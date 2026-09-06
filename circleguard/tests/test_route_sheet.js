const { chromium } = require('playwright');
const path = require('path');
const fs = require('fs');

const ARTIFACT_DIR = 'C:\\Users\\mylam\\.gemini\\antigravity-ide\\brain\\0532c4a0-e44f-4f50-a1d6-e0e4e4caece4';
const SCREENSHOT_DIR = path.join(ARTIFACT_DIR, 'playwright_screenshots');

if (!fs.existsSync(SCREENSHOT_DIR)) {
  fs.mkdirSync(SCREENSHOT_DIR, { recursive: true });
}

async function testRouteSheet() {
  console.log('--- STARTING ROUTE SHEET TEST ---');
  const browser = await chromium.launch({
    channel: 'chrome',
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox']
  });

  const context = await browser.newContext({
    viewport: { width: 390, height: 844 },
    deviceScaleFactor: 2,
    hasTouch: true,
    geolocation: { latitude: 12.9716, longitude: 77.5946 },
    permissions: ['geolocation'],
  });

  const page = await context.newPage();

  console.log('Navigating to http://127.0.0.1:8081...');
  await page.goto('http://127.0.0.1:8081', { waitUntil: 'commit', timeout: 30000 });

  console.log('Waiting for login screen...');
  await page.waitForSelector('text=SIGN IN', { timeout: 15000 });

  console.log('Setting authenticated session in store...');
  await page.evaluate(() => {
    const mockUser = {
      id: 'test-user-id-12345',
      email: 'testexplorer@example.com',
      user_metadata: { full_name: 'Test Explorer' },
    };
    const mockSession = {
      access_token: 'mock-token',
      token_type: 'bearer',
      user: mockUser,
    };
    const mockProfile = {
      id: 'test-user-id-12345',
      full_name: 'Test Explorer',
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
      name: 'Family Guard',
      invite_code: 'TEST12',
      created_by: 'test-user-id-12345',
      created_at: new Date().toISOString(),
    };
    if (window.__useCircleStore) {
      window.__useCircleStore.getState().setActiveCircle(mockCircle);
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
  await page.waitForTimeout(1000);

  // If permission dialog appears, click OK
  try {
    const okButton = page.getByRole('button', { name: /^OK$/i });
    if (await okButton.count() > 0 && await okButton.isVisible()) {
      console.log('Dismissing permission dialog...');
      await okButton.click({ timeout: 2000 });
      await page.waitForTimeout(500);
    }
  } catch (e) {}

  console.log('Triggering member selection with 2 routes...');
  await page.evaluate(() => {
    const mockMember = {
      id: 'member-1',
      user_id: 'target-member-user-id',
      role: 'member',
      isOnline: false,
      lastSeenText: '12d ago',
      profile: {
        id: 'target-member-user-id',
        full_name: 'Art Suryaa',
        phone: '+91 98765 43210',
        avatar_url: null,
      },
    };

    const mockRoutes = [
      {
        id: 'route_0',
        name: 'Fastest / Recommended Route',
        tag: 'fastest',
        distanceKm: 326.8,
        durationMins: 257,
        distText: '326.8 km',
        timeText: '4h 17m',
        diffKmText: 'Primary',
        diffTimeText: 'FASTEST',
        roadCoords: [[12.97, 77.59], [13.08, 80.27]],
      },
      {
        id: 'route_1',
        name: 'Alternative Bypass / Longest Route',
        tag: 'longest',
        distanceKm: 337.4,
        durationMins: 270,
        distText: '337.4 km',
        timeText: '4h 30m',
        diffKmText: '+10.6 km',
        diffTimeText: '+13m',
        roadCoords: [[12.97, 77.59], [13.20, 80.20]],
      },
    ];

    if (window.__mapDebug) {
      window.__mapDebug.setSelectedMember(mockMember);
      window.__mapDebug.setAvailableRoutes(mockRoutes);
    }
  });

  await page.waitForTimeout(800);
  const filename = 'refined_route_sheet_fastest_active.png';
  await page.screenshot({ path: path.join(SCREENSHOT_DIR, filename) });
  console.log(`Saved ${filename}`);

  console.log('Selecting Alternative route...');
  const altCard = page.locator('text=4h 30m').first();
  if (await altCard.count() > 0) {
    await altCard.click();
    await page.waitForTimeout(600);
    const filenameAlt = 'refined_route_sheet_alt_active.png';
    await page.screenshot({ path: path.join(SCREENSHOT_DIR, filenameAlt) });
    console.log(`Saved ${filenameAlt}`);
  }

  await browser.close();
  console.log('--- TEST COMPLETED ---');
}

testRouteSheet().catch(err => {
  console.error('Test error:', err);
  process.exit(1);
});
