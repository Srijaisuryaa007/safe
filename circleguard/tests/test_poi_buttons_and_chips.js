const { chromium } = require('playwright');
const path = require('path');
const fs = require('fs');

const ARTIFACT_DIR = 'C:\\Users\\mylam\\.gemini\\antigravity-ide\\brain\\0532c4a0-e44f-4f50-a1d6-e0e4e4caece4';
const SCREENSHOT_DIR = path.join(ARTIFACT_DIR, 'playwright_screenshots');

async function testPoiCardAndChips() {
  console.log('--- TESTING POI BUTTONS & CHIPS ---');
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

  await page.evaluate(() => {
    const SELF_ID = '11111111-1111-4111-8111-111111111111';
    const SRI_ID = '22222222-2222-4222-8222-222222222222';
    const ART_ID = '33333333-3333-4333-8333-333333333333';
    const CIRCLE_ID = '44444444-4444-4444-8444-444444444444';

    const mockUser = {
      id: SELF_ID,
      email: 'sri@example.com',
      user_metadata: { full_name: 'Sri User' },
    };
    const mockSession = {
      access_token: 'mock-token',
      token_type: 'bearer',
      user: mockUser,
    };
    const mockProfile = {
      id: SELF_ID,
      full_name: 'Sri User',
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
      id: CIRCLE_ID,
      name: 'Family Circle',
      invite_code: 'TEST12',
      created_by: SELF_ID,
      created_at: new Date().toISOString(),
    };
    if (window.__useCircleStore) {
      window.__useCircleStore.getState().setActiveCircle(mockCircle);
      window.__useCircleStore.getState().setMembers([
        {
          user_id: SELF_ID,
          role: 'owner',
          isOnline: true,
          profile: {
            id: SELF_ID,
            full_name: 'Sri User',
          }
        },
        {
          user_id: SRI_ID,
          role: 'member',
          isOnline: true,
          latitude: 12.9716,
          longitude: 77.5946,
          profile: {
            id: SRI_ID,
            full_name: 'Sri Jaisuryaa',
          }
        },
        {
          user_id: ART_ID,
          role: 'co_leader',
          isOnline: true,
          latitude: 12.9716,
          longitude: 77.5946,
          profile: {
            id: ART_ID,
            full_name: 'Art Suryaa',
          }
        }
      ]);
    }
    if (window.__useThemeStore) {
      window.__useThemeStore.getState().setThemeMode('brand_green');
    }
  });

  console.log('Navigating to Map tab...');
  await page.waitForSelector('text=Map', { timeout: 10000 });
  const mapTab = page.locator('[role="tab"]:has-text("Map"), div[role="button"]:has-text("Map")').last();
  await mapTab.click();
  await page.waitForTimeout(2000);

  // Take screenshot of chips bar
  const screenshotChips = path.join(SCREENSHOT_DIR, 'test_chips_deduped_you.png');
  await page.screenshot({ path: screenshotChips });
  console.log('Saved chips screenshot:', screenshotChips);

  // Now trigger searched POI card
  console.log('Selecting searched POI...');
  await page.evaluate(() => {
    if (window.__mapDebug && window.__mapDebug.setSelectedPoi) {
      window.__mapDebug.setSelectedPoi({
        id: 'poi-central-station',
        name: 'Puratchi Thalaivar Dr. M. G. Ramachandran Central',
        subText: 'Coordinates: 13.0824, 80.2760',
        lat: 13.0824,
        lng: 80.2760,
        category: 'landmark'
      });
    }
  });

  await page.waitForTimeout(1000);

  const screenshotPoiCard = path.join(SCREENSHOT_DIR, 'test_poi_card_fixed_buttons.png');
  await page.screenshot({ path: screenshotPoiCard });
  console.log('Saved POI card screenshot:', screenshotPoiCard);

  await browser.close();
  console.log('--- TEST FINISHED ---');
}

testPoiCardAndChips().catch(console.error);
