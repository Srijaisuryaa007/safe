// Unit test for safe zone entry/exit deduplication and notification routing
const assert = require('assert');

// Mock AsyncStorage
const mockStorage = {};
const AsyncStorage = {
  getItem: async (key) => mockStorage[key] || null,
  setItem: async (key, val) => { mockStorage[key] = String(val); },
  removeItem: async (key) => { delete mockStorage[key]; },
  clear: async () => { Object.keys(mockStorage).forEach(k => delete mockStorage[k]); }
};

// Mock AppState
let currentAppState = 'background';
const AppState = {
  get currentState() { return currentAppState; }
};

// Mock PushNotificationService
let scheduledLocalNotifications = [];
let sentExpoPushNotifications = [];

const PushNotificationService = {
  CREATIVE_NOTIFICATION_TEMPLATES: {
    departure: (name, place) => ({ title: 'Departure Alert', body: `${name} departed ${place}` }),
    arrival: (name, place) => ({ title: 'Arrival Alert', body: `${name} arrived at ${place}` })
  },
  scheduleLocalNotification: async (title, body, data) => {
    scheduledLocalNotifications.push({ title, body, data });
  },
  sendExpoPushNotification: async (tokens, title, body, data) => {
    sentExpoPushNotifications.push({ tokens, title, body, data });
  }
};

// Test implementation of deduplication logic mirroring GeofenceEngine
const GEOFENCE_TRANSITION_COOLDOWN_MS = 180000;
const inMemoryAlertState = new Map();
const inFlightAlertLocks = new Set();
const inAppBreachListeners = new Set();

function addInAppGeofenceBreachListener(listener) {
  inAppBreachListeners.add(listener);
  return () => inAppBreachListeners.delete(listener);
}

function notifyInAppGeofenceBreach(breach) {
  inAppBreachListeners.forEach(l => l(breach));
}

async function canAndRecordGeofenceAlert(userId, placeId, targetType, testNow) {
  const alertKey = `${userId}_${placeId}`;
  const now = testNow || Date.now();

  if (inFlightAlertLocks.has(alertKey)) {
    return false;
  }
  inFlightAlertLocks.add(alertKey);

  try {
    let record = inMemoryAlertState.get(alertKey);
    if (!record) {
      try {
        const stored = await AsyncStorage.getItem(`@circleguard_geofence_alert_${alertKey}`);
        if (stored) {
          record = JSON.parse(stored);
        }
      } catch (e) {}
    }

    if (record) {
      // RULE 1: STRICT STATE ALTERNATION
      if (record.lastEventType === targetType) {
        return false;
      }

      // RULE 2: ANTI-FLAPPING COOLDOWN
      if (now - record.lastAlertTime < GEOFENCE_TRANSITION_COOLDOWN_MS) {
        return false;
      }
    }

    const newRecord = {
      lastEventType: targetType,
      lastAlertTime: now,
    };
    inMemoryAlertState.set(alertKey, newRecord);

    await AsyncStorage.setItem(
      `@circleguard_geofence_alert_${alertKey}`,
      JSON.stringify(newRecord)
    );

    return true;
  } finally {
    inFlightAlertLocks.delete(alertKey);
  }
}

async function dispatchGeofencePushAlert(breach, place) {
  const isAppActive = AppState.currentState === 'active';
  const isExit = breach.type === 'exit';
  const placeName = place.name || 'Safe Zone';
  const template = isExit 
    ? PushNotificationService.CREATIVE_NOTIFICATION_TEMPLATES.departure(breach.userName, placeName)
    : PushNotificationService.CREATIVE_NOTIFICATION_TEMPLATES.arrival(breach.userName, placeName);

  if (isAppActive) {
    notifyInAppGeofenceBreach(breach);
  } else {
    await PushNotificationService.scheduleLocalNotification(template.title, template.body, {
      screen: 'Map',
      userId: breach.userId,
      placeId: breach.placeId
    });
  }
}

