const { chromium } = require('playwright');
const assert = require('assert');

async function testSessionPersistence() {
  console.log('--- Testing Phone Session Persistence Across App Reloads ---');
  const browser = await chromium.launch({ channel: 'chrome', headless: true, args: ['--no-sandbox'] });
  const context = await browser.newContext({ viewport: { width: 390, height: 844 } });
  const page = await context.newPage();

  await page.goto('http://127.0.0.1:8081');
  await page.waitForTimeout(2500);

  console.log('1. Setting authenticated user session & profile...');
  const testUser = {
    id: '11111111-1111-4111-8111-111111111111',
    email: 'persisted_user@circleguard.com',
  };
  const testProfile = {
    id: testUser.id,
    full_name: 'Test Mobile User',
    phone: '+14155559999',
    created_at: new Date().toISOString(),
  };

  await page.evaluate(({ testUser, testProfile }) => {
    const mockSession = {
      access_token: 'valid-persisted-access-token',
      refresh_token: 'valid-persisted-refresh-token',
      user: testUser,
    };
    window.__useAuthStore.getState().setSession(mockSession);
    window.__useAuthStore.getState().setProfile(testProfile);
    window.__useAuthStore.getState().setLoading(false);
  }, { testUser, testProfile });

  await page.waitForTimeout(1000);

  const initialCheck = await page.evaluate(() => {
    const store = window.__useAuthStore.getState();
    return {
      hasSession: !!store.session,
      email: store.session?.user?.email,
      name: store.profile?.full_name,
      phone: store.profile?.phone,
    };
  });
  console.log('Initial Auth State:', initialCheck);
  assert(initialCheck.hasSession, 'Session should be active');

  console.log('2. Simulating Phone App Cold Restart / Page Reload...');
  await page.reload();
  await page.waitForTimeout(3000);

  const afterReloadCheck = await page.evaluate(() => {
    const store = window.__useAuthStore.getState();
    return {
      hasSession: !!store.session,
      email: store.session?.user?.email,
      name: store.profile?.full_name,
      phone: store.profile?.phone,
      isLoading: store.isLoading,
    };
  });
  console.log('After Cold Reload Auth State:', afterReloadCheck);

  assert(afterReloadCheck.hasSession, 'Session MUST be preserved across phone reloads!');
  assert.strictEqual(afterReloadCheck.email, testUser.email, 'User email must match');
  assert.strictEqual(afterReloadCheck.phone, testProfile.phone, 'Profile phone must be preserved');
  console.log('SUCCESS! Session and profile remained active after phone reload! 🎉');

  await browser.close();
}

testSessionPersistence().catch(err => {
  console.error('Test Failed:', err);
  process.exit(1);
});
