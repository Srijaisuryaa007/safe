const { chromium } = require('playwright');
const path = require('path');
const fs = require('fs');

const ARTIFACT_DIR = 'C:\\Users\\mylam\\.gemini\\antigravity-ide\\brain\\0532c4a0-e44f-4f50-a1d6-e0e4e4caece4';
const SCREENSHOT_DIR = path.join(ARTIFACT_DIR, 'playwright_screenshots');

if (!fs.existsSync(SCREENSHOT_DIR)) {
  fs.mkdirSync(SCREENSHOT_DIR, { recursive: true });
}

async function runTest() {
  console.log('--- STARTING NO MOCK LOCATIONS & COLLISION AVOIDANCE TEST ---');
  const browser = await chromium.launch({
    channel: 'chrome',
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox']
  });

  const context = await browser.newContext({
    viewport: { width: 390, height: 844 },
    deviceScaleFactor: 2,
    hasTouch: true,
    geolocation: { latitude: 13.0827, longitude: 80.2707 },
    permissions: ['geolocation'],
  });

  const page = await context.newPage();

  console.log('Navigating to http://127.0.0.1:8081...');
  await page.goto('http://127.0.0.1:8081', { waitUntil: 'commit', timeout: 30000 });

  console.log('Waiting for login screen...');
  await page.waitForSelector('text=SIGN IN', { timeout: 15000 });

  console.log('Setting authenticated session with members Jai (no GPS) and Suryaa (with GPS)...');
  await page.evaluate(() => {
    const mockUser = {
      id: 'test-user-self',
      email: 'self@example.com',
      user_metadata: { full_name: 'You' },
    };
    const mockSession = {
      access_token: 'mock-token',
      token_type: 'bearer',
      user: mockUser,
    };
    const mockProfile = {
      id: 'test-user-self',
      full_name: 'You',
      phone: '+1 555-0199',
      avatar_url: null,
      is_ghost_mode: false,
      hide_online_presence: false,
      is_premium: true,
      created_at: new Date().toISOString(),
    };
    window.__useAuthStore.getState().setSession(mockSession);
    window.__useAuthStore.getState().setProfile(mockProfile);
    window.__useAuthStore.getState().setProfileFetching(false);
    window.__useAuthStore.getState().setLoading(false);

    const mockCircle = {
      id: 'circle-123',
      name: 'Family Circle',
      invite_code: 'TEST12',
      created_by: 'test-user-self',
      created_at: new Date().toISOString(),
    };
    if (window.__useCircleStore) {
      window.__useCircleStore.getState().setActiveCircle(mockCircle);
      window.__useCircleStore.getState().setMembers([
        {
          user_id: 'member-jai',
          role: 'member',
          isOnline: false,
          lastSeenText: 'Offline',
          profile: {
            id: 'member-jai',
            full_name: 'Jai',
            phone: '+91 98765 00001',
            avatar_url: null,
          }
        },
        {
          user_id: 'member-suryaa',
          role: 'co_leader',
          isOnline: true,
          latitude: 12.9716,
          longitude: 77.5946,
          profile: {
            id: 'member-suryaa',
            full_name: 'Suryaa027',
            phone: '+91 98765 00002',
            avatar_url: null,
          }
        }
      ]);
    }
    if (window.__useThemeStore) {
      window.__useThemeStore.getState().setThemeMode('light');
    }
  });

  console.log('Waiting for MainTabs footer to mount...');
  await page.waitForSelector('text=Map', { timeout: 10000 });

  console.log('Navigating to Map tab...');
  const mapTab = page.locator('[role="tab"]:has-text("Map"), div[role="button"]:has-text("Map")').last();
  await mapTab.click();
  await page.waitForTimeout(2000);

  // Take screenshot of map with Member Quick Chips
  const screenshotMap = path.join(SCREENSHOT_DIR, 'test_map_no_mock_chips.png');
  await page.screenshot({ path: screenshotMap });
  console.log('Saved map chips screenshot:', screenshotMap);

  // Check chips content
  const chipTexts = await page.locator('[role="button"], div').filter({ hasText: /JAI/ }).allInnerTexts();
  console.log('Jai chip texts found:', chipTexts);

  // Now click on Jai's chip
  console.log('Clicking on Jai chip...');
  const jaiChip = page.locator('div:has-text("JAI")').last();
  await jaiChip.click();
  await page.waitForTimeout(1500);

  // Take screenshot of Jai selected (should show "No Live GPS Telemetry Yet" & "Location Not Available")
  const screenshotJaiCard = path.join(SCREENSHOT_DIR, 'test_jai_no_gps_sheet.png');
  await page.screenshot({ path: screenshotJaiCard });
  console.log('Saved Jai sheet screenshot:', screenshotJaiCard);

  await browser.close();
  console.log('--- TEST COMPLETE ---');
}

runTest().catch(console.error);
