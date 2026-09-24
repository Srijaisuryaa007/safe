/**
 * EnterpriseLocationHistoryService.ts
 * 
 * Industry-Grade Telematics, Anti-Drift Centroid Clustering & High-Precision Map Matching Engine.
 * 
 * 1. Anti-Drift Spatio-Temporal Dwell Clustering (DBSCAN / Centroid Stabilization):
 *    Collapses indoor and parked GPS wander (< 35m, < 2.5 km/h, >= 3 mins) into a single anchored
 *    stay centroid, eliminating chaotic "spiderwebs" and fake phantom mileage.
 * 
 * 2. Circle Safe Places Recognition:
 *    Cross-references stationary dwells against circle safe zones (Home, Office, School, Gym)
 *    to automatically label stops with official named places and icons.
 * 
 * 3. High-Precision Road Snapping & Map Matching:
 *    Snaps moving trajectory legs onto real OpenStreetMap road centerlines with lane curves and turnings.
 * 
 * 4. Enterprise Telematics Metrics:
 *    Computes true road-traveled distance, active travel duration, 98th-percentile top speed,
 *    and average moving speed.
 */

import * as Location from 'expo-location';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Place } from '../store/useCircleStore';
import {
  calculateHaversineKm,
  calculateBearing,
  getCardinalDirection,
  fetchMapMatchedRoute,
  fetchRoadSnappedRoute,
} from './RoadRoutingService';
import {
  calculateHaversineDistanceMeters,
  smoothTrajectoryPoints,
} from './LocationSmoothingService';
import {
  intelligentRouteReconstruction,
  ReconstructionResult,
} from './HistoricalRouteReconstructionService';

export interface RawTelemetryPoint {
  id: string;
  lat: number;
  lng: number;
  timeMs: number;
  speed_mps?: number | null;
  accuracy?: number;
  recorded_at: string;
}

export interface EnterpriseHistoryPoint {
  id: string;
  latitude: number;
  longitude: number;
  timestamp: string;
  rawTimeMs: number;
  speedKmh: number;
  activity: string;
  address?: string;
  placeName?: string;
  placeCategory?: string;
  isStationary?: boolean;
  dwellDurationMins?: number;
  isReconstructed?: boolean;
  reconstructionSource?: 'historical_learned' | 'road_snapped' | 'spline_interpolated' | 'metro_transit' | 'rail_network';
}

export interface EnterpriseStationaryStop {
  id: string;
  name: string;
  category?: string;
  isSafePlace?: boolean;
  placeId?: string;
  latitude: number;
  longitude: number;
  arrivalTime: string;
  departureTime: string;
  durationMinutes: number;
  pointsCount: number;
}

export interface EnterpriseTripLeg {
  id: string;
  legIndex: number;
  startStopName?: string;
  endStopName?: string;
  startTime: string;
  endTime: string;
  startTimeMs: number;
  endTimeMs: number;
  durationMinutes: number;
  distanceKm: number;
  averageSpeedKmh: number;
  topSpeedKmh: number;
  roadCoords: [number, number][];
  bearings: number[];
  cardinalDirection: string;
  isTransit?: boolean;
  transitType?: 'road' | 'metro' | 'rail';
  points: EnterpriseHistoryPoint[];
}

export interface EnterpriseTimelineEvent {
  id: string;
  type: 'stay' | 'trip' | 'waypoint';
  title: string;
  subtitle: string;
  timeRange: string;
  durationText?: string;
  distanceText?: string;
  speedText?: string;
  categoryIcon: string;
  categoryColor: string;
  pointIndex: number;
  latitude: number;
  longitude: number;
  data: any;
}

export interface EnterpriseProcessedHistory {
  points: EnterpriseHistoryPoint[];
  stationaryStops: EnterpriseStationaryStop[];
  tripLegs: EnterpriseTripLeg[];
  timelineEvents: EnterpriseTimelineEvent[];
  allRoadCoords: [number, number][];
  allRoadBearings: number[];
  totalDistanceKm: number;
  travelDurationMinutes: number;
  topSpeedKmh: number;
  averageSpeedKmh: number;
  reconstructionStats: ReconstructionResult | null;
}

const geocodeCache: Record<string, string> = {};

/**
 * Fast cached reverse geocoding with timeout safety
 */
