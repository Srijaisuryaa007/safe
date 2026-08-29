import { calculateHaversineDistanceMeters } from './LocationSmoothingService';
import { calculateBearing, getCardinalDirection } from './RoadRoutingService';

export interface TripLeg {
  id: string;
  points: any[]; // The raw points (e.g. HistoryPoint) belonging to this leg
  startTimeMs: number;
  endTimeMs: number;
  isOutbound: boolean;
  bearing: number;
  cardinalDirection: string;
  startLat: number;
  startLng: number;
  endLat: number;
  endLng: number;
}

/**
 * Splits a continuous chronological array of GPS points into separate trip legs
 * whenever the user remains stationary (within a small radius) for longer than the threshold.
 * 
 * @param points Array of location points
 * @param getTimeMs Function to extract timestamp in MS from a point
 * @param getLat Function to extract latitude from a point
 * @param getLng Function to extract longitude from a point
 * @param stopDurationThresholdMins Minimum minutes of stationary time to trigger a split (default: 4)
 * @param stopRadiusMeters Max drift radius during the stationary period to be considered stopped (default: 60m)
 */
export function segmentTripsByStops<T>(
  points: T[],
  getTimeMs: (p: T) => number,
  getLat: (p: T) => number,
  getLng: (p: T) => number,
  stopDurationThresholdMins: number = 4,
  stopRadiusMeters: number = 60
): TripLeg[] {
  if (!points || points.length === 0) return [];

  // 1. Sort chronologically to guarantee correct travel direction
  const sortedPoints = [...points].sort((a, b) => getTimeMs(a) - getTimeMs(b));

  const legs: TripLeg[] = [];
  let currentLegPoints: T[] = [sortedPoints[0]];
  
  let potentialStopStartTime = getTimeMs(sortedPoints[0]);
  let potentialStopAnchorLat = getLat(sortedPoints[0]);
  let potentialStopAnchorLng = getLng(sortedPoints[0]);
  
  const thresholdMs = stopDurationThresholdMins * 60 * 1000;

  for (let i = 1; i < sortedPoints.length; i++) {
    const pt = sortedPoints[i];
    const timeMs = getTimeMs(pt);
    const lat = getLat(pt);
    const lng = getLng(pt);

    // Skip invalid coordinates
    if (!lat || !lng || isNaN(lat) || isNaN(lng) || lat === 0 || lng === 0) continue;

    const distFromAnchor = calculateHaversineDistanceMeters(potentialStopAnchorLat, potentialStopAnchorLng, lat, lng);

    if (distFromAnchor > stopRadiusMeters) {
      const timeAtAnchor = timeMs - potentialStopStartTime;
      
      if (timeAtAnchor >= thresholdMs) {
        // Significant stop detected! Split the trip here.
        if (currentLegPoints.length >= 2) {
          const first = currentLegPoints[0];
          const last = currentLegPoints[currentLegPoints.length - 1];
          const sLat = getLat(first);
          const sLng = getLng(first);
          const eLat = getLat(last);
          const eLng = getLng(last);

          const bearing = calculateBearing(sLat, sLng, eLat, eLng);
          const cardDir = getCardinalDirection(bearing);

          legs.push({
            id: `leg_${legs.length + 1}`,
            points: [...currentLegPoints],
            startTimeMs: getTimeMs(first),
            endTimeMs: getTimeMs(last),
            isOutbound: legs.length % 2 === 0,
            bearing,
            cardinalDirection: cardDir,
            startLat: sLat,
            startLng: sLng,
            endLat: eLat,
            endLng: eLng,
          });
        }
        currentLegPoints = [];
      }
      
      potentialStopStartTime = timeMs;
      potentialStopAnchorLat = lat;
      potentialStopAnchorLng = lng;
    }
    
    currentLegPoints.push(pt);
  }

  // Push final leg
  if (currentLegPoints.length >= 2) {
    const first = currentLegPoints[0];
    const last = currentLegPoints[currentLegPoints.length - 1];
    const sLat = getLat(first);
    const sLng = getLng(first);
    const eLat = getLat(last);
    const eLng = getLng(last);

    const bearing = calculateBearing(sLat, sLng, eLat, eLng);
    const cardDir = getCardinalDirection(bearing);

    legs.push({
      id: `leg_${legs.length + 1}`,
      points: currentLegPoints,
      startTimeMs: getTimeMs(first),
      endTimeMs: getTimeMs(last),
      isOutbound: legs.length % 2 === 0,
      bearing,
      cardinalDirection: cardDir,
      startLat: sLat,
      startLng: sLng,
      endLat: eLat,
      endLng: eLng,
    });
  } else if (currentLegPoints.length === 1 && legs.length === 0) {
    // Single point fallback
    const single = currentLegPoints[0];
    const sLat = getLat(single);
    const sLng = getLng(single);
    legs.push({
      id: 'leg_1',
      points: currentLegPoints,
      startTimeMs: getTimeMs(single),
      endTimeMs: getTimeMs(single),
      isOutbound: true,
      bearing: 0,
      cardinalDirection: 'N',
      startLat: sLat,
      startLng: sLng,
      endLat: sLat,
      endLng: sLng,
    });
  }

  return legs;
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
  cardinalDirection: string;
  bearingDegrees: number;
  processedPoints: { lat: number; lng: number; speed: number; timeMs: number }[];
}

