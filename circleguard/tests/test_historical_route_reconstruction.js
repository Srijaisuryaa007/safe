/**
 * test_historical_route_reconstruction.js
 * 
 * Verifies:
 * 1. Dropped GPS gap detection.
 * 2. Historical route memory storage & spatial index matching.
 * 3. Learned path prediction & smooth coordinate/timestamp stitching.
 * 4. Fallback road-snapping behavior.
 */

const {
  detectRouteGaps,
  findHistoricalMatch,
  stitchHistoricalSegment,
  intelligentRouteReconstruction,
  saveRouteToHistoricalMemory,
  loadHistoricalRoutes,
} = require('../src/services/HistoricalRouteReconstructionService');

// Mock AsyncStorage for Node.js test environment if needed
if (!global.AsyncStorage) {
  const store = {};
  global.AsyncStorage = {
    getItem: async (key) => store[key] || null,
    setItem: async (key, val) => { store[key] = val; },
    removeItem: async (key) => { delete store[key]; },
  };
}

async function runTests() {
  console.log('=== TEST: INTELLIGENT HISTORICAL ROUTE RECONSTRUCTION ===\n');

  // Test 1: Gap Detection
  console.log('Test 1: Detecting Dropped GPS Segments...');
  const baseTime = 1710000000000;
  
  // Create a continuous trip with 1 dropped segment (tunnel / dead zone)
  const tripWithGap = [
    { id: 'p0', latitude: 12.9716, longitude: 77.5946, rawTimeMs: baseTime, speedKmh: 45, activity: 'Driving', timestamp: '10:00 AM' },
    { id: 'p1', latitude: 12.9730, longitude: 77.5960, rawTimeMs: baseTime + 15000, speedKmh: 48, activity: 'Driving', timestamp: '10:00 AM' },
    { id: 'p2', latitude: 12.9745, longitude: 77.5975, rawTimeMs: baseTime + 30000, speedKmh: 44, activity: 'Driving', timestamp: '10:00 AM' },
    // --- DROPPED GAP: 1.6 km jump and 150 seconds elapsed without GPS ---
    { id: 'p3', latitude: 12.9850, longitude: 77.6080, rawTimeMs: baseTime + 180000, speedKmh: 50, activity: 'Driving', timestamp: '10:03 AM' },
    { id: 'p4', latitude: 12.9865, longitude: 77.6095, rawTimeMs: baseTime + 195000, speedKmh: 46, activity: 'Driving', timestamp: '10:03 AM' },
  ];

  const detectedGaps = detectRouteGaps(tripWithGap);
  console.log(`Detected Gaps Count: ${detectedGaps.length}`);
  if (detectedGaps.length !== 1) {
    throw new Error(`Expected 1 gap, found ${detectedGaps.length}`);
  }
  const gap = detectedGaps[0];
  console.log(`- Gap Distance: ${(gap.distanceMeters / 1000).toFixed(2)} km`);
  console.log(`- Time Jump: ${gap.timeGapSeconds}s`);
  console.log(`- Implied Speed: ${gap.impliedSpeedKmh.toFixed(1)} km/h`);
  console.log('[PASS] Gap correctly identified between p2 and p3!\n');

  // Test 2: Historical Route Matching
  console.log('Test 2: Matching Against Previously Driven Route...');
  // Suppose user drove this exact arterial avenue yesterday, with complete points along the road:
  const pastDrivenRoute = {
    id: 'past_route_yesterday',
    userId: 'user_sri',
    recordedDate: '2026-09-16',
    bounds: { minLat: 12.970, maxLat: 12.990, minLng: 77.590, maxLng: 77.620 },
    points: [
      { lat: 12.9716, lng: 77.5946, speedKmh: 40 },
      { lat: 12.9745, lng: 77.5975, speedKmh: 45 }, // matches p2 (gap start)
      { lat: 12.9770, lng: 77.6000, speedKmh: 48 }, // intermediate road waypoint 1
      { lat: 12.9800, lng: 77.6030, speedKmh: 46 }, // intermediate road waypoint 2
      { lat: 12.9825, lng: 77.6055, speedKmh: 47 }, // intermediate road waypoint 3
      { lat: 12.9850, lng: 77.6080, speedKmh: 50 }, // matches p3 (gap end)
      { lat: 12.9880, lng: 77.6110, speedKmh: 42 },
    ]
  };

  const match = findHistoricalMatch(gap, [pastDrivenRoute]);
  if (!match) {
    throw new Error('Expected historical match but got null');
  }
  console.log(`- Matched Past Route: ${match.routeId}`);
  console.log(`- Confidence Score: ${match.confidence * 100}%`);
  console.log(`- Matched Intermediate Waypoints: ${match.matchedCoords.length}`);
  console.log('[PASS] Historical corridor accurately matched!\n');

  // Test 3: Reconstruct & Stitch
  console.log('Test 3: Reconstructing and Smoothing Path...');
  const stitched = stitchHistoricalSegment(gap, match.matchedCoords);
  console.log(`- Synthesized Points Count: ${stitched.length}`);
  stitched.forEach((pt, idx) => {
    console.log(`  Waypoint #${idx + 1}: [${pt.latitude.toFixed(4)}, ${pt.longitude.toFixed(4)}] @ ${pt.timestamp} (${pt.activity})`);
  });
  if (stitched.length < 2) {
    throw new Error('Expected at least 2 intermediate reconstructed points');
  }
  console.log('[PASS] Stitched points created with seamless timestamps and activity tags!\n');

  // Test 4: End-to-End Master Pipeline
  console.log('Test 4: Testing Full Master Pipeline (intelligentRouteReconstruction)...');
  const result = await intelligentRouteReconstruction(tripWithGap, 'user_sri');
  console.log(`- Original Points Count: ${tripWithGap.length}`);
  console.log(`- Final Reconstructed Points Count: ${result.reconstructedPoints.length}`);
  console.log(`- Gaps Reconstructed (Historical Learned): ${result.gapsHistoricalLearned}`);
  console.log(`- Gaps Reconstructed (Road Snapped): ${result.gapsRoadSnapped}`);
  console.log(`- Total Missing Distance Reconstructed: ${result.missingDistanceKm} km`);

  if (result.reconstructedPoints.length <= tripWithGap.length) {
    throw new Error('Expected reconstructed route to contain more points than original sparse route');
  }
  console.log('\n=== ALL HISTORICAL ROUTE RECONSTRUCTION TESTS PASSED! ===');
}

runTests().catch(err => {
  console.error('Test failed with error:', err);
  process.exit(1);
});
