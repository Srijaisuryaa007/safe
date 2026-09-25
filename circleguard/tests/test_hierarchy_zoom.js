const { chromium } = require('playwright');
const path = require('path');
const fs = require('fs');

const ARTIFACT_DIR = 'C:\\Users\\mylam\\.gemini\\antigravity-ide\\brain\\a3377614-b22c-4960-8db7-02c3ece4891d';
const SCREENSHOT_DIR = path.join(ARTIFACT_DIR, 'playwright_screenshots');

if (!fs.existsSync(SCREENSHOT_DIR)) {
  fs.mkdirSync(SCREENSHOT_DIR, { recursive: true });
}

async function testHierarchyZoom() {
  console.log('--- TESTING CIRCLE PROTECTION HIERARCHY ZOOM IN / ZOOM OUT ---');
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

  console.log('Injecting multi-tier mock members...');
  await page.evaluate(() => {
    const SELF_ID = '03ca6af3-b0f7-46a1-9e70-2bb96befb67c';
    const ART_ID = 'e7b1a2c3-4d5e-6f7a-8b9c-0d1e2f3a4b5c';
    const BHAVANI_ID = 'b1b2b3b4-b5b6-7b8b-9b0b-1b2b3b4b5b6b';
    const NANDA_ID = 'c1d2e3f4-a5b6-7c8d-9e0f-1a2b3c4d5e6f';
    const PRASANNA_ID = 'd1d2d3d4-d5d6-d7d8-d9d0-d1d2d3d4d5d6';
    const CIRCLE_ID = 'af00325e-7e26-4b5d-856d-907085b326d2';

    const mockUser = { id: SELF_ID, email: 'sri@example.com' };
    const mockSession = { access_token: 't', token_type: 'bearer', user: mockUser };
    const mockProfile = { id: SELF_ID, full_name: 'Sri Jai Suryaa', phone: '+918072986912', is_ghost_mode: false, is_premium: true };
    const mockCircle = { id: CIRCLE_ID, name: 'Test app', invite_code: 'HK3GJB', tracking_mode: 'continuous', owner_id: SELF_ID };

    const mockMembers = [
      { id: '1', circle_id: CIRCLE_ID, user_id: SELF_ID, role: 'owner', profile: mockProfile, isOnline: true },
      { id: '2', circle_id: CIRCLE_ID, user_id: ART_ID, role: 'co_leader', supervisor_id: SELF_ID, profile: { full_name: 'Art Suryaa' } },
      { id: '3', circle_id: CIRCLE_ID, user_id: PRASANNA_ID, role: 'guardian', supervisor_id: ART_ID, profile: { full_name: 'Prasanna Raj' } },
      { id: '4', circle_id: CIRCLE_ID, user_id: BHAVANI_ID, role: 'member', supervisor_id: PRASANNA_ID, profile: { full_name: 'Bhavani' } },
      { id: '5', circle_id: CIRCLE_ID, user_id: NANDA_ID, role: 'member', supervisor_id: PRASANNA_ID, profile: { full_name: 'T R NANDAKUMAR' } },
    ];

    window.__mockAuth = { user: mockUser, session: mockSession, profile: mockProfile };
    window.__mockCircle = { activeCircle: mockCircle, members: mockMembers };

    if (window.__useAuthStore) window.__useAuthStore.setState({ user: mockUser, session: mockSession, profile: mockProfile, isLoaded: true });
    if (window.__useCircleStore) window.__useCircleStore.setState({ activeCircle: mockCircle, members: mockMembers, circles: [mockCircle], circleFetched: true, isLoading: false });
  });

  console.log('Navigating to Circle tab...');
  await page.locator('text=Circle').last().click({ force: true });
  await page.waitForTimeout(1500);

  console.log('Scrolling down to find "Hierarchy" button...');
  await page.mouse.move(200, 400);
  await page.mouse.wheel(0, 300);
  await page.waitForTimeout(800);

  console.log('Opening Hierarchy modal...');
  await page.waitForSelector('text=Hierarchy', { timeout: 10000 });
  await page.locator('text=Hierarchy').first().click({ force: true });
  await page.waitForTimeout(1200);

  // 1. Verify Floating Zoom Controls Dock is present
  console.log('Verifying Zoom Controls Dock...');
  await page.waitForSelector('[aria-label="Zoom Out"]', { timeout: 5000 });
  await page.waitForSelector('[aria-label="Zoom In"]', { timeout: 5000 });
  await page.waitForSelector('text=100%', { timeout: 5000 });
  console.log('[PASS] Zoom Controls Dock is visible with 100% default scale!');

  // Capture standard 100% screenshot
  const standardScreenshot = path.join(SCREENSHOT_DIR, 'test_hierarchy_zoom_100.png');
  await page.screenshot({ path: standardScreenshot });
  console.log(`Saved 100% screenshot: ${standardScreenshot}`);

  // 2. Test Zoom Out
  console.log('Clicking Zoom Out twice (target ~70%)...');
  const zoomOutBtn = page.locator('[aria-label="Zoom Out"]');
  await zoomOutBtn.click();
  await page.waitForTimeout(400);
  await zoomOutBtn.click();
  await page.waitForTimeout(600);

  // Check new zoom percentage text
  const zoomedOutText = await page.locator('[aria-label="Reset Zoom"]').textContent();
  console.log(`Current Zoom Scale after Zoom Out: ${zoomedOutText}`);

  // Capture zoomed out screenshot
  const zoomOutScreenshot = path.join(SCREENSHOT_DIR, 'test_hierarchy_zoom_out.png');
  await page.screenshot({ path: zoomOutScreenshot });
  console.log(`Saved Zoom Out screenshot: ${zoomOutScreenshot}`);

  // 3. Test Zoom In
  console.log('Clicking Zoom In 4 times (target ~130%)...');
  const zoomInBtn = page.locator('[aria-label="Zoom In"]');
  await zoomInBtn.click();
  await page.waitForTimeout(300);
  await zoomInBtn.click();
  await page.waitForTimeout(300);
  await zoomInBtn.click();
  await page.waitForTimeout(300);
  await zoomInBtn.click();
  await page.waitForTimeout(600);

  const zoomedInText = await page.locator('[aria-label="Reset Zoom"]').textContent();
  console.log(`Current Zoom Scale after Zoom In: ${zoomedInText}`);

  // Capture zoomed in screenshot
  const zoomInScreenshot = path.join(SCREENSHOT_DIR, 'test_hierarchy_zoom_in.png');
  await page.screenshot({ path: zoomInScreenshot });
  console.log(`Saved Zoom In screenshot: ${zoomInScreenshot}`);

  // 4. Test Reset Zoom
  console.log('Clicking percentage chip to Reset Zoom to 100%...');
  await page.locator('[aria-label="Reset Zoom"]').click();
  await page.waitForTimeout(500);

  const resetText = await page.locator('[aria-label="Reset Zoom"]').textContent();
  console.log(`Current Zoom Scale after Reset: ${resetText}`);

  if (resetText.trim() === '100%') {
    console.log('[PASS] Zoom reset to 100% confirmed!');
  } else {
    console.error(`[FAIL] Expected 100% after reset, got ${resetText}`);
    process.exitCode = 1;
  }

  await browser.close();
  console.log('=== HIERARCHY ZOOM TEST COMPLETED SUCCESSFULLY ===');
}

testHierarchyZoom().catch(err => {
  console.error('[FATAL ERROR]:', err);
  process.exit(1);
});
