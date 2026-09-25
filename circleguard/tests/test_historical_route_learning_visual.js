const { chromium } = require('playwright');
const path = require('path');
const fs = require('fs');

const ARTIFACT_DIR = 'C:\\Users\\mylam\\.gemini\\antigravity-ide\\brain\\a3377614-b22c-4960-8db7-02c3ece4891d';
const SCREENSHOT_DIR = path.join(ARTIFACT_DIR, 'playwright_screenshots');

if (!fs.existsSync(SCREENSHOT_DIR)) {
  fs.mkdirSync(SCREENSHOT_DIR, { recursive: true });
}

async function testHistoricalRouteLearningVisual() {
  console.log('--- TESTING HISTORICAL ROUTE LEARNING & GAP RECONSTRUCTION ---');
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

  console.log('Seeding mock stores, past historical routes memory, and today trip with dropped gap...');
  await page.evaluate(() => {
    const SELF_ID = '03ca6af3-b0f7-46a1-9e70-2bb96befb67c';
    const CIRCLE_ID = 'af00325e-7e26-4b5d-856d-907085b326d2';

    const mockUser = {
      id: SELF_ID,
      email: 'sri@example.com',
    };
    const mockSession = {
      access_token: 'mock-token',
      token_type: 'bearer',
      user: mockUser,
    };
    const mockProfile = {
      id: SELF_ID,
      full_name: 'Sri Jai Suryaa',
      phone: '+918072986912',
      avatar_url: null,
      is_ghost_mode: false,
      hide_online_presence: false,
      is_premium: true,
      created_at: new Date().toISOString(),
    };

    const mockCircle = {
      id: CIRCLE_ID,
      name: 'Family Circle',
      invite_code: 'HK3GJB',
      tracking_mode: 'continuous',
      owner_id: SELF_ID,
      created_at: new Date().toISOString(),
    };

    const mockMembers = [
      {
        circle_id: CIRCLE_ID,
        user_id: SELF_ID,
        role: 'owner',
        joined_at: new Date().toISOString(),
        profile: mockProfile,
        batteryPct: 92,
        isOnline: true,
      },
    ];

    // Seed 1: A previously driven route in the user's learned memory
    const learnedRouteMemory = [
      {
        id: 'learned_commute_route_1',
        userId: SELF_ID,
        recordedDate: '2026-09-15',
        bounds: { minLat: 12.970, maxLat: 12.990, minLng: 77.590, maxLng: 77.620 },
        points: [
          { lat: 12.9716, lng: 77.5946, speedKmh: 42 },
          { lat: 12.9745, lng: 77.5975, speedKmh: 45 },
          { lat: 12.9772, lng: 77.6002, speedKmh: 48 },
          { lat: 12.9805, lng: 77.6035, speedKmh: 46 },
          { lat: 12.9828, lng: 77.6058, speedKmh: 47 },
          { lat: 12.9850, lng: 77.6080, speedKmh: 50 },
          { lat: 12.9880, lng: 77.6110, speedKmh: 40 },
        ]
      }
    ];

    // Seed 2: Today's trip where GPS was dropped for 1.6km (tunnel / dead zone between p2 and p3)
    const now = Date.now();
    const todayDroppedBreadcrumbs = [
      {
        latitude: 12.9716,
        longitude: 77.5946,
        recorded_at: new Date(now - 300000).toISOString(),
        speed_mps: 11.5,
      },
      {
        latitude: 12.9745,
        longitude: 77.5975,
        recorded_at: new Date(now - 250000).toISOString(),
        speed_mps: 12.5,
      },
      {
        latitude: 12.9850,
        longitude: 77.6080,
        recorded_at: new Date(now - 100000).toISOString(),
        speed_mps: 13.8,
      },
      {
        latitude: 12.9880,
        longitude: 77.6110,
        recorded_at: new Date(now - 50000).toISOString(),
        speed_mps: 11.0,
      }
    ];

    window.localStorage.setItem(`@circleguard_learned_routes_${SELF_ID}`, JSON.stringify(learnedRouteMemory));
    window.localStorage.setItem(`@circleguard_offline_breadcrumbs_${SELF_ID}`, JSON.stringify(todayDroppedBreadcrumbs));

    window.__useAuthStore.getState().setSession(mockSession);
    window.__useAuthStore.getState().setProfile(mockProfile);
    window.__useAuthStore.getState().setProfileFetching(false);
    window.__useAuthStore.getState().setLoading(false);

    window.__useCircleStore.getState().setActiveCircle(mockCircle);
    window.__useCircleStore.getState().setMembers(mockMembers);
  });

  await page.waitForSelector('text=MAP', { timeout: 10000 });
  console.log('App ready. Navigating directly to LocationHistoryScreen...');

  await page.evaluate(() => {
    if (window.__navigationRef && window.__navigationRef.navigate) {
      window.__navigationRef.navigate('LocationHistory');
    }
  });

  await page.waitForSelector('text=LOCATION HISTORY', { timeout: 10000 });
  console.log('LocationHistoryScreen loaded! Waiting for AI gap reconstruction...');
  await page.waitForTimeout(2500);

  // Take screenshot 1: Top overview with AI Route Reconstruction Banner
  const shotPath = path.join(SCREENSHOT_DIR, 'test_location_history_ai_reconstruction.png');
  await page.screenshot({ path: shotPath });
  console.log(`[PASS] Saved visual verification screenshot: ${shotPath}`);

  // Scroll inner container down to inspect the movement timeline items
  console.log('Scrolling down to view movement timeline with reconstructed items...');
  await page.evaluate(() => {
    const scrollables = Array.from(document.querySelectorAll('*')).filter(
      el => el.scrollHeight > el.clientHeight && getComputedStyle(el).overflowY !== 'hidden'
    );
    scrollables.forEach(el => {
      el.scrollTop = 450;
    });
  });
  await page.waitForTimeout(1000);

  const shotTimeline = path.join(SCREENSHOT_DIR, 'test_location_history_timeline_learned_roads.png');
  await page.screenshot({ path: shotTimeline });
  console.log(`[PASS] Saved timeline screenshot: ${shotTimeline}`);

  await browser.close();
  console.log('=== TEST COMPLETED SUCCESSFULLY ===');
}

testHistoricalRouteLearningVisual().catch(err => {
  console.error('Test failed with error:', err);
  process.exit(1);
});
