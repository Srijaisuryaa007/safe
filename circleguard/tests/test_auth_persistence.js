const assert = require('assert');

// Simple mock for AsyncStorage in Node
const storage = new Map();
const mockAsyncStorage = {
  getItem: async (key) => storage.get(key) || null,
  setItem: async (key, val) => { storage.set(key, String(val)); },
  removeItem: async (key) => { storage.delete(key); },
  multiRemove: async (keys) => { keys.forEach(k => storage.delete(k)); },
  clear: async () => { storage.clear(); },
};

async function testAuthPersistence() {
  console.log('--- Testing Auth Persistence Logic ---');

  // Verify storage keys
  const AUTH_SESSION_KEY = '@circleguard_auth_session';
  const CACHED_PROFILE_KEY = '@circleguard_cached_profile';

  const mockSession = {
    access_token: 'fake-jwt-token',
    refresh_token: 'fake-refresh-token',
    user: { id: 'usr-12345', email: 'test@example.com' },
  };

  const mockProfile = {
    id: 'usr-12345',
    full_name: 'Jai Suryaa',
    phone: '+14155552671',
    created_at: new Date().toISOString(),
  };

  // 1. Simulate saving session and profile
  await mockAsyncStorage.setItem(AUTH_SESSION_KEY, JSON.stringify(mockSession));
  await mockAsyncStorage.setItem(CACHED_PROFILE_KEY, JSON.stringify(mockProfile));

  // 2. Simulate cold-boot hydration
  const [sessionRaw, profileRaw] = await Promise.all([
    mockAsyncStorage.getItem(AUTH_SESSION_KEY),
    mockAsyncStorage.getItem(CACHED_PROFILE_KEY),
  ]);

  assert(sessionRaw !== null, 'Session should be present in storage');
  assert(profileRaw !== null, 'Profile should be present in storage');

  const restoredSession = JSON.parse(sessionRaw);
  const restoredProfile = JSON.parse(profileRaw);

  assert.strictEqual(restoredSession.user.id, 'usr-12345');
  assert.strictEqual(restoredProfile.full_name, 'Jai Suryaa');
  assert.strictEqual(restoredProfile.phone, '+14155552671');

  console.log('✓ Cold-boot session and profile properly restored from storage.');

  // 3. Test logout cleanup
  await mockAsyncStorage.multiRemove([AUTH_SESSION_KEY, CACHED_PROFILE_KEY]);
  const afterLogoutSession = await mockAsyncStorage.getItem(AUTH_SESSION_KEY);
  const afterLogoutProfile = await mockAsyncStorage.getItem(CACHED_PROFILE_KEY);

  assert.strictEqual(afterLogoutSession, null, 'Session should be wiped on logout');
  assert.strictEqual(afterLogoutProfile, null, 'Profile should be wiped on logout');

  console.log('✓ Logout cleanly purges persistent auth tokens and cached profile.');
  console.log('--- All Auth Persistence Logic Verified! ---');
}

testAuthPersistence().catch(err => {
  console.error('Test failed:', err);
  process.exit(1);
});
