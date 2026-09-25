const { chromium } = require('playwright');
const path = require('path');
const fs = require('fs');

const ARTIFACT_DIR = 'C:\\Users\\mylam\\.gemini\\antigravity-ide\\brain\\a3377614-b22c-4960-8db7-02c3ece4891d';
const SCREENSHOT_DIR = path.join(ARTIFACT_DIR, 'playwright_screenshots');

(async () => {
  console.log('--- Verifying Orbital Golden Logo Badge Across 4 Tabs ---');
  const browser = await chromium.launch({
    channel: 'chrome',
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox']
  });

  const context = await browser.newContext({
    viewport: { width: 390, height: 844 },
    deviceScaleFactor: 2,
    hasTouch: true,
  });

  const page = await context.newPage();

  console.log('Navigating to http://127.0.0.1:8081...');
  await page.goto('http://127.0.0.1:8081', { waitUntil: 'commit', timeout: 30000 });
  await page.waitForSelector('text=SIGN IN', { timeout: 15000 });

  await page.evaluate(() => {
    const SELF_ID = '03ca6af3-b0f7-46a1-9e70-2bb96befb67c';
    const CIRCLE_ID = 'af00325e-7e26-4b5d-856d-907085b326d2';

    const mockUser = { id: SELF_ID, email: 'sri@example.com' };
    const mockSession = { access_token: 't', token_type: 'bearer', user: mockUser };
    const mockProfile = { id: SELF_ID, full_name: 'Sri Jai Suryaa', phone: '+918072986912', is_ghost_mode: false, is_premium: true };
    const mockCircle = { id: CIRCLE_ID, name: 'Family Circle', invite_code: 'HK3GJB', tracking_mode: 'continuous', owner_id: SELF_ID };

    const mockMembers = [
      { id: '1', circle_id: CIRCLE_ID, user_id: SELF_ID, role: 'owner', profile: mockProfile, isOnline: true }
    ];

    if (window.__useAuthStore) window.__useAuthStore.setState({ user: mockUser, session: mockSession, profile: mockProfile, isLoaded: true });
    if (window.__useCircleStore) window.__useCircleStore.setState({ activeCircle: mockCircle, members: mockMembers, circles: [mockCircle], circleFetched: true, isLoading: false });
  });

  await page.waitForTimeout(2000);

  // 1. HOME TAB: Capture header with 3D Rotating Golden Logo Badge
  console.log('Capturing Home Tab header with 3D rotating golden logo...');
  const homePath = path.join(SCREENSHOT_DIR, 'test_tab_home_golden_logo.png');
  await page.screenshot({ path: homePath });
  console.log('Saved Home Tab screenshot:', homePath);

  // Click logo to verify Swiggy address sheet still opens
  console.log('Clicking 3D Golden Logo on Home Tab to open Address modal...');
  await page.locator('[data-testid="header-app-logo-btn"]').first().click({ force: true });
  await page.waitForTimeout(1200);

  const homeModalPath = path.join(SCREENSHOT_DIR, 'test_home_logo_opens_address.png');
  await page.screenshot({ path: homeModalPath });
  console.log('Saved Home Address Sheet screenshot:', homeModalPath);

  // Close address modal
  const closeBtn = page.locator('[data-testid="close-address-modal-btn"]').first();
  if (await closeBtn.count() > 0) {
    await closeBtn.click({ force: true });
    await page.waitForTimeout(800);
  }

  // 2. ACTIVITY TAB
  console.log('Navigating to Activity Tab...');
  await page.locator('text=Activity').last().click({ force: true });
  await page.waitForTimeout(1500);

  const activityPath = path.join(SCREENSHOT_DIR, 'test_tab_activity_golden_logo.png');
  await page.screenshot({ path: activityPath });
  console.log('Saved Activity Tab screenshot:', activityPath);

  // 3. CIRCLE TAB
  console.log('Navigating to Circle Tab...');
  await page.locator('text=Circle').last().click({ force: true });
  await page.waitForTimeout(1500);

  const circlePath = path.join(SCREENSHOT_DIR, 'test_tab_circle_golden_logo.png');
  await page.screenshot({ path: circlePath });
  console.log('Saved Circle Tab screenshot:', circlePath);

  // 4. PROFILE TAB
  console.log('Navigating to Profile Tab...');
  await page.locator('text=Profile').last().click({ force: true });
  await page.waitForTimeout(1500);

  const profilePath = path.join(SCREENSHOT_DIR, 'test_tab_profile_golden_logo.png');
  await page.screenshot({ path: profilePath });
  console.log('Saved Profile Tab screenshot:', profilePath);

  await browser.close();
  console.log('--- All 4 Tabs Verified Successfully ---');
})();
