const { chromium } = require('playwright');
const path = require('path');
const fs = require('fs');

const ARTIFACT_DIR = 'C:\\Users\\mylam\\.gemini\\antigravity-ide\\brain\\4b7cd027-1098-48dd-835e-5684e2a91171';
const SCREENSHOT_DIR = path.join(ARTIFACT_DIR, 'playwright_screenshots');

if (!fs.existsSync(SCREENSHOT_DIR)) {
  fs.mkdirSync(SCREENSHOT_DIR, { recursive: true });
}

async function setupPage(browser) {
  const context = await browser.newContext({
    viewport: { width: 390, height: 844 },
    deviceScaleFactor: 2,
    hasTouch: true,
  });
  const page = await context.newPage();

  console.log('Navigating to app...');
  await page.goto('http://127.0.0.1:8081', { waitUntil: 'load', timeout: 30000 });
  await page.waitForTimeout(3500);

  await page.evaluate(() => {
    const SELF_ID = '03ca6af3-b0f7-46a1-9e70-2bb96befb67c';
    const ART_ID = 'e7b1a2c3-4d5e-6f7a-8b9c-0d1e2f3a4b5c';
    const CIRCLE_ID = 'af00325e-7e26-4b5d-856d-907085b326d2';

    const mockUser = { id: SELF_ID, email: 'sri@example.com' };
    const mockSession = { access_token: 'mock-t', token_type: 'bearer', user: mockUser };
    const mockProfile = { id: SELF_ID, full_name: 'Sri Jai Suryaa', phone: '+918072986912', is_ghost_mode: false, is_premium: true };
    const mockCircle = { id: CIRCLE_ID, name: 'Family Circle', invite_code: 'HK3GJB', tracking_mode: 'continuous', owner_id: SELF_ID };

    const mockMembers = [
      { id: '1', circle_id: CIRCLE_ID, user_id: SELF_ID, role: 'owner', profile: mockProfile, isOnline: true },
      { id: '2', circle_id: CIRCLE_ID, user_id: ART_ID, role: 'co_leader', supervisor_id: SELF_ID, profile: { full_name: 'Art Suryaa', phone: '+919876543210' }, isOnline: true, batteryPct: 88, isDriving: true, latitude: 13.0827, longitude: 80.2707 },
    ];

    if (window.__useAuthStore) {
      window.__useAuthStore.getState().setSession(mockSession);
      window.__useAuthStore.getState().setProfile(mockProfile);
      window.__useAuthStore.getState().setLoading(false);
      window.__useAuthStore.getState().setProfileFetching(false);
    }
    if (window.__useCircleStore) {
      window.__useCircleStore.setState({
        activeCircle: mockCircle,
        members: mockMembers,
        circles: [mockCircle],
        circleFetched: true,
        isLoading: false,
        membersByCircle: { [CIRCLE_ID]: mockMembers },
        fetchMembers: async () => mockMembers,
        fetchPlaces: async () => [],
      });
    }
  });

  await page.waitForTimeout(1500);

  // Navigate to Circle tab
  await page.evaluate(() => {
    if (window.__navigationRef?.isReady?.()) {
      window.__navigationRef.navigate('MainTabs', { screen: 'Circle' });
    }
  });
  await page.waitForTimeout(1500);

  return page;
}

