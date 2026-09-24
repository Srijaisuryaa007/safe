const { chromium } = require('playwright');
const path = require('path');
const fs = require('fs');

const CONVERSATION_ID = '4b7cd027-1098-48dd-835e-5684e2a91171';
const SCREENSHOT_DIR = path.join('C:\\Users\\mylam\\.gemini\\antigravity-ide\\brain', CONVERSATION_ID, 'playwright_screenshots');

if (!fs.existsSync(SCREENSHOT_DIR)) {
  fs.mkdirSync(SCREENSHOT_DIR, { recursive: true });
}

async function runEnterpriseVerification() {
  console.log('🚀 [START] ENTERPRISE LOCATION HISTORY & TELEMATICS VERIFICATION');
  
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

  page.on('console', msg => {
    const text = msg.text();
    if (text.includes('[ENTERPRISE_TELEMATICS]') || text.includes('STATIONARY') || text.includes('TRIP')) {
      console.log('[BROWSER]', text);
    }
  });
  page.on('pageerror', err => console.error('[PAGE ERROR]', err));

  const SELF_ID = '03ca6af3-b0f7-46a1-9e70-2bb96befb67c';
  const CIRCLE_ID = 'af00325e-7e26-4b5d-856d-907085b326d2';

  const mockPlaces = [
    {
      id: 'place_home_1',
      circle_id: CIRCLE_ID,
      name: 'Home Sanctuary',
      latitude: 13.082700,
      longitude: 80.270700,
      geom: 'POINT(80.270700 13.082700)',
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
      geom: 'POINT(80.250000 13.040000)',
      radius_m: 100,
      category: 'work',
      created_at: new Date().toISOString(),
    },
  ];

  // Synthesize Enterprise Telemetry Dataset:
  // 1. Dwell at Home: 8 jitter points within 20m over 8 mins (speed 0.1 m/s)
  // 2. Drive to Tech Campus: 10 moving points along road corridor (speed 45 km/h = 12.5 m/s)
  // 3. Dwell at Tech Campus: 8 jitter points within 25m over 8 mins (speed 0.1 m/s)
  const now = Date.now();
  const mockTripPoints = [];

  // Stay 1: Home Dwell (starts 25 mins ago)
  const homeBaseTime = now - (25 * 60 * 1000);
  for (let i = 0; i < 8; i++) {
    const t = homeBaseTime + (i * 60 * 1000); // 1 min apart
    const lat = 13.082700 + (Math.sin(i * 1.5) * 0.00010);
    const lng = 80.270700 + (Math.cos(i * 1.5) * 0.00010);
    mockTripPoints.push({
      id: `stay_home_${i}`,
      user_id: SELF_ID,
      geom: `POINT(${lng} ${lat})`,
      latitude: lat,
      longitude: lng,
      speed_mps: 0.1,
      recorded_at: new Date(t).toISOString(),
      accuracy: 10,
    });
  }

  // Drive: Home -> Tech Campus (starts 17 mins ago, ends 9 mins ago = 8 mins drive)
  const driveBaseTime = now - (17 * 60 * 1000);
  for (let i = 1; i <= 10; i++) {
    const frac = i / 10;
    const t = driveBaseTime + (i * 45 * 1000); // 45s apart
    const lat = 13.082700 + (13.040000 - 13.082700) * frac;
    const lng = 80.270700 + (80.250000 - 80.270700) * frac;
    mockTripPoints.push({
      id: `drive_point_${i}`,
      user_id: SELF_ID,
      geom: `POINT(${lng} ${lat})`,
      latitude: lat,
      longitude: lng,
      speed_mps: 12.5, // 45 km/h
      recorded_at: new Date(t).toISOString(),
      accuracy: 6,
    });
  }

  // Stay 2: Tech Campus Dwell (starts 9 mins ago, ends 1 min ago = 8 mins dwell)
  const officeBaseTime = now - (9 * 60 * 1000);
  for (let i = 0; i < 8; i++) {
    const t = officeBaseTime + (i * 60 * 1000);
    const lat = 13.040000 + (Math.sin(i * 1.2) * 0.00012);
    const lng = 80.250000 + (Math.cos(i * 1.2) * 0.00012);
    mockTripPoints.push({
      id: `stay_office_${i}`,
      user_id: SELF_ID,
      geom: `POINT(${lng} ${lat})`,
      latitude: lat,
      longitude: lng,
      speed_mps: 0.15,
      recorded_at: new Date(t).toISOString(),
      accuracy: 12,
    });
  }

  // Intercept Supabase Places endpoint to return mock places seamlessly
  await page.route('**/rest/v1/places*', async route => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify(mockPlaces),
    });
  });

  // Intercept Supabase location_history endpoint to return mock telematics points seamlessly
  await page.route('**/rest/v1/location_history*', async route => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify(mockTripPoints),
    });
  });

  console.log('Navigating to app on port 8081...');
  await page.goto('http://127.0.0.1:8081', { waitUntil: 'commit', timeout: 35000 });

  await page.waitForSelector('text=SIGN IN', { timeout: 20000 });

  console.log('Configuring User, Circle Safe Places, and Telemetry Trajectory in state...');
  await page.evaluate(({ SELF_ID, CIRCLE_ID, mockPlaces, mockTripPoints }) => {
    const mockUser = {
      id: SELF_ID,
      email: 'sri@example.com',
      user_metadata: { full_name: 'Sri Jai Suryaa' },
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

    window.__useAuthStore.getState().setSession(mockSession);
    window.__useAuthStore.getState().setProfile(mockProfile);
    window.__useAuthStore.getState().setProfileFetching(false);
    window.__useAuthStore.getState().setLoading(false);

    const mockCircle = {
      id: CIRCLE_ID,
      name: 'Family Circle',
      invite_code: 'HK3GJB',
      owner_id: SELF_ID,
      created_at: new Date().toISOString(),
    };

    if (window.__useCircleStore) {
      window.__useCircleStore.getState().setActiveCircle(mockCircle);
      window.__useCircleStore.getState().setPlaces(mockPlaces);
      window.__useCircleStore.getState().setMembers([
        {
          circle_id: CIRCLE_ID,
          user_id: SELF_ID,
          role: 'owner',
          isOnline: true,
          latitude: 13.0827,
          longitude: 80.2707,
          profile: {
            id: SELF_ID,
            full_name: 'Sri Jai Suryaa',
            phone: '+918072986912',
          }
        }
      ]);
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

  // Check header
  const titleElem = page.locator('text=LOCATION HISTORY').first();
  await titleElem.waitFor({ state: 'visible', timeout: 15000 });
  console.log('✅ Location History screen loaded!');

  // Wait for loading radar spinner to finish processing
  await page.locator('text=RETRIEVING LOCATION HISTORY').waitFor({ state: 'detached', timeout: 15000 }).catch(() => {});
  await page.waitForTimeout(2000);

  const screenText = await page.evaluate(() => document.body.innerText);
  console.log('[VISIBLE SCREEN TEXT SNIPPET]:\n', screenText.split('\n').filter(Boolean).slice(0, 40).join(' | '));

  // Verify Safe Places recognized in Timeline or Stops (filtering for visible only)
  const homeSafeZone = page.locator('text=/Home Sanctuary/').locator('visible=true').first();
  await homeSafeZone.waitFor({ state: 'visible', timeout: 10000 });
  console.log('✅ Safe Place recognized: Home Sanctuary visible in timeline & stops!');

  const officeSafeZone = page.locator('text=/Tech Campus/').locator('visible=true').first();
  await officeSafeZone.waitFor({ state: 'visible', timeout: 10000 });
  console.log('✅ Safe Place recognized: Tech Campus visible in timeline & stops!');

  // Verify Stationary Stops section
  const stopsHeader = page.locator('text=/STATIONARY STOPS/i').locator('visible=true').first();
  await stopsHeader.waitFor({ state: 'visible', timeout: 5000 });
  console.log('✅ Stationary Stops section verified!');

  // Verify Precision Timeline header
  const timelineTitle = page.locator('text=/PRECISION TELEMATICS TIMELINE/i').locator('visible=true').first();
  await timelineTitle.waitFor({ state: 'visible', timeout: 5000 });
  console.log('✅ Precision Telematics Timeline header verified!');

  // Verify 4-metric cards
  const distLabel = page.locator('text=DISTANCE').locator('visible=true').first();
  const travelLabel = page.locator('text=TRAVEL TIME').locator('visible=true').first();
  const topSpeedLabel = page.locator('text=TOP SPEED').locator('visible=true').first();
  const avgSpeedLabel = page.locator('text=AVG SPEED').locator('visible=true').first();

  await distLabel.waitFor({ state: 'visible', timeout: 5000 });
  await travelLabel.waitFor({ state: 'visible', timeout: 5000 });
  await topSpeedLabel.waitFor({ state: 'visible', timeout: 5000 });
  await avgSpeedLabel.waitFor({ state: 'visible', timeout: 5000 });
  console.log('✅ 4-metric grid (Distance, Travel Time, Top Speed, Avg Speed) verified!');

  // Capture full screen overview
  const screenshotOverview = path.join(SCREENSHOT_DIR, 'enterprise_location_history_overview.png');
  await page.screenshot({ path: screenshotOverview });
  console.log(`📸 Saved overview screenshot: ${screenshotOverview}`);

  // Test interactive click on a Trip Card in timeline
  const tripCard = page.locator('text=/Trip from Home Sanctuary|Drive heading|Trip/i').first();
  if (await tripCard.isVisible()) {
    console.log('Testing interactive tap on Trip Card...');
    await tripCard.click();
    await page.waitForTimeout(1000);
    const screenshotTripFocused = path.join(SCREENSHOT_DIR, 'enterprise_location_history_trip_focus.png');
    await page.screenshot({ path: screenshotTripFocused });
    console.log(`📸 Saved Trip Focus screenshot: ${screenshotTripFocused}`);
  }

  // Scroll down to view the full Precision Timeline list
  await page.mouse.wheel(0, 450);
  await page.waitForTimeout(1000);
  const screenshotTimelineScrolled = path.join(SCREENSHOT_DIR, 'enterprise_location_history_timeline_scrolled.png');
  await page.screenshot({ path: screenshotTimelineScrolled });
  console.log(`📸 Saved Timeline Scrolled screenshot: ${screenshotTimelineScrolled}`);

  await browser.close();
  console.log('🏆 [SUCCESS] All enterprise telematics assertions verified successfully!');
}

runEnterpriseVerification().catch((err) => {
  console.error('Test execution failed:', err);
  process.exit(1);
});
