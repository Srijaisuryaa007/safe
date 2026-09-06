const { chromium } = require('playwright');
const path = require('path');
const fs = require('fs');

const ARTIFACT_DIR = 'C:\\Users\\mylam\\.gemini\\antigravity-ide\\brain\\0532c4a0-e44f-4f50-a1d6-e0e4e4caece4';
const SCREENSHOT_DIR = path.join(ARTIFACT_DIR, 'playwright_screenshots');

if (!fs.existsSync(SCREENSHOT_DIR)) {
  fs.mkdirSync(SCREENSHOT_DIR, { recursive: true });
}

async function testTabAnimations() {
  console.log('--- STARTING FOOTER TAB ANIMATION TEST ---');
  const browser = await chromium.launch({
    channel: 'chrome',
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox']
  });

  const context = await browser.newContext({
    viewport: { width: 390, height: 844 }, // Mobile iPhone frame
    deviceScaleFactor: 2,
    hasTouch: true,
  });

  const page = await context.newPage();

  const consoleErrors = [];
  page.on('console', msg => {
    if (msg.type() === 'error') {
      console.log(`[BROWSER ERROR]: ${msg.text()}`);
      consoleErrors.push(msg.text());
    }
  });

  page.on('pageerror', err => {
    console.log(`[PAGE ERROR]: ${err.message}`);
    consoleErrors.push(err.message);
  });

  console.log('Navigating to http://127.0.0.1:8081...');
  await page.goto('http://127.0.0.1:8081', { waitUntil: 'commit', timeout: 30000 });

  console.log('Waiting for login screen...');
  await page.waitForSelector('text=SIGN IN', { timeout: 15000 });

  console.log('Setting authenticated session in store...');
  await page.evaluate(() => {
    const mockUser = {
      id: 'test-user-id-12345',
      email: 'testexplorer@example.com',
      user_metadata: { full_name: 'Test Explorer' },
    };
    const mockSession = {
      access_token: 'mock-token',
      token_type: 'bearer',
      user: mockUser,
    };
    const mockProfile = {
      id: 'test-user-id-12345',
      full_name: 'Test Explorer',
      phone: '+1 555-0199',
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
  });

  console.log('Waiting for MainTabs footer to mount...');
  await page.waitForSelector('text=Map', { timeout: 10000 });
  await page.waitForTimeout(600);

  // Take screenshot 1: Initial view (Home active)
  await page.screenshot({ path: path.join(SCREENSHOT_DIR, 'tab_01_home_active.png') });
  console.log('Saved tab_01_home_active.png');

  // Test clicking through tabs
  const tabs = ['Map', 'Circle', 'Profile', 'Home'];
  for (let i = 0; i < tabs.length; i++) {
    const tabName = tabs[i];
    console.log(`Clicking tab "${tabName}"...`);
    
    // Find the tab item in the tab bar
    const tabButton = page.locator(`[role="tab"]:has-text("${tabName}"), div[role="button"]:has-text("${tabName}")`).last();
    if (await tabButton.count() > 0) {
      await tabButton.click();
      await page.waitForTimeout(500); // Wait for spring animation to settle
      const filename = `tab_${String(i + 2).padStart(2, '0')}_${tabName.toLowerCase()}_active.png`;
      await page.screenshot({ path: path.join(SCREENSHOT_DIR, filename) });
      console.log(`Saved ${filename}`);
    } else {
      console.log(`Tab button for ${tabName} not found!`);
    }
  }

  await browser.close();
  console.log('--- TEST COMPLETED ---');
  console.log(`Total console errors: ${consoleErrors.length}`);
}

testTabAnimations().catch(err => {
  console.error('Test error:', err);
  process.exit(1);
});
