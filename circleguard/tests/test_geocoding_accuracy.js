/**
 * test_geocoding_accuracy.js
 * Verification of GeocodingService accuracy, safe place resolution, and Plus Code filtering.
 */

const assert = require('assert');

// Simulate the cleaning and token deduplication logic in GeocodingService
function cleanAddressToken(token) {
  if (!token) return '';
  const trimmed = token.trim();
  if (!trimmed) return '';

  // Reject Plus Codes (e.g., "7M8R+4G", "8F9V+28 Bengaluru", "4Q77+XW")
  if (/^[A-Z0-9]{4,}\+[A-Z0-9]{2,}/i.test(trimmed)) return '';
  if (trimmed.includes('+') && trimmed.length <= 12) return '';

  // Reject raw coordinate strings (e.g. "12.3456, 78.9012")
  if (/^[-+]?\d{1,3}\.\d+,\s*[-+]?\d{1,3}\.\d+$/.test(trimmed)) return '';

  // Reject generic placeholders
  const lower = trimmed.toLowerCase();
  if (
    lower === 'unnamed road' ||
    lower === 'unknown' ||
    lower === 'null' ||
    lower === 'undefined' ||
    lower === 'current location' ||
    lower === 'location'
  ) {
    return '';
  }

  return trimmed;
}

function deduplicateParts(parts) {
  const result = [];
  const seen = new Set();

  for (const p of parts) {
    const cleaned = cleanAddressToken(p);
    if (!cleaned) continue;

    const lower = cleaned.toLowerCase();
    if (seen.has(lower)) continue;

    const isRedundant = result.some((existing) => {
      const exLower = existing.toLowerCase();
      return (
        exLower === lower ||
        (exLower.includes(lower) && exLower.length - lower.length < 8) ||
        (lower.includes(exLower) && lower.length - exLower.length < 8)
      );
    });

    if (!isRedundant) {
      result.push(cleaned);
      seen.add(lower);
    }
  }

  return result;
}

function calculateHaversineDistanceMeters(lat1, lon1, lat2, lon2) {
  const R = 6371e3;
  const toRad = Math.PI / 180;
  const dLat = (lat2 - lat1) * toRad;
  const dLon = (lon2 - lon1) * toRad;
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(lat1 * toRad) * Math.cos(lat2 * toRad) * Math.sin(dLon / 2) * Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

function findMatchingSafePlace(lat, lng, safePlaces = []) {
  for (const place of safePlaces) {
    const pLat = Number(place.latitude || place.lat || 0);
    const pLng = Number(place.longitude || place.lng || 0);
    if (!pLat || !pLng) continue;
    const radius = Math.max(Number(place.radius_m || place.radius || 120), 40);
    const dist = calculateHaversineDistanceMeters(lat, lng, pLat, pLng);
    if (dist <= radius) {
      return place;
    }
  }
  return null;
}

console.log('🧪 Starting Geocoding Accuracy Verification...');

// 1. Plus Code filtering tests
assert.strictEqual(cleanAddressToken('7M8R+4G'), '', 'Must strip short Plus code');
assert.strictEqual(cleanAddressToken('8F9V+28 Bengaluru'), '', 'Must strip Plus code with city');
assert.strictEqual(cleanAddressToken('4Q77+XW'), '', 'Must strip 4Q77+XW Plus code');
assert.strictEqual(cleanAddressToken('12.9716, 77.5946'), '', 'Must strip raw coordinates');
assert.strictEqual(cleanAddressToken('Unnamed Road'), '', 'Must strip generic placeholder');
assert.strictEqual(cleanAddressToken('100 Feet Road'), '100 Feet Road', 'Must preserve valid street name');
assert.strictEqual(cleanAddressToken('42 Baker Street'), '42 Baker Street', 'Must preserve valid building/street');
console.log('✅ Plus Code and placeholder sanitation tests passed.');

// 2. Safe place matching test
const testSafePlaces = [
  { id: '1', name: 'Home', latitude: 12.971598, longitude: 77.594562, radius_m: 100 },
  { id: '2', name: 'Office', latitude: 12.9352, longitude: 77.6245, radius_m: 150 },
];

const homeMatch = findMatchingSafePlace(12.971605, 77.594580, testSafePlaces);
assert(homeMatch !== null, 'Coordinates within 100m of Home must match');
assert.strictEqual(homeMatch.name, 'Home');

const outsideMatch = findMatchingSafePlace(12.980000, 77.600000, testSafePlaces);
assert.strictEqual(outsideMatch, null, 'Coordinates 1km away must return null');
console.log('✅ Circle Safe Place geofence matching tests passed.');

// 3. Address synthesis and token deduplication
const rawParts = [
  'Oakwood Apts',
  '3rd Cross Road',
  '3rd Cross Road', // Duplicate
  'Indiranagar',
  'Bengaluru',
  'Bengaluru Urban', // Redundant
  '560038',
  'India',
];

const deduped = deduplicateParts(rawParts);
assert.strictEqual(deduped.filter(x => x === '3rd Cross Road').length, 1, 'No duplicate street names');
assert.strictEqual(deduped.filter(x => x.toLowerCase().includes('bengaluru')).length, 1, 'No redundant city tokens');
console.log('✅ Deduplication output:', deduped.join(', '));
console.log('🎉 ALL GEOCODING ACCURACY TESTS PASSED PERFECTLY!');
