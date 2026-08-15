import { calculateHaversineDistanceMeters } from './LocationSmoothingService';

export interface TripLeg {
  id: string;
  points: any[]; // The raw points (e.g. HistoryPoint) belonging to this leg
  startTimeMs: number;
  endTimeMs: number;
  isOutbound: boolean; // First leg is outbound, subsequent legs alternate or rely on distance to home
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
          legs.push({
            id: `leg_${legs.length + 1}`,
            points: [...currentLegPoints],
            startTimeMs: getTimeMs(currentLegPoints[0]),
            endTimeMs: getTimeMs(currentLegPoints[currentLegPoints.length - 1]),
            isOutbound: legs.length % 2 === 0, // Alternate outbound/return
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
    legs.push({
      id: `leg_${legs.length + 1}`,
      points: currentLegPoints,
      startTimeMs: getTimeMs(currentLegPoints[0]),
      endTimeMs: getTimeMs(currentLegPoints[currentLegPoints.length - 1]),
      isOutbound: legs.length % 2 === 0,
    });
  }

  return legs;
}
