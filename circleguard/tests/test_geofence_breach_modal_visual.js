const { chromium } = require('playwright');
const path = require('path');
const fs = require('fs');

const ARTIFACT_DIR = 'C:\\Users\\mylam\\.gemini\\antigravity-ide\\brain\\a3377614-b22c-4960-8db7-02c3ece4891d';
const SCREENSHOT_DIR = path.join(ARTIFACT_DIR, 'playwright_screenshots');

async function captureGeofenceBreachModal() {
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

  console.log('Injecting session and triggering Geofence Breach in Map...');
  await page.evaluate(() => {
    const SELF_ID = '03ca6af3-b0f7-46a1-9e70-2bb96befb67c';
    const MEMBER_ID = 'f2b8417c-e092-4f32-8ea5-6d0c9f1a2345';
    const CIRCLE_ID = 'af00325e-7e26-4b5d-856d-907085b326d2';

    const mockUser = { id: SELF_ID, email: 'sri@example.com' };
    const mockSession = { access_token: 't', token_type: 'bearer', user: mockUser };
    const mockProfile = { id: SELF_ID, full_name: 'Sri Jai Suryaa', phone: '+918072986912', is_ghost_mode: false, is_premium: true };
    const memberProfile = { id: MEMBER_ID, full_name: 'Art Suryaa', phone: '+919876543210', is_ghost_mode: false, is_premium: true };
    const mockCircle = { id: CIRCLE_ID, name: 'Family Circle', invite_code: 'HK3GJB', tracking_mode: 'continuous', owner_id: SELF_ID };

    const mockMembers = [
      { id: '1', circle_id: CIRCLE_ID, user_id: SELF_ID, role: 'owner', profile: mockProfile, isOnline: true },
      { id: '2', circle_id: CIRCLE_ID, user_id: MEMBER_ID, role: 'member', profile: memberProfile, isOnline: true }
    ];

    const mockPlaces = [
      { id: 'place_1', circle_id: CIRCLE_ID, name: 'Home Sanctuary', latitude: 12.9716, longitude: 77.5946, radius_m: 150, category: 'home' }
    ];

    if (window.__useAuthStore) window.__useAuthStore.setState({ user: mockUser, session: mockSession, profile: mockProfile, isLoaded: true });
    if (window.__useCircleStore) window.__useCircleStore.setState({ activeCircle: mockCircle, members: mockMembers, places: mockPlaces, circles: [mockCircle], circleFetched: true, isLoading: false });
  });

  await page.waitForTimeout(1000);

  // If Permission Required dialog appeared, dismiss it by clicking OK
  const okBtn = page.locator('text=OK').first();
  if (await okBtn.isVisible()) {
    console.log('Dismissing Permission Required alert...');
    await okBtn.click({ force: true });
    await page.waitForTimeout(1000);
  }

  // Navigate to Map
  console.log('Navigating to Map tab...');
  await page.locator('text=Map').last().click({ force: true });
  await page.waitForTimeout(2000);

  // Check again if any dialog popped up
  const okBtn2 = page.locator('text=OK').first();
  if (await okBtn2.isVisible()) {
    await okBtn2.click({ force: true });
    await page.waitForTimeout(800);
  }

  // Trigger Geofence Breach AlertModal
  console.log('Triggering Geofence Breach alert in MapScreen state...');
  await page.evaluate(() => {
    // Check if we can trigger AlertModal directly through dispatching geofence evaluation or simulating breach
    // If MapScreen's setModalVisible isn't exposed globally, we can also test LuxuryAlertModal or render AlertModal
    if (window.__triggerGeofenceBreach) {
      window.__triggerGeofenceBreach();
    }
  });

  // Let's also check if AlertModal or Alert is open
  const screenshotPath = path.join(SCREENSHOT_DIR, 'test_map_screen_view.png');
  await page.screenshot({ path: screenshotPath });
  console.log(`Saved map screen screenshot to ${screenshotPath}`);

  await browser.close();
}

captureGeofenceBreachModal().catch(err => {
  console.error(err);
  process.exit(1);
});
