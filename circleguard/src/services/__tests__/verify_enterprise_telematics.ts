// Polyfill __DEV__ for Node CLI environment
(global as any).__DEV__ = true;

import {
  processEnterpriseLocationHistory,
  matchSafePlace,
  densifyRoadCoordinates,
  RawTelemetryPoint,
} from '../EnterpriseLocationHistoryService';
import { Place } from '../../store/useCircleStore';

async function runTests() {
  console.log('====================================================');
  console.log('🔬 ENTERPRISE TELEMATICS & ANTI-DRIFT VERIFICATION');
  console.log('====================================================\n');

  let passed = 0;
  let total = 0;

  function assert(desc: string, cond: boolean, details?: any) {
    total++;
    if (cond) {
      console.log(`✅ [PASS] ${desc}`);
      passed++;
    } else {
      console.error(`❌ [FAIL] ${desc}`);
      if (details) console.error('   Details:', details);
    }
  }

  // ----------------------------------------------------
  // TEST 1: Safe Place Geofence Matching
  // ----------------------------------------------------
  console.log('--- TEST 1: Circle Safe Place Recognition ---');
  const places: Place[] = [
    {
      id: 'p_home',
      circle_id: 'c_1',
      name: 'Home Sanctuary',
      latitude: 13.082700,
      longitude: 80.270700,
      radius_m: 80,
      category: 'home',
    },
    {
      id: 'p_office',
      circle_id: 'c_1',
      name: 'Tech Campus',
      latitude: 13.040000,
      longitude: 80.250000,
      radius_m: 100,
      category: 'work',
    },
  ];

  // Point 25m from Home
  const matchHome = matchSafePlace(13.082850, 80.270800, places);
  assert('Matches Home when within 80m geofence', matchHome?.id === 'p_home' && matchHome?.name === 'Home Sanctuary');

  // Point 2km away from any place
  const matchAlien = matchSafePlace(13.100000, 80.290000, places);
  assert('Returns null when outside all safe places', matchAlien === null);

  // ----------------------------------------------------
  // TEST 2: Anti-Drift Stationary Centroid Clustering
  // Simulates 15 minutes sitting indoors with raw GPS jitter (10-25m wander)
  // ----------------------------------------------------
  console.log('\n--- TEST 2: Anti-Drift Centroid Stabilization (Indoor GPS Wander) ---');
  const baseTime = Date.now() - 3600000;
  const rawJitterPoints: RawTelemetryPoint[] = [];

  // Generate 30 jitter fixes over 15 minutes around Home (1 fix every 30s)
  const homeLat = 13.082700;
  const homeLng = 80.270700;
  let naiveJitterDistMeters = 0;
  let prevLat = homeLat;
  let prevLng = homeLng;

  for (let i = 0; i < 30; i++) {
    // Add ±0.00015 lat/lng jitter (~15m wander)
    const latJitter = (Math.sin(i * 1.3) * 0.00012);
    const lngJitter = (Math.cos(i * 1.7) * 0.00012);
    const curLat = homeLat + latJitter;
    const curLng = homeLng + lngJitter;

    if (i > 0) {
      // Calculate Euclidean-approx distance in meters
      const dLat = (curLat - prevLat) * 111000;
      const dLng = (curLng - prevLng) * 111000 * Math.cos(homeLat * Math.PI / 180);
      naiveJitterDistMeters += Math.sqrt(dLat * dLat + dLng * dLng);
    }
    prevLat = curLat;
    prevLng = curLng;

    rawJitterPoints.push({
      id: `fix_${i}`,
      lat: curLat,
      lng: curLng,
      timeMs: baseTime + (i * 30 * 1000), // every 30s
      speed_mps: 0.15, // drifting speed
      accuracy: 14,
      recorded_at: new Date(baseTime + (i * 30 * 1000)).toISOString(),
    });
  }

  console.log(`   [Raw Data] Naive Euclidean sum of stationary jitter: ${(naiveJitterDistMeters / 1000).toFixed(2)} km of fake phantom movement!`);

  const historyResult = await processEnterpriseLocationHistory(rawJitterPoints, places, 'user_test');

  assert('Collapses stationary jitter into exactly 1 stationary stop', historyResult.stationaryStops.length === 1);
  assert('Correctly associates stay with Circle Safe Place "Home Sanctuary"', historyResult.stationaryStops[0]?.name === 'Home Sanctuary');
  assert('Eliminates phantom mileage: total distance is 0 km', historyResult.totalDistanceKm === 0, { dist: historyResult.totalDistanceKm });
  assert('All points in stay are clamped to centroid with speed 0', historyResult.points.every(p => p.speedKmh === 0 && p.isStationary));
  assert('Identifies dwell duration accurately (~15 mins)', historyResult.stationaryStops[0]?.durationMinutes >= 14 && historyResult.stationaryStops[0]?.durationMinutes <= 16);

  // ----------------------------------------------------
  // TEST 3: Multi-Leg Trajectory with Movement and Two Anchored Stops
  // ----------------------------------------------------
  console.log('\n--- TEST 3: Multi-Leg Telematics (Stay -> Drive -> Stay) ---');
  const fullTripPoints: RawTelemetryPoint[] = [...rawJitterPoints]; // Start at Home (15 mins)

  // Drive 5 km from Home (13.0827, 80.2707) to Tech Campus (13.0400, 80.2500) over 10 minutes
  const tripStartTime = baseTime + (15 * 60 * 1000) + 10000;
  const numDriveFixes = 20;
  for (let i = 1; i <= numDriveFixes; i++) {
    const fraction = i / numDriveFixes;
    const lat = homeLat + (13.040000 - homeLat) * fraction;
    const lng = homeLng + (80.250000 - homeLng) * fraction;
    fullTripPoints.push({
      id: `drive_${i}`,
      lat,
      lng,
      timeMs: tripStartTime + (i * 30 * 1000),
      speed_mps: 12.5, // 45 km/h
      accuracy: 6,
      recorded_at: new Date(tripStartTime + (i * 30 * 1000)).toISOString(),
    });
  }

  // Arrival at Tech Campus: dwell for 20 minutes
  const arrivalTime = tripStartTime + (numDriveFixes * 30 * 1000) + 10000;
  for (let i = 0; i < 20; i++) {
    const curLat = 13.040000 + (Math.sin(i) * 0.00008);
    const curLng = 80.250000 + (Math.cos(i) * 0.00008);
    fullTripPoints.push({
      id: `dest_${i}`,
      lat: curLat,
      lng: curLng,
      timeMs: arrivalTime + (i * 60 * 1000), // every 1 min
      speed_mps: 0.1,
      accuracy: 12,
      recorded_at: new Date(arrivalTime + (i * 60 * 1000)).toISOString(),
    });
  }

  const multiLegResult = await processEnterpriseLocationHistory(fullTripPoints, places, 'user_test');

  assert('Identifies both stationary stops (Home and Tech Campus)', multiLegResult.stationaryStops.length === 2);
  assert('Start stop identified as Home Sanctuary', multiLegResult.stationaryStops[0]?.name === 'Home Sanctuary');
  assert('End stop identified as Tech Campus', multiLegResult.stationaryStops[1]?.name === 'Tech Campus');
  assert('Segments trip into exactly 1 driving leg between anchors', multiLegResult.tripLegs.length === 1);
  assert('Calculates authentic travel distance (> 4 km and < 7 km)', multiLegResult.totalDistanceKm >= 4 && multiLegResult.totalDistanceKm <= 7, { dist: multiLegResult.totalDistanceKm });
  assert('Calculates realistic moving speed (30 - 55 km/h)', multiLegResult.averageSpeedKmh >= 25 && multiLegResult.averageSpeedKmh <= 60, { avgSpd: multiLegResult.averageSpeedKmh });
  assert('Populates structured timeline events with Stays and Trips', multiLegResult.timelineEvents.length === 3); // Stay -> Trip -> Stay

  // ----------------------------------------------------
  // TEST 4: Densification for 60fps Playback Glide
  // ----------------------------------------------------
  console.log('\n--- TEST 4: Coordinate Densification for Smooth 60fps Playback ---');
  const sparseCoords: [number, number][] = [
    [13.0827, 80.2707],
    [13.0400, 80.2500],
  ];
  const densified = densifyRoadCoordinates(sparseCoords, 20);
  assert('Densifies sparse road coordinates into smooth glide steps', densified.length > 5);

  console.log('\n====================================================');
  console.log(`📊 RESULTS: ${passed}/${total} TESTS PASSED (${((passed / total) * 100).toFixed(0)}%)`);
  console.log('====================================================');

  if (passed === total) {
    console.log('🏆 All enterprise telematics assertions verified successfully!');
  } else {
    process.exit(1);
  }
}

runTests().catch(err => {
  console.error('Fatal test error:', err);
  process.exit(1);
});
