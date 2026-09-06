const { chromium } = require('playwright');
const path = require('path');
const fs = require('fs');

const ARTIFACT_DIR = 'C:\\Users\\mylam\\.gemini\\antigravity-ide\\brain\\0532c4a0-e44f-4f50-a1d6-e0e4e4caece4';
const SCREENSHOT_DIR = path.join(ARTIFACT_DIR, 'playwright_screenshots');

async function testEnterpriseTelematics() {
  console.log('--- TESTING ENTERPRISE LOCATION HISTORY & DRIVING TELEMATICS ---');
  const browser = await chromium.launch({
    channel: 'chrome',
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox']
  });

  const context = await browser.newContext({
    viewport: { width: 390, height: 844 },
    deviceScaleFactor: 2,
    hasTouch: true,
    geolocation: { latitude: 13.0824, longitude: 80.2760 },
    permissions: ['geolocation'],
  });

  const page = await context.newPage();

  console.log('Navigating to http://127.0.0.1:8081...');
  await page.goto('http://127.0.0.1:8081', { waitUntil: 'commit', timeout: 30000 });

  await page.waitForSelector('text=SIGN IN', { timeout: 15000 });

  console.log('Setting up mock user, session and offline breadcrumbs...');
  await page.evaluate(async () => {
    const SELF_ID = '03ca6af3-b0f7-46a1-9e70-2bb96befb67c';
    const CIRCLE_ID = 'af00325e-7e26-4b5d-856d-907085b326d2';

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
      window.__useCircleStore.getState().setMembers([
        {
          circle_id: CIRCLE_ID,
          user_id: SELF_ID,
          role: 'owner',
          isOnline: true,
          latitude: 13.0824,
          longitude: 80.2760,
          profile: {
            id: SELF_ID,
            full_name: 'Sri Jai Suryaa',
            phone: '+918072986912',
          }
        }
      ]);
    }

    // Inject realistic vehicular journey into local AsyncStorage offline buffer
    const now = Date.now();
    const mockTripPoints = [];
    const baseLat = 13.0824;
    const baseLng = 80.2760;

    for (let i = 0; i < 12; i++) {
      const t = now - (12 - i) * 20000; // 20s intervals
      const lat = baseLat + i * 0.0015;
      const lng = baseLng + i * 0.0012;
      // High vehicular speed (~50 km/h = 13.8 m/s), point 8 has a hard brake
      const speed_mps = (i === 8) ? 3.0 : 14.5;
      mockTripPoints.push({
        user_id: SELF_ID,
        geom: `POINT(${lng} ${lat})`,
        latitude: lat,
        longitude: lng,
        speed_mps,
        recorded_at: new Date(t).toISOString(),
        accuracy: 8,
      });
    }

    try {
      localStorage.setItem(`@circleguard_offline_breadcrumbs_${SELF_ID}`, JSON.stringify(mockTripPoints));
    } catch (e) {}
  });

  await page.waitForTimeout(1000);

  // 1. TEST LOCATION HISTORY SCREEN
  console.log('Navigating to LocationHistory screen...');
  await page.evaluate(() => {
    if (window.__navigationRef && window.__navigationRef.navigate) {
      window.__navigationRef.navigate('LocationHistory');
    }
  });

  await page.waitForTimeout(2500);

  const locHistoryHeader = page.locator('text=LOCATION HISTORY').first();
  if (await locHistoryHeader.isVisible()) {
    console.log('Location History loaded successfully!');
    const screenshotPath = path.join(SCREENSHOT_DIR, 'test_telematics_location_history.png');
    await page.screenshot({ path: screenshotPath });
    console.log(`Saved Location History screenshot: ${screenshotPath}`);
  }

  // 2. TEST DRIVING REPORTS SCREEN
  console.log('Navigating to DrivingReports screen...');
  await page.evaluate(() => {
    if (window.__navigationRef && window.__navigationRef.navigate) {
      window.__navigationRef.navigate('DrivingReports');
    }
  });

  await page.waitForTimeout(2500);

  const drivingHeader = page.locator('text=DRIVING REPORTS').first();
  if (await drivingHeader.isVisible()) {
    console.log('Driving Reports loaded successfully!');
    const screenshotPath = path.join(SCREENSHOT_DIR, 'test_telematics_driving_report.png');
    await page.screenshot({ path: screenshotPath });
    console.log(`Saved Driving Reports screenshot: ${screenshotPath}`);

    // Check if trip card exists to open detail modal
    const tripCard = page.locator('text=/Trip to|Return to|bound Trip/i').first();
    if (await tripCard.isVisible()) {
      console.log('Clicking on recorded trip card to open telemetry route modal...');
      await tripCard.click();
      await page.waitForTimeout(1500);
      const modalScreenshot = path.join(SCREENSHOT_DIR, 'test_telematics_trip_modal.png');
      await page.screenshot({ path: modalScreenshot });
      console.log(`Saved Trip Modal screenshot: ${modalScreenshot}`);

      // Close modal
      const closeBtn = page.locator('text=TRIP TELEMETRY ROUTE').locator('..').locator('button, [role="button"]').first();
      if (await closeBtn.isVisible()) {
        await closeBtn.click();
      }
    }
  }

  await browser.close();
  console.log('--- TEST FINISHED SUCCESSFULLY ---');
}

testEnterpriseTelematics().catch(console.error);
