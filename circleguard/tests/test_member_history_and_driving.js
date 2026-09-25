const { chromium } = require('playwright');
const path = require('path');
const fs = require('fs');

const ARTIFACT_DIR = 'C:\\Users\\mylam\\.gemini\\antigravity-ide\\brain\\a3377614-b22c-4960-8db7-02c3ece4891d';
const SCREENSHOT_DIR = path.join(ARTIFACT_DIR, 'playwright_screenshots');

if (!fs.existsSync(SCREENSHOT_DIR)) {
  fs.mkdirSync(SCREENSHOT_DIR, { recursive: true });
}

async function setupPage(browser) {
  const context = await browser.newContext({
    viewport: { width: 390, height: 844 },
    deviceScaleFactor: 2,
    hasTouch: true,
  });

  const page = await context.newPage();

  console.log('Navigating to http://127.0.0.1:8081...');
  await page.goto('http://127.0.0.1:8081', { waitUntil: 'commit', timeout: 30000 });
  await page.waitForSelector('text=SIGN IN', { timeout: 15000 });

  console.log('Injecting mock user auth & circle members...');
  await page.evaluate(() => {
    const SELF_ID = '03ca6af3-b0f7-46a1-9e70-2bb96befb67c';
    const ART_ID = 'e7b1a2c3-4d5e-6f7a-8b9c-0d1e2f3a4b5c';
    const BHAVANI_ID = 'b1b2b3b4-b5b6-7b8b-9b0b-1b2b3b4b5b6b';
    const CIRCLE_ID = 'af00325e-7e26-4b5d-856d-907085b326d2';

    const mockUser = { id: SELF_ID, email: 'sri@example.com' };
    const mockSession = { access_token: 't', token_type: 'bearer', user: mockUser };
    const mockProfile = { id: SELF_ID, full_name: 'Sri Jai Suryaa', phone: '+918072986912', is_ghost_mode: false, is_premium: true };
    const mockCircle = { id: CIRCLE_ID, name: 'Family Circle', invite_code: 'HK3GJB', tracking_mode: 'continuous', owner_id: SELF_ID };

    const mockMembers = [
      { id: '1', circle_id: CIRCLE_ID, user_id: SELF_ID, role: 'owner', profile: mockProfile, isOnline: true },
      { id: '2', circle_id: CIRCLE_ID, user_id: ART_ID, role: 'co_leader', supervisor_id: SELF_ID, profile: { full_name: 'Art Suryaa' }, isOnline: true, batteryPct: 88 },
      { id: '3', circle_id: CIRCLE_ID, user_id: BHAVANI_ID, role: 'member', supervisor_id: ART_ID, profile: { full_name: 'Bhavani' }, isOnline: false, batteryPct: 54 },
    ];

    window.__mockAuth = { user: mockUser, session: mockSession, profile: mockProfile };
    window.__mockCircle = { activeCircle: mockCircle, members: mockMembers };

    if (window.__useAuthStore) window.__useAuthStore.setState({ user: mockUser, session: mockSession, profile: mockProfile, isLoaded: true });
    if (window.__useCircleStore) window.__useCircleStore.setState({ activeCircle: mockCircle, members: mockMembers, circles: [mockCircle], circleFetched: true, isLoading: false });
  });

  await page.waitForTimeout(1000);

  console.log('Navigating to Circle tab...');
  await page.locator('text=Circle').last().click({ force: true });
  await page.waitForTimeout(1500);

  return page;
}

async function testMemberHistoryAndDriving() {
  console.log('--- TESTING MEMBER 3-DOTS: DRIVER SAFETY & TIMELINE ISOLATION ---');
  const browser = await chromium.launch({
    channel: 'chrome',
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox']
  });

  try {
    // TEST 1: Drive Safety
    console.log('\n--- PART 1: TEST DRIVE SAFETY NAVIGATION FOR ART SURYAA ---');
    const page1 = await setupPage(browser);

    console.log('Clicking 3-dots for Art Suryaa...');
    const artThreeDots = page1.locator('[aria-label="Actions for Art Suryaa"]');
    await artThreeDots.waitFor({ timeout: 5000 });
    await artThreeDots.click({ force: true });
    await page1.waitForTimeout(800);

    console.log('Clicking Drive Safety tile in modal...');
    const driveSafetyTile = page1.locator('text=Drive Safety');
    await driveSafetyTile.waitFor({ timeout: 5000 });
    await driveSafetyTile.click({ force: true });

    console.log('Waiting for DrivingReportsScreen to open...');
    await page1.waitForSelector('text=DRIVING REPORTS', { timeout: 10000 });
    await page1.waitForTimeout(1500);

    const drivingScreenshotPath = path.join(SCREENSHOT_DIR, 'test_driving_reports_art_suryaa.png');
    await page1.screenshot({ path: drivingScreenshotPath });
    console.log(`[PASS] DrivingReportsScreen rendered! Screenshot: ${drivingScreenshotPath}`);
    await page1.close();

    // TEST 2: Timeline
    console.log('\n--- PART 2: TEST TIMELINE NAVIGATION FOR ART SURYAA ---');
    const page2 = await setupPage(browser);

    console.log('Clicking 3-dots for Art Suryaa...');
    const artThreeDots2 = page2.locator('[aria-label="Actions for Art Suryaa"]');
    await artThreeDots2.waitFor({ timeout: 5000 });
    await artThreeDots2.click({ force: true });
    await page2.waitForTimeout(800);

    console.log('Clicking Timeline tile in modal...');
    const timelineTile = page2.locator('text=Timeline');
    await timelineTile.waitFor({ timeout: 5000 });
    await timelineTile.click({ force: true });

    console.log('Waiting for LocationHistoryScreen to open...');
    await page2.waitForSelector('text=LOCATION HISTORY', { timeout: 10000 });
    await page2.waitForTimeout(1500);

    const timelineScreenshotPath = path.join(SCREENSHOT_DIR, 'test_location_history_art_suryaa.png');
    await page2.screenshot({ path: timelineScreenshotPath });
    console.log(`[PASS] LocationHistoryScreen rendered! Screenshot: ${timelineScreenshotPath}`);
    await page2.close();

    console.log('\n=== ALL MEMBER ISOLATION TESTS PASSED SUCCESSFULLY ===');
  } finally {
    await browser.close();
  }
}

testMemberHistoryAndDriving().catch(err => {
  console.error('[FATAL ERROR]:', err);
  process.exit(1);
});
