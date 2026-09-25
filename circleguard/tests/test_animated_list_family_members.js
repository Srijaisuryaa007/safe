const { chromium } = require('playwright');
const path = require('path');
const fs = require('fs');

const ARTIFACT_DIR = 'C:\\Users\\mylam\\.gemini\\antigravity-ide\\brain\\a3377614-b22c-4960-8db7-02c3ece4891d';
const SCREENSHOT_DIR = path.join(ARTIFACT_DIR, 'playwright_screenshots');

if (!fs.existsSync(SCREENSHOT_DIR)) {
  fs.mkdirSync(SCREENSHOT_DIR, { recursive: true });
}

async function testAnimatedListFamilyMembers() {
  console.log('--- TESTING REACT BITS ANIMATEDLIST IN FAMILY MEMBERS SECTION ---');
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

  console.log('Setting up mock user and 5 members to test AnimatedList...');
  await page.evaluate(() => {
    const SELF_ID = '03ca6af3-b0f7-46a1-9e70-2bb96befb67c';
    const ART_ID = 'e7b1a2c3-4d5e-6f7a-8b9c-0d1e2f3a4b5c';
    const SURYAA_ID = 'd5e6f7a8-b9c0-1d2e-3f4a-5b6c7d8e9f0a';
    const JAI_ID = 'c1d2e3f4-a5b6-7c8d-9e0f-1a2b3c4d5e6f';
    const GUEST_ID = 'f8a1b2c3-4d5e-6f7a-8b9c-0d1e2f3a4b5d';
    const CIRCLE_ID = 'af00325e-7e26-4b5d-856d-907085b326d2';

    const mockUser = {
      id: SELF_ID,
      email: 'sri@example.com',
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

    const mockCircle = {
      id: CIRCLE_ID,
      name: 'Family Circle',
      invite_code: 'HK3GJB',
      tracking_mode: 'continuous',
      owner_id: SELF_ID,
      created_at: new Date().toISOString(),
    };

    const mockMembers = [
      {
        circle_id: CIRCLE_ID,
        user_id: SELF_ID,
        role: 'owner',
        joined_at: new Date(Date.now() - 30 * 86400000).toISOString(),
        profile: {
          id: SELF_ID,
          full_name: 'Sri Jai Suryaa',
          avatar_url: null,
          phone: '+918072986912',
        },
        batteryPct: 88,
        isOnline: true,
      },
      {
        circle_id: CIRCLE_ID,
        user_id: ART_ID,
        role: 'co_leader',
        joined_at: new Date(Date.now() - 20 * 86400000).toISOString(),
        profile: {
          id: ART_ID,
          full_name: 'Art Suryaa',
          avatar_url: null,
          phone: '+918072986913',
        },
        batteryPct: 47,
        isOnline: true,
        lastSeenText: 'Active now',
      },
      {
        circle_id: CIRCLE_ID,
        user_id: SURYAA_ID,
        role: 'guardian',
        supervisor_id: ART_ID,
        joined_at: new Date(Date.now() - 15 * 86400000).toISOString(),
        profile: {
          id: SURYAA_ID,
          full_name: 'Bhavani Suryaa',
          avatar_url: null,
          phone: '+918072986914',
        },
        batteryPct: 79,
        isDriving: true,
        isOnline: true,
        lastSeenText: 'Driving • 35 mph',
      },
      {
        circle_id: CIRCLE_ID,
        user_id: JAI_ID,
        role: 'member',
        supervisor_id: SURYAA_ID,
        joined_at: new Date(Date.now() - 5 * 86400000).toISOString(),
        profile: {
          id: JAI_ID,
          full_name: 'Jai Nandakumar',
          avatar_url: null,
          phone: '+918072986915',
        },
        batteryPct: 18,
        isOnline: true,
        lastSeenText: 'At School',
      },
      {
        circle_id: CIRCLE_ID,
        user_id: GUEST_ID,
        role: 'member',
        supervisor_id: SELF_ID,
        joined_at: new Date(Date.now() - 2 * 86400000).toISOString(),
        profile: {
          id: GUEST_ID,
          full_name: 'Grandma Suryaa',
          avatar_url: null,
          phone: '+918072986916',
        },
        batteryPct: 65,
        isOnline: false,
        lastSeenText: 'Offline • 2h ago',
      },
    ];

    window.__useAuthStore.getState().setSession(mockSession);
    window.__useAuthStore.getState().setProfile(mockProfile);
    window.__useAuthStore.getState().setProfileFetching(false);
    window.__useAuthStore.getState().setLoading(false);

    window.__useCircleStore.getState().setActiveCircle(mockCircle);
    window.__useCircleStore.getState().setMembers(mockMembers);
  });

  await page.waitForSelector('text=MAP', { timeout: 10000 });
  console.log('Main Tabs loaded. Navigating to Circle tab...');

  await page.locator('text=Circle').last().click({ force: true });
  await page.waitForTimeout(2000);

  // Switch to LIST view if available
  const listToggle = page.locator('text=LIST').first();
  if (await listToggle.isVisible()) {
    console.log('Switching to LIST view...');
    await listToggle.click({ force: true });
    await page.waitForTimeout(800);
  }

  // Scroll down so member cards are cleanly visible
  console.log('Scrolling down to view Family Members section...');
  await page.mouse.move(200, 400);
  await page.mouse.wheel(0, 420);
  await page.waitForTimeout(1000);

  // Check if AnimatedList container is present
  const animatedListContainer = page.locator('.scroll-list-container');
  const isListContainerVisible = await animatedListContainer.isVisible();
  console.log('Is AnimatedList container visible:', isListContainerVisible);

  const scrollList = page.locator('.scroll-list');
  const isScrollListVisible = await scrollList.isVisible();
  console.log('Is ScrollList visible:', isScrollListVisible);

  // Take screenshot of Circle tab with AnimatedList
  const shot1 = path.join(SCREENSHOT_DIR, 'test_family_members_animated_list.png');
  await page.screenshot({ path: shot1 });
  console.log('Saved screenshot to:', shot1);

  // Scroll the animated list to see gradient behavior
  if (isScrollListVisible) {
    console.log('Scrolling within AnimatedList to trigger top & bottom gradient overlays...');
    await scrollList.evaluate(el => el.scrollTo({ top: 140, behavior: 'smooth' }));
    await page.waitForTimeout(800);
    const shot2 = path.join(SCREENSHOT_DIR, 'test_family_members_animated_list_scrolled.png');
    await page.screenshot({ path: shot2 });
    console.log('Saved scrolled screenshot to:', shot2);
  }

  await browser.close();
  console.log('Test completed successfully!');
}

testAnimatedListFamilyMembers().catch(err => {
  console.error('Test failed with error:', err);
  process.exit(1);
});
