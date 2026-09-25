const { chromium } = require('playwright');
const path = require('path');
const fs = require('fs');

const ARTIFACT_DIR = 'C:\\Users\\mylam\\.gemini\\antigravity-ide\\brain\\a3377614-b22c-4960-8db7-02c3ece4891d';
const SCREENSHOT_DIR = path.join(ARTIFACT_DIR, 'playwright_screenshots');

if (!fs.existsSync(SCREENSHOT_DIR)) {
  fs.mkdirSync(SCREENSHOT_DIR, { recursive: true });
}

async function testActivityNoSOS() {
  console.log('--- TESTING ACTIVITY TAB: CONFIRM FLOATING SOS BUTTON IS REMOVED ---');
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

  console.log('Injecting mock user auth & circle session...');
  await page.evaluate(() => {
    const SELF_ID = '03ca6af3-b0f7-46a1-9e70-2bb96befb67c';
    const CIRCLE_ID = 'af00325e-7e26-4b5d-856d-907085b326d2';

    const mockUser = { id: SELF_ID, email: 'sri@example.com' };
    const mockSession = { access_token: 't', token_type: 'bearer', user: mockUser };
    const mockProfile = { id: SELF_ID, full_name: 'Sri Jai Suryaa', phone: '+918072986912', is_ghost_mode: false, is_premium: true };
    const mockCircle = { id: CIRCLE_ID, name: 'Family Circle', invite_code: 'HK3GJB', tracking_mode: 'continuous', owner_id: SELF_ID };

    const mockMembers = [
      { id: '1', circle_id: CIRCLE_ID, user_id: SELF_ID, role: 'owner', profile: mockProfile, isOnline: true }
    ];

    window.__mockAuth = { user: mockUser, session: mockSession, profile: mockProfile };
    window.__mockCircle = { activeCircle: mockCircle, members: mockMembers };

    if (window.__useAuthStore) window.__useAuthStore.setState({ user: mockUser, session: mockSession, profile: mockProfile, isLoaded: true });
    if (window.__useCircleStore) window.__useCircleStore.setState({ activeCircle: mockCircle, members: mockMembers, circles: [mockCircle], circleFetched: true, isLoading: false });
  });

  await page.waitForTimeout(1000);

  console.log('Navigating to Activity tab...');
  await page.locator('text=Activity').last().click({ force: true });
  await page.waitForTimeout(2000);

  // Check for Timeline feed content (e.g., Activity Timeline, All, Incidents, Places, Battery)
  console.log('Waiting for Activity view to settle...');
  await page.waitForTimeout(1500);

  // Check if any floating SOS button exists
  const sosElements = await page.locator('text=SOS').all();
  console.log(`Found ${sosElements.length} elements containing 'SOS'`);

  let floatingSosFound = false;
  for (let i = 0; i < sosElements.length; i++) {
    const box = await sosElements[i].boundingBox();
    const isVis = await sosElements[i].isVisible();
    console.log(`SOS Element ${i}: visible=${isVis}, box=${JSON.stringify(box)}`);
    // The previous floating SOS button was near bottom right (e.g. y > 700, x > 250)
    if (isVis && box && box.y > 600 && box.x > 250) {
      floatingSosFound = true;
    }
  }

  const screenshotPath = path.join(SCREENSHOT_DIR, 'test_activity_tab_no_sos.png');
  await page.screenshot({ path: screenshotPath });
  console.log(`Saved screenshot to ${screenshotPath}`);

  if (floatingSosFound) {
    console.error('[FAIL] Floating SOS button was detected near footer!');
    process.exitCode = 1;
  } else {
    console.log('[PASS] Confirmed: Floating SOS button is removed and does not overlap the footer!');
  }

  await browser.close();
}

testActivityNoSOS().catch(err => {
  console.error('[FATAL ERROR]:', err);
  process.exit(1);
});