/**
 * Performs high-precision telemetry analytics on a trip leg sequence with anti-jitter filters.
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
      cardinalDirection: 'N',
      bearingDegrees: 0,
      processedPoints: [],
    };
  }

  const rawProcessed: { lat: number; lng: number; speed: number; timeMs: number }[] = [];
  let totalDistanceMeters = 0;

  for (let i = 0; i < points.length; i++) {
    const cur = points[i];
    const curLat = getLat(cur);
    const curLng = getLng(cur);
    const curTime = getTimeMs(cur);

    if (!curLat || !curLng || isNaN(curLat) || isNaN(curLng) || curLat === 0 || curLng === 0) continue;

    let speedKmh = getSpeedKmh ? getSpeedKmh(cur) : 0;

    if (i > 0 && rawProcessed.length > 0) {
      const prev = rawProcessed[rawProcessed.length - 1];
      const dtSec = Math.max(0.5, (curTime - prev.timeMs) / 1000);
      const stepDistMeters = calculateHaversineDistanceMeters(prev.lat, prev.lng, curLat, curLng);

      // GPS Jitter filter: skip impossible teleports (> 160 km/h in very short intervals)
      const impliedSpeedKmh = (stepDistMeters / dtSec) * 3.6;
      if (dtSec < 3 && impliedSpeedKmh > 160) {
        continue; // ignore spurious multipath jump
      }

      totalDistanceMeters += stepDistMeters;

      if (!speedKmh || speedKmh <= 0) {
        // Smooth infer speed with speed cap
        speedKmh = Math.min(130, Math.round(impliedSpeedKmh));
      }
    }

    // Cap realistic vehicular speeds
    speedKmh = Math.min(140, Math.max(0, Math.round(speedKmh)));

    rawProcessed.push({
      lat: curLat,
      lng: curLng,
      speed: speedKmh,
      timeMs: curTime,
    });
  }

  if (rawProcessed.length === 0) {
    return {
      distanceKm: 0,
      durationMins: 0,
      topSpeedKmh: 0,
      avgSpeedKmh: 0,
      hardBrakes: 0,
      rapidAccels: 0,
      speedingEvents: 0,
      driverScore: 100,
      cardinalDirection: 'N',
      bearingDegrees: 0,
      processedPoints: [],
    };
  }

  // Direction calculation from start to end
  const firstPt = rawProcessed[0];
  const lastPt = rawProcessed[rawProcessed.length - 1];
  const bearing = calculateBearing(firstPt.lat, firstPt.lng, lastPt.lat, lastPt.lng);
  const cardDir = getCardinalDirection(bearing);

  // Analyze events
  let hardBrakes = 0;
  let rapidAccels = 0;
  let speedingEvents = 0;
  let movingSpeedSum = 0;
  let movingSpeedCount = 0;
  let maxObservedSpeed = 0;
  let isCurrentlySpeeding = false;

  for (let i = 0; i < rawProcessed.length; i++) {
    const cur = rawProcessed[i];

    if (cur.speed > maxObservedSpeed) {
      maxObservedSpeed = cur.speed;
    }

    if (cur.speed >= 4) {
      movingSpeedSum += cur.speed;
      movingSpeedCount++;
    }

    if (i > 0) {
      const prev = rawProcessed[i - 1];
      const dtSec = Math.max(0.5, (cur.timeMs - prev.timeMs) / 1000);
      const accelKmhPerSec = (cur.speed - prev.speed) / dtSec;

      // Realistic vehicular thresholds
      if (accelKmhPerSec <= -12) {
        hardBrakes++;
      } else if (accelKmhPerSec >= 11) {
        rapidAccels++;
      }
    }

    if (cur.speed > 80) {
      if (!isCurrentlySpeeding) {
        speedingEvents++;
        isCurrentlySpeeding = true;
      }
    } else {
      isCurrentlySpeeding = false;
    }
  }

  const startTime = rawProcessed[0].timeMs;
  const endTime = rawProcessed[rawProcessed.length - 1].timeMs;
  const rawDurationMins = Math.round((endTime - startTime) / 60000);
  const durationMins = Math.max(1, rawDurationMins);
  const distanceKm = parseFloat((totalDistanceMeters / 1000).toFixed(1));

  let avgSpeedKmh = movingSpeedCount > 0 
    ? Math.round(movingSpeedSum / movingSpeedCount) 
    : (distanceKm > 0 && durationMins > 0 ? Math.round((distanceKm / (durationMins / 60))) : 0);

  if (isNaN(avgSpeedKmh)) avgSpeedKmh = 0;

  // Cap safety deductions
  const scoreDeductions = (hardBrakes * 4) + (rapidAccels * 2.5) + (speedingEvents * 3.5);
  const driverScore = Math.max(50, Math.min(100, Math.round(100 - scoreDeductions)));

  return {
    distanceKm,
    durationMins,
    topSpeedKmh: maxObservedSpeed,
    avgSpeedKmh,
    hardBrakes,
    rapidAccels,
    speedingEvents,
    driverScore,
    cardinalDirection: cardDir,
    bearingDegrees: Math.round(bearing),
    processedPoints: rawProcessed,
  };
}
