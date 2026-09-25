/**
 * test_industry_precision_routing.js
 * Comprehensive integration test for industry-level precision driving route reconstruction.
 */

const assert = require('assert');

// Test 1: Test OSRM Map Matching API directly
async function testOSRMMapMatching() {
  console.log('\n--- 1. TESTING OSRM MAP MATCHING API ---');
  // Raw GPS breadcrumbs along a known road in Chennai (Poonamallee High Rd / EVR Periyar Salai)
  const rawPoints = [
    { lat: 13.0827, lng: 80.2707, speed: 45 },
    { lat: 13.0838, lng: 80.2725, speed: 48 },
    { lat: 13.0850, lng: 80.2750, speed: 52 },
    { lat: 13.0862, lng: 80.2775, speed: 42 }
  ];

  const coordString = rawPoints.map(p => `${p.lng.toFixed(6)},${p.lat.toFixed(6)}`).join(';');
  const url = `https://router.project-osrm.org/match/v1/driving/${coordString}?geometries=geojson&overview=full&tidy=true&gaps=ignore`;

  console.log('Sending OSRM Match request for', rawPoints.length, 'raw GPS coordinates...');
  const res = await fetch(url);
  assert(res.ok, `OSRM Match HTTP response was not OK: ${res.status}`);

  const data = await res.json();
  console.log('OSRM Match response code:', data.code);
  assert.strictEqual(data.code, 'Ok', 'Expected OSRM Match code "Ok"');
  assert(data.matchings && data.matchings.length > 0, 'Expected at least 1 matching sequence');

  const matching = data.matchings[0];
  const roadCoords = matching.geometry.coordinates; // [[lng, lat], ...]
  console.log('Raw GPS points count:', rawPoints.length);
  console.log('Snapped road coordinates count:', roadCoords.length);
  console.log('Road Distance:', matching.distance.toFixed(1), 'meters');

  // Road coordinates should have significantly higher density following actual road curves
  assert(roadCoords.length > rawPoints.length, `Expected snapped road coordinates (${roadCoords.length}) > raw points (${rawPoints.length})`);
  console.log('[PASS] OSRM Map Matching snapped raw points to road centerline with curves!');
}

// Test 2: Test Corner-Preserving Trajectory Smoothing
function testCornerPreservingSmoothing() {
  console.log('\n--- 2. TESTING CORNER-PRESERVING TRAJECTORY SMOOTHING ---');

  // Simulate vehicle making a 90-degree right turn at a cross-street
  function calculateBearing(lat1, lng1, lat2, lng2) {
    const radLat1 = (lat1 * Math.PI) / 180;
    const radLat2 = (lat2 * Math.PI) / 180;
    const dLng = ((lng2 - lng1) * Math.PI) / 180;
    const y = Math.sin(dLng) * Math.cos(radLat2);
    const x = Math.cos(radLat1) * Math.sin(radLat2) - Math.sin(radLat1) * Math.cos(radLat2) * Math.cos(dLng);
    const brng = (Math.atan2(y, x) * 180) / Math.PI;
    return (brng + 360) % 360;
  }

  function smoothTrajectoryPoints(points) {
    if (!points || points.length < 3) return points;
    const smoothed = [{ ...points[0] }];
    for (let i = 1; i < points.length - 1; i++) {
      const prev = points[i - 1];
      const curr = points[i];
      const next = points[i + 1];

      const bIn = calculateBearing(prev.latitude, prev.longitude, curr.latitude, curr.longitude);
      const bOut = calculateBearing(curr.latitude, curr.longitude, next.latitude, next.longitude);
      let turnAngle = Math.abs(bOut - bIn);
      if (turnAngle > 180) turnAngle = 360 - turnAngle;

      if (turnAngle > 35) {
        // Corner turn: 90% weight to current point
        const cornerLat = prev.latitude * 0.05 + curr.latitude * 0.90 + next.latitude * 0.05;
        const cornerLng = prev.longitude * 0.05 + curr.longitude * 0.90 + next.longitude * 0.05;
        smoothed.push({ ...curr, latitude: cornerLat, longitude: cornerLng });
      } else {
        const avgLat = prev.latitude * 0.20 + curr.latitude * 0.60 + next.latitude * 0.20;
        const avgLng = prev.longitude * 0.20 + curr.longitude * 0.60 + next.longitude * 0.20;
        smoothed.push({ ...curr, latitude: avgLat, longitude: avgLng });
      }
    }
    smoothed.push({ ...points[points.length - 1] });
    return smoothed;
  }

  const cornerWaypoints = [
    { latitude: 13.0800, longitude: 80.2700 }, // Approach from South
    { latitude: 13.0850, longitude: 80.2700 }, // Corner intersection apex
    { latitude: 13.0850, longitude: 80.2750 }, // Exit toward East
  ];

  const smoothed = smoothTrajectoryPoints(cornerWaypoints);
  const apex = smoothed[1];

  console.log('Original corner apex:', cornerWaypoints[1]);
  console.log('Smoothed corner apex:', apex);

  const latDelta = Math.abs(apex.latitude - cornerWaypoints[1].latitude);
  const lngDelta = Math.abs(apex.longitude - cornerWaypoints[1].longitude);

  console.log('Latitude preservation delta:', (latDelta * 111000).toFixed(1), 'meters');
  console.log('Longitude preservation delta:', (lngDelta * 111000).toFixed(1), 'meters');

  assert(latDelta * 111000 < 35, 'Corner apex latitude shifted too much!');
  assert(lngDelta * 111000 < 35, 'Corner apex longitude shifted too much!');
  console.log('[PASS] Corner preservation successfully prevented cutting through buildings!');
}

// Test 3: Test Gap Detection and Road Reconnection
async function testGapInfilling() {
  console.log('\n--- 3. TESTING GAP INFILLING VIA ROAD ROUTING ---');
  // Two points across a gap (e.g. 1.2 km apart on a highway)
  const gapStart = { latitude: 13.0827, longitude: 80.2707 };
  const gapEnd = { latitude: 13.0920, longitude: 80.2790 };

  const url = `https://router.project-osrm.org/route/v1/driving/${gapStart.longitude.toFixed(6)},${gapStart.latitude.toFixed(6)};${gapEnd.longitude.toFixed(6)},${gapEnd.latitude.toFixed(6)}?overview=full&geometries=geojson`;
  const res = await fetch(url);
  assert(res.ok, 'OSRM Route response was not OK');

  const data = await res.json();
  assert.strictEqual(data.code, 'Ok', 'Expected OSRM Route code "Ok"');
  const roadCoords = data.routes[0].geometry.coordinates;

  console.log('Gap endpoints: 2 coordinates');
  console.log('Reconstructed road vertices count:', roadCoords.length);
  console.log('Reconstructed road distance:', data.routes[0].distance.toFixed(1), 'meters');
  assert(roadCoords.length > 5, 'Expected road gap to be reconstructed with multiple road vertices');
  console.log('[PASS] Dropped GPS gap infilled with authentic road corridor geometry!');
}

async function runAllTests() {
  try {
    await testOSRMMapMatching();
    testCornerPreservingSmoothing();
    await testGapInfilling();
    console.log('\n========================================');
    console.log('>>> ALL INDUSTRY PRECISION ROUTE TESTS PASSED <<<');
    console.log('========================================\n');
  } catch (err) {
    console.error('TEST FAILED:', err);
    process.exit(1);
  }
}

runAllTests();