export async function reverseGeocodeEnterprise(lat: number, lng: number): Promise<string> {
  const cacheKey = `${lat.toFixed(3)},${lng.toFixed(3)}`;
  if (geocodeCache[cacheKey]) return geocodeCache[cacheKey];

  let addr = `Location • ${lat.toFixed(4)}, ${lng.toFixed(4)}`;
  try {
    const geoPromise = Location.reverseGeocodeAsync({ latitude: lat, longitude: lng });
    const timeoutPromise = new Promise((_, reject) => setTimeout(() => reject(new Error('timeout')), 2000));
    const geoRes: any = await Promise.race([geoPromise, timeoutPromise]).catch(() => null);

    if (geoRes && geoRes.length > 0) {
      const place = geoRes[0];
      const parts = [
        place.name,
        place.street,
        place.district || place.subregion || place.city,
      ].filter(Boolean);
      if (parts.length > 0) {
        addr = parts.join(', ');
      }
    }
  } catch (_) {}

  geocodeCache[cacheKey] = addr;
  return addr;
}

/**
 * Match a coordinate against circle safe places within geofence radius
 */
export function matchSafePlace(lat: number, lng: number, places: Place[] = []): Place | null {
  if (!places || places.length === 0) return null;

  let closestPlace: Place | null = null;
  let minDistance = Infinity;

  for (const place of places) {
    if (!place.latitude || !place.longitude) continue;
    const distMeters = calculateHaversineDistanceMeters(lat, lng, place.latitude, place.longitude);
    const radius = Math.max(place.radius_m || 80, 60);

    if (distMeters <= radius && distMeters < minDistance) {
      minDistance = distMeters;
      closestPlace = place;
    }
  }

  return closestPlace;
}

/**
 * Densify and interpolate coordinates along road curve for 60fps smooth playback
 */
export function densifyRoadCoordinates(coords: [number, number][], targetSpacingMeters = 15): [number, number][] {
  if (!coords || coords.length < 2) return coords;

  const densified: [number, number][] = [coords[0]];

  for (let i = 0; i < coords.length - 1; i++) {
    const p1 = coords[i];
    const p2 = coords[i + 1];
    const distMeters = calculateHaversineDistanceMeters(p1[0], p1[1], p2[0], p2[1]);

    if (distMeters > targetSpacingMeters) {
      const steps = Math.min(20, Math.ceil(distMeters / targetSpacingMeters));
      for (let s = 1; s < steps; s++) {
        const t = s / steps;
        const lat = p1[0] + (p2[0] - p1[0]) * t;
        const lng = p1[1] + (p2[1] - p1[1]) * t;
        densified.push([lat, lng]);
      }
    }
    densified.push(p2);
  }

  return densified;
}

/**
 * MAIN ENTERPRISE PROCESSING PIPELINE
 */
