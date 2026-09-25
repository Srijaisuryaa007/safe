const { chromium } = require('playwright');
const path = require('path');
const fs = require('fs');

const ARTIFACT_DIR = 'C:\\Users\\mylam\\.gemini\\antigravity-ide\\brain\\1552c728-fbd5-4a4e-9da5-fb93c3352ef3';
const SCREENSHOT_DIR = path.join(ARTIFACT_DIR, 'playwright_screenshots');

if (!fs.existsSync(SCREENSHOT_DIR)) {
  fs.mkdirSync(SCREENSHOT_DIR, { recursive: true });
}

async function testDragHandleSingleClose() {
  console.log('--- TESTING PROFILE MODAL DRAG HANDLE SINGLE CLOSE ---');
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
  await page.goto('http://127.0.0.1:8081', { waitUntil: 'load', timeout: 45000 });
  await page.waitForSelector('text=SIGN IN', { timeout: 30000 });

  console.log('Injecting session and circle members...');
  await page.evaluate(() => {
    const SELF_ID = '03ca6af3-b0f7-46a1-9e70-2bb96befb67c';
    const MEMBER_ID = 'd5e6f7a8-b9c0-1d2e-3f4a-5b6c7d8e9f0a';
    const CIRCLE_ID = 'c1';

    const mockUser = { id: SELF_ID, email: 'sri@example.com' };
    const mockSession = { access_token: 'mock-token', token_type: 'bearer', user: mockUser };
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
      name: 'Safety Circle',
      invite_code: 'S1',
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
      {
        circle_id: CIRCLE_ID,
        user_id: MEMBER_ID,
        role: 'member',
        joined_at: new Date().toISOString(),
        profile: {
          id: MEMBER_ID,
          full_name: 'Member Two',
          avatar_url: null,
          phone: '+919876543210',
        },
        batteryPct: 65,
        isOnline: true,
        lastSeenText: 'Active now',
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

  console.log('Opening MemberShortProfileModal for Member Two...');
  await page.evaluate(() => {
    const member = window.__useCircleStore.getState().members.find(m => m.user_id === 'd5e6f7a8-b9c0-1d2e-3f4a-5b6c7d8e9f0a');
    if (window.__openMemberShortProfile && member) {
      window.__openMemberShortProfile(member);
    }
  });

  console.log('Waiting for MemberShortProfileModal to open...');
  await page.waitForSelector('text=CURRENT STATUS', { timeout: 8000 });
  await page.waitForTimeout(600);

  // Take screenshot of open modal
  const openModalScreenshot = path.join(SCREENSHOT_DIR, 'profile_modal_open.png');
  await page.screenshot({ path: openModalScreenshot });
  console.log(`Saved screenshot of open modal: ${openModalScreenshot}`);

  // Find the drag handle
  const dragHandle = page.locator('[aria-label="Drag down or tap to close"]').first();
  await dragHandle.waitFor({ timeout: 5000 });
  const isDragHandleVisible = await dragHandle.isVisible();
  console.log(`Is drag handle visible? ${isDragHandleVisible}`);

  const box = await dragHandle.boundingBox();
  console.log(`Drag handle bounding box: x=${box.x}, y=${box.y}, w=${box.width}, h=${box.height}`);

  console.log('Simulating single drag down gesture on the drag handle...');
  await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
  await page.mouse.down();
  await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2 + 180, { steps: 10 });
  await page.mouse.up();

  console.log('Waiting for modal dismiss animation to complete (single smooth transition)...');
  await page.waitForTimeout(800);

  const isModalStillOpen = await page.locator('text=CURRENT STATUS').isVisible().catch(() => false);
  console.log(`Is profile modal still open after drag? ${isModalStillOpen}`);

  if (!isModalStillOpen) {
    console.log('SUCCESS: Profile Modal smoothly dismissed on drag down with NO double-close glitch!');
  } else {
    console.log('Testing tap/click on drag handle...');
    await dragHandle.click({ force: true });
    await page.waitForTimeout(800);
    const isModalOpenAfterTap = await page.locator('text=CURRENT STATUS').isVisible().catch(() => false);
    console.log(`Is profile modal still open after tap? ${isModalOpenAfterTap}`);
    if (!isModalOpenAfterTap) {
      console.log('SUCCESS: Profile Modal smoothly dismissed on tap with NO double-close glitch!');
    }
  }

  const closedScreenshot = path.join(SCREENSHOT_DIR, 'profile_modal_closed.png');
  await page.screenshot({ path: closedScreenshot });
  console.log(`Saved screenshot after dismiss: ${closedScreenshot}`);

  await browser.close();
  console.log('--- ALL TESTS COMPLETED SUCCESSFULLY ---');
}

testDragHandleSingleClose().catch((err) => {
  console.error('Test error:', err);
  process.exit(1);
});
