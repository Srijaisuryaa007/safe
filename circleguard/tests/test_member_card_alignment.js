const { chromium } = require('playwright');
const path = require('path');

const ARTIFACT_DIR = 'C:\\Users\\mylam\\.gemini\\antigravity-ide\\brain\\0532c4a0-e44f-4f50-a1d6-e0e4e4caece4';
const SCREENSHOT_DIR = path.join(ARTIFACT_DIR, 'playwright_screenshots');

async function testMemberCardAlignment() {
  console.log('--- TESTING MEMBER CARD ALIGNMENT & OVERLAP FIX ---');
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

  console.log('Setting up mock user, session and members matching user screenshot...');
  await page.evaluate(() => {
    const SELF_ID = '03ca6af3-b0f7-46a1-9e70-2bb96befb67c';
    const ART_ID = 'e7b1a2c3-4d5e-6f7a-8b9c-0d1e2f3a4b5c';
    const SURYAA_ID = 'd5e6f7a8-b9c0-1d2e-3f4a-5b6c7d8e9f0a';
    const JAI_ID = 'c1d2e3f4-a5b6-7c8d-9e0f-1a2b3c4d5e6f';
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
      name: 'Test app',
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
        batteryPct: 5,
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
        isOnline: false,
        lastSeenText: 'Offline • 12d ago',
      },
      {
        circle_id: CIRCLE_ID,
        user_id: SURYAA_ID,
        role: 'guardian',
        supervisor_id: ART_ID,
        joined_at: new Date(Date.now() - 15 * 86400000).toISOString(),
        profile: {
          id: SURYAA_ID,
          full_name: 'suryaa027',
          avatar_url: null,
          phone: '+918072986914',
        },
        batteryPct: 47,
        isOnline: false,
        lastSeenText: 'Offline • 12d ago',
      },
      {
        circle_id: CIRCLE_ID,
        user_id: JAI_ID,
        role: 'member',
        supervisor_id: SURYAA_ID,
        joined_at: new Date(Date.now() - 5 * 86400000).toISOString(),
        profile: {
          id: JAI_ID,
          full_name: 'Jai',
          avatar_url: null,
          phone: '+918072986915',
        },
        batteryPct: 48,
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
  console.log('Scrolling down to view member cards...');
  await page.mouse.move(200, 400);
  await page.mouse.wheel(0, 450);
  await page.waitForTimeout(1000);

  // Verify that Guardian text and battery text do not overlap
  console.log('Verifying bounding boxes of Guardian badges and battery items...');
  const collisionCheck = await page.evaluate(() => {
    const guardianBadges = Array.from(document.querySelectorAll('*')).filter(
      el => el.textContent && el.textContent.startsWith('Guardian:') && el.children.length === 0
    );
    const batteryTexts = Array.from(document.querySelectorAll('*')).filter(
      el => el.textContent && el.textContent.includes('%') && el.children.length === 0
    );

    const issues = [];
    for (const g of guardianBadges) {
      const gRect = g.getBoundingClientRect();
      for (const b of batteryTexts) {
        const bRect = b.getBoundingClientRect();
        // Check if on same vertical band
        const vOverlap = Math.max(0, Math.min(gRect.bottom, bRect.bottom) - Math.max(gRect.top, bRect.top));
        const hOverlap = Math.max(0, Math.min(gRect.right, bRect.right) - Math.max(gRect.left, bRect.left));
        if (vOverlap > 5 && hOverlap > 5) {
          issues.push({
            guardian: g.textContent,
            battery: b.textContent,
            vOverlap,
            hOverlap,
          });
        }
      }
    }
    return { issuesCount: issues.length, issues };
  });

  console.log('Collision check results:', collisionCheck);

  if (collisionCheck.issuesCount > 0) {
    console.error('COLLISION DETECTED!', collisionCheck.issues);
  } else {
    console.log('[SUCCESS] ZERO OVERLAPS: Guardian pills and battery telemetry are cleanly separated!');
  }

  const screenshotPath = path.join(SCREENSHOT_DIR, 'test_member_card_alignment_fixed.png');
  await page.screenshot({ path: screenshotPath });
  console.log(`Saved screenshot: ${screenshotPath}`);

  await browser.close();
}

testMemberCardAlignment().catch((err) => {
  console.error('Test error:', err);
  process.exit(1);
});
