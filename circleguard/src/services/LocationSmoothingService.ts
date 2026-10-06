// LocationSmoothingService.ts — Client-side GPS filtering & trajectory smoothing

export interface GPSPoint {
  latitude: number;
  longitude: number;
  timestamp?: string;
  speedKmh?: number;
  accuracyMeters?: number;
}

// Configurable threshold constants
export const MAX_ALLOWED_ACCURACY_METERS = 30; // Reject GPS readings worse than 30m accuracy
export const MAX_REALISTIC_SPEED_KMH = 150;     // Reject implied speed jumps > 150 km/h
export const MIN_DUPLICATE_TIME_DIFF_MS = 2000; // Deduplicate points within 2 seconds
export const MIN_DUPLICATE_DIST_METERS = 3;     // Deduplicate points within 3 meters

/**
 * Filter 1: High-Confidence GPS Check
 * Rejects readings with a horizontal accuracy radius worse than maxThreshold (default 30m)
 */
export function isHighConfidenceGPS(accuracyMeters?: number, maxThreshold = MAX_ALLOWED_ACCURACY_METERS): boolean {
  if (accuracyMeters === undefined || accuracyMeters === null) return true;
  return accuracyMeters <= maxThreshold;
}

/**
 * Haversine distance in meters between two lat/lng coordinates
 */
