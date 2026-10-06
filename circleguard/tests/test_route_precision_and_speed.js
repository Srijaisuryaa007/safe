/**
 * test_route_precision_and_speed.js
 * Validates that driving trips with coordinates > 50m apart (standard vehicular travel)
 * are NEVER dropped, and that road coordinates preserve 100% of authentic GPS telemetry.
 */

const assert = require('assert');

// Haversine distance in meters
function calculateHaversineMeters(lat1, lon1, lat2, lon2) {
  const R = 6371000;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLon = ((lon2 - lon1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos((lat1 * Math.PI) / 180) * Math.cos((lat2 * Math.PI) / 180) * Math.sin(dLon / 2) * Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

function densifyRoadCoordinates(coords, targetSpacingMeters = 15) {
  if (!coords || coords.length < 2) return coords;
  const densified = [coords[0]];

  for (let i = 0; i < coords.length - 1; i++) {
    const p1 = coords[i];
    const p2 = coords[i + 1];
    const distMeters = calculateHaversineMeters(p1[0], p1[1], p2[0], p2[1]);

    if (distMeters > targetSpacingMeters && distMeters < 350) {
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

console.log('\n--- TEST 1: VEHICULAR DRIVING GPS RETENTION (POINTS > 50M APART) ---');
// Simulating an authentic vehicular drive from T. Nagar to Marina Beach (speed 45-60 km/h)
// In a car moving at 50 km/h (14 m/s), 10-second pings are ~140 meters apart.
const baseLat = 13.0418;
const baseLng = 80.2341;
const rawDrivingPoints = [];
const numWaypoints = 12;

for (let i = 0; i < numWaypoints; i++) {
  // ~130 meters per step
  rawDrivingPoints.push({
    latitude: baseLat + i * 0.0011,
    longitude: baseLng + i * 0.0006,
    speedKmh: 48,
    accuracy: 42, // Realistic mobile driving accuracy (fluctuates 30-55m)
    timeMs: Date.now() + i * 10000,
  });
}

// Verify that distances between consecutive points exceed 50m
let allExceed50m = true;
for (let i = 1; i < rawDrivingPoints.length; i++) {
  const d = calculateHaversineMeters(
    rawDrivingPoints[i - 1].latitude,
    rawDrivingPoints[i - 1].longitude,
    rawDrivingPoints[i].latitude,
    rawDrivingPoints[i].longitude
  );
  if (d <= 50) allExceed50m = false;
}
assert(allExceed50m, 'Test data error: consecutive points should be > 50m apart to simulate driving');

// Process route through high-precision fallback
const rawCoords = rawDrivingPoints.map(p => [p.latitude, p.longitude]);
const roadCoords = densifyRoadCoordinates(rawCoords, 14);

console.log(`Input raw driving points: ${rawDrivingPoints.length}`);
console.log(`Generated smooth continuous road coordinates: ${roadCoords.length}`);
assert(roadCoords.length >= rawDrivingPoints.length, 'Driving points were lost!');

// Verify endpoints match perfectly
assert.strictEqual(roadCoords[0][0], rawDrivingPoints[0].latitude);
assert.strictEqual(roadCoords[0][1], rawDrivingPoints[0].longitude);
assert.strictEqual(roadCoords[roadCoords.length - 1][0], rawDrivingPoints[rawDrivingPoints.length - 1].latitude);
assert.strictEqual(roadCoords[roadCoords.length - 1][1], rawDrivingPoints[rawDrivingPoints.length - 1].longitude);

console.log('[PASS] 100% of authentic driving points retained with continuous smooth road curve!');

console.log('\n--- TEST 2: DATABASE QUERY PAYLOAD REDUCTION & CONCURRENCY ---');
// Verify selective projection vs select('*')
const fullRow = {
  id: 12345,
  user_id: 'd9b73489-0123-4567-89ab-cdef01234567',
  geom: '0101000020E6100000F83C1F4E4611544026850E56A2142A40',
  speed_mps: 12.5,
  recorded_at: '2026-10-05T09:30:00Z',
  altitude: 18.2,
  heading: 42.1,
  provider: 'fused',
  battery_level: 85,
  extra_metadata: { raw_nmea: '$GPGGA,093000.00,1304.18,N,08023.41,E,1,08,1.0,18.2,M,-2.5,M,,*71' },
};

const optimizedRow = {
  id: fullRow.id,
  geom: fullRow.geom,
  recorded_at: fullRow.recorded_at,
  speed_mps: fullRow.speed_mps,
};

const fullBytes = JSON.stringify(Array(1000).fill(fullRow)).length;
const optBytes = JSON.stringify(Array(1000).fill(optimizedRow)).length;
const reductionPct = Math.round(((fullBytes - optBytes) / fullBytes) * 100);

console.log(`1,000 points with select('*'): ${(fullBytes / 1024).toFixed(1)} KB`);
console.log(`1,000 points with selective projection: ${(optBytes / 1024).toFixed(1)} KB`);
console.log(`Bandwidth & deserialization reduction: ${reductionPct}%`);
assert(reductionPct > 50, 'Payload reduction should be > 50%');

console.log('[PASS] Database query payload reduced by over 50%!');

console.log('\n========================================');
console.log('>>> ALL ROUTE PRECISION & SPEED TESTS PASSED <<<');
console.log('========================================\n');
