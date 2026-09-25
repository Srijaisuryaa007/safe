const { chromium } = require('playwright');
const path = require('path');

const ARTIFACT_DIR = 'C:\\Users\\mylam\\.gemini\\antigravity-ide\\brain\\a3377614-b22c-4960-8db7-02c3ece4891d';
const SCREENSHOT_DIR = path.join(ARTIFACT_DIR, 'playwright_screenshots');

async function testSwitch() {
  const browser = await chromium.launch({ channel: 'chrome', headless: true, args: ['--no-sandbox'] });
  const context = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, hasTouch: true });
  const page = await context.newPage();

  console.log('Navigating to http://127.0.0.1:8081...');
  await page.goto('http://127.0.0.1:8081', { waitUntil: 'commit', timeout: 30000 });
  await page.waitForSelector('text=SIGN IN', { timeout: 15000 });

  await page.evaluate(() => {
    const SELF_ID = '03ca6af3-b0f7-46a1-9e70-2bb96befb67c';
    const ART_ID = 'e7b1a2c3-4d5e-6f7a-8b9c-0d1e2f3a4b5c';
    const BHAVANI_ID = 'b1b2b3b4-b5b6-7b8b-9b0b-1b2b3b4b5b6b';
    const CIRCLE_ID = 'af00325e-7e26-4b5d-856d-907085b326d2';

    const mockUser = { id: SELF_ID, email: 'sri@example.com' };
    const mockSession = { access_token: 't', token_type: 'bearer', user: mockUser };
    const mockProfile = { id: SELF_ID, full_name: 'Sri Jai Suryaa', phone: '+918072986912' };
    const mockCircle = { id: CIRCLE_ID, name: 'Family Circle', invite_code: 'HK3GJB' };

    const mockMembers = [
      { id: '1', circle_id: CIRCLE_ID, user_id: SELF_ID, role: 'owner', profile: mockProfile, isOnline: true },
      { id: '2', circle_id: CIRCLE_ID, user_id: ART_ID, role: 'co_leader', profile: { full_name: 'Art Suryaa' }, isOnline: true, batteryPct: 88 },
      { id: '3', circle_id: CIRCLE_ID, user_id: BHAVANI_ID, role: 'member', profile: { full_name: 'Bhavani' }, isOnline: false, batteryPct: 54 },
    ];

    if (window.__useAuthStore) window.__useAuthStore.setState({ user: mockUser, session: mockSession, profile: mockProfile, isLoaded: true });
    if (window.__useCircleStore) window.__useCircleStore.setState({ activeCircle: mockCircle, members: mockMembers, circles: [mockCircle], circleFetched: true, isLoading: false });
  });

  await page.waitForTimeout(1000);
  await page.locator('text=Circle').last().click({ force: true });
  await page.waitForTimeout(1000);

  // Navigate to Timeline for Art Suryaa
  const artThreeDots = page.locator('[aria-label="Actions for Art Suryaa"]');
  await artThreeDots.waitFor({ timeout: 5000 });
  await artThreeDots.click({ force: true });
  await page.waitForTimeout(600);

  const timelineTile = page.locator('text=Timeline');
  await timelineTile.waitFor({ timeout: 5000 });
  await timelineTile.click({ force: true });
  await page.waitForSelector('text=LOCATION HISTORY', { timeout: 10000 });
  await page.waitForTimeout(1000);

  console.log('LocationHistory opened for Art Suryaa.');
  const artBanner = page.locator('text=Timeline for Art Suryaa');
  await artBanner.waitFor({ timeout: 5000 });
  console.log('[PASS] Verified "Timeline for Art Suryaa" is shown!');

  console.log('Clicking Switch Member button...');
  const switchMemberBtn = page.locator('text=Switch Member');
  await switchMemberBtn.waitFor({ timeout: 5000 });
  await switchMemberBtn.click({ force: true });
  await page.waitForTimeout(800);

  console.log('Member picker modal opened! Verifying Bhavani in modal...');
  const bhavaniOption = page.locator('[role="dialog"]').locator('text=Bhavani').last();
  await bhavaniOption.waitFor({ timeout: 5000 });
  console.log('Clicking Bhavani to switch member...');
  await bhavaniOption.click({ force: true });
  await page.waitForTimeout(1500);

  const bhavaniTimelineBanner = page.locator('text=Timeline for Bhavani');
  await bhavaniTimelineBanner.waitFor({ timeout: 5000 });
  console.log('[PASS] Successfully switched member to Bhavani!');

  const shot = path.join(SCREENSHOT_DIR, 'test_location_history_switch_bhavani.png');
  await page.screenshot({ path: shot });
  console.log('Saved screenshot:', shot);

  await browser.close();
  console.log('=== TEST MEMBER SWITCHING COMPLETED SUCCESSFULLY ===');
}

testSwitch().catch(e => {
  console.error('[FATAL ERROR]:', e);
  process.exit(1);
});