export async function processEnterpriseLocationHistory(
  rawPoints: RawTelemetryPoint[],
  places: Place[] = [],
  targetUserId: string
): Promise<EnterpriseProcessedHistory> {
  if (!rawPoints || rawPoints.length === 0) {
    return {
      points: [],
      stationaryStops: [],
      tripLegs: [],
      timelineEvents: [],
      allRoadCoords: [],
      allRoadBearings: [],
      totalDistanceKm: 0,
      travelDurationMinutes: 0,
      topSpeedKmh: 0,
      averageSpeedKmh: 0,
      reconstructionStats: null,
    };
  }

  // Step 1: Chronological sort & deduplication
  const sorted = [...rawPoints].sort((a, b) => a.timeMs - b.timeMs);
  const deduplicated: RawTelemetryPoint[] = [];

  for (let i = 0; i < sorted.length; i++) {
    const pt = sorted[i];
    if (i === 0) {
      deduplicated.push(pt);
      continue;
    }
    const prev = deduplicated[deduplicated.length - 1];
    const dt = Math.abs(pt.timeMs - prev.timeMs);
    const dist = calculateHaversineDistanceMeters(prev.lat, prev.lng, pt.lat, pt.lng);

    // Reject duplicate fixes within 1.5 seconds and 3 meters
    if (dt < 1500 && dist < 3) continue;

    // Reject unphysical speed spikes (> 140 km/h) unless verified over > 5 seconds
    const dtSec = Math.max(0.5, dt / 1000);
    const impliedKmh = (dist / dtSec) * 3.6;
    if (dtSec < 4 && impliedKmh > 140) continue;

    deduplicated.push(pt);
  }

  // Step 2: Calculate clean speeds & initial history point objects
  let cleanPoints: EnterpriseHistoryPoint[] = [];
  for (let i = 0; i < deduplicated.length; i++) {
    const pt = deduplicated[i];
    let speedKmh = 0;

    if (pt.speed_mps != null && !isNaN(pt.speed_mps) && pt.speed_mps >= 0) {
      speedKmh = Math.round(pt.speed_mps * 3.6);
    } else if (i > 0) {
      const prev = deduplicated[i - 1];
      const dtSec = Math.max(0.5, (pt.timeMs - prev.timeMs) / 1000);
      const dist = calculateHaversineDistanceMeters(prev.lat, prev.lng, pt.lat, pt.lng);
      const implied = (dist / dtSec) * 3.6;
      speedKmh = implied < 2.0 ? 0 : Math.min(130, Math.round(implied));
    }

    cleanPoints.push({
      id: pt.id,
      latitude: pt.lat,
      longitude: pt.lng,
      timestamp: new Date(pt.recorded_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      rawTimeMs: pt.timeMs,
      speedKmh,
      activity: speedKmh > 25 ? 'Driving / Transit' : speedKmh > 3 ? 'Walking' : 'Stationary',
      address: `Waypoint • ${pt.lat.toFixed(4)}, ${pt.lng.toFixed(4)}`,
    });
  }

  // Step 3: Anti-Drift Spatio-Temporal Centroid Dwell Clustering
  // Detects stationary stays (dwell >= 3 mins within 40m radius) and collapses indoor GPS jitter
  const DWELL_RADIUS_METERS = 40;
  const DWELL_MIN_TIME_MS = 3 * 60 * 1000; // 3 minutes

  const stationaryStops: EnterpriseStationaryStop[] = [];
  const stabilizedPoints: EnterpriseHistoryPoint[] = [];

  let currentDwell: EnterpriseHistoryPoint[] = [];
  let dwellStartPt: EnterpriseHistoryPoint | null = null;

  for (let i = 0; i < cleanPoints.length; i++) {
    const pt = cleanPoints[i];

    if (!dwellStartPt) {
      dwellStartPt = pt;
      currentDwell = [pt];
      continue;
    }

    const distFromStart = calculateHaversineDistanceMeters(
      dwellStartPt.latitude,
      dwellStartPt.longitude,
      pt.latitude,
      pt.longitude
    );

    const isSpeedStationary = pt.speedKmh <= 2.5;

    if (distFromStart <= DWELL_RADIUS_METERS && isSpeedStationary) {
      currentDwell.push(pt);
    } else {
      // Check if accumulated dwell was significant (>= 3 mins)
      const durationMs = currentDwell[currentDwell.length - 1].rawTimeMs - currentDwell[0].rawTimeMs;
      if (currentDwell.length >= 2 && durationMs >= DWELL_MIN_TIME_MS) {
        // Compute high-precision centroid
        let sumLat = 0;
        let sumLng = 0;
        for (const p of currentDwell) {
          sumLat += p.latitude;
          sumLng += p.longitude;
        }
        const centroidLat = sumLat / currentDwell.length;
        const centroidLng = sumLng / currentDwell.length;
        const dwellMins = Math.max(3, Math.round(durationMs / 60000));

        // Check Safe Places match
        const matchedPlace = matchSafePlace(centroidLat, centroidLng, places);
        const stopName = matchedPlace ? matchedPlace.name : `Stay Location (${dwellMins}m)`;

        const stop: EnterpriseStationaryStop = {
          id: `stop_${currentDwell[0].id}`,
          name: stopName,
          category: matchedPlace ? (matchedPlace.category || 'safe_zone') : 'stay',
          isSafePlace: !!matchedPlace,
          placeId: matchedPlace?.id,
          latitude: centroidLat,
          longitude: centroidLng,
          arrivalTime: currentDwell[0].timestamp,
          departureTime: currentDwell[currentDwell.length - 1].timestamp,
          durationMinutes: dwellMins,
          pointsCount: currentDwell.length,
        };
        stationaryStops.push(stop);

        // Stabilize all points in this dwell to the centroid to kill jitter
        for (const p of currentDwell) {
          stabilizedPoints.push({
            ...p,
            latitude: centroidLat,
            longitude: centroidLng,
            speedKmh: 0,
            activity: `Stationary at ${stopName}`,
            placeName: stopName,
            isStationary: true,
            dwellDurationMins: dwellMins,
          });
        }
      } else {
        // Normal movement or brief pause, pass through
        stabilizedPoints.push(...currentDwell);
      }

      // Start new candidate window
      dwellStartPt = pt;
      currentDwell = [pt];
    }
  }

  // Handle trailing dwell
  if (currentDwell.length >= 2) {
    const durationMs = currentDwell[currentDwell.length - 1].rawTimeMs - currentDwell[0].rawTimeMs;
    if (durationMs >= DWELL_MIN_TIME_MS) {
      let sumLat = 0;
      let sumLng = 0;
      for (const p of currentDwell) {
        sumLat += p.latitude;
        sumLng += p.longitude;
      }
      const centroidLat = sumLat / currentDwell.length;
      const centroidLng = sumLng / currentDwell.length;
      const dwellMins = Math.max(3, Math.round(durationMs / 60000));
      const matchedPlace = matchSafePlace(centroidLat, centroidLng, places);
      const stopName = matchedPlace ? matchedPlace.name : `Stay Location (${dwellMins}m)`;

      const stop: EnterpriseStationaryStop = {
        id: `stop_${currentDwell[0].id}`,
        name: stopName,
        category: matchedPlace ? (matchedPlace.category || 'safe_zone') : 'stay',
        isSafePlace: !!matchedPlace,
        placeId: matchedPlace?.id,
        latitude: centroidLat,
        longitude: centroidLng,
        arrivalTime: currentDwell[0].timestamp,
        departureTime: currentDwell[currentDwell.length - 1].timestamp,
        durationMinutes: dwellMins,
        pointsCount: currentDwell.length,
      };
      stationaryStops.push(stop);

      for (const p of currentDwell) {
        stabilizedPoints.push({
          ...p,
          latitude: centroidLat,
          longitude: centroidLng,
          speedKmh: 0,
          activity: `Stationary at ${stopName}`,
          placeName: stopName,
          isStationary: true,
          dwellDurationMins: dwellMins,
        });
      }
    } else {
      stabilizedPoints.push(...currentDwell);
    }
  } else if (currentDwell.length === 1) {
    stabilizedPoints.push(currentDwell[0]);
  }

  // Step 4: Corner-preserving smoothing on moving trajectories
  let smoothedPoints = smoothTrajectoryPoints(stabilizedPoints);

  // Step 5: Intelligent Route Reconstruction across GPS gaps (tunnels, dead zones)
  let reconstructionStats: ReconstructionResult | null = null;
  if (smoothedPoints.length >= 2) {
    try {
      const reconPromise = intelligentRouteReconstruction(smoothedPoints, targetUserId);
      const timeoutPromise = new Promise((resolve) => setTimeout(() => resolve(null), 1500));
      const recon: any = await Promise.race([reconPromise, timeoutPromise]);
      if (recon && recon.reconstructedPoints && recon.reconstructedPoints.length >= smoothedPoints.length) {
        smoothedPoints = recon.reconstructedPoints as EnterpriseHistoryPoint[];
        reconstructionStats = recon;
      }
    } catch (_) {}
  }

  // Step 6: Trip Leg Segmentation (Moving segments between stationary stops)
  const tripLegs: EnterpriseTripLeg[] = [];
  let currentLegPoints: EnterpriseHistoryPoint[] = [];

  for (let i = 0; i < smoothedPoints.length; i++) {
    const pt = smoothedPoints[i];
    const isStopPt = pt.isStationary || pt.speedKmh <= 1.5;

    if (!isStopPt) {
      // Connect to preceding stationary anchor for clean start
      if (currentLegPoints.length === 0 && i > 0) {
        currentLegPoints.push(smoothedPoints[i - 1]);
      }
      currentLegPoints.push(pt);
    } else {
      if (currentLegPoints.length >= 2) {
        // Connect to this arrival anchor
        currentLegPoints.push(pt);
        const leg = compileTripLeg(currentLegPoints, tripLegs.length);
        tripLegs.push(leg);
        currentLegPoints = [];
      } else {
        currentLegPoints = [];
      }
    }
  }

  if (currentLegPoints.length >= 2) {
    const leg = compileTripLeg(currentLegPoints, tripLegs.length);
    tripLegs.push(leg);
  }

  // If no distinct legs found but we have moving points, treat whole track as one leg
  if (tripLegs.length === 0 && smoothedPoints.length >= 2) {
    const hasMovement = smoothedPoints.some(p => p.speedKmh >= 3);
    if (hasMovement) {
      tripLegs.push(compileTripLeg(smoothedPoints, 0));
    }
  }

  // Step 7: Map Matching & Street Centerline Snapping on Trip Legs
  let allRoadCoords: [number, number][] = [];
  let allRoadBearings: number[] = [];

  for (const leg of tripLegs) {
    if (leg.points.length >= 2) {
      try {
        const matchPromise = fetchMapMatchedRoute(
          leg.points.map(p => ({
            latitude: p.latitude,
            longitude: p.longitude,
            speed: p.speedKmh,
            timeMs: p.rawTimeMs,
          })),
          { useCache: true }
        );
        const timeoutPromise = new Promise((resolve) => setTimeout(() => resolve(null), 1500));
        const matchRes: any = await Promise.race([matchPromise, timeoutPromise]);

        if (matchRes && matchRes.roadCoords && matchRes.roadCoords.length >= 2) {
          leg.roadCoords = matchRes.roadCoords;
          leg.bearings = matchRes.bearings || [];
          leg.distanceKm = matchRes.totalDistanceKm || leg.distanceKm;
        }
      } catch (_) {}
    }

    // Densify for smooth playback glide
    const densified = densifyRoadCoordinates(leg.roadCoords, 14);
    leg.roadCoords = densified;

    if (allRoadCoords.length > 0) {
      allRoadCoords.push(...densified.slice(1));
    } else {
      allRoadCoords.push(...densified);
    }

    // Compute continuous bearings
    const legBearings: number[] = [];
    for (let b = 0; b < densified.length; b++) {
      if (b < densified.length - 1) {
        legBearings.push(calculateBearing(densified[b][0], densified[b][1], densified[b + 1][0], densified[b + 1][1]));
      } else if (legBearings.length > 0) {
        legBearings.push(legBearings[legBearings.length - 1]);
      } else {
        legBearings.push(0);
      }
    }
    leg.bearings = legBearings;
    allRoadBearings.push(...legBearings);
  }

  // If road coords were empty, fall back to smoothed coordinates
  if (allRoadCoords.length === 0 && smoothedPoints.length > 0) {
    allRoadCoords = smoothedPoints.map(p => [p.latitude, p.longitude]);
    for (let i = 0; i < allRoadCoords.length; i++) {
      if (i < allRoadCoords.length - 1) {
        allRoadBearings.push(calculateBearing(allRoadCoords[i][0], allRoadCoords[i][1], allRoadCoords[i + 1][0], allRoadCoords[i + 1][1]));
      } else {
        allRoadBearings.push(allRoadBearings[allRoadBearings.length - 1] || 0);
      }
    }
  }

  // Step 8: Accurate Telematics Metrics
  let totalDistanceKm = 0;
  for (const leg of tripLegs) {
    totalDistanceKm += leg.distanceKm;
  }
  totalDistanceKm = parseFloat(totalDistanceKm.toFixed(1));

  let movingSec = 0;
  for (const leg of tripLegs) {
    movingSec += Math.max(60, leg.durationMinutes * 60);
  }
  const travelDurationMinutes = Math.max(1, Math.round(movingSec / 60));

  // 98th-percentile top speed
  const movingSpeeds = smoothedPoints.map(p => p.speedKmh).filter(s => s >= 5).sort((a, b) => a - b);
  let topSpeedKmh = 0;
  if (movingSpeeds.length >= 5) {
    const p98 = Math.min(movingSpeeds.length - 1, Math.floor(movingSpeeds.length * 0.98));
    topSpeedKmh = movingSpeeds[p98];
  } else if (movingSpeeds.length > 0) {
    topSpeedKmh = movingSpeeds[movingSpeeds.length - 1];
  }

  const averageSpeedKmh = travelDurationMinutes > 0 && totalDistanceKm > 0
    ? Math.round((totalDistanceKm / (travelDurationMinutes / 60)))
    : 0;

  // Step 9: Assemble Professional Timeline Events
  const timelineEvents: EnterpriseTimelineEvent[] = [];

  // Group events chronologically (both stays and trip legs)
  let legPtr = 0;
  let stopPtr = 0;

  while (legPtr < tripLegs.length || stopPtr < stationaryStops.length) {
    const nextLeg = tripLegs[legPtr];
    const nextStop = stationaryStops[stopPtr];

    if (nextStop && (!nextLeg || nextStop.arrivalTime <= nextLeg.startTime)) {
      timelineEvents.push({
        id: nextStop.id,
        type: 'stay',
        title: nextStop.name,
        subtitle: nextStop.isSafePlace ? `Safe Zone • ${nextStop.durationMinutes} mins dwell` : `Stationary Stay • ${nextStop.durationMinutes} mins`,
        timeRange: `${nextStop.arrivalTime} – ${nextStop.departureTime}`,
        durationText: `${nextStop.durationMinutes} mins`,
        categoryIcon: nextStop.isSafePlace ? 'shield-checkmark' : 'location',
        categoryColor: nextStop.isSafePlace ? '#2E7D5B' : '#E07A5F',
        pointIndex: 0,
        latitude: nextStop.latitude,
        longitude: nextStop.longitude,
        data: nextStop,
      });
      stopPtr++;
    } else if (nextLeg) {
      const isFast = nextLeg.averageSpeedKmh > 40;
      timelineEvents.push({
        id: nextLeg.id,
        type: 'trip',
        title: nextLeg.startStopName && nextLeg.endStopName
          ? `Trip from ${nextLeg.startStopName} to ${nextLeg.endStopName}`
          : `Drive heading ${nextLeg.cardinalDirection}`,
        subtitle: `${nextLeg.distanceKm.toFixed(1)} km • ${nextLeg.durationMinutes} mins • Avg ${nextLeg.averageSpeedKmh} km/h`,
        timeRange: `${nextLeg.startTime} – ${nextLeg.endTime}`,
        distanceText: `${nextLeg.distanceKm.toFixed(1)} km`,
        durationText: `${nextLeg.durationMinutes} mins`,
        speedText: `${nextLeg.topSpeedKmh} km/h max`,
        categoryIcon: isFast ? 'car-sport' : 'navigate',
        categoryColor: '#2E7D5B',
        pointIndex: 0,
        latitude: nextLeg.roadCoords[0]?.[0] || 0,
        longitude: nextLeg.roadCoords[0]?.[1] || 0,
        data: nextLeg,
      });
      legPtr++;
    } else {
      break;
    }
  }

  return {
    points: smoothedPoints,
    stationaryStops,
    tripLegs,
    timelineEvents,
    allRoadCoords,
    allRoadBearings,
    totalDistanceKm,
    travelDurationMinutes,
    topSpeedKmh,
    averageSpeedKmh,
    reconstructionStats,
  };
}

function compileTripLeg(points: EnterpriseHistoryPoint[], legIdx: number): EnterpriseTripLeg {
  const first = points[0];
  const last = points[points.length - 1];

  let rawDistKm = 0;
  for (let i = 1; i < points.length; i++) {
    rawDistKm += calculateHaversineKm(points[i - 1].latitude, points[i - 1].longitude, points[i].latitude, points[i].longitude);
  }

  const dtMins = Math.max(1, Math.round((last.rawTimeMs - first.rawTimeMs) / 60000));
  const avgSpeed = Math.round((rawDistKm / (dtMins / 60)));
  const topSpeed = Math.max(...points.map(p => p.speedKmh), 0);

  const bearing = calculateBearing(first.latitude, first.longitude, last.latitude, last.longitude);
  const cardDir = getCardinalDirection(bearing);

  return {
    id: `leg_${legIdx + 1}_${first.id}`,
    legIndex: legIdx,
    startStopName: first.placeName,
    endStopName: last.placeName,
    startTime: first.timestamp,
    endTime: last.timestamp,
    startTimeMs: first.rawTimeMs,
    endTimeMs: last.rawTimeMs,
    durationMinutes: dtMins,
    distanceKm: parseFloat(rawDistKm.toFixed(1)),
    averageSpeedKmh: isNaN(avgSpeed) ? 0 : Math.min(130, avgSpeed),
    topSpeedKmh: isNaN(topSpeed) ? 0 : Math.min(140, topSpeed),
    roadCoords: points.map(p => [p.latitude, p.longitude]),
    bearings: [bearing],
    cardinalDirection: cardDir,
    points,
  };
}
