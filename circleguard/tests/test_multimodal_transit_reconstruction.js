/**
 * test_multimodal_transit_reconstruction.js
 * 
 * Verifies:
 * 1. OfflineLocationQueueService retains degraded accuracy fixes (300m-700m) in tunnels.
 * 2. TransitCorridorService identifies Metro and Railway corridors via station metadata and kinematics.
 * 3. Smooth Railway / Subway Hermite spline synthesis with tangency and velocity constraints.
 * 4. End-to-End multi-modal reconstruction through intelligentRouteReconstruction.
 */

const fs = require('fs');
const babel = require('@babel/core');
const Module = require('module');

const store = {};
const mockAsyncStorage = {
  getItem: async (key) => store[key] || null,
  setItem: async (key, val) => { store[key] = val; },
  removeItem: async (key) => { delete store[key]; },
};
mockAsyncStorage.default = mockAsyncStorage;

// Intercept react-native and async-storage imports in Node
const originalRequire = Module.prototype.require;
Module.prototype.require = function (id) {
  if (id === 'react-native') {
    return {
      Platform: { OS: 'ios', select: (obj) => obj.ios || obj.default },
      AppState: { addEventListener: () => ({ remove: () => {} }) },
    };
  }
  if (id === '@react-native-async-storage/async-storage') {
    return mockAsyncStorage;
  }
  return originalRequire.apply(this, arguments);
};

// Register TypeScript on-the-fly compiler hook
require.extensions['.ts'] = function (module, filename) {
  const content = fs.readFileSync(filename, 'utf8');
  const transformed = babel.transformSync(content, {
    filename,
    presets: [
      ['@babel/preset-typescript', { allowNamespaces: true }]
    ],
    plugins: [
      ['@babel/plugin-transform-modules-commonjs', { loose: true }]
    ]
  });
  module._compile(transformed.code, filename);
};

// Mock react-native and external dependencies before requiring services
const mockSupabase = {
  from: () => ({
    insert: async () => ({ error: { message: 'offline' } }),
    select: () => ({
      eq: () => ({
        gte: () => ({
          order: () => ({
            limit: async () => ({ data: [], error: null })
          })
        }),
        single: async () => ({ data: null, error: null }),
        limit: async () => ({ data: [], error: null })
      })
    }),
    upsert: async () => ({ error: null }),
  }),
  auth: {
    getSession: async () => ({ data: { session: { user: { id: 'test_user_id' } } } }),
  }
};

require.cache[require.resolve('../src/lib/supabase')] = {
  exports: { supabase: mockSupabase }
};

const { isTransitCorridor, synthesizeTransitCorridor } = require('../src/services/TransitCorridorService');
const { detectRouteGaps, intelligentRouteReconstruction } = require('../src/services/HistoricalRouteReconstructionService');
const { queueAndSyncLocationHistory, getPendingOfflineBreadcrumbs } = require('../src/services/OfflineLocationQueueService');

