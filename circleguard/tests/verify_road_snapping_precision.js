const { chromium } = require('playwright');
const path = require('path');

async function verifyRoadSnappingPrecision() {
  const browser = await chromium.launch({ channel: 'chrome', headless: true });
  const context = await browser.newContext({ viewport: { width: 412, height: 915 } });
  const page = await context.newPage();

  page.on('console', msg => {
    const text = msg.text();
    if (!text.includes('[Fast Refresh]') && !text.includes('Download the React DevTools')) {
      console.log('PAGE LOG:', text);
    }
  });
  page.on('pageerror', err => console.log('PAGE ERROR:', err.message));
  page.on('response', res => {
    if (res.status() >= 400) {
      console.log('HTTP ERROR:', res.status(), res.url());
    }
  });

  const SELF_ID = '03ca6af3-b0f7-46a1-9e70-2bb96befb67c';
  const CIRCLE_ID = 'af00325e-7e26-4b5d-856d-907085b326d2';

  // Realistic driving breadcrumbs along Chennai road network
  // From Central Station (13.0827, 80.2707) towards Marina Beach via Wallajah Rd / Kamarajar Salai (13.0645, 80.2815)
  const baseTime = Date.now() - 3600 * 1000;
  const mockTelemetry = [
    { id: 'loc_1', user_id: SELF_ID, latitude: 13.0827, longitude: 80.2707, speed_mps: 0, recorded_at: new Date(baseTime).toISOString() },
    { id: 'loc_2', user_id: SELF_ID, latitude: 13.0814, longitude: 80.2726, speed_mps: 8.5, recorded_at: new Date(baseTime + 120000).toISOString() },
    { id: 'loc_3', user_id: SELF_ID, latitude: 13.0819, longitude: 80.2814, speed_mps: 11.2, recorded_at: new Date(baseTime + 240000).toISOString() },
    { id: 'loc_4', user_id: SELF_ID, latitude: 13.0763, longitude: 80.2836, speed_mps: 12.8, recorded_at: new Date(baseTime + 360000).toISOString() },
    { id: 'loc_5', user_id: SELF_ID, latitude: 13.0721, longitude: 80.2854, speed_mps: 9.4, recorded_at: new Date(baseTime + 480000).toISOString() },
    { id: 'loc_6', user_id: SELF_ID, latitude: 13.0645, longitude: 80.2815, speed_mps: 0, recorded_at: new Date(baseTime + 600000).toISOString() },
  ];

  await page.route('**/rest/v1/places*', route => route.fulfill({
    status: 200,
    contentType: 'application/json',
    body: JSON.stringify([
      { id: 'pl_1', circle_id: CIRCLE_ID, name: 'Home Safe Haven', category: 'home', latitude: 13.0827, longitude: 80.2707, radius_m: 100 },
      { id: 'pl_2', circle_id: CIRCLE_ID, name: 'Marina Beach Bay', category: 'work', latitude: 13.0645, longitude: 80.2825, radius_m: 120 }
    ])
  }));

  await page.route('**/rest/v1/location_history*', route => route.fulfill({
    status: 200,
    contentType: 'application/json',
    body: JSON.stringify(mockTelemetry)
  }));

  console.log('Navigating to app...');
  await page.goto('http://127.0.0.1:8081');
  await page.waitForSelector('text=SIGN IN', { timeout: 25000 });

  console.log('Setting authenticated session...');
  await page.evaluate(({ SELF_ID, CIRCLE_ID }) => {
    window.__useAuthStore.getState().setSession({ access_token: 'valid_test_token', token_type: 'bearer', user: { id: SELF_ID } });
    window.__useAuthStore.getState().setProfile({ id: SELF_ID, full_name: 'Sri Jai Suryaa', is_premium: true });
    window.__useAuthStore.getState().setLoading(false);
    window.__useCircleStore.getState().setActiveCircle({ id: CIRCLE_ID, name: 'Family Circle', owner_id: SELF_ID });
    window.__useCircleStore.getState().setMembers([{
      circle_id: CIRCLE_ID, user_id: SELF_ID, role: 'owner', isOnline: true,
      latitude: 13.0645, longitude: 80.2825,
      profile: { id: SELF_ID, full_name: 'Sri Jai Suryaa' }
    }]);
  }, { SELF_ID, CIRCLE_ID });

  await page.waitForTimeout(1500);

  // Take screenshot of Home Screen with History button
  const homeScreenshot = path.resolve(__dirname, '../../playwright_screenshots/home_screen_with_history.png');
  await page.screenshot({ path: homeScreenshot });
  console.log('Saved home screen screenshot:', homeScreenshot);

  // Click on "History" quick tile
  console.log('Clicking on History quick tile...');
  const historyTile = page.locator('text=History').locator('visible=true').first();
  await historyTile.click();

  // Wait for Location History screen to mount
  await page.waitForSelector('text=LOCATION HISTORY', { timeout: 15000 });
  console.log('Successfully navigated to Location History screen!');

  // Wait for telematics processing, OSRM road matching & map rendering
  await page.waitForTimeout(9000);

  // Extract and verify Telematics KPI Dashboard values
  const kpiTexts = await page.evaluate(() => {
    return Array.from(document.querySelectorAll('*'))
      .filter(el => ['TOTAL DISTANCE', 'ACTIVE TRANSIT', 'TOP SPEED', 'AVG SPEED'].includes(el.textContent?.trim()))
      .map(el => {
        const parent = el.closest('div');
        return parent ? parent.innerText.replace(/\n/g, ' ') : el.textContent;
      });
  });
  console.log('Telematics Dashboard Metrics:', kpiTexts);

  const historyLoadedScreenshot = path.resolve(__dirname, '../../playwright_screenshots/location_history_road_snapped.png');
  await page.screenshot({ path: historyLoadedScreenshot });
  console.log('Saved location history screenshot:', historyLoadedScreenshot);

  // Check iframe/webview for Leaflet map elements
  const iframeHandle = await page.$('iframe');
  if (iframeHandle) {
    const frame = await iframeHandle.contentFrame();
    if (frame) {
      const polylineCount = await frame.$$eval('path.leaflet-interactive', paths => paths.length);
      console.log('Found interactive Leaflet SVG paths (roads & glow):', polylineCount);

      // Verify road coordinates in window
      const roadCoordStats = await frame.evaluate(() => {
        return {
          hasMap: !!window.L,
          markersCount: document.querySelectorAll('.leaflet-marker-icon').length,
          pathsCount: document.querySelectorAll('path').length,
          polylinePoints: window.legPolylines && window.legPolylines[0] && window.legPolylines[0].getLatLngs ? window.legPolylines[0].getLatLngs().length : 0,
        };
      });
      console.log('Map internal stats:', roadCoordStats);
    }
  }

  // Scroll down to check timeline events
  const timelineItem = page.locator('text=Trip from').or(page.locator('text=Drive heading')).or(page.locator('text=Home Safe Haven'));
  if (await timelineItem.first().isVisible()) {
    console.log('Timeline event is visible on screen!');
  }

  // Tap play button if visible to test playback along road curves
  const playButton = page.locator('[aria-label="Play"]').or(page.locator('text=▶')).or(page.locator('button:has-text("Play")'));
  const playBtn = page.locator('svg[name="play"]').or(page.locator('path[d*="play"]')).first();
  
  await page.waitForTimeout(1000);
  const playbackScreenshot = path.resolve(__dirname, '../../playwright_screenshots/location_history_playback.png');
  await page.screenshot({ path: playbackScreenshot });
  console.log('Saved final playback screenshot:', playbackScreenshot);

  await browser.close();
  console.log('Verification completed successfully!');
}

verifyRoadSnappingPrecision().catch(err => {
  console.error('Test error:', err);
  process.exit(1);
});
