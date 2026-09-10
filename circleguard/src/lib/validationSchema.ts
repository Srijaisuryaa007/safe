/**
 * Production Input Validation Engine
 * 
 * Enforces strict schemas (type, length, format, allowed characters, range, enums)
 * and OUTRIGHT REJECTS non-conforming inputs (no silent escaping or sanitization bypasses).
 */

export interface ValidationResult<T = any> {
  valid: boolean;
  error?: string;
  value?: T;
}

// ============================================================================
// REGEX PATTERNS FOR STRICT FORMAT VALIDATION
// ============================================================================

// Strict RFC 5322 compatible email with non-empty local-part, valid domain labels, and 2-24 char TLD
const STRICT_EMAIL_REGEX = /^[a-zA-Z0-9.!#$%&'*+/=?^_`{|}~-]+@[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?(?:\.[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?)*\.[a-zA-Z]{2,24}$/;

// Standard UUID v4
const UUID_V4_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

// 6-Character Uppercase Alphanumeric Circle Code (rejecting ambiguous chars 0, O, I, 1 is optional, but standard format is 6 uppercase alnum)
const INVITE_CODE_REGEX = /^[A-HJ-NP-Za-km-z2-9]{6}$/i;

// Names: Letters (including Unicode / accented), spaces, hyphens, and apostrophes only. No HTML tags or scripts.
const PERSON_NAME_REGEX = /^[\p{L}\p{M}'\s-]+$/u;

// ASCII/Unicode control characters (0x00-0x1F except newline/tab, plus 0x7F-0x9F)
const CONTROL_CHARS_REGEX = /[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F-\u009F]/;

// Safe URL format
const HTTPS_URL_REGEX = /^https:\/\/[a-zA-Z0-9\-._~:/?#[\]@!$&'()*+,;=]+$/i;

// ============================================================================
// VALIDATION SCHEMAS
// ============================================================================

export const ValidationSchema = {
  /**
   * Validates Email Address:
   * - Type: String
   * - Length: Between 5 and 254 characters (RFC standard limit)
   * - Format: Strict RFC email syntax, valid domain structure
   * - Rejection: Disallows control chars, spaces, multiple @, consecutive dots, missing TLD
   */
  validateEmail(input: unknown): ValidationResult<string> {
    if (typeof input !== 'string') {
      return { valid: false, error: 'Email address must be a text string.' };
    }

    const trimmed = input.trim();

    if (trimmed.length < 5) {
      return { valid: false, error: 'Email address is too short (minimum 5 characters).' };
    }

    if (trimmed.length > 254) {
      return { valid: false, error: 'Email address exceeds maximum length of 254 characters.' };
    }

    if (CONTROL_CHARS_REGEX.test(trimmed)) {
      return { valid: false, error: 'Email address contains invalid control characters.' };
    }

    if (trimmed.includes('..')) {
      return { valid: false, error: 'Email address cannot contain consecutive dots.' };
    }

    if (!STRICT_EMAIL_REGEX.test(trimmed)) {
      return { valid: false, error: 'Please enter a valid email address (e.g. name@domain.com).' };
    }

    const [, domain] = trimmed.split('@');
    if (!domain || !domain.includes('.')) {
      return { valid: false, error: 'Email address domain is invalid.' };
    }

    return { valid: true, value: trimmed.toLowerCase() };
  },

  /**
   * Validates Password:
   * - Type: String
   * - Length: Minimum 8 characters, maximum 128 characters
   * - Format: Requires at least 1 uppercase letter, 1 lowercase letter, and 1 numeric digit
   * - Rejection: Outright rejects whitespace-only or control-character inputs
   */
  validatePassword(input: unknown): ValidationResult<string> {
    if (typeof input !== 'string') {
      return { valid: false, error: 'Password must be a text string.' };
    }

    if (input.length < 8) {
      return { valid: false, error: 'Password must be at least 8 characters long.' };
    }

    if (input.length > 128) {
      return { valid: false, error: 'Password exceeds maximum length of 128 characters.' };
    }

    if (CONTROL_CHARS_REGEX.test(input)) {
      return { valid: false, error: 'Password contains prohibited control characters.' };
    }

    if (!/[A-Z]/.test(input)) {
      return { valid: false, error: 'Password must contain at least one uppercase letter (A-Z).' };
    }

    if (!/[a-z]/.test(input)) {
      return { valid: false, error: 'Password must contain at least one lowercase letter (a-z).' };
    }

    if (!/[0-9]/.test(input)) {
      return { valid: false, error: 'Password must contain at least one numeric digit (0-9).' };
    }

    return { valid: true, value: input };
  },

  /**
   * Validates Person Full Name:
   * - Type: String
   * - Length: Between 2 and 70 characters
   * - Format: Unicode letters, spaces, hyphens, and apostrophes only
   */
  validateFullName(input: unknown): ValidationResult<string> {
    if (typeof input !== 'string') {
      return { valid: false, error: 'Name must be a text string.' };
    }

    const trimmed = input.trim();

    if (trimmed.length < 2) {
      return { valid: false, error: 'Name must be at least 2 characters long.' };
    }

    if (trimmed.length > 70) {
      return { valid: false, error: 'Name cannot exceed 70 characters.' };
    }

    if (CONTROL_CHARS_REGEX.test(trimmed)) {
      return { valid: false, error: 'Name contains invalid control characters.' };
    }

    if (!PERSON_NAME_REGEX.test(trimmed)) {
      return { valid: false, error: 'Name can only contain letters, spaces, hyphens, and apostrophes.' };
    }

    return { valid: true, value: trimmed };
  },

  /**
   * Validates Circle Invite Code:
   * - Type: String
   * - Length: Exactly 6 characters OR 36-character UUID
   * - Format: Alphanumeric 6-char uppercase or standard UUID v4
   * - Rejection: Disallows special characters, spaces, punctuation
   */
  validateInviteCode(input: unknown): ValidationResult<string> {
    if (typeof input !== 'string') {
      return { valid: false, error: 'Invite code must be a text string.' };
    }

    const clean = input.trim();

    if (UUID_V4_REGEX.test(clean)) {
      return { valid: true, value: clean.toLowerCase() };
    }

    if (clean.length !== 6) {
      return { valid: false, error: 'Invite code must be exactly 6 characters.' };
    }

    if (CONTROL_CHARS_REGEX.test(clean) || /[^A-Za-z0-9]/.test(clean)) {
      return { valid: false, error: 'Invite code may only contain alphanumeric characters.' };
    }

    return { valid: true, value: clean.toUpperCase() };
  },

  /**
   * Validates Circle Name:
   * - Type: String
   * - Length: Between 2 and 50 characters
   * - Rejection: Disallows control characters or empty strings
   */
  validateCircleName(input: unknown): ValidationResult<string> {
    if (typeof input !== 'string') {
      return { valid: false, error: 'Circle name must be a text string.' };
    }

    const trimmed = input.trim();

    if (trimmed.length < 2) {
      return { valid: false, error: 'Circle name must be at least 2 characters long.' };
    }

    if (trimmed.length > 50) {
      return { valid: false, error: 'Circle name cannot exceed 50 characters.' };
    }

    if (CONTROL_CHARS_REGEX.test(trimmed)) {
      return { valid: false, error: 'Circle name contains invalid control characters.' };
    }

    return { valid: true, value: trimmed };
  },

  /**
   * Validates Chat Message:
   * - Type: String
   * - Length: Between 1 and 2000 characters
   * - Rejection: Disallows empty/whitespace-only messages and control characters
   */
  validateChatMessage(input: unknown): ValidationResult<string> {
    if (typeof input !== 'string') {
      return { valid: false, error: 'Message content must be a text string.' };
    }

    const trimmed = input.trim();

    if (trimmed.length === 0) {
      return { valid: false, error: 'Message cannot be empty.' };
    }

    if (trimmed.length > 2000) {
      return { valid: false, error: 'Message exceeds maximum length of 2000 characters.' };
    }

    if (CONTROL_CHARS_REGEX.test(trimmed)) {
      return { valid: false, error: 'Message contains prohibited control characters.' };
    }

    return { valid: true, value: trimmed };
  },

  /**
   * Validates Geographical Coordinates:
   * - Type: Finite Number
   * - Latitude: [-90.0, 90.0]
   * - Longitude: [-180.0, 180.0]
   */
  validateCoordinates(lat: unknown, lng: unknown): ValidationResult<{ latitude: number; longitude: number }> {
    const numLat = typeof lat === 'number' ? lat : parseFloat(String(lat));
    const numLng = typeof lng === 'number' ? lng : parseFloat(String(lng));

    if (!Number.isFinite(numLat) || Number.isNaN(numLat)) {
      return { valid: false, error: 'Latitude must be a valid finite numeric value.' };
    }

    if (!Number.isFinite(numLng) || Number.isNaN(numLng)) {
      return { valid: false, error: 'Longitude must be a valid finite numeric value.' };
    }

    if (numLat < -90 || numLat > 90) {
      return { valid: false, error: 'Latitude must be between -90.0 and +90.0 degrees.' };
    }

    if (numLng < -180 || numLng > 180) {
      return { valid: false, error: 'Longitude must be between -180.0 and +180.0 degrees.' };
    }

    return { valid: true, value: { latitude: numLat, longitude: numLng } };
  },

  /**
   * Validates Safe Place / Geofence:
   * - Name: 2-50 chars
   * - Radius: 10 to 10,000 meters
   * - Category: enum of allowed place types
   */
  validateGeofence(place: {
    name: unknown;
    radius_m?: unknown;
    category?: unknown;
    latitude: unknown;
    longitude: unknown;
  }): ValidationResult {
    if (!place || typeof place !== 'object') {
      return { valid: false, error: 'Geofence payload must be an object.' };
    }

    // 1. Name
    if (typeof place.name !== 'string' || place.name.trim().length < 2 || place.name.trim().length > 50) {
      return { valid: false, error: 'Geofence name must be between 2 and 50 characters.' };
    }

    if (CONTROL_CHARS_REGEX.test(place.name)) {
      return { valid: false, error: 'Geofence name contains invalid control characters.' };
    }

    // 2. Coordinates
    const coordRes = this.validateCoordinates(place.latitude, place.longitude);
    if (!coordRes.valid) return coordRes;

    // 3. Radius
    if (place.radius_m !== undefined) {
      const rad = typeof place.radius_m === 'number' ? place.radius_m : parseInt(String(place.radius_m), 10);
      if (!Number.isFinite(rad) || rad < 10 || rad > 10000) {
        return { valid: false, error: 'Geofence radius must be between 10 meters and 10,000 meters.' };
      }
    }

    // 4. Category
    const allowedCategories = ['home', 'school', 'work', 'gym', 'station', 'other'];
    if (place.category !== undefined) {
      if (typeof place.category !== 'string' || !allowedCategories.includes(place.category.toLowerCase())) {
        return { valid: false, error: `Invalid category. Allowed categories: ${allowedCategories.join(', ')}.` };
      }
    }

    return { valid: true };
  },

  /**
   * Validates Webhook Payload structure strictly (for RevenueCat or external webhooks):
   */
  validateRevenueCatWebhook(payload: unknown): ValidationResult {
    if (!payload || typeof payload !== 'object') {
      return { valid: false, error: 'Webhook body must be a JSON object.' };
    }

    const obj = payload as Record<string, any>;
    const event = obj.event;

    if (!event || typeof event !== 'object') {
      return { valid: false, error: 'Missing required "event" object in webhook payload.' };
    }

    // Allowed RevenueCat event types
    const allowedEvents = [
      'INITIAL_PURCHASE',
      'RENEWAL',
      'CANCELLATION',
      'UNCANCELLATION',
      'NON_RENEWING_PURCHASE',
      'EXPIRATION',
      'BILLING_ISSUE',
      'PRODUCT_CHANGE',
      'TRANSFER',
      'TEST',
    ];

    if (typeof event.type !== 'string' || !allowedEvents.includes(event.type)) {
      return { valid: false, error: `Invalid event type "${event.type}". Must be a recognized purchase event.` };
    }

    if (event.app_user_id !== undefined && event.app_user_id !== null) {
      if (typeof event.app_user_id !== 'string') {
        return { valid: false, error: '"app_user_id" must be a string.' };
      }
      if (event.app_user_id.length > 256) {
        return { valid: false, error: '"app_user_id" exceeds maximum allowed length.' };
      }
      if (CONTROL_CHARS_REGEX.test(event.app_user_id)) {
        return { valid: false, error: '"app_user_id" contains invalid control characters.' };
      }
    }

    return { valid: true };
  },
};