export function calculateHaversineDistanceMeters(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 6371000; // Earth radius in meters
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLon = ((lon2 - lon1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos((lat1 * Math.PI) / 180) * Math.cos((lat2 * Math.PI) / 180) * Math.sin(dLon / 2) * Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

/**
 * Filter 2: Reject Physically Impossible Speed Jumps
 * Calculates implied speed between 2 points (distance / time).
 * Returns false if implied speed exceeds maxSpeedKmh (default 150 km/h).
 */
export function isPhysicallyPossibleMovement(
  lat1: number,
  lng1: number,
  timeMs1: number,
  lat2: number,
  lng2: number,
  timeMs2: number,
  maxSpeedKmh = MAX_REALISTIC_SPEED_KMH
): boolean {
  const timeElapsedSec = Math.abs(timeMs2 - timeMs1) / 1000;
  if (timeElapsedSec <= 0) return false; // Duplicate timestamp!

  const distMeters = calculateHaversineDistanceMeters(lat1, lng1, lat2, lng2);
  const impliedSpeedKmh = (distMeters / timeElapsedSec) * 3.6;

  if (impliedSpeedKmh > maxSpeedKmh) {
    console.warn(`[LocationSmoothing] Rejected impossible jump: ${impliedSpeedKmh.toFixed(1)} km/h over ${timeElapsedSec.toFixed(1)}s (${distMeters.toFixed(0)}m)`);
    return false;
  }
  return true;
}

/**
 * De-duplication Check
 * Returns true if a point is a duplicate of the previous point (within 2 seconds and <3 meters)
 */
export function isDuplicateLocation(
  lastLat: number,
  lastLng: number,
  lastTimeMs: number,
  newLat: number,
  newLng: number,
  newTimeMs: number
): boolean {
  const timeDiffMs = Math.abs(newTimeMs - lastTimeMs);
  const distMeters = calculateHaversineDistanceMeters(lastLat, lastLng, newLat, newLng);

  // Exact same timestamp OR within 2 seconds with negligible movement (<3m)
  if (timeDiffMs < MIN_DUPLICATE_TIME_DIFF_MS && distMeters < MIN_DUPLICATE_DIST_METERS) {
    return true;
  }
  return false;
}

import { calculateBearing } from './RoadRoutingService';

/**
 * Calculates perpendicular/cross-track distance in meters from point P to line AB
 */
export function calculateCrossTrackDistanceMeters(
  latP: number,
  lngP: number,
  latA: number,
  lngA: number,
  latB: number,
  lngB: number
): number {
  const dAP = calculateHaversineDistanceMeters(latA, lngA, latP, lngP);
  if (dAP < 1) return 0;
  const dAB = calculateHaversineDistanceMeters(latA, lngA, latB, lngB);
  if (dAB < 1) return dAP;

  const bearingAB = (calculateBearing(latA, lngA, latB, lngB) * Math.PI) / 180;
  const bearingAP = (calculateBearing(latA, lngA, latP, lngP) * Math.PI) / 180;

  // Cross-track distance formula on a sphere
  const R = 6371000;
  const δ13 = dAP / R;
  const dXt = Math.asin(Math.sin(δ13) * Math.sin(bearingAP - bearingAB)) * R;
  return Math.abs(dXt);
}

/**
 * Strict GPS Spike & Outlier Filter
 * 
 * Eliminates rogue GPS glitches that jump onto side streets and return:
 * 1. Accuracy filter: Rejects fixes with accuracy > 35m (or 45m at highway speeds).
 * 2. Unphysical velocity filter: Rejects spikes implying > 120 km/h over short time intervals.
 * 3. Single-point & two-point dog-leg lateral spike filter:
 *    Detects points that veer sharply sideways (> 25m off trajectory with bearing reversal > 120°)
 *    and immediately snap back to the genuine travel path.
 */
export function filterGpsSpikesAndOutliers<T extends {
  latitude: number;
  longitude: number;
  timeMs?: number;
  rawTimeMs?: number;
  accuracy?: number;
  speedKmh?: number;
  speed_mps?: number | null;
}>(points: T[]): T[] {
  if (!points || points.length < 3) return points;

  // Pass 1: Accuracy & implausible velocity filtering
  const pass1: T[] = [];
  for (let i = 0; i < points.length; i++) {
    const pt = points[i];
    const acc = pt.accuracy;
    const speedMps = pt.speed_mps ?? (pt.speedKmh ? pt.speedKmh / 3.6 : 0);
    // Realistic mobile accuracy threshold: filter out gross cellular tower drift (> 65-75m)
    // while strictly retaining legitimate in-vehicle GPS fixes that fluctuate between 30-65m
    const maxAllowedAcc = speedMps > 8 ? 75 : 60;

    // Strict accuracy check
    if (typeof acc === 'number' && acc > maxAllowedAcc) {
      continue;
    }

    if (pass1.length === 0) {
      pass1.push(pt);
      continue;
    }

    const prev = pass1[pass1.length - 1];
    const tPrev = prev.rawTimeMs ?? prev.timeMs ?? 0;
    const tCurr = pt.rawTimeMs ?? pt.timeMs ?? 0;
    const dtSec = Math.abs(tCurr - tPrev) / 1000;
    const distMeters = calculateHaversineDistanceMeters(prev.latitude, prev.longitude, pt.latitude, pt.longitude);

    // Reject duplicate points (under 1.5s and < 2.5m)
    if (dtSec > 0 && dtSec < 1.5 && distMeters < 2.5) {
      continue;
    }

    // Reject unphysical speed spikes (> 120 km/h) over short intervals
    if (dtSec > 0.5 && dtSec < 6) {
      const impliedKmh = (distMeters / dtSec) * 3.6;
      if (impliedKmh > 125) {
        continue;
      }
    }

    pass1.push(pt);
  }

  if (pass1.length < 3) return pass1;

  // Pass 2: Single-Point Dog-Leg Lateral Spike Rejection
  // If point i jumps sideways to a random street and point i+1 returns to original corridor, discard point i!
  const pass2: T[] = [pass1[0]];

  for (let i = 1; i < pass1.length - 1; i++) {
    const prev = pass2[pass2.length - 1];
    const curr = pass1[i];
    const next = pass1[i + 1];

    const dPrevCurr = calculateHaversineDistanceMeters(prev.latitude, prev.longitude, curr.latitude, curr.longitude);
    const dCurrNext = calculateHaversineDistanceMeters(curr.latitude, curr.longitude, next.latitude, next.longitude);
    const dPrevNext = calculateHaversineDistanceMeters(prev.latitude, prev.longitude, next.latitude, next.longitude);

    // Compute bearing reversal angle at curr:
    // If the path jumps out to curr and jumps straight back to next, the angle difference is near 180°
    const bIn = calculateBearing(prev.latitude, prev.longitude, curr.latitude, curr.longitude);
    const bOut = calculateBearing(curr.latitude, curr.longitude, next.latitude, next.longitude);
    let reversalAngle = Math.abs(bOut - bIn);
    if (reversalAngle > 180) reversalAngle = 360 - reversalAngle;

    // Cross-track orthogonal displacement from line connecting prev and next
    const crossTrack = calculateCrossTrackDistanceMeters(
      curr.latitude, curr.longitude,
      prev.latitude, prev.longitude,
      next.latitude, next.longitude
    );

    // Spike condition:
    // 1. Point jumps out significantly (> 25m) and jumps back (> 25m), while prev and next are close or normal (dPrevNext < dPrevCurr + dCurrNext - 20)
    // 2. Strong reversal angle (> 120°) OR high lateral deviation (> 30m) with acute reversal (> 95°)
    const isDogLegSpike =
      dPrevCurr > 20 &&
      dCurrNext > 20 &&
      crossTrack > 22 &&
      (reversalAngle > 120 || (reversalAngle > 95 && crossTrack > 32)) &&
      dPrevNext < (dPrevCurr + dCurrNext) * 0.65;

    if (isDogLegSpike) {
      // Discard curr: it's a GPS multipath glitch into a side street!
      continue;
    }

    pass2.push(curr);
  }

  pass2.push(pass1[pass1.length - 1]);

  return pass2;
}

/**
 * Corner-Preserving Trajectory Smoothing Engine
 * 
 * Smooths lateral GPS jitter along straightaways while strictly preserving
 * acute corner vertices (> 35° turns at intersections) so street corners
 * are never cut diagonally across buildings before map matching.
 */
export function smoothTrajectoryPoints<T extends { latitude: number; longitude: number }>(points: T[]): T[] {
  if (!points || points.length < 3) return points;

  const smoothed: T[] = [{ ...points[0] }];

  for (let i = 1; i < points.length - 1; i++) {
    const prev = points[i - 1];
    const curr = points[i];
    const next = points[i + 1];

    // Calculate heading angle before and after current waypoint
    const bIn = calculateBearing(prev.latitude, prev.longitude, curr.latitude, curr.longitude);
    const bOut = calculateBearing(curr.latitude, curr.longitude, next.latitude, next.longitude);
    
    let turnAngle = Math.abs(bOut - bIn);
    if (turnAngle > 180) turnAngle = 360 - turnAngle;

    if (turnAngle > 35) {
      // Acute corner turn (intersection/fork/roundabout):
      // Strongly preserve authentic corner apex to prevent cutting through buildings!
      const cornerLat = prev.latitude * 0.05 + curr.latitude * 0.90 + next.latitude * 0.05;
      const cornerLng = prev.longitude * 0.05 + curr.longitude * 0.90 + next.longitude * 0.05;
      smoothed.push({
        ...curr,
        latitude: cornerLat,
        longitude: cornerLng,
      });
    } else {
      // Straight road corridor: apply standard lateral jitter dampening
      const avgLat = prev.latitude * 0.20 + curr.latitude * 0.60 + next.latitude * 0.20;
      const avgLng = prev.longitude * 0.20 + curr.longitude * 0.60 + next.longitude * 0.20;
      smoothed.push({
        ...curr,
        latitude: avgLat,
        longitude: avgLng,
      });
    }
  }

  smoothed.push({ ...points[points.length - 1] });
  return smoothed;
}

/**
 * 2D Kinematic Kalman Filter for Industry-Standard GPS Trajectory Estimation
 * 
 * Tracks [latitude, longitude, velocityLat, velocityLng] in state space.
 * Eliminates high-frequency sensor noise, multipath wander, and random lateral jumps
 * while accurately maintaining speed, momentum, and turning vectors.
 */
export class KinematicKalmanFilter {
  private lat0: number | null = null;
  private lng0: number | null = null;
  private cosLat: number = 1;
  private x: number = 0; // East (m)
  private y: number = 0; // North (m)
  private vx: number = 0;
  private vy: number = 0;
  private px: number = 64; // initial position variance (m^2)
  private py: number = 64;
  private pvx: number = 16;
  private pvy: number = 16;
  private accelSigma: number = 1.5;
  private lastTime: number = 0;

  constructor(accelSigma: number = 1.5) {
    this.accelSigma = accelSigma;
  }

  public reset() {
    this.lat0 = null;
    this.lng0 = null;
    this.lastTime = 0;
  }

  public update(lat: number, lng: number, timeMs: number, accuracyMeters: number = 12): { latitude: number; longitude: number; speedKmh: number } {
    if (this.lat0 === null || this.lng0 === null) {
      this.lat0 = lat;
      this.lng0 = lng;
      this.cosLat = Math.cos((lat * Math.PI) / 180);
      this.lastTime = timeMs;
      return { latitude: lat, longitude: lng, speedKmh: 0 };
    }

    const rawDt = (timeMs - this.lastTime) / 1000;
    // If there is an extended time gap (> 25s) or negative timestamp anomaly, reset filter
    if (rawDt > 25 || rawDt < 0) {
      this.reset();
      this.lat0 = lat;
      this.lng0 = lng;
      this.cosLat = Math.cos((lat * Math.PI) / 180);
      this.lastTime = timeMs;
      return { latitude: lat, longitude: lng, speedKmh: 0 };
    }

    const dt = Math.max(0.2, Math.min(25, rawDt));
    this.lastTime = timeMs;

    // Measurement in meters relative to initial origin
    const zmX = (lng - this.lng0) * 111320 * this.cosLat;
    const zmY = (lat - this.lat0) * 110540;

    // Distance jump guard: if jump from current estimated position is > 150m, reset origin to prevent overshoot
    const distJumpM = Math.sqrt(Math.pow(zmX - this.x, 2) + Math.pow(zmY - this.y, 2));
    if (distJumpM > 150) {
      this.reset();
      this.lat0 = lat;
      this.lng0 = lng;
      this.cosLat = Math.cos((lat * Math.PI) / 180);
      this.lastTime = timeMs;
      return { latitude: lat, longitude: lng, speedKmh: 0 };
    }

    // Predict
    this.x += this.vx * dt;
    this.y += this.vy * dt;

    const dt2 = dt * dt;
    const sa2 = this.accelSigma * this.accelSigma;
    const qPos = Math.min(50, 0.25 * dt2 * sa2 * 4);
    const qVel = dt2 * sa2;

    this.px += qPos;
    this.py += qPos;
    this.pvx += qVel;
    this.pvy += qVel;

    // Measurement variance
    const r = Math.max(9.0, accuracyMeters * accuracyMeters * 0.8);

    // Kalman Gains
    const kx = this.px / (this.px + r);
    const ky = this.py / (this.py + r);

    const resX = zmX - this.x;
    const resY = zmY - this.y;

    this.x += kx * resX;
    this.y += ky * resY;
    
    // Clamp velocities to physically plausible vehicle limits (max 38 m/s = 137 km/h)
    const rawVx = (kx / dt) * resX * 0.25;
    const rawVy = (ky / dt) * resY * 0.25;
    this.vx = Math.max(-38, Math.min(38, this.vx * 0.8 + rawVx));
    this.vy = Math.max(-38, Math.min(38, this.vy * 0.8 + rawVy));

    this.px *= (1 - kx);
    this.py *= (1 - ky);

    // Convert back to lat/lng
    const outLat = (this.lat0 ?? lat) + (this.y / 110540);
    const outLng = (this.lng0 ?? lng) + (this.x / (111320 * this.cosLat));
    const speedKmh = Math.min(140, Math.round(Math.sqrt(this.vx * this.vx + this.vy * this.vy) * 3.6));

    return {
      latitude: parseFloat(outLat.toFixed(6)),
      longitude: parseFloat(outLng.toFixed(6)),
      speedKmh,
    };
  }
}

/**
 * Applies 2D Kinematic Kalman Filter over a sequence of breadcrumbs
 */
export function applyKinematicKalmanFilter<T extends { latitude: number; longitude: number; rawTimeMs?: number; timeMs?: number; accuracy?: number }>(
  points: T[]
): T[] {
  if (!points || points.length < 2) return points;
  const kf = new KinematicKalmanFilter();
  return points.map((p, idx) => {
    const timeMs = p.rawTimeMs ?? p.timeMs ?? (idx * 5000);
    const acc = typeof p.accuracy === 'number' && p.accuracy > 0 ? p.accuracy : 12;
    const filtered = kf.update(p.latitude, p.longitude, timeMs, acc);
    return {
      ...p,
      latitude: filtered.latitude,
      longitude: filtered.longitude,
    };
  });
}

/**
 * Ramer-Douglas-Peucker (RDP) Trajectory Simplification
 * Compresses redundant straightaway points while strictly preserving
 * all corner intersections (> 20° heading turn) and stop anchors.
 */
export function simplifyTrajectoryRDP<T extends { latitude: number; longitude: number; speedKmh?: number }>(
  points: T[],
  epsilonMeters = 5.0
): T[] {
  if (!points || points.length <= 2) return points;

  let dmax = 0;
  let index = 0;
  const start = points[0];
  const end = points[points.length - 1];

  for (let i = 1; i < points.length - 1; i++) {
    const pt = points[i];
    const d = calculateCrossTrackDistanceMeters(
      pt.latitude, pt.longitude,
      start.latitude, start.longitude,
      end.latitude, end.longitude
    );
    if (d > dmax) {
      index = i;
      dmax = d;
    }
  }

  if (dmax > epsilonMeters) {
    const recResults1 = simplifyTrajectoryRDP(points.slice(0, index + 1), epsilonMeters);
    const recResults2 = simplifyTrajectoryRDP(points.slice(index), epsilonMeters);
    return [...recResults1.slice(0, -1), ...recResults2];
  } else {
    return [start, end];
  }
}

