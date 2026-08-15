/**
 * RoadRoutingService.ts
 * High-precision road matching & navigation routing service using OSRM.
 * Snaps raw/sparse GPS points onto actual street networks (like Google Maps).
 */

export interface LatLng {
  latitude: number;
  longitude: number;
}

export interface RouteSegment {
  roadCoords: [number, number][]; // [lat, lng] array
  totalDistanceKm: number;
  totalDurationMins: number;
  bearings: number[]; // Heading angles for each coordinate
}

/**
 * Calculates bearing angle in degrees (0..360) between two points
 */
export function calculateBearing(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const radLat1 = (lat1 * Math.PI) / 180;
  const radLat2 = (lat2 * Math.PI) / 180;
  const dLng = ((lng2 - lng1) * Math.PI) / 180;

  const y = Math.sin(dLng) * Math.cos(radLat2);
  const x = Math.cos(radLat1) * Math.sin(radLat2) - Math.sin(radLat1) * Math.cos(radLat2) * Math.cos(dLng);
  const brng = (Math.atan2(y, x) * 180) / Math.PI;
  return (brng + 360) % 360;
}

/**
 * Returns human readable cardinal direction string from bearing angle
 */
export function getCardinalDirection(bearing: number): string {
  const directions = ['N', 'NE', 'E', 'SE', 'S', 'SW', 'W', 'NW'];
  const index = Math.round(bearing / 45) % 8;
  return directions[index];
}

/**
 * Calculates Haversine distance in KM between two coordinates
 */
