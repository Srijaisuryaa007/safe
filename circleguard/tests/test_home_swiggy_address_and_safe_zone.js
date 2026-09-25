const { chromium } = require('playwright');
const path = require('path');
const fs = require('fs');

const ARTIFACT_DIR = 'C:\\Users\\mylam\\.gemini\\antigravity-ide\\brain\\a3377614-b22c-4960-8db7-02c3ece4891d';
const SCREENSHOT_DIR = path.join(ARTIFACT_DIR, 'playwright_screenshots');

if (!fs.existsSync(SCREENSHOT_DIR)) {
  fs.mkdirSync(SCREENSHOT_DIR, { recursive: true });
}

(async () => {
  console.log('--- Starting Swiggy Address & Safe Zone Verification ---');
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

  console.log('Injecting mock user auth, circle members and safe zone places...');
  await page.evaluate(() => {
    const SELF_ID = '03ca6af3-b0f7-46a1-9e70-2bb96befb67c';
    const MEMBER_2_ID = 'e1122334-5566-7788-99aa-bbccddeeff00';
    const CIRCLE_ID = 'af00325e-7e26-4b5d-856d-907085b326d2';

    const mockUser = { id: SELF_ID, email: 'sri@example.com' };
    const mockSession = { access_token: 't', token_type: 'bearer', user: mockUser };
    const mockProfile = { id: SELF_ID, full_name: 'Sri Jai Suryaa', phone: '+918072986912', is_ghost_mode: false, is_premium: true };
    const mockCircle = { id: CIRCLE_ID, name: 'Family Circle', invite_code: 'HK3GJB', tracking_mode: 'continuous', owner_id: SELF_ID };

    // Place at Bangalore (Home Sanctuary)
    const mockPlaces = [
      {
        id: 'place-home-1',
        circle_id: CIRCLE_ID,
        name: 'Home Sanctuary',
        latitude: 12.9716,
        longitude: 77.5946,
        radius_m: 200,
        category: 'home'
      }
    ];

    const mockMembers = [
      {
        id: '1',
        circle_id: CIRCLE_ID,
        user_id: SELF_ID,
        role: 'owner',
        profile: mockProfile,
        latitude: 12.9716, // In Home Sanctuary
        longitude: 77.5946,
        battery_level: 92,
        isOnline: true,
        speed: 0,
        isDriving: false,
      },
      {
        id: '2',
        circle_id: CIRCLE_ID,
        user_id: MEMBER_2_ID,
        role: 'member',
        profile: { id: MEMBER_2_ID, full_name: 'Art Suryaa', phone: '+919876543210' },
        latitude: 13.0827, // Chennai - OUTSIDE Home Sanctuary
        longitude: 80.2707,
        battery_level: 68,
        isOnline: true,
        speed: 0,
        isDriving: false,
      }
    ];

    if (window.__useAuthStore) {
      window.__useAuthStore.setState({
        user: mockUser,
        session: mockSession,
        profile: mockProfile,
        isLoaded: true
      });
    }

    if (window.__useCircleStore) {
      window.__useCircleStore.setState({
        activeCircle: mockCircle,
        members: mockMembers,
        places: mockPlaces,
        circles: [mockCircle],
        circleFetched: true,
        isLoading: false
      });
    }
  });

  await page.waitForTimeout(2000);

  // 1. Capture Home view with the App Logo in header
  const homeHeaderPath = path.join(SCREENSHOT_DIR, 'test_home_header_app_logo.png');
  await page.screenshot({ path: homeHeaderPath });
  console.log('Saved Home header screenshot:', homeHeaderPath);

  // 2. Click the app logo in the header to open Swiggy address sheet
  console.log('Clicking the App Logo button in header to open Swiggy Address modal...');
  const logoBtn = page.locator('[data-testid="header-app-logo-btn"]').first();
  if (await logoBtn.count() > 0) {
    await logoBtn.click({ force: true });
  } else {
    await page.locator('img[src*="logo"]').first().click({ force: true });
  }

  await page.waitForTimeout(1500);

  // 3. Capture Swiggy-style Current Address sheet
  const addressSheetPath = path.join(SCREENSHOT_DIR, 'test_swiggy_address_sheet_open.png');
  await page.screenshot({ path: addressSheetPath });
  console.log('Saved Swiggy Address Sheet screenshot:', addressSheetPath);

  // Close the sheet using testID
  console.log('Closing address modal...');
  const closeBtn = page.locator('[data-testid="close-address-modal-btn"]').first();
  if (await closeBtn.count() > 0) {
    await closeBtn.click({ force: true });
  }
  await page.waitForTimeout(1000);

  // 4. Scroll down to Peace of Mind Tip so the member cards are visible above the dock
  console.log('Scrolling down to reveal member cards...');
  const tipLocator = page.locator('text=Peace of Mind Tip').first();
  if (await tipLocator.count() > 0) {
    await tipLocator.scrollIntoViewIfNeeded();
  } else {
    await page.locator('text=Live Family Status').scrollIntoViewIfNeeded();
  }
  await page.waitForTimeout(1000);

  const familyStatusPath = path.join(SCREENSHOT_DIR, 'test_live_family_status_verified.png');
  await page.screenshot({ path: familyStatusPath });
  console.log('Saved Live Family Status screenshot:', familyStatusPath);

  // 5. Test Dark Mode
  console.log('Switching to Dark Mode via useThemeStore...');
  await page.evaluate(() => {
    if (window.__useThemeStore) {
      window.__useThemeStore.getState().setThemeMode('dark');
    }
  });
  await page.waitForTimeout(1500);

  const darkModeCardsPath = path.join(SCREENSHOT_DIR, 'test_dark_mode_family_status_cards.png');
  await page.screenshot({ path: darkModeCardsPath });
  console.log('Saved Dark Mode Family Status screenshot:', darkModeCardsPath);

  await browser.close();
  console.log('--- Test Finished Successfully ---');
})();