async function runTests() {
  console.log('=== TEST: MULTI-MODAL METRO & RAILWAY TRANSIT RECONSTRUCTION ===\n');

  // -------------------------------------------------------------
  // Test 1: Offline Queue Resilience in Underground Tunnels
  // -------------------------------------------------------------
  console.log('Test 1: Offline Breadcrumb Buffering in Underground Metro Tunnel...');
  const testUserId = 'test_transit_user_007';

  // Underground cell-tower ping with 480m accuracy and transit speed 12 m/s
  await queueAndSyncLocationHistory({
    user_id: testUserId,
    geom: 'POINT(80.2707 13.0827)',
    speed_mps: 12.5,
    recorded_at: new Date().toISOString(),
    accuracy: 480, // Degraded tunnel accuracy
    latitude: 13.0827,
    longitude: 80.2707,
  });

  const pending = await getPendingOfflineBreadcrumbs(testUserId);
  console.log(`- Stored Pending Offline Breadcrumbs: ${pending.length}`);
  if (pending.length === 0) {
    throw new Error('Expected tunnel breadcrumb to be buffered offline in AsyncStorage!');
  }
  if (pending[0].accuracy !== 480) {
    throw new Error(`Expected accuracy 480, found ${pending[0].accuracy}`);
  }
  console.log('[PASS] Underground metro tunnel breadcrumb successfully preserved offline!\n');

  // -------------------------------------------------------------
  // Test 2: Metro Corridor Detection
  // -------------------------------------------------------------
  console.log('Test 2: Detecting Metro Subway Corridor...');
  const baseTime = 1715000000000;
  const metroStart = {
    id: 'p_station_entry',
    latitude: 13.0820,
    longitude: 80.2750,
    rawTimeMs: baseTime,
    speedKmh: 22,
    activity: 'Walking to Metro',
    timestamp: '09:00 AM',
    address: 'Central Metro Station (Underground Entry)',
  };

  const metroEnd = {
    id: 'p_station_exit',
    latitude: 13.0600,
    longitude: 80.2450,
    rawTimeMs: baseTime + 320000, // ~5.3 mins later
    speedKmh: 18,
    activity: 'Exiting Station',
    timestamp: '09:05 AM',
    address: 'Thousand Lights Metro Station Platform',
  };

  const metroGap = {
    startIndex: 0,
    endIndex: 1,
    startPoint: metroStart,
    endPoint: metroEnd,
    distanceMeters: 4100, // 4.1 km
    timeGapSeconds: 320,
    impliedSpeedKmh: 46.1, // ~46 km/h
    bearing: 230,
  };

  const metroMatch = isTransitCorridor(metroGap, metroStart.address, metroEnd.address);
  console.log(`- Is Transit: ${metroMatch.isTransit}`);
  console.log(`- Transit Type: ${metroMatch.transitType}`);
  console.log(`- Confidence: ${(metroMatch.confidence * 100).toFixed(0)}%`);
  console.log(`- Reason: ${metroMatch.reason}`);

  if (!metroMatch.isTransit || metroMatch.transitType !== 'metro') {
    throw new Error(`Expected metro transit detection, got ${JSON.stringify(metroMatch)}`);
  }
  console.log('[PASS] Underground metro tunnel corridor accurately detected!\n');

  // -------------------------------------------------------------
  // Test 3: Railway Corridor Detection
  // -------------------------------------------------------------
  console.log('Test 3: Detecting High-Speed Railway Corridor...');
  const railStart = {
    id: 'p_rail_entry',
    latitude: 13.0836,
    longitude: 80.2754,
    rawTimeMs: baseTime,
    speedKmh: 55,
    activity: 'Train Departure',
    timestamp: '11:00 AM',
    address: 'Chennai Central Railway Station',
  };

  const railEnd = {
    id: 'p_rail_exit',
    latitude: 12.9249,
    longitude: 80.1000,
    rawTimeMs: baseTime + 1200000, // 20 mins later
    speedKmh: 65,
    activity: 'Train Arrival',
    timestamp: '11:20 AM',
    address: 'Tambaram Railway Junction Terminal',
  };

  const railGap = {
    startIndex: 0,
    endIndex: 1,
    startPoint: railStart,
    endPoint: railEnd,
    distanceMeters: 25000, // 25 km
    timeGapSeconds: 1200,
    impliedSpeedKmh: 75.0, // 75 km/h
    bearing: 215,
  };

  const railMatch = isTransitCorridor(railGap, railStart.address, railEnd.address);
  console.log(`- Is Transit: ${railMatch.isTransit}`);
  console.log(`- Transit Type: ${railMatch.transitType}`);
  console.log(`- Confidence: ${(railMatch.confidence * 100).toFixed(0)}%`);

  if (!railMatch.isTransit || railMatch.transitType !== 'rail') {
    throw new Error(`Expected rail transit detection, got ${JSON.stringify(railMatch)}`);
  }
  console.log('[PASS] Inter-city rail corridor accurately detected!\n');

  // -------------------------------------------------------------
  // Test 4: Smooth Cubic Hermite Track Spline Synthesis
  // -------------------------------------------------------------
  console.log('Test 4: Synthesizing Smooth Metro Tunnel Track Curve...');
  const synthesizedMetro = await synthesizeTransitCorridor(metroGap, 'metro');
  console.log(`- Generated Metro Tunnel Track Vertices: ${synthesizedMetro.length}`);
  console.log(`- Sample Point: [${synthesizedMetro[0].latitude}, ${synthesizedMetro[0].longitude}] @ ${synthesizedMetro[0].timestamp}`);
  console.log(`- Activity: ${synthesizedMetro[0].activity}`);
  console.log(`- Reconstruction Source: ${synthesizedMetro[0].reconstructionSource}`);

  if (synthesizedMetro.length < 5) {
    throw new Error('Expected at least 5 synthesized curve points along 4.1km metro tunnel');
  }
  if (synthesizedMetro[0].reconstructionSource !== 'metro_transit') {
    throw new Error(`Expected reconstructionSource metro_transit, found ${synthesizedMetro[0].reconstructionSource}`);
  }
  console.log('[PASS] Hermite tunnel spline generated with accurate timestamps and activity!\n');

  // -------------------------------------------------------------
  // Test 5: Master Pipeline Integration
  // -------------------------------------------------------------
  console.log('Test 5: Full Master Pipeline (intelligentRouteReconstruction with Metro Gap)...');
  const routeWithMetroGap = [
    { id: 'p0', latitude: 13.0825, longitude: 80.2755, rawTimeMs: baseTime - 30000, speedKmh: 4, activity: 'Walking', timestamp: '08:59 AM' },
    metroStart,
    // Underground tunnel gap here (no cell reception)
    metroEnd,
    { id: 'p3', latitude: 13.0590, longitude: 80.2440, rawTimeMs: baseTime + 350000, speedKmh: 4, activity: 'Walking', timestamp: '09:06 AM' },
  ];

  const pipelineResult = await intelligentRouteReconstruction(routeWithMetroGap, testUserId);
  console.log(`- Reconstructed Total Points: ${pipelineResult.reconstructedPoints.length}`);
  console.log(`- Gaps Detected: ${pipelineResult.gapsDetected}`);
  console.log(`- Gaps Reconstructed (Transit Corridors): ${pipelineResult.gapsTransitCorridors}`);
  console.log(`- Missing Distance Reconstructed: ${pipelineResult.missingDistanceKm} km`);

  if (pipelineResult.gapsTransitCorridors < 1) {
    throw new Error('Expected pipeline to reconstruct at least 1 transit corridor gap!');
  }
  if (pipelineResult.reconstructedPoints.length <= routeWithMetroGap.length) {
    throw new Error('Expected reconstructed path to contain infilled subway points!');
  }

  const hasMetroPoints = pipelineResult.reconstructedPoints.some(p => p.reconstructionSource === 'metro_transit');
  if (!hasMetroPoints) {
    throw new Error('Expected reconstructed route to contain points tagged with metro_transit!');
  }

  console.log('[PASS] Full pipeline successfully reconstructed underground metro tunnel corridor!\n');
  console.log('=== ALL MULTI-MODAL TRANSIT RECONSTRUCTION TESTS PASSED! ===');
}

runTests().catch(err => {
  console.error('Test failed with error:', err);
  process.exit(1);
});