export function calculateHaversineKm(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 6371; // Earth radius km
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLon = ((lon2 - lon1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos((lat1 * Math.PI) / 180) * Math.cos((lat2 * Math.PI) / 180) * Math.sin(dLon / 2) * Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

/**
 * Catmull-Rom Spline Curve Smoothing Fallback
 * Used when network is offline or OSRM is unreachable to prevent sharp diagonal cuts through buildings.
 */
function generateCatmullRomSpline(points: [number, number][], numInterpolated: number = 5): [number, number][] {
  if (points.length < 2) return points;

  const smooth: [number, number][] = [];
  const extendedPoints: [number, number][] = [points[0], ...points, points[points.length - 1]];

  for (let i = 1; i < extendedPoints.length - 2; i++) {
    const p0 = extendedPoints[i - 1];
    const p1 = extendedPoints[i];
    const p2 = extendedPoints[i + 1];
    const p3 = extendedPoints[i + 2];

    for (let t = 0; t < 1; t += 1 / numInterpolated) {
      const t2 = t * t;
      const t3 = t2 * t;

      const lat =
        0.5 *
        (2 * p1[0] +
          (-p0[0] + p2[0]) * t +
          (2 * p0[0] - 5 * p1[0] + 4 * p2[0] - p3[0]) * t2 +
          (-p0[0] + 3 * p1[0] - 3 * p2[0] + p3[0]) * t3);

      const lng =
        0.5 *
        (2 * p1[1] +
          (-p0[1] + p2[1]) * t +
          (2 * p0[1] - 5 * p1[1] + 4 * p2[1] - p3[1]) * t2 +
          (-p0[1] + 3 * p1[1] - 3 * p2[1] + p3[1]) * t3);

      smooth.push([lat, lng]);
    }
  }

  smooth.push(points[points.length - 1]);
  return smooth;
}

/**
 * Fetches exact road-matched coordinates using OSRM Route API.
 * Handles batching for large waypoint arrays.
 */
export async function fetchRoadSnappedRoute(waypoints: LatLng[]): Promise<RouteSegment> {
  if (!waypoints || waypoints.length === 0) {
    return { roadCoords: [], totalDistanceKm: 0, totalDurationMins: 0, bearings: [] };
  }

  if (waypoints.length === 1) {
    const single: [number, number] = [waypoints[0].latitude, waypoints[0].longitude];
    return { roadCoords: [single], totalDistanceKm: 0, totalDurationMins: 0, bearings: [0] };
  }

  // Filter out redundant identical points
  const filteredWaypoints: LatLng[] = [waypoints[0]];
  for (let i = 1; i < waypoints.length; i++) {
    const prev = filteredWaypoints[filteredWaypoints.length - 1];
    const curr = waypoints[i];
    const dist = calculateHaversineKm(prev.latitude, prev.longitude, curr.latitude, curr.longitude);
    if (dist >= 0.003) { // 3 meters min separation
      filteredWaypoints.push(curr);
    }
  }

  if (filteredWaypoints.length < 2) {
    const single: [number, number] = [waypoints[0].latitude, waypoints[0].longitude];
    return { roadCoords: [single], totalDistanceKm: 0, totalDurationMins: 0, bearings: [0] };
  }

  const MAX_BATCH_SIZE = 40;
  const allRoadCoords: [number, number][] = [];
  let aggregateDistanceMeters = 0;
  let aggregateDurationSeconds = 0;

  for (let startIdx = 0; startIdx < filteredWaypoints.length - 1; startIdx += MAX_BATCH_SIZE - 1) {
    const chunk = filteredWaypoints.slice(startIdx, startIdx + MAX_BATCH_SIZE);
    if (chunk.length < 2) break;

    // OSRM expects coordinates in "longitude,latitude" format
    const coordString = chunk.map(w => `${w.longitude.toFixed(6)},${w.latitude.toFixed(6)}`).join(';');
    const url = `https://router.project-osrm.org/route/v1/driving/${coordString}?overview=full&geometries=geojson`;

    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 6000);

      const response = await fetch(url, { signal: controller.signal });
      clearTimeout(timeoutId);

      if (response.ok) {
        const data = await response.json();
        if (data.code === 'Ok' && data.routes && data.routes.length > 0) {
          const route = data.routes[0];
          aggregateDistanceMeters += route.distance || 0;
          aggregateDurationSeconds += route.duration || 0;

          const geojsonCoords = route.geometry.coordinates; // [[lng, lat], ...]
          const converted: [number, number][] = geojsonCoords.map((c: [number, number]) => [c[1], c[0]]);

          if (allRoadCoords.length > 0) {
            allRoadCoords.push(...converted.slice(1));
          } else {
            allRoadCoords.push(...converted);
          }
          continue;
        }
      }
    } catch (e) {
      console.warn('[RoadRoutingService] OSRM fetch note, utilizing fallback curve smoothing:', e);
    }

    // Fallback if chunk OSRM fails
    const rawChunkCoords: [number, number][] = chunk.map(w => [w.latitude, w.longitude]);
    const smoothedChunk = generateCatmullRomSpline(rawChunkCoords, 4);
    if (allRoadCoords.length > 0) {
      allRoadCoords.push(...smoothedChunk.slice(1));
    } else {
      allRoadCoords.push(...smoothedChunk);
    }
  }

  // Calculate bearings along the road coordinates
  const bearings: number[] = [];
  for (let i = 0; i < allRoadCoords.length; i++) {
    if (i < allRoadCoords.length - 1) {
      const [lat1, lng1] = allRoadCoords[i];
      const [lat2, lng2] = allRoadCoords[i + 1];
      bearings.push(calculateBearing(lat1, lng1, lat2, lng2));
    } else if (bearings.length > 0) {
      bearings.push(bearings[bearings.length - 1]);
    } else {
      bearings.push(0);
    }
  }

  // If aggregate distance wasn't obtained from OSRM, sum Haversine distances
  if (aggregateDistanceMeters === 0 && allRoadCoords.length > 1) {
    for (let i = 1; i < allRoadCoords.length; i++) {
      const [lat1, lng1] = allRoadCoords[i - 1];
      const [lat2, lng2] = allRoadCoords[i];
      aggregateDistanceMeters += calculateHaversineKm(lat1, lng1, lat2, lng2) * 1000;
    }
  }

  const totalDistanceKm = parseFloat((aggregateDistanceMeters / 1000).toFixed(1));
  const totalDurationMins = Math.max(1, Math.round(aggregateDurationSeconds / 60));

  return {
    roadCoords: allRoadCoords,
    totalDistanceKm,
    totalDurationMins,
    bearings,
  };
}
