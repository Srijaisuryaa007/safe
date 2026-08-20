import { calculateHaversineDistanceMeters } from './LocationSmoothingService';

export interface TripLeg {
  id: string;
  points: any[]; // The raw points (e.g. HistoryPoint) belonging to this leg
  startTimeMs: number;
  endTimeMs: number;
  isOutbound: boolean; // First leg is outbound, subsequent legs alternate or rely on distance to home
  startLat?: number;
  startLng?: number;
  endLat?: number;
  endLng?: number;
}

/**
 * Splits a continuous chronological array of GPS points into separate trip legs
 * whenever the user remains stationary (within a small radius) for longer than the threshold.
 * 
 * @param points Array of location points
 * @param getTimeMs Function to extract timestamp in MS from a point
 * @param getLat Function to extract latitude from a point
 * @param getLng Function to extract longitude from a point
 * @param stopDurationThresholdMins Minimum minutes of stationary time to trigger a split (default: 5)
 * @param stopRadiusMeters Max drift radius during the stationary period to be considered stopped (default: 50m)
 */
export function segmentTripsByStops<T>(
  points: T[],
  getTimeMs: (p: T) => number,
  getLat: (p: T) => number,
  getLng: (p: T) => number,
  stopDurationThresholdMins: number = 5,
  stopRadiusMeters: number = 50
): TripLeg[] {
  if (!points || points.length === 0) return [];

  const legs: TripLeg[] = [];
  let currentLegPoints: T[] = [points[0]];
  
  let potentialStopStartTime = getTimeMs(points[0]);
  let potentialStopAnchorLat = getLat(points[0]);
  let potentialStopAnchorLng = getLng(points[0]);
  
  const thresholdMs = stopDurationThresholdMins * 60 * 1000;

  for (let i = 1; i < points.length; i++) {
    const pt = points[i];
    const timeMs = getTimeMs(pt);
    const lat = getLat(pt);
    const lng = getLng(pt);

    const distFromAnchor = calculateHaversineDistanceMeters(potentialStopAnchorLat, potentialStopAnchorLng, lat, lng);

    if (distFromAnchor > stopRadiusMeters) {
      // User has moved outside the stationary anchor radius.
      // Did they stay inside the anchor long enough to trigger a split?
      const timeAtAnchor = timeMs - potentialStopStartTime;
      
      if (timeAtAnchor >= thresholdMs) {
        // Significant stop detected! Split the trip here.
        if (currentLegPoints.length > 0) {
          const first = currentLegPoints[0];
          const last = currentLegPoints[currentLegPoints.length - 1];
          legs.push({
            id: `leg_${legs.length + 1}`,
            points: [...currentLegPoints],
            startTimeMs: getTimeMs(first),
            endTimeMs: getTimeMs(last),
            isOutbound: legs.length % 2 === 0, // Alternate outbound/return
            startLat: getLat(first),
            startLng: getLng(first),
            endLat: getLat(last),
            endLng: getLng(last),
          });
        }
        // Start a new leg
        currentLegPoints = [];
      }
      
      // Reset the anchor to the new moving position
      potentialStopStartTime = timeMs;
      potentialStopAnchorLat = lat;
      potentialStopAnchorLng = lng;
    }
    
    currentLegPoints.push(pt);
  }

  // Push the final leg
  if (currentLegPoints.length > 0) {
    const first = currentLegPoints[0];
    const last = currentLegPoints[currentLegPoints.length - 1];
    legs.push({
      id: `leg_${legs.length + 1}`,
      points: currentLegPoints,
      startTimeMs: getTimeMs(first),
      endTimeMs: getTimeMs(last),
      isOutbound: legs.length % 2 === 0,
      startLat: getLat(first),
      startLng: getLng(first),
      endLat: getLat(last),
      endLng: getLng(last),
    });
  }

  return legs;
}

/**
 * Calculates the exact cumulative distance in kilometers along a sequence of GPS coordinates.
 */
export function calculateCumulativeRouteDistanceKm<T>(
  points: T[],
  getLat: (p: T) => number,
  getLng: (p: T) => number
): number {
  if (!points || points.length < 2) return 0;

  let totalMeters = 0;
  for (let i = 1; i < points.length; i++) {
    const p1 = points[i - 1];
    const p2 = points[i];
    const d = calculateHaversineDistanceMeters(getLat(p1), getLng(p1), getLat(p2), getLng(p2));
    totalMeters += d;
  }

  return parseFloat((totalMeters / 1000).toFixed(2));
}

