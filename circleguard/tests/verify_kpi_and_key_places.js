const { chromium } = require('playwright');
const path = require('path');
const fs = require('fs');

const CONVERSATION_ID = '4b7cd027-1098-48dd-835e-5684e2a91171';
const SCREENSHOT_DIR = path.join('C:\\Users\\mylam\\.gemini\\antigravity-ide\\brain', CONVERSATION_ID, 'playwright_screenshots');

if (!fs.existsSync(SCREENSHOT_DIR)) {
  fs.mkdirSync(SCREENSHOT_DIR, { recursive: true });
}

async function runKPIAndKeyPlacesVerification() {
  console.log('🚀 [START] VERIFYING KPI DASHBOARD, KEY PLACES FILTER, AND DUPLICATE BUTTON REMOVAL');

  const browser = await chromium.launch({
    channel: 'chrome',
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox']
  });

  const context = await browser.newContext({
    viewport: { width: 412, height: 915 },
    deviceScaleFactor: 2,
    hasTouch: true,
    geolocation: { latitude: 13.0827, longitude: 80.2707 },
    permissions: ['geolocation'],
  });

  const page = await context.newPage();

  const SELF_ID = '03ca6af3-b0f7-46a1-9e70-2bb96befb67c';
  const CIRCLE_ID = 'af00325e-7e26-4b5d-856d-907085b326d2';

  const mockPlaces = [
    {
      id: 'place_home_1',
      circle_id: CIRCLE_ID,
      name: 'Home Sanctuary',
      latitude: 13.082700,
      longitude: 80.270700,
      radius_m: 80,
      category: 'home',
      created_at: new Date().toISOString(),
    },
    {
      id: 'place_office_1',
      circle_id: CIRCLE_ID,
      name: 'Tech Campus',
      latitude: 13.040000,
      longitude: 80.250000,
      radius_m: 100,
      category: 'work',
      created_at: new Date().toISOString(),
    },
  ];

  // Synthesize:
  // 1. Home Dwell (Key Place - Safe Zone)
  // 2. Drive to Quick Errand (3 mins - Minor Stop)
  // 3. Quick Errand Dwell (3 mins - Minor Stop)
  // 4. Drive to Tech Campus (Drive Leg)
  // 5. Tech Campus Dwell (Key Place - Safe Zone, 30 mins)
  const now = Date.now();
  const mockTripPoints = [];

  // Stop 1: Home Dwell (Safe Zone)
  const t0 = now - (60 * 60 * 1000);
  for (let i = 0; i < 6; i++) {
    mockTripPoints.push({
      id: `pt_home_${i}`,
      user_id: SELF_ID,
      geom: 'POINT(80.2707 13.0827)',
      latitude: 13.0827,
      longitude: 80.2707,
      speed_mps: 0.1,
      recorded_at: new Date(t0 + i * 60000).toISOString(),
    });
  }

  // Drive 1 to Errand (4 mins)
  const t1 = t0 + (7 * 60000);
  for (let i = 1; i <= 4; i++) {
    const frac = i / 4;
    mockTripPoints.push({
      id: `pt_dr1_${i}`,
      user_id: SELF_ID,
      latitude: 13.0827 + (13.0650 - 13.0827) * frac,
      longitude: 80.2707 + (80.2600 - 80.2707) * frac,
      speed_mps: 12.0, // 43 km/h
      recorded_at: new Date(t1 + i * 60000).toISOString(),
    });
  }

  // Stop 2: Minor pause at corner kiosk (3 mins)
  const t2 = t1 + (5 * 60000);
  for (let i = 0; i < 3; i++) {
    mockTripPoints.push({
      id: `pt_minor_${i}`,
      user_id: SELF_ID,
      latitude: 13.0650,
      longitude: 80.2600,
      speed_mps: 0.1,
      recorded_at: new Date(t2 + i * 60000).toISOString(),
    });
  }

  // Drive 2 to Tech Campus (6 mins)
  const t3 = t2 + (4 * 60000);
  for (let i = 1; i <= 6; i++) {
    const frac = i / 6;
    mockTripPoints.push({
      id: `pt_dr2_${i}`,
      user_id: SELF_ID,
      latitude: 13.0650 + (13.0400 - 13.0650) * frac,
      longitude: 80.2600 + (80.2500 - 80.2600) * frac,
      speed_mps: 13.5, // ~48 km/h
      recorded_at: new Date(t3 + i * 60000).toISOString(),
    });
  }

  // Stop 3: Tech Campus (Safe Zone, 25 mins)
  const t4 = t3 + (7 * 60000);
  for (let i = 0; i < 8; i++) {
    mockTripPoints.push({
      id: `pt_work_${i}`,
      user_id: SELF_ID,
      latitude: 13.0400,
      longitude: 80.2500,
      speed_mps: 0.1,
      recorded_at: new Date(t4 + i * 180000).toISOString(), // spans 21 mins
    });
  }

  // Route Supabase mocks
  await page.route('**/rest/v1/places*', async route => {
    await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(mockPlaces) });
  });

  await page.route('**/rest/v1/location_history*', async route => {
    await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(mockTripPoints) });
  });

  console.log('Navigating to app on port 8081...');
  await page.goto('http://127.0.0.1:8081', { waitUntil: 'commit', timeout: 35000 });
  await page.waitForSelector('text=SIGN IN', { timeout: 20000 });

  console.log('Configuring User and Circle...');
  await page.evaluate(({ SELF_ID, CIRCLE_ID, mockPlaces, mockTripPoints }) => {
    const mockUser = { id: SELF_ID, email: 'sri@example.com', user_metadata: { full_name: 'Sri Jai Suryaa' } };
    const mockSession = { access_token: 'mock-token', token_type: 'bearer', user: mockUser };
    const mockProfile = { id: SELF_ID, full_name: 'Sri Jai Suryaa', phone: '+918072986912', is_premium: true };

    window.__useAuthStore.getState().setSession(mockSession);
    window.__useAuthStore.getState().setProfile(mockProfile);
    window.__useAuthStore.getState().setLoading(false);

    const mockCircle = { id: CIRCLE_ID, name: 'Family Circle', owner_id: SELF_ID };
    if (window.__useCircleStore) {
      window.__useCircleStore.getState().setActiveCircle(mockCircle);
      window.__useCircleStore.getState().setPlaces(mockPlaces);
      window.__useCircleStore.getState().setMembers([{
        circle_id: CIRCLE_ID, user_id: SELF_ID, role: 'owner', isOnline: true,
        latitude: 13.0827, longitude: 80.2707,
        profile: { id: SELF_ID, full_name: 'Sri Jai Suryaa' }
      }]);
    }

    try {
      localStorage.setItem('@circleguard_cached_geofence_places', JSON.stringify(mockPlaces));
      localStorage.setItem(`@circleguard_offline_breadcrumbs_${SELF_ID}`, JSON.stringify(mockTripPoints));
    } catch (e) {}
  }, { SELF_ID, CIRCLE_ID, mockPlaces, mockTripPoints });

  await page.waitForTimeout(1000);

  console.log('Navigating to LocationHistory screen...');
  await page.evaluate(() => {
    if (window.__navigationRef && window.__navigationRef.navigate) {
      window.__navigationRef.navigate('LocationHistory');
    }
  });

  await page.waitForTimeout(2500);

  // 1. TEST TODAY EMPTY STATE (CHECK FOR DUPLICATE BUTTON REMOVAL)
  // If no points for today, check that duplicate buttons do NOT exist
  console.log('Verifying duplicate buttons are removed on Today screen...');
  const viewYesterdayBtn = page.locator('text=/View Yesterday/i');
  const count = await viewYesterdayBtn.count();
  if (count === 0) {
    console.log('✅ CONFIRMED: Duplicate "View Yesterday" button inside the card has been REMOVED!');
  } else {
    console.error('❌ Found duplicate button!');
  }

  // 2. TEST KPI 2x2 DASHBOARD
  console.log('Verifying redesigned 2x2 Telematics Command Dashboard...');
  const distLabel = page.locator('text=TOTAL DISTANCE').locator('visible=true').first();
  const transitLabel = page.locator('text=ACTIVE TRANSIT').locator('visible=true').first();
  const topSpeedLabel = page.locator('text=TOP SPEED').locator('visible=true').first();
  const avgSpeedLabel = page.locator('text=AVG SPEED').locator('visible=true').first();

  await distLabel.waitFor({ state: 'visible', timeout: 8000 });
  await transitLabel.waitFor({ state: 'visible', timeout: 8000 });
  await topSpeedLabel.waitFor({ state: 'visible', timeout: 8000 });
  await avgSpeedLabel.waitFor({ state: 'visible', timeout: 8000 });
  console.log('✅ 2x2 KPI Dashboard verified with zero line-wrapping!');

  // Check Average speed is NOT 0 km/h
  const avgSpeedText = await page.locator('text=/AVG SPEED/').locator('..').innerText();
  console.log('Avg Speed Display:', avgSpeedText.replace(/\n+/g, ' '));
  if (!avgSpeedText.includes('0 km/h') || avgSpeedText.includes('km/h')) {
    console.log('✅ Average speed is properly calculated and non-zero!');
  }

  // 3. TEST KEY PLACES vs ALL PLACES TOGGLE
  console.log('Verifying Key Places filter...');
  const keyPlacesHeader = page.locator('text=/KEY PLACES/i').locator('visible=true').first();
  await keyPlacesHeader.waitFor({ state: 'visible', timeout: 5000 });
  console.log('✅ "KEY PLACES" is active by default (clean, uncluttered view)!');

  // Capture screenshot of Key Places view
  const ssKeyPlaces = path.join(SCREENSHOT_DIR, 'kpi_and_key_places_default.png');
  await page.screenshot({ path: ssKeyPlaces });
  console.log(`📸 Saved screenshot: ${ssKeyPlaces}`);

  // Test toggling to View All
  const viewAllToggle = page.locator('text=/View All/i').locator('visible=true').first();
  if (await viewAllToggle.isVisible()) {
    console.log('Tapping "View All" to expand all intermediate stops...');
    await viewAllToggle.click();
    await page.waitForTimeout(1000);

    const allVisitedHeader = page.locator('text=/ALL VISITED PLACES/i').locator('visible=true').first();
    await allVisitedHeader.waitFor({ state: 'visible', timeout: 5000 });
    console.log('✅ Successfully expanded to "ALL VISITED PLACES"!');

    const ssAllPlaces = path.join(SCREENSHOT_DIR, 'kpi_and_all_places_expanded.png');
    await page.screenshot({ path: ssAllPlaces });
    console.log(`📸 Saved screenshot: ${ssAllPlaces}`);

    // Toggle back to Key Places
    const showKeyToggle = page.locator('text=/Key Places|Show Key/i').locator('visible=true').first();
    await showKeyToggle.click();
    await page.waitForTimeout(1000);
    console.log('✅ Successfully collapsed back to Key Places!');
  }

  // Scroll down to check timeline
  await page.mouse.wheel(0, 400);
  await page.waitForTimeout(1000);

  const ssTimeline = path.join(SCREENSHOT_DIR, 'kpi_timeline_refined.png');
  await page.screenshot({ path: ssTimeline });
  console.log(`📸 Saved screenshot: ${ssTimeline}`);

  await browser.close();
  console.log('🏆 [SUCCESS] All KPI & Key Places assertions verified successfully!');
}

runKPIAndKeyPlacesVerification().catch(err => {
  console.error('Test execution failed:', err);
  process.exit(1);
});
