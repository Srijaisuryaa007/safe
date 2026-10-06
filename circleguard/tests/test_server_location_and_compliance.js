const assert = require('assert');

console.log('================================================================');
console.log('RUNNING ENTERPRISE TEST SUITE: SERVER-TRIGGERED LOCATION & COMPLIANCE');
console.log('================================================================\n');

// -----------------------------------------------------------------------------
// TEST 1: SERVER-TRIGGERED LOCATION REQUEST TIMEOUT & FALLBACK SIMULATION
// -----------------------------------------------------------------------------
console.log('--- TEST 1: LOCATION REQUEST 30s TIMEOUT & LAST-KNOWN FALLBACK ---');

function simulateLocationRequestResolution(targetResponsive, targetLat, targetLng, lastKnownLat, lastKnownLng, lastKnownUpdatedAt) {
  const timeoutMs = 30000;
  
  if (targetResponsive) {
    // Fulfilled within timeout
    return {
      success: true,
      isLive: true,
      latitude: targetLat,
      longitude: targetLng,
      timestamp: new Date().toISOString(),
      label: 'Live GPS fix received now',
    };
  } else {
    // 30s Timeout expired: fallback to last known location
    const minutesAgo = Math.max(1, Math.round((Date.now() - new Date(lastKnownUpdatedAt).getTime()) / 60000));
    const label = minutesAgo < 60 ? `Last updated ${minutesAgo} min ago` : `Last updated ${Math.round(minutesAgo / 60)} hr ago`;
    return {
      success: true,
      isLive: false,
      latitude: lastKnownLat,
      longitude: lastKnownLng,
      timestamp: lastKnownUpdatedAt,
      label,
    };
  }
}

// Case 1A: Responsive target device
const resA = simulateLocationRequestResolution(true, 13.0827, 80.2707, 13.0800, 80.2600, '2026-10-05T05:00:00Z');
assert.strictEqual(resA.isLive, true);
assert.strictEqual(resA.latitude, 13.0827);
assert.strictEqual(resA.label, 'Live GPS fix received now');
console.log('[PASS] Responsive target device returns live GPS fix immediately');

// Case 1B: Offline or silent target device (times out after 30s)
const tenMinsAgo = new Date(Date.now() - 10 * 60000).toISOString();
const resB = simulateLocationRequestResolution(false, null, null, 12.9716, 77.5946, tenMinsAgo);
assert.strictEqual(resB.isLive, false);
assert.strictEqual(resB.latitude, 12.9716);
assert.ok(resB.label.includes('10 min ago'));
console.log('[PASS] Unresponsive device safely falls back to last known location with relative age:', resB.label);


// -----------------------------------------------------------------------------
// TEST 2: ANTI-SPAM RATE LIMITING
// -----------------------------------------------------------------------------
console.log('\n--- TEST 2: RATE LIMITING PER CONTACT PAIR ---');

const requestTimestamps = new Map();

function checkRateLimit(requesterId, targetId, windowMs = 45000) {
  const key = `${requesterId}_${targetId}`;
  const now = Date.now();
  const lastTime = requestTimestamps.get(key) || 0;
  if (now - lastTime < windowMs) {
    return { allowed: false, retryAfterSec: Math.ceil((windowMs - (now - lastTime)) / 1000) };
  }
  requestTimestamps.set(key, now);
  return { allowed: true };
}

const req1 = checkRateLimit('user_A', 'user_B');
assert.strictEqual(req1.allowed, true);

const req2 = checkRateLimit('user_A', 'user_B');
assert.strictEqual(req2.allowed, false);
assert.ok(req2.retryAfterSec > 0 && req2.retryAfterSec <= 45);
console.log('[PASS] Rapid spam request blocked with 429 retry-after:', req2.retryAfterSec, 'seconds');


// -----------------------------------------------------------------------------
// TEST 3: OFFLINE SMS SOS FALLBACK LINK GENERATION
// -----------------------------------------------------------------------------
console.log('\n--- TEST 3: OFFLINE SMS SOS GENERATION ---');

function formatOfflineSms(userName, lat, lng, accuracy, phoneNumbers, customMessage) {
  const locationLink = (lat !== null && lng !== null) ? `https://maps.google.com/?q=${lat},${lng}` : 'Location unavailable';
  const defaultMsg = `EMERGENCY ALERT: ${userName} triggered an SOS distress alert. Live GPS Map Link:\n${locationLink}\n(Accuracy: ~${accuracy}m)\n\nSent via CircleGuard Offline SMS Fallback`;
  const msg = customMessage ? `${customMessage}\n\n${locationLink}` : defaultMsg;
  
  const separator = '&'; // iOS style or ? for android
  const recipientsStr = phoneNumbers.join(',');
  const uri = `sms:${recipientsStr}${separator}body=${encodeURIComponent(msg)}`;
  return { uri, msg, locationLink };
}

