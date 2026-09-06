const { chromium } = require('playwright');
const path = require('path');
const fs = require('fs');

const ARTIFACT_DIR = 'C:\\Users\\mylam\\.gemini\\antigravity-ide\\brain\\0532c4a0-e44f-4f50-a1d6-e0e4e4caece4';
const SCREENSHOT_DIR = path.join(ARTIFACT_DIR, 'playwright_screenshots');

if (!fs.existsSync(SCREENSHOT_DIR)) {
  fs.mkdirSync(SCREENSHOT_DIR, { recursive: true });
}

async function runFullAudit() {
  console.log('=== STARTING PLAYWRIGHT FULL SYSTEM AUDIT ===');
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

  const consoleErrors = [];
  const consoleWarns = [];
  const pageErrors = [];
  const failedRequests = [];

  page.on('console', msg => {
    const type = msg.type();
    const text = msg.text();
    if (type === 'error') {
      console.log(`[CONSOLE ERROR]: ${text}`);
      consoleErrors.push(text);
    } else if (type === 'warning') {
      consoleWarns.push(text);
    }
  });

  page.on('pageerror', err => {
    console.log(`[PAGE ERROR]: ${err.message}`);
    pageErrors.push({ message: err.message, stack: err.stack });
  });

  page.on('requestfailed', req => {
    // ignore google generate_204 as we already identified it
    failedRequests.push({ url: req.url(), method: req.method(), error: req.failure()?.errorText });
  });

  // Mock Supabase REST endpoints when auth is tested
  await page.route('**/auth/v1/token?grant_type=password', async route => {
    console.log('[MOCK AUTH] Intercepted signInWithPassword');
    const json = {
      access_token: 'mock-access-token-12345',
      token_type: 'bearer',
      expires_in: 3600,
      refresh_token: 'mock-refresh-token-12345',
      user: {
        id: 'user-vip-001',
        aud: 'authenticated',
        role: 'authenticated',
        email: 'safety-lead@circleguard.com',
        phone: '+91 9876543210',
        user_metadata: { full_name: 'Jaisuryaa Luxury Leader' },
        created_at: new Date().toISOString(),
      }
    };
    await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(json) });
  });

  await page.route('**/rest/v1/profiles*', async route => {
    console.log('[MOCK REST] Intercepted profiles query');
    const profile = {
      id: 'user-vip-001',
      full_name: 'Jaisuryaa Luxury Leader',
      phone: '+91 9876543210',
      avatar_url: null,
      is_ghost_mode: false,
      hide_online_presence: false,
      is_premium: true,
      created_at: new Date().toISOString()
    };
    // Return single or array based on headers
    const accept = route.request().headers()['accept'] || '';
    if (accept.includes('application/vnd.pgrst.object+json')) {
      await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(profile) });
    } else {
      await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify([profile]) });
    }
  });

  await page.route('**/rest/v1/circle_members*', async route => {
    console.log('[MOCK REST] Intercepted circle_members query');
    const members = [
      {
        id: 'cm-1',
        circle_id: 'circle-101',
        user_id: 'user-vip-001',
        role: 'leader',
        joined_at: new Date().toISOString(),
        circles: {
          id: 'circle-101',
          name: 'Executive Family Circle',
          invite_code: 'CG-8829',
          leader_id: 'user-vip-001',
          created_at: new Date().toISOString()
        }
      }
    ];
    await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(members) });
  });

  await page.route('**/rest/v1/places*', async route => {
    console.log('[MOCK REST] Intercepted places query');
    const places = [
      {
        id: 'place-1',
        circle_id: 'circle-101',
        name: 'Grand Estate Villa',
        latitude: 12.9716,
        longitude: 77.5946,
        radius_meters: 150,
        place_type: 'home',
        created_at: new Date().toISOString()
      }
    ];
    await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(places) });
  });

  await page.route('**/rest/v1/sos_alerts*', async route => {
    await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify([]) });
  });

  await page.route('**/rest/v1/circle_messages*', async route => {
    await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify([]) });
  });

  console.log('1. Loading application at http://localhost:8081...');
  await page.goto('http://localhost:8081', { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(4000);

  // Take screenshot: Login screen
  await page.screenshot({ path: path.join(SCREENSHOT_DIR, 'audit_01_login.png') });
  console.log('Saved audit_01_login.png');

  // Test Sign In with Mocked Supabase Auth
  console.log('2. Entering valid credentials to test authentication & main tabs...');
  const inputs = page.locator('input');
  if (await inputs.count() >= 2) {
    await inputs.nth(0).fill('safety-lead@circleguard.com');
    await inputs.nth(1).fill('CorrectPassword123!');
    await page.waitForTimeout(500);

    const signInBtn = page.locator('text="SIGN IN"').first();
    await signInBtn.click();
    console.log('Clicked SIGN IN button, waiting for auth transition to MainTabs...');
    await page.waitForTimeout(4000);

    // Take screenshot after login
    await page.screenshot({ path: path.join(SCREENSHOT_DIR, 'audit_02_authenticated_view.png') });
    console.log('Saved audit_02_authenticated_view.png');

    const curText = await page.evaluate(() => document.body.innerText.substring(0, 400));
    console.log('Visible text after login:');
    console.log(curText);

    // Let's check available tabs
    const tabs = page.locator('div[role="tab"], [role="button"]:has-text("Map"), [role="button"]:has-text("Home"), [role="button"]:has-text("Activity"), [role="button"]:has-text("Places"), [role="button"]:has-text("Profile")');
    const tabCount = await tabs.count();
    console.log(`Found ${tabCount} tabs/nav items`);

    // Click through each main tab
    const tabNames = ['Home', 'Map', 'Places', 'Activity', 'Profile'];
    for (const name of tabNames) {
      const tab = page.locator(`div[role="tab"]:has-text("${name}"), [role="button"]:has-text("${name}")`).first();
      if (await tab.count() > 0) {
        console.log(`Navigating to tab: ${name}...`);
        try {
          await tab.click({ timeout: 4000 });
          await page.waitForTimeout(2000);
          await page.screenshot({ path: path.join(SCREENSHOT_DIR, `audit_03_tab_${name.toLowerCase()}.png`) });
          console.log(`Saved audit_03_tab_${name.toLowerCase()}.png`);
        } catch (e) {
          console.log(`Error clicking tab ${name}:`, e.message);
        }
      }
    }
  }

  // Record summary report
  const report = {
    timestamp: new Date().toISOString(),
    totalConsoleErrors: consoleErrors.length,
    consoleErrors: Array.from(new Set(consoleErrors)),
    totalConsoleWarns: consoleWarns.length,
    consoleWarns: Array.from(new Set(consoleWarns)),
    totalPageErrors: pageErrors.length,
    pageErrors,
    failedRequests: failedRequests.slice(0, 20)
  };

  fs.writeFileSync(path.join(ARTIFACT_DIR, 'playwright_full_audit_report.json'), JSON.stringify(report, null, 2));
  console.log('Report saved to playwright_full_audit_report.json');

  await browser.close();
  console.log('=== PLAYWRIGHT FULL SYSTEM AUDIT COMPLETE ===');
}

runFullAudit().catch(err => {
  console.error('Audit failed:', err);
  process.exit(1);
});
