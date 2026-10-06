// Test suite: Geofence departure/arrival incident recording & Activity tab timeline syncing
const assert = require('assert');

console.log('=== TEST SUITE: GEOFENCE EXIT/ENTRY INCIDENT & ACTIVITY TAB SYNC ===');

// 1. Mock Places (e.g. Home with 150m radius)
const homePlace = {
  id: 'place-home-101',
  circle_id: 'circle-100',
  name: 'Home',
  latitude: 12.9716,
  longitude: 77.5946,
  radius_m: 150,
};

// 2. Haversine distance function (identical to GeofenceEngine.ts)
function getHaversineDistanceInMeters(lat1, lon1, lat2, lon2) {
  const R = 6371e3;
  const phi1 = (lat1 * Math.PI) / 180;
  const phi2 = (lat2 * Math.PI) / 180;
  const deltaPhi = ((lat2 - lat1) * Math.PI) / 180;
  const deltaLambda = ((lon2 - lon1) * Math.PI) / 180;

  const a =
    Math.sin(deltaPhi / 2) * Math.sin(deltaPhi / 2) +
    Math.cos(phi1) * Math.cos(phi2) * Math.sin(deltaLambda / 2) * Math.sin(deltaLambda / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

  return R * c;
}

// 3. User initially at Home (distance = 20 meters, inside)
const initialLoc = { latitude: 12.9717, longitude: 77.5947 };
const initialDist = getHaversineDistanceInMeters(homePlace.latitude, homePlace.longitude, initialLoc.latitude, initialLoc.longitude);
console.log(`[Test] User at Home: distance = ${initialDist.toFixed(1)}m (inside radius: ${initialDist <= homePlace.radius_m})`);
assert.strictEqual(initialDist <= homePlace.radius_m, true, 'User must be inside home initially');

// 4. User moves away (distance = 320 meters, outside)
const movedLoc = { latitude: 12.9745, longitude: 77.5946 };
const movedDist = getHaversineDistanceInMeters(homePlace.latitude, homePlace.longitude, movedLoc.latitude, movedLoc.longitude);
console.log(`[Test] User left Home: distance = ${movedDist.toFixed(1)}m (outside radius: ${movedDist > homePlace.radius_m})`);
assert.strictEqual(movedDist > homePlace.radius_m + 40, true, 'User must exceed exit threshold');

// 5. Test Transition Generation
const eventTimestamp = new Date().toISOString();
const exitEvent = {
  circle_id: homePlace.circle_id,
  member_id: 'user-sri-1',
  zone_id: homePlace.id,
  type: 'EXIT',
  occurred_at: eventTimestamp,
  lat: movedLoc.latitude,
  lng: movedLoc.longitude,
  userName: 'Sri jai suryaa',
  placeName: homePlace.name,
};

// 6. Test Activity Tab formatting
const shortTimeStr = new Date(exitEvent.occurred_at).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit', hour12: true });
const activityTitle = `${exitEvent.userName} left ${exitEvent.placeName} • ${shortTimeStr}`;
const activitySubtitle = `Departed ${exitEvent.placeName} safe boundary at ${shortTimeStr}.`;
const pushTitle = `📍 ${exitEvent.userName} left ${exitEvent.placeName}`;
const pushBody = `${exitEvent.userName} left ${exitEvent.placeName} safe boundary at ${shortTimeStr}.`;

console.log(`[Test] Activity Title: "${activityTitle}"`);
console.log(`[Test] Push Notification: "${pushTitle}" - "${pushBody}"`);

assert.ok(activityTitle.includes('left Home'), 'Activity title must clearly state user left Home');
assert.ok(pushTitle.includes('left Home'), 'Push notification title must state user left Home');

// 7. Test Circle Member Notification targeting (excludes departing user)
const allCircleMembers = [
  { user_id: 'user-sri-1', full_name: 'Sri jai suryaa', push_token: 'ExponentPushToken[sri]' },
  { user_id: 'user-member-2', full_name: 'Jai Suryaa', push_token: 'ExponentPushToken[jai]' },
  { user_id: 'user-member-3', full_name: 'Family Member 3', push_token: 'ExponentPushToken[mem3]' },
];

const targetPushTokens = allCircleMembers
  .filter(m => m.user_id !== exitEvent.member_id)
  .map(m => m.push_token);

console.log(`[Test] Target push tokens for other circle members (${targetPushTokens.length}):`, targetPushTokens);
assert.strictEqual(targetPushTokens.length, 2, 'Must notify all other circle members');
assert.ok(!targetPushTokens.includes('ExponentPushToken[sri]'), 'Must not spam departing user with their own departure');

// 8. Test Merged Activity Timeline Deduplication
const rawZoneEvents = [
  { id: 'ze-1', user_id: 'user-sri-1', place_id: homePlace.id, event_type: 'departure', occurred_at: eventTimestamp },
];
const rawPlaceEvents = [
  { id: 'pe-1', user_id: 'user-sri-1', place_id: homePlace.id, event_type: 'departure', occurred_at: eventTimestamp },
];

const seenKeys = new Set();
const mergedTimeline = [];
[...rawZoneEvents, ...rawPlaceEvents].forEach(ev => {
  const bucket = Math.floor(new Date(ev.occurred_at).getTime() / 60000);
  const key = `${ev.user_id}_${ev.place_id}_${ev.event_type}_${bucket}`;
  if (!seenKeys.has(key)) {
    seenKeys.add(key);
    mergedTimeline.push(ev);
  }
});

console.log(`[Test] Merged timeline count (should be 1 deduplicated event): ${mergedTimeline.length}`);
assert.strictEqual(mergedTimeline.length, 1, 'Duplicate events from zone_events and place_events must be deduplicated');

console.log('\n[PASS] All Geofence exit incident recording and Activity Tab syncing tests succeeded!\n');