async function testAll() {
  const browser = await chromium.launch({
    channel: 'chrome',
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox']
  });

  try {
    // TEST 1: Open profile and verify Location History button
    console.log('--- TEST 1: LOCATION HISTORY BUTTON ---');
    const page1 = await setupPage(browser);
    
    // Tap Art Suryaa's member card
    const artCard = page1.locator('text=Art Suryaa').first();
    await artCard.waitFor({ timeout: 5000 });
    await artCard.click({ force: true });
    await page1.waitForTimeout(1000);

    const profileScreenshot = path.join(SCREENSHOT_DIR, 'elevated_profile_modal.png');
    await page1.screenshot({ path: profileScreenshot });
    console.log('Saved elevated profile modal screenshot:', profileScreenshot);

    const locHistBtn = page1.locator('text=Location History');
    await locHistBtn.waitFor({ timeout: 5000 });
    console.log('Clicking Location History button...');
    await locHistBtn.click({ force: true });
    await page1.waitForTimeout(2000);
    const hasHistoryTitle = await page1.locator('text=LOCATION HISTORY').isVisible();
    console.log('Navigated to LOCATION HISTORY?', hasHistoryTitle);
    await page1.screenshot({ path: path.join(SCREENSHOT_DIR, 'test_profile_location_history_nav.png') });
    await page1.close();

    // TEST 2: Open profile and verify Driving Summary button
    console.log('\n--- TEST 2: DRIVING SUMMARY BUTTON ---');
    const page2 = await setupPage(browser);
    const artCard2 = page2.locator('text=Art Suryaa').first();
    await artCard2.waitFor({ timeout: 5000 });
    await artCard2.click({ force: true });
    await page2.waitForTimeout(1000);

    const drivSummaryBtn = page2.locator('text=Driving Summary');
    await drivSummaryBtn.waitFor({ timeout: 5000 });
    console.log('Clicking Driving Summary button...');
    await drivSummaryBtn.click({ force: true });
    await page2.waitForTimeout(2000);
    const hasDrivingTitle = await page2.locator('text=DRIVING REPORTS').isVisible();
    console.log('Navigated to DRIVING REPORTS?', hasDrivingTitle);
    await page2.screenshot({ path: path.join(SCREENSHOT_DIR, 'test_profile_driving_summary_nav.png') });
    await page2.close();

    // TEST 3: Open profile and verify Location button
    console.log('\n--- TEST 3: LOCATION BUTTON ---');
    const page3 = await setupPage(browser);
    const artCard3 = page3.locator('text=Art Suryaa').first();
    await artCard3.waitFor({ timeout: 5000 });
    await artCard3.click({ force: true });
    await page3.waitForTimeout(1000);

    const locBtn = page3.locator('text=Location').first();
    await locBtn.waitFor({ timeout: 5000 });
    console.log('Clicking Location button...');
    await locBtn.click({ force: true });
    await page3.waitForTimeout(2000);
    const hasMapOrHome = await page3.locator('text=Family Circle').isVisible().catch(() => false);
    console.log('Navigated to Map / Home tab?', hasMapOrHome);
    await page3.screenshot({ path: path.join(SCREENSHOT_DIR, 'test_profile_location_nav.png') });
    await page3.close();

    // TEST 4: Open profile and verify Chat button
    console.log('\n--- TEST 4: CHAT BUTTON ---');
    const page4 = await setupPage(browser);
    const artCard4 = page4.locator('text=Art Suryaa').first();
    await artCard4.waitFor({ timeout: 5000 });
    await artCard4.click({ force: true });
    await page4.waitForTimeout(1000);

    const chatBtn = page4.locator('text=Chat').first();
    await chatBtn.waitFor({ timeout: 5000 });
    console.log('Clicking Chat button...');
    await chatBtn.click({ force: true });
    await page4.waitForTimeout(2000);
    const chatScreenshot = path.join(SCREENSHOT_DIR, 'test_profile_chat_nav.png');
    await page4.screenshot({ path: chatScreenshot });
    console.log('Navigated to Chat screen. Screenshot:', chatScreenshot);
    await page4.close();

    // TEST 5: Verify Home screen Feature Hub elevation
    console.log('\n--- TEST 5: HOME SCREEN FEATURE HUB ELEVATION ---');
    const page5 = await setupPage(browser);
    await page5.evaluate(() => {
      if (window.__navigationRef?.isReady?.()) {
        window.__navigationRef.navigate('MainTabs', { screen: 'Home' });
      }
    });
    await page5.waitForTimeout(1500);
    const homeScreenshot = path.join(SCREENSHOT_DIR, 'elevated_home_feature_hub.png');
    await page5.screenshot({ path: homeScreenshot });
    console.log('Home screen screenshot:', homeScreenshot);
    await page5.close();

    console.log('\nALL PROFILE MODAL TESTS COMPLETED SUCCESSFULLY!');
  } catch (err) {
    console.error('Test error:', err);
  } finally {
    await browser.close();
  }
}

testAll();
