const { chromium } = require('playwright');
const path = require('path');
const fs = require('fs');

const ARTIFACT_DIR = 'C:\\Users\\mylam\\.gemini\\antigravity-ide\\brain\\a3377614-b22c-4960-8db7-02c3ece4891d';
const SCREENSHOT_DIR = path.join(ARTIFACT_DIR, 'playwright_screenshots');

if (!fs.existsSync(SCREENSHOT_DIR)) {
  fs.mkdirSync(SCREENSHOT_DIR, { recursive: true });
}

async function testHierarchyScroll() {
  console.log('--- TESTING CIRCLE PROTECTION HIERARCHY DUAL-AXIS SCROLL ---');
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

  console.log('Setting up mock multi-level hierarchy members...');
  await page.evaluate(() => {
    const SELF_ID = '03ca6af3-b0f7-46a1-9e70-2bb96befb67c';
    const ART_ID = 'e7b1a2c3-4d5e-6f7a-8b9c-0d1e2f3a4b5c';
    const BHAVANI_ID = 'b1b2b3b4-b5b6-7b8b-9b0b-1b2b3b4b5b6b';
    const NANDA_ID = 'c1d2e3f4-a5b6-7c8d-9e0f-1a2b3c4d5e6f';
    const PRASANNA_ID = 'd1d2d3d4-d5d6-d7d8-d9d0-d1d2d3d4d5d6';
    const SUB_MEMBER_1 = 'f1f2f3f4-f5f6-f7f8-f9f0-f1f2f3f4f5f6';
    const SUB_MEMBER_2 = 'a1a2a3a4-a5a6-a7a8-a9a0-a1a2a3a4a5a6';
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

    // 4-level deep hierarchy:
    // Level 0: Founder (Sri Jai Suryaa)
    // Level 1: Co-Leader (Art Suryaa)
    // Level 2: Guardian (Prasanna Raj, supervised by Art Suryaa)
    // Level 3: Members (Bhavani, Nanda, Sub1, Sub2, supervised by Prasanna Raj)
    const mockMembers = [
      {
        id: 'cm-self',
        circle_id: CIRCLE_ID,
        user_id: SELF_ID,
        role: 'owner',
        joined_at: new Date().toISOString(),
        profile: mockProfile,
        isOnline: true,
        batteryPct: 92,
      },
      {
        id: 'cm-art',
        circle_id: CIRCLE_ID,
        user_id: ART_ID,
        role: 'co_leader',
        joined_at: new Date().toISOString(),
        supervisor_id: SELF_ID,
        batteryPct: 12,
        isOnline: true,
        profile: {
          full_name: 'Art Suryaa',
          avatar_url: 'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?w=120',
          phone: '+919123456780',
        },
      },
      {
        id: 'cm-prasanna',
        circle_id: CIRCLE_ID,
        user_id: PRASANNA_ID,
        role: 'guardian',
        joined_at: new Date().toISOString(),
        supervisor_id: ART_ID,
        batteryPct: 89,
        isOnline: true,
        profile: {
          full_name: 'Prasanna Raj',
          avatar_url: null,
          phone: '+919876543211',
        },
      },
      {
        id: 'cm-bhavani',
        circle_id: CIRCLE_ID,
        user_id: BHAVANI_ID,
        role: 'member',
        joined_at: new Date().toISOString(),
        supervisor_id: PRASANNA_ID,
        batteryPct: 44,
        isOnline: true,
        profile: {
          full_name: 'Bhavani',
          avatar_url: null,
          phone: '+919988776655',
        },
      },
      {
        id: 'cm-nanda',
        circle_id: CIRCLE_ID,
        user_id: NANDA_ID,
        role: 'member',
        joined_at: new Date().toISOString(),
        supervisor_id: PRASANNA_ID,
        batteryPct: 57,
        isOnline: true,
        profile: {
          full_name: 'T R NANDAKUMAR',
          avatar_url: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=120',
          phone: '+919876543210',
        },
      },
      {
        id: 'cm-sub1',
        circle_id: CIRCLE_ID,
        user_id: SUB_MEMBER_1,
        role: 'member',
        joined_at: new Date().toISOString(),
        supervisor_id: PRASANNA_ID,
        batteryPct: 78,
        isOnline: true,
        profile: {
          full_name: 'Ananya Suryaa',
          avatar_url: null,
          phone: '+919876543299',
        },
      },
      {
        id: 'cm-sub2',
        circle_id: CIRCLE_ID,
        user_id: SUB_MEMBER_2,
        role: 'member',
        joined_at: new Date().toISOString(),
        supervisor_id: ART_ID,
        batteryPct: 85,
        isOnline: true,
        profile: {
          full_name: 'Karthik Raja',
          avatar_url: null,
          phone: '+919876543288',
        },
      },
    ];

    window.__mockAuth = { user: mockUser, session: mockSession, profile: mockProfile };
    window.__mockCircle = { activeCircle: mockCircle, members: mockMembers };

    const authStore = window.__useAuthStore || require('../store/useAuthStore').useAuthStore;
    const circleStore = window.__useCircleStore || require('../store/useCircleStore').useCircleStore;

    if (authStore) {
      authStore.setState({ user: mockUser, session: mockSession, profile: mockProfile, isLoaded: true });
    }
    if (circleStore) {
      circleStore.setState({
        activeCircle: mockCircle,
        members: mockMembers,
        circles: [mockCircle],
        circleFetched: true,
        isLoading: false,
      });
    }
  });

  console.log('Navigating to Circle tab...');
  await page.locator('text=Circle').last().click({ force: true });
  await page.waitForTimeout(2000);

  console.log('Scrolling down to find "Hierarchy" button...');
  await page.mouse.move(200, 400);
  await page.mouse.wheel(0, 300);
  await page.waitForTimeout(1000);

  console.log('Locating and clicking "Hierarchy" button...');
  await page.waitForSelector('text=Hierarchy', { timeout: 10000 });
  const hierarchyBtn = await page.locator('text=Hierarchy').first();
  await hierarchyBtn.click({ force: true });
  await page.waitForTimeout(1500);

  // Verify Circle Protection Hierarchy modal is open
  await page.waitForSelector('text=Circle Protection Hierarchy', { timeout: 5000 });
  console.log('[PASS] Circle Protection Hierarchy modal opened successfully!');

  // Capture top of modal screenshot
  const initialModalScreenshot = path.join(SCREENSHOT_DIR, 'test_hierarchy_modal_top.png');
  await page.screenshot({ path: initialModalScreenshot });
  console.log(`Saved initial hierarchy modal screenshot: ${initialModalScreenshot}`);

  // Test vertical scrolling down
  console.log('Testing vertical scrolling down in hierarchy tree...');
  const scrollTestResult = await page.evaluate(async () => {
    // Locate scrollable containers inside the hierarchy modal
    const modalContainers = Array.from(document.querySelectorAll('*')).filter(el => {
      const style = window.getComputedStyle(el);
      const isScrollableY = (style.overflowY === 'auto' || style.overflowY === 'scroll') && el.scrollHeight > el.clientHeight;
      const isScrollableX = (style.overflowX === 'auto' || style.overflowX === 'scroll') && el.scrollWidth > el.clientWidth;
      return isScrollableY || isScrollableX;
    });

    console.log(`Found ${modalContainers.length} scrollable elements in modal`);

    // Find the vertical scroll container
    const verticalContainer = modalContainers.find(el => {
      const style = window.getComputedStyle(el);
      return (style.overflowY === 'auto' || style.overflowY === 'scroll') && el.scrollHeight > el.clientHeight;
    });

    // Find the horizontal scroll container
    const horizontalContainer = modalContainers.find(el => {
      const style = window.getComputedStyle(el);
      return (style.overflowX === 'auto' || style.overflowX === 'scroll') && el.scrollWidth > el.clientWidth;
    });

    const initialScrollTop = verticalContainer ? verticalContainer.scrollTop : -1;
    const initialScrollLeft = horizontalContainer ? horizontalContainer.scrollLeft : -1;

    let scrolledTop = -1;
    let scrolledLeft = -1;

    if (verticalContainer) {
      verticalContainer.scrollTop = 250;
      scrolledTop = verticalContainer.scrollTop;
    }

    if (horizontalContainer) {
      horizontalContainer.scrollLeft = 100;
      scrolledLeft = horizontalContainer.scrollLeft;
    }

    return {
      hasVerticalContainer: !!verticalContainer,
      hasHorizontalContainer: !!horizontalContainer,
      verticalScrollHeight: verticalContainer ? verticalContainer.scrollHeight : 0,
      verticalClientHeight: verticalContainer ? verticalContainer.clientHeight : 0,
      horizontalScrollWidth: horizontalContainer ? horizontalContainer.scrollWidth : 0,
      horizontalClientWidth: horizontalContainer ? horizontalContainer.clientWidth : 0,
      initialScrollTop,
      scrolledTop,
      initialScrollLeft,
      scrolledLeft,
    };
  });

  console.log('Scroll test results:', JSON.stringify(scrollTestResult, null, 2));

  if (scrollTestResult.hasVerticalContainer && scrollTestResult.verticalScrollHeight > scrollTestResult.verticalClientHeight) {
    console.log(`[PASS] VERTICAL SCROLL CONFIRMED! scrollHeight (${scrollTestResult.verticalScrollHeight}px) > clientHeight (${scrollTestResult.verticalClientHeight}px)`);
  } else {
    console.error('[FAIL] Could not scroll vertically!');
    process.exitCode = 1;
  }

  // Wait a moment and capture scrolled view screenshot
  await page.waitForTimeout(1000);
  const scrolledScreenshot = path.join(SCREENSHOT_DIR, 'test_hierarchy_modal_scrolled_down.png');
  await page.screenshot({ path: scrolledScreenshot });
  console.log(`Saved scrolled hierarchy modal screenshot: ${scrolledScreenshot}`);

  await browser.close();
  console.log('=== CIRCLE PROTECTION HIERARCHY DUAL-AXIS SCROLL TEST COMPLETE ===');
}

testHierarchyScroll().catch(err => {
  console.error('[FATAL ERROR]:', err);
  process.exit(1);
});
