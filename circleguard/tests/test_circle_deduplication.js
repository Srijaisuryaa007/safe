const { chromium } = require('playwright');
const path = require('path');
const fs = require('fs');

const ARTIFACT_DIR = 'C:\\Users\\mylam\\.gemini\\antigravity-ide\\brain\\0532c4a0-e44f-4f50-a1d6-e0e4e4caece4';
const SCREENSHOT_DIR = path.join(ARTIFACT_DIR, 'playwright_screenshots');

async function testCircleDeduplication() {
  console.log('--- TESTING CIRCLE MEMBER DEDUPLICATION & DASHBOARD FIXES ---');
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
    const DUP_ID = '2875720f-904b-4559-a436-512286054510';
    const ART_ID = '701b6a69-f70c-4663-81c1-87c8c4d216a3';
    const SURYAA_ID = 'edb8e3d4-c139-4d8b-9c5b-85ebc4c4cf98';
    const JAI_ID = '310eab72-af82-4418-a265-2d18f8c59ae0';
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

    // Feed raw members including the duplicate Sri Jai Suryaa (+91 8072986912)
    if (window.__useCircleStore) {
      window.__useCircleStore.getState().setActiveCircle(mockCircle);
      window.__useCircleStore.getState().setMembers([
        {
          circle_id: CIRCLE_ID,
          user_id: SELF_ID,
          role: 'owner',
          isOnline: true,
          profile: {
            id: SELF_ID,
            full_name: 'Sri Jai Suryaa',
            phone: '+918072986912',
          }
        },
        {
          circle_id: CIRCLE_ID,
          user_id: DUP_ID,
          role: 'co_leader',
          isOnline: false,
          lastSeenText: 'Offline • 12d ago',
          batteryPct: 47,
          profile: {
            id: DUP_ID,
            full_name: 'Sri Jai Suryaa',
            phone: '+91 8072986912',
          }
        },
        {
          circle_id: CIRCLE_ID,
          user_id: ART_ID,
          role: 'co_leader',
          isOnline: false,
          lastSeenText: 'Offline • 12d ago',
          batteryPct: 47,
          profile: {
            id: ART_ID,
            full_name: 'Art Suryaa',
            phone: '+91 6138994668',
          }
        },
        {
          circle_id: CIRCLE_ID,
          user_id: SURYAA_ID,
          role: 'guardian',
          supervisor_id: ART_ID,
          isOnline: false,
          lastSeenText: 'Offline • 12d ago',
          batteryPct: 47,
          profile: {
            id: SURYAA_ID,
            full_name: 'suryaa027',
            phone: '+91 64376643764667',
          }
        },
        {
          circle_id: CIRCLE_ID,
          user_id: JAI_ID,
          role: 'member',
          supervisor_id: SURYAA_ID,
          isOnline: false,
          lastSeenText: 'Offline • 1h ago',
          batteryPct: 48,
          profile: {
            id: JAI_ID,
            full_name: 'Jai',
            phone: '+91 5434649955',
          }
        }
      ]);
    }
  });

  await page.waitForTimeout(1000);

  // Switch to Circle tab
  console.log('Navigating to Circle tab...');
  await page.locator('text=Circle').last().click({ force: true });
  await page.waitForTimeout(2000);

  // Check LIST view
  const listToggle = page.locator('text=LIST').first();
  if (await listToggle.isVisible()) {
    console.log('Switching to LIST view...');
    await listToggle.click({ force: true });
    await page.waitForTimeout(800);
  }

  console.log('Scrolling down to view all member cards...');
  await page.mouse.move(200, 400);
  await page.mouse.wheel(0, 500);
  await page.waitForTimeout(1000);

  const screenshotPath2 = path.join(SCREENSHOT_DIR, 'test_circle_scrolled_cards.png');
  await page.screenshot({ path: screenshotPath2 });
  console.log(`Saved scrolled screenshot: ${screenshotPath2}`);

  // Count occurrences of Sri Jai Suryaa
  const sriOccurrences = await page.locator('text=Sri Jai Suryaa').count();
  console.log(`Occurrences of Sri Jai Suryaa on screen: ${sriOccurrences}`);

  // Check member count text
  const membersText = await page.locator('text=/MEMBERS \\(\\d+\\)/').first().textContent();
  console.log(`Members section header: ${membersText}`);

  await browser.close();
  console.log('--- TEST FINISHED ---');
}

testCircleDeduplication().catch(console.error);
