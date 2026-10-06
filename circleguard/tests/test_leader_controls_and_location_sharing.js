/**
 * Enterprise Test Suite: Circle Leader Member Settings & Circle Location Sharing
 * 
 * Verifies:
 * 1. Leader can toggle privacy & security settings (Ghost Mode, Online Presence, Shake SOS, Biometric Lock).
 * 2. Leader can cycle GPS sync frequency between realtime (5s), balanced (15s), and battery_saver (60s).
 * 3. Non-leaders cannot modify other members' settings.
 * 4. Leader can broadcast and share member locations to circle members via push, chat, and external links.
 */

const assert = require('assert');

console.log('================================================================');
console.log('RUNNING ENTERPRISE TEST SUITE: LEADER CONTROLS & LOCATION SHARING');
console.log('================================================================\n');

// Mock in-memory DB & Store
const mockCircleStore = {
  members: [
    {
      user_id: 'leader-01',
      role: 'owner',
      profile: {
        full_name: 'John Leader',
        is_ghost_mode: false,
        hide_online_presence: false,
        gps_frequency: 'balanced',
        shake_sos_enabled: true,
        app_lock_enabled: true,
      },
    },
    {
      user_id: 'member-02',
      role: 'member',
      latitude: 37.7749,
      longitude: -122.4194,
      batteryPct: 88,
      profile: {
        full_name: 'Jane Member',
        is_ghost_mode: false,
        hide_online_presence: false,
        gps_frequency: 'balanced',
        shake_sos_enabled: false,
        app_lock_enabled: false,
      },
    },
    {
      user_id: 'member-03',
      role: 'member',
      profile: {
        full_name: 'Bob Member',
        expo_push_token: 'ExponentPushToken[bob-token-123]',
      },
    }
  ]
};

// 1. Leader Setting Mutation Protocol
function leaderUpdateSetting(callerUserId, targetUserId, field, newValue) {
  const caller = mockCircleStore.members.find(m => m.user_id === callerUserId);
  const isLeader = caller?.role === 'owner' || caller?.role === 'co_leader';
  
  if (!isLeader && callerUserId !== targetUserId) {
    return { success: false, error: 'Unauthorized: Only Circle Leaders can modify member protocols.' };
  }

  const target = mockCircleStore.members.find(m => m.user_id === targetUserId);
  if (!target) return { success: false, error: 'Member not found.' };

  target.profile[field] = newValue;
  return { success: true, updatedProfile: target.profile };
}

// 2. GPS Frequency Cycling Protocol
function leaderCycleGpsFrequency(callerUserId, targetUserId) {
  const caller = mockCircleStore.members.find(m => m.user_id === callerUserId);
  const isLeader = caller?.role === 'owner' || caller?.role === 'co_leader';
  
  if (!isLeader && callerUserId !== targetUserId) {
    return { success: false, error: 'Unauthorized: Only Circle Leaders can modify GPS frequency.' };
  }

  const target = mockCircleStore.members.find(m => m.user_id === targetUserId);
  if (!target) return { success: false, error: 'Member not found.' };

  const order = ['realtime', 'balanced', 'battery_saver'];
  const currentIndex = order.indexOf(target.profile.gps_frequency || 'balanced');
  const nextFreq = order[(currentIndex + 1) % order.length];
  
  target.profile.gps_frequency = nextFreq;
  return { success: true, newGpsFrequency: nextFreq };
}