export interface TelemetryAnalysisResult {
  distanceKm: number;
  durationMins: number;
  topSpeedKmh: number;
  avgSpeedKmh: number;
  hardBrakes: number;
  rapidAccels: number;
  speedingEvents: number;
  driverScore: number;
  processedPoints: { lat: number; lng: number; speed: number; timeMs: number }[];
}

/**
 * Performs high-precision telemetry analytics on a trip leg sequence.
 */
export function analyzeTripTelemetry<T>(
  points: T[],
  getTimeMs: (p: T) => number,
  getLat: (p: T) => number,
  getLng: (p: T) => number,
  getSpeedKmh?: (p: T) => number
): TelemetryAnalysisResult {
  if (!points || points.length === 0) {
    return {
      distanceKm: 0,
      durationMins: 0,
      topSpeedKmh: 0,
      avgSpeedKmh: 0,
      hardBrakes: 0,
      rapidAccels: 0,
      speedingEvents: 0,
      driverScore: 100,
      processedPoints: [],
    };
  }

  const processedPoints: { lat: number; lng: number; speed: number; timeMs: number }[] = [];
  let totalDistanceMeters = 0;
  let topSpeedKmh = 0;
  let hardBrakes = 0;
  let rapidAccels = 0;
  let speedingEvents = 0;
  let movingSpeedSum = 0;
  let movingSpeedCount = 0;
  let isCurrentlySpeeding = false;

  for (let i = 0; i < points.length; i++) {
    const cur = points[i];
    const curLat = getLat(cur);
    const curLng = getLng(cur);
    const curTime = getTimeMs(cur);

    let speedKmh = getSpeedKmh ? getSpeedKmh(cur) : 0;

    if (i > 0) {
      const prev = points[i - 1];
      const prevLat = getLat(prev);
      const prevLng = getLng(prev);
      const prevTime = getTimeMs(prev);
      const dtSec = Math.max(0.5, (curTime - prevTime) / 1000);

      const stepDistMeters = calculateHaversineDistanceMeters(prevLat, prevLng, curLat, curLng);
      totalDistanceMeters += stepDistMeters;

      // If speed was not provided in history record, infer from distance / time
      if (!speedKmh || speedKmh <= 0) {
        const calculatedMps = stepDistMeters / dtSec;
        speedKmh = Math.round(calculatedMps * 3.6);
      }

      // Check speed deltas for hard braking & rapid acceleration
      const prevSpeedKmh = processedPoints[i - 1]?.speed || 0;
      const speedDeltaKmh = speedKmh - prevSpeedKmh;

      if (dtSec <= 3.5) {
        if (speedDeltaKmh <= -10) {
          // Hard brake: velocity dropped by > 10 km/h in < 3.5s
          hardBrakes++;
        } else if (speedDeltaKmh >= 10) {
          // Rapid acceleration: velocity rose by > 10 km/h in < 3.5s
          rapidAccels++;
        }
      }
    }

    if (speedKmh > topSpeedKmh) {
      topSpeedKmh = speedKmh;
    }

    if (speedKmh > 5) {
      movingSpeedSum += speedKmh;
      movingSpeedCount++;
    }

    if (speedKmh > 80) {
      if (!isCurrentlySpeeding) {
        speedingEvents++;
        isCurrentlySpeeding = true;
      }
    } else {
      isCurrentlySpeeding = false;
    }

    processedPoints.push({
      lat: curLat,
      lng: curLng,
      speed: speedKmh,
      timeMs: curTime,
    });
  }

  const startTime = getTimeMs(points[0]);
  const endTime = getTimeMs(points[points.length - 1]);
  const durationMins = Math.max(1, Math.round((endTime - startTime) / 60000));
  const distanceKm = parseFloat((totalDistanceMeters / 1000).toFixed(1));

  let avgSpeedKmh = movingSpeedCount > 0 
    ? Math.round(movingSpeedSum / movingSpeedCount) 
    : (durationMins > 0 ? Math.round((distanceKm / (durationMins / 60))) : 25);

  if (isNaN(avgSpeedKmh) || avgSpeedKmh <= 0) avgSpeedKmh = 25;

  const scoreDeductions = (hardBrakes * 3) + (rapidAccels * 2) + (speedingEvents * 3);
  const driverScore = Math.max(60, Math.min(100, 100 - scoreDeductions));

  return {
    distanceKm,
    durationMins,
    topSpeedKmh: topSpeedKmh || 30,
    avgSpeedKmh,
    hardBrakes,
    rapidAccels,
    speedingEvents,
    driverScore,
    processedPoints,
  };
}

