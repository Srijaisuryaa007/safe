const { chromium } = require('playwright');
const path = require('path');
const fs = require('fs');

const ARTIFACT_DIR = 'C:\\Users\\mylam\\.gemini\\antigravity-ide\\brain\\1552c728-fbd5-4a4e-9da5-fb93c3352ef3';
const SCREENSHOT_DIR = path.join(ARTIFACT_DIR, 'playwright_screenshots');

if (!fs.existsSync(SCREENSHOT_DIR)) {
  fs.mkdirSync(SCREENSHOT_DIR, { recursive: true });
}

async function runTest() {
  const browser = await chromium.launch({
    channel: 'chrome',
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox']
  });

  try {
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
      const CIRCLE_ID = 'af00325e-7e26-4b5d-856d-907085b326d2';

      const mockUser = { id: SELF_ID, email: 'sri@example.com' };
      const mockSession = { access_token: 't', token_type: 'bearer', user: mockUser };
      const mockProfile = { id: SELF_ID, full_name: 'Sri Jai Suryaa', phone: '+918072986912', is_ghost_mode: false, is_premium: true };
      const mockCircle = { id: CIRCLE_ID, name: 'Family Circle', invite_code: 'HK3GJB', tracking_mode: 'continuous', owner_id: SELF_ID };

      const mockMembers = [
        { id: '1', circle_id: CIRCLE_ID, user_id: SELF_ID, role: 'owner', profile: mockProfile, isOnline: true },
        { id: '2', circle_id: CIRCLE_ID, user_id: ART_ID, role: 'co_leader', supervisor_id: SELF_ID, profile: { full_name: 'Art Suryaa', phone: '+919876543210' }, isOnline: true, batteryPct: 88, isDriving: true },
      ];

      if (window.__useAuthStore) window.__useAuthStore.setState({ user: mockUser, session: mockSession, profile: mockProfile, isLoaded: true });
      if (window.__useCircleStore) window.__useCircleStore.setState({ activeCircle: mockCircle, members: mockMembers, circles: [mockCircle], circleFetched: true, isLoading: false });
    });

    await page.waitForTimeout(1000);

    console.log('Navigating to Circle tab...');
    await page.locator('text=Circle').last().click({ force: true });
    await page.waitForTimeout(1500);

    console.log('Opening short profile modal by clicking member card for Art Suryaa...');
    // In BillionDollarCircleView, clicking the card or avatar opens short profile modal
    const artCard = page.locator('text=Art Suryaa').first();
    await artCard.waitFor({ timeout: 5000 });
    await artCard.click({ force: true });
    await page.waitForTimeout(1000);

    await page.screenshot({ path: path.join(SCREENSHOT_DIR, 'profile_modal_current_state.png') });
    console.log('Saved screenshot of current profile modal state.');

    // Check if Location History button is visible
    const locHistBtn = page.locator('text=Location History');
    const isLocHistVisible = await locHistBtn.isVisible();
    console.log('Is Location History button visible?', isLocHistVisible);

    const drivSummaryBtn = page.locator('text=Driving Summary');
    const isDrivSummaryVisible = await drivSummaryBtn.isVisible();
    console.log('Is Driving Summary button visible?', isDrivSummaryVisible);

    if (isLocHistVisible) {
      console.log('Clicking Location History button...');
      await locHistBtn.click({ force: true });
      await page.waitForTimeout(1500);
      const onLocHistScreen = await page.locator('text=LOCATION HISTORY').isVisible();
      console.log('Did it navigate to LOCATION HISTORY screen?', onLocHistScreen);
      await page.screenshot({ path: path.join(SCREENSHOT_DIR, 'profile_click_location_history_result.png') });
    }

  } catch (err) {
    console.error('Test error:', err);
  } finally {
    await browser.close();
  }
}

runTest();
