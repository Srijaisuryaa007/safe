const { chromium } = require('playwright');
const path = require('path');
const fs = require('fs');

const ARTIFACT_DIR = 'C:\\Users\\mylam\\.gemini\\antigravity-ide\\brain\\0532c4a0-e44f-4f50-a1d6-e0e4e4caece4';
const SCREENSHOT_DIR = path.join(ARTIFACT_DIR, 'playwright_screenshots');

async function testSafePlacesMiniMap() {
  console.log('--- TESTING SAFE PLACES MINI MAP INTERACTION & EXPANSION ---');
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
      name: 'Test app',
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
  });

  await page.waitForTimeout(1000);

  // Navigate directly to SafePlaces via window.__navigationRef
  console.log('Navigating directly to SafePlaces screen...');
  await page.evaluate(() => {
    if (window.__navigationRef && window.__navigationRef.navigate) {
      window.__navigationRef.navigate('SafePlaces');
    }
  });
  await page.waitForTimeout(2500);

  // Scroll to GEOFENCE MAP
  console.log('Locating mini map on Safe Places screen...');
  const mapHeader = page.locator('text=GEOFENCE MAP').first();
  if (await mapHeader.isVisible()) {
    await mapHeader.scrollIntoViewIfNeeded();
    await page.waitForTimeout(800);

    const screenshotPath = path.join(SCREENSHOT_DIR, 'test_safeplaces_minimap_inpage.png');
    await page.screenshot({ path: screenshotPath });
    console.log(`Saved in-page mini-map screenshot: ${screenshotPath}`);

    // Click EXPAND button (exact match, not "Expands buffer...")
    console.log('Clicking EXPAND button...');
    const expandBtn = page.getByRole('button', { name: 'EXPAND' }).or(page.locator('text=/^\\s*EXPAND\\s*$/')).first();
    if (await expandBtn.isVisible()) {
      await expandBtn.click({ force: true });
      await page.waitForTimeout(1200);

      const screenshotPath2 = path.join(SCREENSHOT_DIR, 'test_safeplaces_minimap_expanded.png');
      await page.screenshot({ path: screenshotPath2 });
      console.log(`Saved expanded precision map screenshot: ${screenshotPath2}`);

      // Click DONE to close modal
      const doneBtn = page.locator('text=DONE').first();
      if (await doneBtn.isVisible()) {
        await doneBtn.click({ force: true });
        await page.waitForTimeout(800);
        console.log('Closed expanded modal successfully.');
      }
    }
  } else {
    console.log('Could not find GEOFENCE MAP header, taking screen fallback...');
    const fallbackPath = path.join(SCREENSHOT_DIR, 'test_safeplaces_fallback.png');
    await page.screenshot({ path: fallbackPath });
  }

  await browser.close();
  console.log('--- TEST FINISHED ---');
}

testSafePlacesMiniMap().catch(console.error);
