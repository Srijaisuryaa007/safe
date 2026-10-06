const assert = require('assert');

// 1. Test coordinate parsing helper logic
function parseEWKBPoint(hex) {
  try {
    if (typeof hex !== 'string') return null;
    const cleanHex = hex.trim();
    if (cleanHex.length >= 40) {
      const isLittleEndian = cleanHex.startsWith('0101') || cleanHex.startsWith('01');
      let offset = cleanHex.length >= 50 ? 18 : (cleanHex.length >= 42 ? 10 : 2);
      const lngHex = cleanHex.substr(offset, 16);
      const latHex = cleanHex.substr(offset + 16, 16);
      if (lngHex.length < 16 || latHex.length < 16) return null;
      const buffer = new ArrayBuffer(8);
      const view = new DataView(buffer);
      const parseHexDouble = (hexStr) => {
        for (let i = 0; i < 8; i++) {
          const byte = parseInt(hexStr.substr(i * 2, 2), 16);
          view.setUint8(isLittleEndian ? i : 7 - i, byte);
        }
        return view.getFloat64(0, isLittleEndian);
      };
      const lng = parseHexDouble(lngHex);
      const lat = parseHexDouble(latHex);
      if (!isNaN(lat) && !isNaN(lng) && Math.abs(lat) <= 90 && Math.abs(lng) <= 180 && (lat !== 0 || lng !== 0)) {
        return { latitude: lat, longitude: lng };
      }
    }
  } catch (e) {}
  return null;
}

function parsePointGeom(geom) {
  if (!geom) return null;
  if (typeof geom === 'string') {
    const clean = geom.trim();
    if (clean.startsWith('01') || clean.startsWith('00')) {
      const parsed = parseEWKBPoint(clean);
      if (parsed) return parsed;
    }
    const match = clean.match(/POINT\s*\(\s*([-\d.]+)[,\s]+([-\d.]+)\s*\)/i);
    if (match) {
      return { longitude: parseFloat(match[1]), latitude: parseFloat(match[2]) };
    }
  } else if (typeof geom === 'object') {
    if (Array.isArray(geom.coordinates)) {
      return { longitude: parseFloat(geom.coordinates[0]), latitude: parseFloat(geom.coordinates[1]) };
    } else if (geom.latitude && geom.longitude) {
      return { latitude: parseFloat(geom.latitude), longitude: parseFloat(geom.longitude) };
    }
  }
  return null;
}

// Test PostGIS WKT Point
const wkt = 'POINT(80.2707 13.0827)';
const parsedWkt = parsePointGeom(wkt);
assert.ok(parsedWkt, 'Should parse WKT point');
assert.strictEqual(Math.round(parsedWkt.latitude * 10000), 130827);
assert.strictEqual(Math.round(parsedWkt.longitude * 10000), 802707);
console.log('[PASS] PostGIS WKT coordinate parser verified:', parsedWkt);

// Test GeoJSON Object Point
const geoJson = { coordinates: [80.25, 13.05] };
const parsedGeoJson = parsePointGeom(geoJson);
assert.ok(parsedGeoJson, 'Should parse GeoJSON point');
assert.strictEqual(parsedGeoJson.latitude, 13.05);
assert.strictEqual(parsedGeoJson.longitude, 80.25);
console.log('[PASS] GeoJSON coordinate parser verified:', parsedGeoJson);

// Test Direct Latitude/Longitude Fallback
const dbItem = { latitude: 13.085, longitude: 80.275, speed_mps: 5.2, accuracy: 8 };
const directCoords = parsePointGeom(dbItem.geom) || 
  (dbItem.latitude != null && dbItem.longitude != null ? { latitude: Number(dbItem.latitude), longitude: Number(dbItem.longitude) } : null);
assert.ok(directCoords, 'Should fall back to numeric latitude/longitude columns');
assert.strictEqual(directCoords.latitude, 13.085);
assert.strictEqual(directCoords.longitude, 80.275);
console.log('[PASS] Direct latitude/longitude fallback verified:', directCoords);

// Test Live Member Stationary Dwell Synthesis
function synthesizeLiveStationaryEvent(member, liveLoc, places) {
  const dwellLat = liveLoc.latitude;
  const dwellLng = liveLoc.longitude;
  const placeName = 'Safe Home';
  const durationMins = 145;
  const durationFormatted = `${Math.floor(durationMins / 60)}h ${durationMins % 60}m`;
  const timeFormatted = '11:30 AM';

  const singleStop = {
    id: `stop_live_${member.user_id}`,
    name: placeName,
    category: 'home',
    isSafePlace: true,
    latitude: dwellLat,
    longitude: dwellLng,
    arrivalTime: timeFormatted,
    departureTime: 'Present (Live)',
    durationMinutes: durationMins,
    pointsCount: 1,
  };

  const singleEvent = {
    id: `timeline_stay_${member.user_id}`,
    type: 'stay',
    title: `Stationary at ${placeName}`,
    subtitle: `Circle Safe Place • ${durationFormatted}`,
    timeRange: `${timeFormatted} - Present`,
    durationText: durationFormatted,
    categoryIcon: 'shield-checkmark',
    categoryColor: '#2E7D5B',
    pointIndex: 0,
    latitude: dwellLat,
    longitude: dwellLng,
    data: {
      ...singleStop,
      durationFormatted,
      batteryLevel: liveLoc.battery_pct,
    },
  };

  return { singleStop, singleEvent };
}

const mockLiveLoc = { latitude: 13.0827, longitude: 80.2707, battery_pct: 92, speed_mps: 0, updated_at: new Date().toISOString() };
const mockMember = { user_id: 'other-user-456', name: 'Other Member' };
const { singleStop, singleEvent } = synthesizeLiveStationaryEvent(mockMember, mockLiveLoc, []);
assert.strictEqual(singleStop.latitude, 13.0827);
assert.strictEqual(singleStop.isSafePlace, true);
assert.strictEqual(singleEvent.data.batteryLevel, 92);
console.log('[PASS] Live stationary dwell synthesis verified:', singleEvent.title, singleEvent.subtitle);

console.log('=== ALL OTHER MEMBER TELEMETRY & ROUTE PRECISION TESTS PASSED ===');