async function runTests() {
  console.log('🧪 Starting Safe Zone Deduplication & Notification Tests...\n');

  const userId = 'user-test-123';
  const placeId = 'place-home-456';
  const place = { id: placeId, name: 'Home Safe Zone' };

  // TEST 1: Initial exit alert permitted
  console.log('Test 1: First exit should be permitted');
  const t0 = 1000000;
  const res1 = await canAndRecordGeofenceAlert(userId, placeId, 'exit', t0);
  assert.strictEqual(res1, true, 'First exit should be allowed');
  console.log('  ✓ PASS: First exit allowed');

  // TEST 2: Repeated exit without entry must be BLOCKED
  console.log('Test 2: Repeated exit (subsequent GPS points beyond boundary) must be BLOCKED');
  const res2 = await canAndRecordGeofenceAlert(userId, placeId, 'exit', t0 + 5000);
  assert.strictEqual(res2, false, 'Duplicate exit should be blocked');
  const res3 = await canAndRecordGeofenceAlert(userId, placeId, 'exit', t0 + 60000);
  assert.strictEqual(res3, false, 'Duplicate exit after 1 min should still be blocked');
  console.log('  ✓ PASS: Multiple exit alerts strictly blocked');

  // TEST 3: Concurrent task collision (e.g. Native Geofence + Tracking Task at exact same time)
  console.log('Test 3: Concurrent tasks running simultaneously for same target state');
  const [c1, c2] = await Promise.all([
    canAndRecordGeofenceAlert(userId, 'place-work-789', 'exit', t0),
    canAndRecordGeofenceAlert(userId, 'place-work-789', 'exit', t0)
  ]);
  const successCount = (c1 ? 1 : 0) + (c2 ? 1 : 0);
  assert.strictEqual(successCount, 1, 'Only exactly 1 task can win concurrent execution');
  console.log('  ✓ PASS: Exactly 1 concurrent alert permitted, duplicate blocked');

  // TEST 4: Anti-flapping cooldown blocks quick re-entry jitter
  console.log('Test 4: Flapping re-entry within 3 minutes must be BLOCKED');
  const resFlap = await canAndRecordGeofenceAlert(userId, placeId, 'entry', t0 + 60000); // 1 minute later
  assert.strictEqual(resFlap, false, 'Entry within 3 minutes should be blocked');
  console.log('  ✓ PASS: Boundary jitter re-entry blocked');

  // TEST 5: Legitimate re-entry after 3-minute cooldown is PERMITTED
  console.log('Test 5: Legitimate re-entry after 3 minutes cooldown must be PERMITTED');
  const tReentry = t0 + 190000; // > 3 minutes later
  const resReentry = await canAndRecordGeofenceAlert(userId, placeId, 'entry', tReentry);
  assert.strictEqual(resReentry, true, 'Re-entry after cooldown should be allowed');
  console.log('  ✓ PASS: Legitimate re-entry permitted');

  // TEST 6: Repeated entry without exit must be BLOCKED
  console.log('Test 6: Repeated entry without exit must be BLOCKED');
  const resEntryDupe = await canAndRecordGeofenceAlert(userId, placeId, 'entry', tReentry + 10000);
  assert.strictEqual(resEntryDupe, false, 'Duplicate entry should be blocked');
  console.log('  ✓ PASS: Duplicate entry blocked');

  // TEST 7: Outside-the-app notification (AppState === 'background')
  console.log('Test 7: Outside the app sends exactly 1 system notification');
  currentAppState = 'background';
  scheduledLocalNotifications = [];
  let inAppAlertsReceived = 0;
  const unsub = addInAppGeofenceBreachListener(() => inAppAlertsReceived++);

  const breachOut = {
    type: 'exit',
    placeId,
    placeName: 'Home Safe Zone',
    userId,
    userName: 'Sri'
  };

  await dispatchGeofencePushAlert(breachOut, place);
  assert.strictEqual(scheduledLocalNotifications.length, 1, 'Should schedule 1 local notification outside app');
  assert.strictEqual(inAppAlertsReceived, 0, 'Should not trigger in-app alert when app is in background');
  console.log('  ✓ PASS: Exactly 1 outside system notification sent');

  // TEST 8: In-app notification (AppState === 'active')
  console.log('Test 8: Inside the app sends exactly 1 in-app alert and NO external system popups');
  currentAppState = 'active';
  scheduledLocalNotifications = [];
  inAppAlertsReceived = 0;

  const breachIn = {
    type: 'entry',
    placeId,
    placeName: 'Home Safe Zone',
    userId,
    userName: 'Sri'
  };

  await dispatchGeofencePushAlert(breachIn, place);
  assert.strictEqual(scheduledLocalNotifications.length, 0, 'Should NOT schedule local notification when app is active');
  assert.strictEqual(inAppAlertsReceived, 1, 'Should trigger exactly 1 in-app alert');
  console.log('  ✓ PASS: Exactly 1 in-app alert triggered, 0 outside popups');

  unsub();

  console.log('\n🎉 ALL 8 DEDUPLICATION & NOTIFICATION TESTS PASSED SUCCESSFULLY!');
}

runTests().catch(err => {
  console.error('\n❌ TEST FAILED:', err);
  process.exit(1);
});
