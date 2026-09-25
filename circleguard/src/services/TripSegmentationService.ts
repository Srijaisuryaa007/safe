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
    const prevPt = sortedPoints[i - 1];
    const timeMs = getTimeMs(pt);
    const prevTimeMs = getTimeMs(prevPt);
    const lat = getLat(pt);
    const lng = getLng(pt);

    // Skip invalid coordinates
    if (!lat || !lng || isNaN(lat) || isNaN(lng) || lat === 0 || lng === 0) continue;

    const timeSincePrev = timeMs - prevTimeMs;
    const distFromAnchor = calculateHaversineDistanceMeters(potentialStopAnchorLat, potentialStopAnchorLng, lat, lng);

    // Split condition 1: Gap in pings >= thresholdMs (e.g. phone was parked/dormant for 5+ mins)
    // Split condition 2: User moved outside stop anchor after dwelling there >= thresholdMs
    const isPingGapStop = timeSincePrev >= thresholdMs;
    const isAnchorDwellStop = distFromAnchor > stopRadiusMeters && (timeMs - potentialStopStartTime >= thresholdMs);

    if (isPingGapStop || isAnchorDwellStop) {
      // Significant stop detected! Split the trip here so dwell time is not added to the leg.
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
      } else if (currentLegPoints.length === 1 && legs.length > 0) {
        // Preserve transit/underground station entry fix by appending to the preceding leg
        legs[legs.length - 1].points.push(currentLegPoints[0]);
        legs[legs.length - 1].endTimeMs = getTimeMs(currentLegPoints[0]);
        legs[legs.length - 1].endLat = getLat(currentLegPoints[0]);
        legs[legs.length - 1].endLng = getLng(currentLegPoints[0]);
      }
      currentLegPoints = [];
      potentialStopStartTime = timeMs;
      potentialStopAnchorLat = lat;
      potentialStopAnchorLng = lng;
    } else if (distFromAnchor > stopRadiusMeters) {
      // Moved within the leg - update stop anchor
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
  } else if (currentLegPoints.length === 1) {
    if (legs.length > 0) {
      legs[legs.length - 1].points.push(currentLegPoints[0]);
      legs[legs.length - 1].endTimeMs = getTimeMs(currentLegPoints[0]);
      legs[legs.length - 1].endLat = getLat(currentLegPoints[0]);
      legs[legs.length - 1].endLng = getLng(currentLegPoints[0]);
    } else {
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
      driverScore: 0,
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

      const impliedSpeedKmh = (stepDistMeters / dtSec) * 3.6;

      // Jitter & Teleport Filter: skip impossible speeds (> 125 km/h in under 4 seconds)
      if (dtSec < 4 && impliedSpeedKmh > 125) {
        continue; // ignore spurious multipath jump
      }

      // Genuine Movement Filter: Accumulate movement if moved >= 4m or moving >= 1.8 km/h
      if (stepDistMeters >= 4 && (speedKmh >= 1.8 || impliedSpeedKmh >= 1.8)) {
        // Curve compensation: straight lines between GPS pings undercount street curves
        const curveFactor = dtSec >= 12 ? 1.06 : 1.0;
        totalDistanceMeters += (stepDistMeters * curveFactor);
      }

      if (!speedKmh || speedKmh <= 0) {
        // Smooth infer speed with kinematic acceleration cap (max 9 km/h/s change from prev)
        const maxPhysicalSpeed = Math.min(115, (prev.speed > 0 ? prev.speed : 30) + (9 * dtSec));
        speedKmh = impliedSpeedKmh < 1.8 ? 0 : Math.min(maxPhysicalSpeed, Math.round(impliedSpeedKmh));
      }
    }

    // Cap realistic vehicular speeds (prevent unverified speed spikes)
    speedKmh = Math.min(115, Math.max(0, Math.round(speedKmh)));

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
      driverScore: 0,
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

  // 3-Point Rolling Median Filter on speeds:
  // Eliminates single-ping GPS glitches (e.g., [50, 140, 55] -> 55) while strictly preserving genuine sustained driving speed
  const filteredSpeeds: number[] = [];
  for (let i = 0; i < rawProcessed.length; i++) {
    const prevSpd = i > 0 ? rawProcessed[i - 1].speed : rawProcessed[i].speed;
    const curSpd = rawProcessed[i].speed;
    const nextSpd = i < rawProcessed.length - 1 ? rawProcessed[i + 1].speed : rawProcessed[i].speed;
    const sorted = [prevSpd, curSpd, nextSpd].sort((a, b) => a - b);
    filteredSpeeds.push(sorted[1]);
  }

  let hardBrakes = 0;
  let rapidAccels = 0;
  let speedingEvents = 0;
  let movingSpeedSum = 0;
  let movingSpeedCount = 0;
  let isCurrentlySpeeding = false;

  for (let i = 0; i < rawProcessed.length; i++) {
    const smoothSpd = filteredSpeeds[i];
    rawProcessed[i].speed = smoothSpd; // update to smoothed speed

    if (smoothSpd >= 3) {
      movingSpeedSum += smoothSpd;
      movingSpeedCount++;
    }

    // Verify acceleration across 2 consecutive points to eliminate single-fix GPS noise
    if (i >= 1) {
      const prev = rawProcessed[i - 1];
      const dtSec = Math.max(0.8, (rawProcessed[i].timeMs - prev.timeMs) / 1000);
      
      if (dtSec >= 1.0 && dtSec <= 8.0) {
        const accelKmhPerSec = (smoothSpd - prev.speed) / dtSec;

        // Hard brake: initial vehicular speed >= 25 km/h and deceleration <= -13.5 km/h/s (~ -0.38g)
        if (prev.speed >= 25 && accelKmhPerSec <= -13.5) {
          const isPersistentBrake = i === rawProcessed.length - 1 || rawProcessed[i + 1].speed <= smoothSpd + 8;
          if (isPersistentBrake) {
            hardBrakes++;
          }
        } 
        // Rapid acceleration: initial vehicular speed >= 12 km/h and acceleration >= +13.0 km/h/s (~ +0.37g)
        else if (accelKmhPerSec >= 13.0 && smoothSpd >= 25) {
          rapidAccels++;
        }
      }
    }

    // Speeding: sustained velocity > 85 km/h (episode-based detection)
    if (smoothSpd > 85) {
      if (!isCurrentlySpeeding) {
        speedingEvents++;
        isCurrentlySpeeding = true;
      }
    } else if (smoothSpd < 78) {
      isCurrentlySpeeding = false;
    }
  }

  // Top speed: Highest sustained moving speed (already de-glitched by the 3-point rolling median filter)
  const movingSpeeds = filteredSpeeds.filter(s => s >= 5).sort((a, b) => a - b);
  let maxObservedSpeed = 0;
  if (movingSpeeds.length > 0) {
    maxObservedSpeed = movingSpeeds[movingSpeeds.length - 1];
  }

  const startTime = rawProcessed[0].timeMs;
  const endTime = rawProcessed[rawProcessed.length - 1].timeMs;
  const rawDurationMins = Math.max(1, Math.round((endTime - startTime) / 60000));

  // Calculate genuine in-transit driving duration by summing active moving segments
  let activeDriveDurationSec = 0;
  for (let i = 1; i < rawProcessed.length; i++) {
    const prev = rawProcessed[i - 1];
    const cur = rawProcessed[i];
    const dtSec = Math.max(0, (cur.timeMs - prev.timeMs) / 1000);
    const dDistM = calculateHaversineDistanceMeters(prev.lat, prev.lng, cur.lat, cur.lng);

    // If point represents motion or normal traffic/traffic-light waiting:
    const isMoving = cur.speed >= 1.8 || prev.speed >= 1.8 || dDistM >= 15;
    if (isMoving) {
      // Normal driving interval or short red light (cap at 180s = 3 mins to eliminate parked dwell gaps)
      activeDriveDurationSec += Math.min(180, Math.max(1, dtSec));
    } else if (dtSec <= 90) {
      // Brief traffic pause (under 90s)
      activeDriveDurationSec += dtSec;
    }
  }

  const activeDurationMins = Math.max(1, Math.round(activeDriveDurationSec / 60));
  // Use active in-transit driving duration (strictly excluding parked dwell time)
  const durationMins = (activeDurationMins >= 1 && activeDurationMins <= rawDurationMins)
    ? activeDurationMins
    : rawDurationMins;
  const distanceKm = parseFloat((totalDistanceMeters / 1000).toFixed(1));

  // Genuine Moving Average Speed: Distance (km) / Active Transit (hours)
  let avgSpeedKmh = 0;
  if (distanceKm > 0 && durationMins > 0) {
    avgSpeedKmh = Math.round(distanceKm / (durationMins / 60));
  } else if (movingSpeedCount > 0) {
    avgSpeedKmh = Math.round(movingSpeedSum / movingSpeedCount);
  }

  if (maxObservedSpeed > 0 && avgSpeedKmh > maxObservedSpeed) {
    avgSpeedKmh = maxObservedSpeed;
  }
  if (isNaN(avgSpeedKmh)) avgSpeedKmh = 0;

  // Normalized Driver Safety Score (0-100):
  // Baseline 100, fair rate-weighted penalty per 10km driven
  const effectiveDistance = Math.max(1.0, distanceKm);
  const eventDeduction = ((hardBrakes * 3) + (rapidAccels * 2) + (speedingEvents * 4)) / Math.max(1, effectiveDistance / 10);
  const driverScore = Math.max(65, Math.min(100, Math.round(100 - eventDeduction)));

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

/**
 * Enhanced vehicular trip classifier:
 * Accurately detects city drives, neighborhood trips, and highway journeys
 * while rejecting stationary noise and slow pedestrian walks.
 */
export function isVehicularTrip(analysis: TelemetryAnalysisResult): boolean {
  // A vehicular drive is confirmed if:
  // 1. Distance >= 0.2 km AND top speed >= 16 km/h (captures neighborhood drives & traffic)
  // 2. OR distance >= 0.4 km AND avg moving speed >= 11 km/h
  // 3. OR top speed >= 25 km/h (clear vehicular speed)
  return (analysis.distanceKm >= 0.2 && analysis.topSpeedKmh >= 16) ||
         (analysis.distanceKm >= 0.4 && analysis.avgSpeedKmh >= 11) ||
         (analysis.topSpeedKmh >= 25 && analysis.distanceKm >= 0.15);
}

