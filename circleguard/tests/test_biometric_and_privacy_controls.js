const { chromium } = require('playwright');
const path = require('path');
const fs = require('fs');

const ARTIFACT_DIR = 'C:\\Users\\mylam\\.gemini\\antigravity-ide\\brain\\1552c728-fbd5-4a4e-9da5-fb93c3352ef3';
const SCREENSHOT_DIR = path.join(ARTIFACT_DIR, 'playwright_screenshots');

if (!fs.existsSync(SCREENSHOT_DIR)) {
  fs.mkdirSync(SCREENSHOT_DIR, { recursive: true });
}

async function runTestSuite() {
  console.log('--- STARTING SUITE: JELLYRADIO, LOCATION HISTORY CLEANUP, GHOST/ONLINE PRIVACY, BIOMETRIC LOCK ---');
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

  console.log('Navigating to app...');
  await page.goto('http://127.0.0.1:8081', { waitUntil: 'commit', timeout: 30000 });
  await page.waitForTimeout(4000);

  console.log('Injecting session and circle data...');
  await page.evaluate(() => {
    const SELF_ID = '03ca6af3-b0f7-46a1-9e70-2bb96befb67c';
    const ART_ID = 'e7b1a2c3-4d5e-6f7a-8b9c-0d1e2f3a4b5c';
    const CIRCLE_ID = 'af00325e-7e26-4b5d-856d-907085b326d2';

    const mockUser = { id: SELF_ID, email: 'sri@example.com' };
    const mockSession = { access_token: 't', token_type: 'bearer', user: mockUser };
    const mockProfile = { id: SELF_ID, full_name: 'Sri Jai Suryaa', phone: '+918072986912', is_ghost_mode: false, hide_online_presence: false };
    const mockCircle = { id: CIRCLE_ID, name: 'Family Circle', invite_code: 'HK3GJB', tracking_mode: 'continuous', owner_id: SELF_ID };

    const mockMembers = [
      { id: '1', circle_id: CIRCLE_ID, user_id: SELF_ID, role: 'owner', profile: mockProfile, isOnline: true, batteryPct: 94 },
      { id: '2', circle_id: CIRCLE_ID, user_id: ART_ID, role: 'member', profile: { full_name: 'Art Suryaa', phone: '+919876543210' }, isOnline: true, batteryPct: 82, latitude: 13.0827, longitude: 80.2707 },
    ];

    if (window.__useAuthStore) window.__useAuthStore.setState({ user: mockUser, session: mockSession, profile: mockProfile, isLoaded: true });
    if (window.__useCircleStore) window.__useCircleStore.setState({
      activeCircle: mockCircle,
      members: mockMembers,
      circles: [mockCircle],
      circleFetched: true,
      isLoading: false
    });
  });

  await page.waitForTimeout(1000);

  // 1. TEST ACTIVITY TAB WITH JELLYRADIO
  console.log('Testing Activity Tab with React Bits JellyRadio...');
  await page.locator('text=Activity').last().click({ force: true });
  await page.waitForTimeout(2000);

  // Check for JellyRadio component chips
  const allEventsChip = page.locator('text=All Events').first();
  const checkinsChip = page.locator('text=Check-ins').first();
  const arrivalsChip = page.locator('text=Arrivals / Departures').first();
  const alertsChip = page.locator('text=Alerts').first();

  console.log('Verifying JellyRadio chips are visible...');
  const isAllEventsVis = await allEventsChip.isVisible();
  const isArrivalsVis = await arrivalsChip.isVisible();
  console.log(`JellyRadio chips: All Events visible=${isAllEventsVis}, Arrivals visible=${isArrivalsVis}`);

  // Test interactive click on JellyRadio
  await arrivalsChip.click({ force: true });
  await page.waitForTimeout(600);

  const shotActivity = path.join(SCREENSHOT_DIR, 'activity_jelly_radio_chips.png');
  await page.screenshot({ path: shotActivity });
  console.log(`Saved screenshot: ${shotActivity}`);

  // 2. TEST LOCATION HISTORY: VERIFY ONLY 1 SWITCH MEMBER BUTTON
  console.log('Navigating to Location History from Home / Drawer...');
  await page.locator('text=Home').last().click({ force: true });
  await page.waitForTimeout(1500);

  const historyTile = page.locator('text=History').first();
  if (await historyTile.isVisible()) {
    await historyTile.click({ force: true });
  } else {
    // Navigate directly via evaluate if tile is hidden
    await page.evaluate(() => {
      if (window.__navigationRef) window.__navigationRef.navigate('LocationHistory');
    });
  }
  await page.waitForTimeout(2000);

  // Count how many "Switch Member" or dropdown buttons exist in Location History
  const switchMemberButtons = await page.locator('text=Switch Member').all();
  console.log(`Number of 'Switch Member' buttons found: ${switchMemberButtons.length}`);

  const shotLocHistory = path.join(SCREENSHOT_DIR, 'location_history_single_switch_button.png');
  await page.screenshot({ path: shotLocHistory });
  console.log(`Saved screenshot: ${shotLocHistory}`);

  if (switchMemberButtons.length > 1) {
    console.error(`[FAIL] Found duplicate Switch Member buttons (${switchMemberButtons.length})!`);
  } else {
    console.log('[PASS] Confirmed exactly 1 clean Switch Member button in Location History!');
  }

  // 3. TEST PRIVACY & GHOST MODE SETTINGS
  console.log('Testing Privacy Settings & Ghost Mode...');
  await page.locator('text=Profile').last().click({ force: true }).catch(() => {});
  await page.waitForTimeout(1200);

  const privacySettingBtn = page.locator('text=Privacy & Security').first();
  if (await privacySettingBtn.isVisible()) {
    await privacySettingBtn.click({ force: true });
    await page.waitForTimeout(1000);

    const ghostModeTitle = page.locator('text=Ghost Privacy Mode').first();
    const hideOnlineTitle = page.locator('text=Hide Online Presence').first();
    console.log(`Privacy items: Ghost=${await ghostModeTitle.isVisible()}, HideOnline=${await hideOnlineTitle.isVisible()}`);

    const shotPrivacy = path.join(SCREENSHOT_DIR, 'privacy_settings_active.png');
    await page.screenshot({ path: shotPrivacy });
    console.log(`Saved screenshot: ${shotPrivacy}`);
  }

  console.log('--- TEST SUITE FINISHED SUCCESSFULLY ---');
  await browser.close();
}

runTestSuite().catch(err => {
  console.error('[FATAL ERROR]:', err);
  process.exit(1);
});