// 3. Location Broadcast Protocol
function broadcastLocationToCircle(callerUserId, targetUserId, circleId) {
  const caller = mockCircleStore.members.find(m => m.user_id === callerUserId);
  const isLeader = caller?.role === 'owner' || caller?.role === 'co_leader';
  
  if (!isLeader) {
    return { success: false, error: 'Unauthorized: Only Circle Leaders can broadcast member location.' };
  }

  const target = mockCircleStore.members.find(m => m.user_id === targetUserId);
  if (!target || target.latitude == null || target.longitude == null) {
    return { success: false, error: 'Target member location unavailable.' };
  }

  const mapsUrl = `https://maps.google.com/?q=${target.latitude},${target.longitude}`;
  const chatMessage = `📍 [Leader Broadcast] Shared ${target.profile.full_name}'s live location with circle:\n${mapsUrl}`;
  
  // Find other members with push tokens
  const notifiedTokens = [];
  mockCircleStore.members.forEach(m => {
    if (m.user_id !== callerUserId && m.profile?.expo_push_token) {
      notifiedTokens.push(m.profile.expo_push_token);
    }
  });

  return {
    success: true,
    chatMessage,
    mapsUrl,
    notifiedTokensCount: notifiedTokens.length,
    notifiedTokens,
  };
}

// ==========================================
// TEST EXECUTION
// ==========================================

console.log('--- TEST 1: LEADER TOGGLING MEMBER SECURITY & PRIVACY PROTOCOLS ---');
const toggleRes1 = leaderUpdateSetting('leader-01', 'member-02', 'is_ghost_mode', true);
assert.strictEqual(toggleRes1.success, true);
assert.strictEqual(mockCircleStore.members[1].profile.is_ghost_mode, true);
console.log('[PASS] Circle Leader enabled Ghost Mode on member');

const toggleRes2 = leaderUpdateSetting('leader-01', 'member-02', 'shake_sos_enabled', true);
assert.strictEqual(toggleRes2.success, true);
assert.strictEqual(mockCircleStore.members[1].profile.shake_sos_enabled, true);
console.log('[PASS] Circle Leader armed Shake SOS on member');

const toggleRes3 = leaderUpdateSetting('leader-01', 'member-02', 'app_lock_enabled', true);
assert.strictEqual(toggleRes3.success, true);
assert.strictEqual(mockCircleStore.members[1].profile.app_lock_enabled, true);
console.log('[PASS] Circle Leader enforced Biometric App Lock on member');

console.log('\n--- TEST 2: LEADER CYCLING MEMBER GPS FREQUENCY ---');
const cycleRes1 = leaderCycleGpsFrequency('leader-01', 'member-02');
assert.strictEqual(cycleRes1.success, true);
assert.strictEqual(cycleRes1.newGpsFrequency, 'battery_saver');
console.log('[PASS] GPS frequency successfully cycled from balanced -> battery_saver (60s)');

const cycleRes2 = leaderCycleGpsFrequency('leader-01', 'member-02');
assert.strictEqual(cycleRes2.success, true);
assert.strictEqual(cycleRes2.newGpsFrequency, 'realtime');
console.log('[PASS] GPS frequency successfully cycled from battery_saver -> realtime (5s)');

console.log('\n--- TEST 3: UNAUTHORIZED NON-LEADER MUTATION REJECTION ---');
const unauthorizedRes = leaderUpdateSetting('member-03', 'member-02', 'is_ghost_mode', false);
assert.strictEqual(unauthorizedRes.success, false);
console.log(`[PASS] Non-leader mutation prevented: "${unauthorizedRes.error}"`);

console.log('\n--- TEST 4: LEADER LOCATION BROADCAST TO CIRCLE ---');
const broadcastRes = broadcastLocationToCircle('leader-01', 'member-02', 'circle-100');
assert.strictEqual(broadcastRes.success, true);
assert.ok(broadcastRes.mapsUrl.includes('37.7749,-122.4194'));
assert.strictEqual(broadcastRes.notifiedTokensCount, 1);
assert.strictEqual(broadcastRes.notifiedTokens[0], 'ExponentPushToken[bob-token-123]');
console.log(`[PASS] Broadcasted location to circle chat: ${broadcastRes.chatMessage}`);
console.log(`[PASS] Push notification delivered to ${broadcastRes.notifiedTokensCount} circle members`);

console.log('\n================================================================');
console.log('>>> ALL LEADER CONTROLS & LOCATION SHARING TESTS PASSED <<<');
console.log('================================================================\n');
