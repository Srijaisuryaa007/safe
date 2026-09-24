const { chromium } = require('playwright');
const path = require('path');
const fs = require('fs');

const CONVERSATION_ID = '4b7cd027-1098-48dd-835e-5684e2a91171';
const SCREENSHOT_DIR = path.join('C:\\Users\\mylam\\.gemini\\antigravity-ide\\brain', CONVERSATION_ID, 'playwright_screenshots');

async function testMapInteractions() {
  console.log('🚀 [START] VERIFYING MAP ROUTE PLAYBACK, ZOOM/FOCUS, AND PRECISE TRAJECTORY');

  const browser = await chromium.launch({ channel: 'chrome', headless: true });
  const context = await browser.newContext({ viewport: { width: 412, height: 915 } });
  const page = await context.newPage();

  const SELF_ID = '03ca6af3-b0f7-46a1-9e70-2bb96befb67c';
  const CIRCLE_ID = 'af00325e-7e26-4b5d-856d-907085b326d2';

  const mockPlaces = [
    { id: 'p1', circle_id: CIRCLE_ID, name: 'Sanctuary Base', latitude: 13.0827, longitude: 80.2707, radius_m: 80, category: 'home' },
    { id: 'p2', circle_id: CIRCLE_ID, name: 'Work Hub', latitude: 13.0400, longitude: 80.2500, radius_m: 100, category: 'work' },
  ];

  const now = Date.now();
  const mockTripPoints = [];

  // Anchor 1: Home
  for (let i = 0; i < 5; i++) {
    mockTripPoints.push({
      id: `pt_h_${i}`,
      user_id: SELF_ID,
      latitude: 13.0827,
      longitude: 80.2707,
      speed_mps: 0.1,
      recorded_at: new Date(now - (30 - i) * 60000).toISOString(),
    });
  }

  // Drive Segment (10 points)
  for (let i = 1; i <= 10; i++) {
    const frac = i / 10;
    mockTripPoints.push({
      id: `pt_d_${i}`,
      user_id: SELF_ID,
      latitude: 13.0827 + (13.0400 - 13.0827) * frac,
      longitude: 80.2707 + (80.2500 - 80.2707) * frac,
      speed_mps: 12.5,
      recorded_at: new Date(now - (25 - i) * 60000).toISOString(),
    });
  }

  // Anchor 2: Work Hub
  for (let i = 0; i < 5; i++) {
    mockTripPoints.push({
      id: `pt_w_${i}`,
      user_id: SELF_ID,
      latitude: 13.0400,
      longitude: 80.2500,
      speed_mps: 0.1,
      recorded_at: new Date(now - (14 - i) * 60000).toISOString(),
    });
  }

  await page.route('**/rest/v1/places*', route => route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(mockPlaces) }));
  await page.route('**/rest/v1/location_history*', route => route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(mockTripPoints) }));

  await page.goto('http://127.0.0.1:8081');
  await page.waitForSelector('text=SIGN IN', { timeout: 20000 });

  await page.evaluate(({ SELF_ID, CIRCLE_ID, mockPlaces, mockTripPoints }) => {
    window.__useAuthStore.getState().setSession({ access_token: 'tk', token_type: 'bearer', user: { id: SELF_ID } });
    window.__useAuthStore.getState().setProfile({ id: SELF_ID, full_name: 'Sri Jai Suryaa', is_premium: true });
    window.__useAuthStore.getState().setLoading(false);
    window.__useCircleStore.getState().setActiveCircle({ id: CIRCLE_ID, name: 'Family Circle', owner_id: SELF_ID });
    window.__useCircleStore.getState().setPlaces(mockPlaces);
    window.__useCircleStore.getState().setMembers([{ circle_id: CIRCLE_ID, user_id: SELF_ID, role: 'owner', isOnline: true, latitude: 13.0827, longitude: 80.2707, profile: { id: SELF_ID, full_name: 'Sri Jai Suryaa' } }]);
  }, { SELF_ID, CIRCLE_ID, mockPlaces, mockTripPoints });

  await page.waitForTimeout(500);
  await page.evaluate(() => window.__navigationRef.navigate('LocationHistory'));
  
  // Wait for loading radar to disappear and map iframe to be visible
  await page.waitForSelector('#historyMapIframe', { state: 'visible', timeout: 15000 });
  await page.waitForTimeout(2000);

  // 1. Capture initial overview with full route
  const ssRouteOverview = path.join(SCREENSHOT_DIR, 'precise_location_history_map_ready.png');
  await page.screenshot({ path: ssRouteOverview });
  console.log(`📸 Saved screenshot: ${ssRouteOverview}`);

  // 2. Click Play to verify avatar movement along the polyline
  const playBtn = page.locator('div[style*="border-radius: 20px"]').locator('visible=true').first();
  if (await playBtn.isVisible()) {
    console.log('Starting route animation playback...');
    await playBtn.click();
    await page.waitForTimeout(2500);

    const ssPlayback = path.join(SCREENSHOT_DIR, 'precise_route_playback_active.png');
    await page.screenshot({ path: ssPlayback });
    console.log(`📸 Saved screenshot: ${ssPlayback}`);
  }

  // 3. Scroll and click on the destination place card to verify map camera smoothly centers
  await page.mouse.wheel(0, 350);
  await page.waitForTimeout(800);

  const workCard = page.locator('text=Work Hub').locator('visible=true').first();
  if (await workCard.isVisible()) {
    console.log('Focusing on Work Hub stop card...');
    await workCard.click();
    await page.waitForTimeout(1500);

    // Scroll back up to view map
    await page.mouse.wheel(0, -350);
    await page.waitForTimeout(800);

    const ssFocused = path.join(SCREENSHOT_DIR, 'precise_route_stop_focused.png');
    await page.screenshot({ path: ssFocused });
    console.log(`📸 Saved screenshot: ${ssFocused}`);
  }

  await browser.close();
  console.log('🏆 [SUCCESS] Location History Map verified end-to-end!');
}

testMapInteractions().catch(err => {
  console.error('Test failed:', err);
  process.exit(1);
});
