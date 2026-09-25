const { chromium } = require('playwright');
const path = require('path');
const fs = require('fs');

const ARTIFACT_DIR = 'C:\\Users\\mylam\\.gemini\\antigravity-ide\\brain\\fe9a29ba-aab3-4576-ac75-7f9d612d3a79';

async function testMultimodalTransitVisual() {
  console.log('--- TESTING MULTI-MODAL METRO & RAILWAY TRANSIT VISUAL RECONSTRUCTION ---');
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
  await page.goto('http://127.0.0.1:8081', { waitUntil: 'commit', timeout: 45000 });
  
  try {
    await page.waitForSelector('text=SIGN IN', { timeout: 30000 });
  } catch (e) {
    console.log('Sign in selector skipped or already on dashboard');
  }

  console.log('Seeding mock stores and today metro transit corridor gap...');
  await page.evaluate(() => {
    const SELF_ID = '03ca6af3-b0f7-46a1-9e70-2bb96befb67c';
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
        joined_at: new Date().toISOString(),
        profile: mockProfile,
        batteryPct: 92,
        isOnline: true,
      },
    ];

    // Today's underground metro trip with 4.1km dead zone gap between stations
    const now = Date.now();
    const todayMetroBreadcrumbs = [
      {
        latitude: 13.0825,
        longitude: 80.2755,
        recorded_at: new Date(now - 400000).toISOString(),
        speed_mps: 1.2,
      },
      {
        latitude: 13.0820,
        longitude: 80.2750,
        recorded_at: new Date(now - 340000).toISOString(),
        speed_mps: 8.5,
      },
      // Underground subway tunnel (4.1km gap, signal dropped)
      {
        latitude: 13.0600,
        longitude: 80.2450,
        recorded_at: new Date(now - 40000).toISOString(),
        speed_mps: 7.2,
      },
      {
        latitude: 13.0590,
        longitude: 80.2440,
        recorded_at: new Date(now - 5000).toISOString(),
        speed_mps: 1.1,
      }
    ];

    window.localStorage.setItem(`@circleguard_offline_breadcrumbs_${SELF_ID}`, JSON.stringify(todayMetroBreadcrumbs));

    window.__useAuthStore.getState().setSession(mockSession);
    window.__useAuthStore.getState().setProfile(mockProfile);
    window.__useAuthStore.getState().setProfileFetching(false);
    window.__useAuthStore.getState().setLoading(false);

    window.__useCircleStore.getState().setActiveCircle(mockCircle);
    window.__useCircleStore.getState().setMembers(mockMembers);
  });

  await page.waitForSelector('text=MAP', { timeout: 10000 });
  console.log('App ready. Navigating directly to LocationHistoryScreen...');

  await page.evaluate(() => {
    if (window.__navigationRef && window.__navigationRef.navigate) {
      window.__navigationRef.navigate('LocationHistory');
    }
  });

  await page.waitForSelector('text=LOCATION HISTORY', { timeout: 10000 });
  console.log('LocationHistoryScreen loaded! Waiting for loading spinner to detach...');
  
  try {
    await page.waitForSelector('text=RETRIEVING LOCATION HISTORY', { state: 'detached', timeout: 25000 });
    console.log('Location history finished loading and reconstructing!');
  } catch (e) {
    console.log('Timed out waiting for spinner detach, proceeding with screenshot...');
  }
  await page.waitForTimeout(1500);

  // Take screenshot 1: Top overview with Map and Multi-Modal Transit Banner
  const shotMap = path.join(ARTIFACT_DIR, 'verify_multimodal_metro_map.png');
  await page.screenshot({ path: shotMap });
  console.log(`[PASS] Saved visual verification screenshot: ${shotMap}`);

  // Scroll down to timeline
  await page.evaluate(() => {
    const scrollables = Array.from(document.querySelectorAll('*')).filter(
      el => el.scrollHeight > el.clientHeight && getComputedStyle(el).overflowY !== 'hidden'
    );
    scrollables.forEach(el => {
      el.scrollTop = 500;
    });
  });
  await page.waitForTimeout(1500);

  const shotTimeline = path.join(ARTIFACT_DIR, 'verify_multimodal_metro_timeline.png');
  await page.screenshot({ path: shotTimeline });
  console.log(`[PASS] Saved timeline screenshot: ${shotTimeline}`);

  await browser.close();
  console.log('=== MULTI-MODAL VISUAL TEST COMPLETED SUCCESSFULLY ===');
}

testMultimodalTransitVisual().catch(err => {
  console.error('Test failed with error:', err);
  process.exit(1);
});
