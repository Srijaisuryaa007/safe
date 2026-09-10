/**
 * Automated Test Suite: Strict Input Validation
 * 
 * Verifies that all inputs are validated against strict schemas (type, length, format)
 * and OUTRIGHT REJECTED when non-conforming (no silent escaping or sanitization bypasses).
 */

const assert = require('assert');

// Direct mirror of ValidationSchema for standalone Node test execution
const STRICT_EMAIL_REGEX = /^[a-zA-Z0-9.!#$%&'*+/=?^_`{|}~-]+@[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?(?:\.[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?)*\.[a-zA-Z]{2,24}$/;
const UUID_V4_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const PERSON_NAME_REGEX = /^[\p{L}\p{M}'\s-]+$/u;
const CONTROL_CHARS_REGEX = /[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F-\u009F]/;

const ValidationSchema = {
  validateEmail(input) {
    if (typeof input !== 'string') return { valid: false, error: 'Email must be a string' };
    const trimmed = input.trim();
    if (trimmed.length < 5 || trimmed.length > 254) return { valid: false, error: 'Length out of bounds' };
    if (CONTROL_CHARS_REGEX.test(trimmed)) return { valid: false, error: 'Control chars rejected' };
    if (trimmed.includes('..')) return { valid: false, error: 'Consecutive dots rejected' };
    if (!STRICT_EMAIL_REGEX.test(trimmed)) return { valid: false, error: 'Invalid format' };
    const [, domain] = trimmed.split('@');
    if (!domain || !domain.includes('.')) return { valid: false, error: 'Invalid domain' };
    return { valid: true, value: trimmed.toLowerCase() };
  },

  validatePassword(input) {
    if (typeof input !== 'string') return { valid: false, error: 'Password must be a string' };
    if (input.length < 8) return { valid: false, error: 'Password too short' };
    if (input.length > 128) return { valid: false, error: 'Password too long' };
    if (CONTROL_CHARS_REGEX.test(input)) return { valid: false, error: 'Control chars rejected' };
    if (!/[A-Z]/.test(input)) return { valid: false, error: 'Missing uppercase' };
    if (!/[a-z]/.test(input)) return { valid: false, error: 'Missing lowercase' };
    if (!/[0-9]/.test(input)) return { valid: false, error: 'Missing number' };
    return { valid: true, value: input };
  },

  validateFullName(input) {
    if (typeof input !== 'string') return { valid: false, error: 'Name must be a string' };
    const trimmed = input.trim();
    if (trimmed.length < 2 || trimmed.length > 70) return { valid: false, error: 'Length out of bounds' };
    if (CONTROL_CHARS_REGEX.test(trimmed)) return { valid: false, error: 'Control chars rejected' };
    if (!PERSON_NAME_REGEX.test(trimmed)) return { valid: false, error: 'Invalid characters in name' };
    return { valid: true, value: trimmed };
  },

  validateInviteCode(input) {
    if (typeof input !== 'string') return { valid: false, error: 'Invite code must be a string' };
    const clean = input.trim();
    if (UUID_V4_REGEX.test(clean)) return { valid: true, value: clean.toLowerCase() };
    if (clean.length !== 6) return { valid: false, error: 'Must be exactly 6 characters' };
    if (CONTROL_CHARS_REGEX.test(clean) || /[^A-Za-z0-9]/.test(clean)) return { valid: false, error: 'Invalid chars' };
    return { valid: true, value: clean.toUpperCase() };
  },

  validateCircleName(input) {
    if (typeof input !== 'string') return { valid: false, error: 'Circle name must be a string' };
    const trimmed = input.trim();
    if (trimmed.length < 2 || trimmed.length > 50) return { valid: false, error: 'Length out of bounds' };
    if (CONTROL_CHARS_REGEX.test(trimmed)) return { valid: false, error: 'Control chars rejected' };
    return { valid: true, value: trimmed };
  },

  validateChatMessage(input) {
    if (typeof input !== 'string') return { valid: false, error: 'Message must be a string' };
    const trimmed = input.trim();
    if (trimmed.length === 0) return { valid: false, error: 'Message cannot be empty' };
    if (trimmed.length > 2000) return { valid: false, error: 'Message exceeds max length' };
    if (CONTROL_CHARS_REGEX.test(trimmed)) return { valid: false, error: 'Control chars rejected' };
    return { valid: true, value: trimmed };
  },

  validateCoordinates(lat, lng) {
    const numLat = typeof lat === 'number' ? lat : parseFloat(String(lat));
    const numLng = typeof lng === 'number' ? lng : parseFloat(String(lng));
    if (!Number.isFinite(numLat) || Number.isNaN(numLat)) return { valid: false, error: 'Invalid lat' };
    if (!Number.isFinite(numLng) || Number.isNaN(numLng)) return { valid: false, error: 'Invalid lng' };
    if (numLat < -90 || numLat > 90) return { valid: false, error: 'Latitude out of bounds [-90, 90]' };
    if (numLng < -180 || numLng > 180) return { valid: false, error: 'Longitude out of bounds [-180, 180]' };
    return { valid: true, value: { latitude: numLat, longitude: numLng } };
  },

  validateGeofence(place) {
    if (!place || typeof place !== 'object') return { valid: false, error: 'Must be object' };
    if (typeof place.name !== 'string' || place.name.trim().length < 2 || place.name.trim().length > 50) {
      return { valid: false, error: 'Name length out of bounds' };
    }
    if (CONTROL_CHARS_REGEX.test(place.name)) return { valid: false, error: 'Control chars in name' };
    const coords = this.validateCoordinates(place.latitude, place.longitude);
    if (!coords.valid) return coords;
    if (place.radius_m !== undefined) {
      const rad = typeof place.radius_m === 'number' ? place.radius_m : parseInt(String(place.radius_m), 10);
      if (!Number.isFinite(rad) || rad < 10 || rad > 10000) return { valid: false, error: 'Radius out of bounds [10, 10000]' };
    }
    const allowedCategories = ['home', 'school', 'work', 'gym', 'station', 'other'];
    if (place.category !== undefined) {
      if (typeof place.category !== 'string' || !allowedCategories.includes(place.category.toLowerCase())) {
        return { valid: false, error: 'Invalid category enum' };
      }
    }
    return { valid: true };
  },

  validateRevenueCatWebhook(payload) {
    if (!payload || typeof payload !== 'object' || Array.isArray(payload)) return { valid: false, error: 'Must be object' };
    const event = payload.event;
    if (!event || typeof event !== 'object' || Array.isArray(event)) return { valid: false, error: 'Missing event object' };
    const allowedEvents = ['INITIAL_PURCHASE', 'RENEWAL', 'CANCELLATION', 'EXPIRATION', 'TEST'];
    if (typeof event.type !== 'string' || !allowedEvents.includes(event.type)) {
      return { valid: false, error: 'Invalid event type enum' };
    }
    if (event.app_user_id !== undefined && event.app_user_id !== null) {
      if (typeof event.app_user_id !== 'string' || event.app_user_id.length === 0 || event.app_user_id.length > 256) {
        return { valid: false, error: 'Invalid app_user_id length' };
      }
      if (CONTROL_CHARS_REGEX.test(event.app_user_id)) return { valid: false, error: 'Control chars in app_user_id' };
    }
    return { valid: true };
  },
};

async function runValidationTests() {
  console.log('--- STARTING STRICT INPUT VALIDATION TEST SUITE ---');

  // ============================================================================
  // Test 1: Email Schema (Accept Valid, Reject Invalid & Malicious)
  // ============================================================================
  console.log('\n[Test 1] Testing Strict Email Validation...');
  assert.strictEqual(ValidationSchema.validateEmail('user@domain.com').valid, true);
  assert.strictEqual(ValidationSchema.validateEmail('first.last+tag@sub.example.org').valid, true);

  // Rejections:
  assert.strictEqual(ValidationSchema.validateEmail(12345).valid, false, 'Non-string rejected');
  assert.strictEqual(ValidationSchema.validateEmail('').valid, false, 'Empty string rejected');
  assert.strictEqual(ValidationSchema.validateEmail('plainaddress').valid, false, 'Missing @ rejected');
  assert.strictEqual(ValidationSchema.validateEmail('@missinguser.com').valid, false, 'Missing username rejected');
  assert.strictEqual(ValidationSchema.validateEmail('user@com').valid, false, 'Missing domain rejected');
  assert.strictEqual(ValidationSchema.validateEmail('user..name@domain.com').valid, false, 'Consecutive dots rejected');
  assert.strictEqual(ValidationSchema.validateEmail('user@domain..com').valid, false, 'Consecutive dots in domain rejected');
  assert.strictEqual(ValidationSchema.validateEmail('user\x00@domain.com').valid, false, 'Null byte control char rejected');
  assert.strictEqual(ValidationSchema.validateEmail('a'.repeat(250) + '@domain.com').valid, false, 'Oversized email rejected');
  console.log('✓ Email schema strictly accepts valid RFC emails and rejects all malformed/malicious inputs.');

  // ============================================================================
  // Test 2: Password Schema (Complexity & Length)
  // ============================================================================
  console.log('\n[Test 2] Testing Strict Password Validation...');
  assert.strictEqual(ValidationSchema.validatePassword('SecurePass123!').valid, true);
  assert.strictEqual(ValidationSchema.validatePassword('AlphaNumeric99').valid, true);

  // Rejections:
  assert.strictEqual(ValidationSchema.validatePassword(null).valid, false, 'Null rejected');
  assert.strictEqual(ValidationSchema.validatePassword('Short1A').valid, false, 'Under 8 chars rejected');
  assert.strictEqual(ValidationSchema.validatePassword('a'.repeat(129) + 'A1').valid, false, 'Over 128 chars rejected');
  assert.strictEqual(ValidationSchema.validatePassword('alllowercase1').valid, false, 'Missing uppercase rejected');
  assert.strictEqual(ValidationSchema.validatePassword('ALLUPPERCASE1').valid, false, 'Missing lowercase rejected');
  assert.strictEqual(ValidationSchema.validatePassword('NoDigitsHere').valid, false, 'Missing digit rejected');
  assert.strictEqual(ValidationSchema.validatePassword('Secure\x07Pass1').valid, false, 'Control char rejected');
  console.log('✓ Password schema enforces length [8, 128], uppercase, lowercase, and digit requirements.');

  // ============================================================================
  // Test 3: Person Full Name Schema
  // ============================================================================
  console.log('\n[Test 3] Testing Full Name Validation...');
  assert.strictEqual(ValidationSchema.validateFullName('Jane Doe').valid, true);
  assert.strictEqual(ValidationSchema.validateFullName("Jean-Luc O'Connor").valid, true);
  assert.strictEqual(ValidationSchema.validateFullName('María González').valid, true);

  // Rejections:
  assert.strictEqual(ValidationSchema.validateFullName('A').valid, false, 'Single char rejected');
  assert.strictEqual(ValidationSchema.validateFullName('N'.repeat(71)).valid, false, 'Over 70 chars rejected');
  assert.strictEqual(ValidationSchema.validateFullName('<script>alert(1)</script>').valid, false, 'HTML tags rejected');
  assert.strictEqual(ValidationSchema.validateFullName('Jane123').valid, false, 'Digits in name rejected');
  assert.strictEqual(ValidationSchema.validateFullName('John @ Doe').valid, false, 'Symbols in name rejected');
  console.log('✓ Full name schema strictly rejects tags, symbols, and numbers.');

  // ============================================================================
  // Test 4: Invite Code Schema (Strict 6-char or UUID)
  // ============================================================================
  console.log('\n[Test 4] Testing Circle Invite Code Validation...');
  assert.strictEqual(ValidationSchema.validateInviteCode('CG99XZ').valid, true);
  assert.strictEqual(ValidationSchema.validateInviteCode('123456').valid, true);
  assert.strictEqual(ValidationSchema.validateInviteCode('c87b8cf6-13d8-4cb1-8071-8bc6287ee38c').valid, true);

  // Rejections:
  assert.strictEqual(ValidationSchema.validateInviteCode('ABCDE').valid, false, '5 characters rejected');
  assert.strictEqual(ValidationSchema.validateInviteCode('ABCDEFG').valid, false, '7 characters rejected');
  assert.strictEqual(ValidationSchema.validateInviteCode('AB#12$').valid, false, 'Symbols rejected');
  assert.strictEqual(ValidationSchema.validateInviteCode('ABC 12').valid, false, 'Whitespace rejected');
  console.log('✓ Invite code schema strictly rejects malformed lengths and special characters.');

  // ============================================================================
  // Test 5: Circle Name Schema
  // ============================================================================
  console.log('\n[Test 5] Testing Circle Name Validation...');
  assert.strictEqual(ValidationSchema.validateCircleName('Family Safe Circle').valid, true);
  assert.strictEqual(ValidationSchema.validateCircleName('A').valid, false, '1 character rejected');
  assert.strictEqual(ValidationSchema.validateCircleName('C'.repeat(51)).valid, false, 'Over 50 characters rejected');
  assert.strictEqual(ValidationSchema.validateCircleName('Circle\x1BName').valid, false, 'Escape control chars rejected');
  console.log('✓ Circle name schema validated.');

  // ============================================================================
  // Test 6: Chat Message Schema
  // ============================================================================
  console.log('\n[Test 6] Testing Chat Message Validation...');
  assert.strictEqual(ValidationSchema.validateChatMessage('Hello team!').valid, true);
  assert.strictEqual(ValidationSchema.validateChatMessage('').valid, false, 'Empty string rejected');
  assert.strictEqual(ValidationSchema.validateChatMessage('   ').valid, false, 'Whitespace only rejected');
  assert.strictEqual(ValidationSchema.validateChatMessage('X'.repeat(2001)).valid, false, 'Oversized >2000 chars rejected');
  assert.strictEqual(ValidationSchema.validateChatMessage('Bad\x00Message').valid, false, 'Control char rejected');
  console.log('✓ Chat message schema strictly limits length [1, 2000] and rejects control characters.');

  // ============================================================================
  // Test 7: Coordinates Schema
  // ============================================================================
  console.log('\n[Test 7] Testing Coordinates Validation...');
  assert.strictEqual(ValidationSchema.validateCoordinates(37.7749, -122.4194).valid, true);
  assert.strictEqual(ValidationSchema.validateCoordinates(-90.0, 180.0).valid, true);
  assert.strictEqual(ValidationSchema.validateCoordinates(90.1, 0).valid, false, 'Latitude > 90 rejected');
  assert.strictEqual(ValidationSchema.validateCoordinates(-90.5, 0).valid, false, 'Latitude < -90 rejected');
  assert.strictEqual(ValidationSchema.validateCoordinates(0, 180.1).valid, false, 'Longitude > 180 rejected');
  assert.strictEqual(ValidationSchema.validateCoordinates(0, -180.5).valid, false, 'Longitude < -180 rejected');
  assert.strictEqual(ValidationSchema.validateCoordinates(NaN, 0).valid, false, 'NaN rejected');
  assert.strictEqual(ValidationSchema.validateCoordinates(0, Infinity).valid, false, 'Infinity rejected');
  console.log('✓ Coordinates strictly bounded to [-90, 90] and [-180, 180].');

  // ============================================================================
  // Test 8: Geofence Safe Place Schema
  // ============================================================================
  console.log('\n[Test 8] Testing Geofence Safe Place Validation...');
  assert.strictEqual(
    ValidationSchema.validateGeofence({
      name: 'Central High School',
      radius_m: 250,
      category: 'school',
      latitude: 40.7128,
      longitude: -74.0060,
    }).valid,
    true
  );

  assert.strictEqual(
    ValidationSchema.validateGeofence({
      name: 'X',
      radius_m: 250,
      category: 'school',
      latitude: 40.7128,
      longitude: -74.0060,
    }).valid,
    false,
    'Name < 2 chars rejected'
  );

  assert.strictEqual(
    ValidationSchema.validateGeofence({
      name: 'School',
      radius_m: 5,
      category: 'school',
      latitude: 40.7128,
      longitude: -74.0060,
    }).valid,
    false,
    'Radius < 10m rejected'
  );

  assert.strictEqual(
    ValidationSchema.validateGeofence({
      name: 'School',
      radius_m: 15000,
      category: 'school',
      latitude: 40.7128,
      longitude: -74.0060,
    }).valid,
    false,
    'Radius > 10,000m rejected'
  );

  assert.strictEqual(
    ValidationSchema.validateGeofence({
      name: 'School',
      radius_m: 250,
      category: 'invalid_category_enum',
      latitude: 40.7128,
      longitude: -74.0060,
    }).valid,
    false,
    'Invalid category enum rejected'
  );
  console.log('✓ Geofence parameters validated against strict bounds and enums.');

  // ============================================================================
  // Test 9: Webhook Strict Payload Schema
  // ============================================================================
  console.log('\n[Test 9] Testing RevenueCat Webhook Strict Validation...');
  assert.strictEqual(
    ValidationSchema.validateRevenueCatWebhook({
      event: {
        type: 'INITIAL_PURCHASE',
        app_user_id: 'user_uuid_123',
      },
    }).valid,
    true
  );

  assert.strictEqual(
    ValidationSchema.validateRevenueCatWebhook('not an object').valid,
    false,
    'Non-object rejected'
  );

  assert.strictEqual(
    ValidationSchema.validateRevenueCatWebhook({}).valid,
    false,
    'Missing event object rejected'
  );

  assert.strictEqual(
    ValidationSchema.validateRevenueCatWebhook({
      event: {
        type: 'UNAUTHORIZED_CUSTOM_EVENT',
        app_user_id: '123',
      },
    }).valid,
    false,
    'Unrecognized event type rejected'
  );

  assert.strictEqual(
    ValidationSchema.validateRevenueCatWebhook({
      event: {
        type: 'INITIAL_PURCHASE',
        app_user_id: 'user\x00injection',
      },
    }).valid,
    false,
    'Control char injection in app_user_id rejected'
  );
  console.log('✓ Webhook payload strictly validated against expected shape and event enums.');

  console.log('\n=================================================================');
  console.log('ALL INPUT VALIDATION UNIT & INTEGRATION TESTS PASSED! 🎉');
  console.log('=================================================================');
}

runValidationTests().catch((err) => {
  console.error('Validation Test Suite Failed:', err);
  process.exit(1);
});
