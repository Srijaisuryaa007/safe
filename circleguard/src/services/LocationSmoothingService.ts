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
    const maxAllowedAcc = speedMps > 10 ? 45 : 35;

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

