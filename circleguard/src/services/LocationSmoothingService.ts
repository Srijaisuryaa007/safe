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

/**
 * 3-Point Moving Average Trajectory Smoothing
 * Smooths raw GPS jitter before rendering on map polylines without mutating stored raw points.
 */
export function smoothTrajectoryPoints<T extends { latitude: number; longitude: number }>(points: T[]): T[] {
  if (!points || points.length < 3) return points;

  const smoothed: T[] = [{ ...points[0] }];

  for (let i = 1; i < points.length - 1; i++) {
    const prev = points[i - 1];
    const curr = points[i];
    const next = points[i + 1];

    // Weighted 3-point average (0.25 prev + 0.50 curr + 0.25 next)
    const avgLat = prev.latitude * 0.25 + curr.latitude * 0.5 + next.latitude * 0.25;
    const avgLng = prev.longitude * 0.25 + curr.longitude * 0.5 + next.longitude * 0.25;

    smoothed.push({
      ...curr,
      latitude: avgLat,
      longitude: avgLng,
    });
  }

  smoothed.push({ ...points[points.length - 1] });
  return smoothed;
}