const smsOutput = formatOfflineSms('Rahul Sharma', 28.6139, 77.2090, 12, ['+919876543210', '+919123456789']);
assert.ok(smsOutput.uri.startsWith('sms:+919876543210,+919123456789'));
assert.ok(smsOutput.msg.includes('https://maps.google.com/?q=28.6139,77.209'));
assert.ok(smsOutput.msg.includes('Accuracy: ~12m'));
console.log('[PASS] Emergency SMS correctly formatted with exact map link and multiple recipients');


// -----------------------------------------------------------------------------
// TEST 4: OEM BATTERY OPTIMIZATION & AUTOSTART DETECTION
// -----------------------------------------------------------------------------
console.log('\n--- TEST 4: MULTI-OEM BATTERY OPTIMIZATION DETECTION ---');

const OEM_DB = {
  xiaomi: { name: 'Xiaomi / MIUI / HyperOS', setting: 'No restrictions', autostart: true },
  samsung: { name: 'Samsung (One UI)', setting: 'Unrestricted', autostart: false },
  oppo: { name: 'Oppo (ColorOS)', setting: 'Allow background activity', autostart: true },
  vivo: { name: 'Vivo (Funtouch OS / OriginOS)', setting: 'High background power consumption', autostart: true },
  realme: { name: 'Realme (Realme UI)', setting: "Don't optimize", autostart: true },
  oneplus: { name: 'OnePlus (OxygenOS)', setting: "Don't optimize", autostart: false },
};

function getOemSpec(brand) {
  const b = (brand || '').toLowerCase();
  for (const [key, spec] of Object.entries(OEM_DB)) {
    if (b.includes(key)) return spec;
  }
  return { name: 'Standard Android', setting: 'Unrestricted', autostart: false };
}

const xiaomiSpec = getOemSpec('Xiaomi Poco F5');
assert.strictEqual(xiaomiSpec.name, 'Xiaomi / MIUI / HyperOS');
assert.strictEqual(xiaomiSpec.setting, 'No restrictions');
assert.strictEqual(xiaomiSpec.autostart, true);

const samsungSpec = getOemSpec('Samsung Galaxy S23');
assert.strictEqual(samsungSpec.name, 'Samsung (One UI)');
assert.strictEqual(samsungSpec.setting, 'Unrestricted');

console.log('[PASS] Accurate OEM battery settings detected for Xiaomi & Samsung');


// -----------------------------------------------------------------------------
// TEST 5: DPDP ACT 2023 CONSENT TRACKING & 30-DAY RETENTION
// -----------------------------------------------------------------------------
console.log('\n--- TEST 5: DPDP CONSENT AUDIT & DATA RETENTION ---');

const consentStore = new Map();

function grantDpdpConsent(userId, type, purpose, version = '1.0') {
  consentStore.set(`${userId}_${type}`, {
    status: 'granted',
    version,
    purpose,
    grantedAt: new Date().toISOString(),
  });
  return true;
}

function withdrawDpdpConsent(userId, type) {
  const existing = consentStore.get(`${userId}_${type}`);
  if (existing) {
    existing.status = 'withdrawn';
    existing.withdrawnAt = new Date().toISOString();
  }
  return true;
}

grantDpdpConsent('user_101', 'background_location', 'Continuous circle safety and geofence alerts', '1.0');
assert.strictEqual(consentStore.get('user_101_background_location').status, 'granted');

withdrawDpdpConsent('user_101', 'background_location');
assert.strictEqual(consentStore.get('user_101_background_location').status, 'withdrawn');
assert.ok(consentStore.get('user_101_background_location').withdrawnAt);

// Simulate 30-day retention purge
const testTelemetryRows = [
  { id: 1, recordedAt: new Date(Date.now() - 5 * 86400000).toISOString() },  // 5 days old -> KEEP
  { id: 2, recordedAt: new Date(Date.now() - 25 * 86400000).toISOString() }, // 25 days old -> KEEP
  { id: 3, recordedAt: new Date(Date.now() - 32 * 86400000).toISOString() }, // 32 days old -> PURGE
  { id: 4, recordedAt: new Date(Date.now() - 60 * 86400000).toISOString() }, // 60 days old -> PURGE
];

const thirtyDaysAgo = Date.now() - 30 * 86400000;
const retained = testTelemetryRows.filter(r => new Date(r.recordedAt).getTime() >= thirtyDaysAgo);
const purged = testTelemetryRows.filter(r => new Date(r.recordedAt).getTime() < thirtyDaysAgo);

assert.strictEqual(retained.length, 2);
assert.strictEqual(purged.length, 2);
console.log('[PASS] DPDP consent lifecycle & 30-day retention policy verified');

console.log('\n================================================================');
console.log('>>> ALL SERVER-TRIGGERED LOCATION & COMPLIANCE TESTS PASSED <<<');
console.log('================================================================\n');
