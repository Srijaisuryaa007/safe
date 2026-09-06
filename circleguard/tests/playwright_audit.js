const { chromium } = require('playwright');
const path = require('path');
const fs = require('fs');

const ARTIFACT_DIR = 'C:\\Users\\mylam\\.gemini\\antigravity-ide\\brain\\0532c4a0-e44f-4f50-a1d6-e0e4e4caece4';
const SCREENSHOT_DIR = path.join(ARTIFACT_DIR, 'playwright_screenshots');

if (!fs.existsSync(SCREENSHOT_DIR)) {
  fs.mkdirSync(SCREENSHOT_DIR, { recursive: true });
}

async function runAudit() {
  console.log('--- STARTING PLAYWRIGHT AUDIT ---');
  const browser = await chromium.launch({
    channel: 'chrome',
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox']
  });

  const context = await browser.newContext({
    viewport: { width: 390, height: 844 }, // Mobile iPhone frame
    userAgent: 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Mobile/15E148',
    deviceScaleFactor: 2,
    hasTouch: true,
  });

  const page = await context.newPage();

  const consoleMessages = [];
  const pageErrors = [];
  const failedRequests = [];

  page.on('console', msg => {
    const type = msg.type();
    const text = msg.text();
    consoleMessages.push({ type, text });
    if (type === 'error') {
      console.log(`[BROWSER CONSOLE ERROR]: ${text}`);
    } else if (type === 'warning') {
      console.log(`[BROWSER CONSOLE WARN]: ${text}`);
    }
  });

  page.on('pageerror', err => {
    console.log(`[BROWSER UNCAUGHT ERROR]: ${err.message}\n${err.stack}`);
    pageErrors.push({ message: err.message, stack: err.stack });
  });

  page.on('requestfailed', req => {
    console.log(`[NETWORK REQUEST FAILED]: ${req.method()} ${req.url()} - ${req.failure()?.errorText}`);
    failedRequests.push({ url: req.url(), method: req.method(), error: req.failure()?.errorText });
  });

  console.log('Navigating to http://localhost:8081...');
  await page.goto('http://localhost:8081', { waitUntil: 'domcontentloaded', timeout: 30000 });

  console.log('Waiting 3s for initial splash or bundle hydration...');
  await page.waitForTimeout(3000);

  // Take screenshot 1: Initial Screen (Splash / App load)
  await page.screenshot({ path: path.join(SCREENSHOT_DIR, '01_initial_splash.png') });
  console.log('Captured 01_initial_splash.png');

  // Wait for splash screen to finish (it auto-dismisses or has a button)
  console.log('Waiting up to 5s for splash to transition to Login...');
  await page.waitForTimeout(4000);

  // Take screenshot 2: After Splash transition (Login or Main)
  await page.screenshot({ path: path.join(SCREENSHOT_DIR, '02_after_splash.png') });
  console.log('Captured 02_after_splash.png');

  // Inspect page content
  const pageTitle = await page.title();
  const pageUrl = page.url();
  console.log(`Page Title: ${pageTitle}, URL: ${pageUrl}`);

  // Check what texts exist on the page
  const bodyText = await page.evaluate(() => document.body.innerText);
  console.log('Current visible body text snippet (first 300 chars):');
  console.log(bodyText.substring(0, 300));

  // TEST LOGIN SCREEN INTERACTIONS
  console.log('\n--- TESTING LOGIN SCREEN ---');

  // Check if Sign In button exists
  const signInButton = page.locator('div[role="button"]:has-text("SIGN IN"), [role="button"]:has-text("Sign In"), div:text-is("SIGN IN")').first();
  const signInExists = await signInButton.count();
  console.log(`Sign In button found: ${signInExists > 0}`);

  if (signInExists > 0) {
    // 1. Test empty form submission
    console.log('Clicking Sign In with empty inputs...');
    await signInButton.click();
    await page.waitForTimeout(1000);
    await page.screenshot({ path: path.join(SCREENSHOT_DIR, '03_login_empty_validation.png') });
    console.log('Captured 03_login_empty_validation.png');

    const errorVisible = await page.evaluate(() => {
      return document.body.innerText.includes('Please enter both email and password');
    });
    console.log(`Empty validation error rendered: ${errorVisible}`);

    // 2. Test typing credentials
    console.log('Typing test credentials...');
    const inputs = page.locator('input');
    const inputCount = await inputs.count();
    console.log(`Found ${inputCount} input fields`);

    if (inputCount >= 2) {
      await inputs.nth(0).fill('testuser@example.com');
      await inputs.nth(1).fill('WrongPassword123!');
      await page.waitForTimeout(500);
      await page.screenshot({ path: path.join(SCREENSHOT_DIR, '04_login_filled.png') });
      console.log('Captured 04_login_filled.png');

      // Click sign in
      console.log('Submitting invalid credentials...');
      await signInButton.click();
      await page.waitForTimeout(2500);
      await page.screenshot({ path: path.join(SCREENSHOT_DIR, '05_login_invalid_auth_response.png') });
      console.log('Captured 05_login_invalid_auth_response.png');
    }

    // 3. Test Country Selector Modal
    console.log('Testing Country Selector Modal...');
    const countryButton = page.locator('div[role="button"]:has-text("+"), [role="button"]:has-text("United States"), [role="button"]:has-text("India")').first();
    if (await countryButton.count() > 0) {
      console.log('Clicking Country Selector button...');
      await countryButton.click();
      await page.waitForTimeout(1000);
      await page.screenshot({ path: path.join(SCREENSHOT_DIR, '06_country_modal_open.png') });
      console.log('Captured 06_country_modal_open.png');

      // Search in country modal if search input exists
      const modalSearch = page.locator('input[placeholder*="Search" i], input[placeholder*="country" i]').first();
      if (await modalSearch.count() > 0) {
        await modalSearch.fill('Canada');
        await page.waitForTimeout(500);
        await page.screenshot({ path: path.join(SCREENSHOT_DIR, '07_country_modal_search.png') });
        console.log('Captured 07_country_modal_search.png');
      }

      // Close modal or pick country
      const canadaOption = page.locator('text=Canada').first();
      if (await canadaOption.count() > 0) {
        await canadaOption.click();
        await page.waitForTimeout(500);
        console.log('Selected Canada');
      } else {
        // click close
        const closeBtn = page.locator('div[role="button"]:has-text("✕"), div[role="button"]:has-text("Close")').first();
        if (await closeBtn.count() > 0) await closeBtn.click();
      }
    }

    // 4. Test Navigation to Sign Up
    console.log('\n--- TESTING SIGN UP NAVIGATION ---');
    const signUpLink = page.locator('div[role="button"]:has-text("CREATE AN ACCOUNT"), [role="button"]:has-text("SIGN UP"), div:has-text("CREATE AN ACCOUNT"), div:has-text("SIGN UP")').last();
    if (await signUpLink.count() > 0) {
      console.log('Clicking Sign Up link...');
      await signUpLink.click();
      await page.waitForTimeout(1500);
      await page.screenshot({ path: path.join(SCREENSHOT_DIR, '08_signup_screen.png') });
      console.log('Captured 08_signup_screen.png');

      // Test Sign Up validation
      const createAccountBtn = page.locator('div[role="button"]:has-text("CREATE ACCOUNT"), [role="button"]:has-text("SIGN UP")').first();
      if (await createAccountBtn.count() > 0) {
        await createAccountBtn.click();
        await page.waitForTimeout(500);
        await page.screenshot({ path: path.join(SCREENSHOT_DIR, '09_signup_empty_validation.png') });
        console.log('Captured 09_signup_empty_validation.png');
      }

      // Switch back to Sign In
      const signInLink = page.locator('div[role="button"]:has-text("SIGN IN"), div:has-text("SIGN IN")').last();
      if (await signInLink.count() > 0) {
        await signInLink.click();
        await page.waitForTimeout(1000);
        console.log('Navigated back to Login screen');
      }
    }
  }

  // 5. Test Authenticated Experience & Main App Screens (Profile Setup & MainTabs)
  console.log('\n--- TESTING AUTHENTICATED STATE & MAIN TABS ---');
  const authInjected = await page.evaluate(async () => {
    try {
      // Find useAuthStore in window or inject mock user profile into zustand / state
      // Check if __useAuthStore is exposed or simulate session
      const mockProfile = {
        id: 'test-user-id-12345',
        full_name: 'Test Explorer',
        phone: '+1 555-0199',
        avatar_url: null,
        is_ghost_mode: false,
        hide_online_presence: false,
        is_premium: true,
        created_at: new Date().toISOString()
      };
      const mockSession = {
        access_token: 'mock-token',
        token_type: 'bearer',
        expires_in: 3600,
        refresh_token: 'mock-refresh-token',
        user: {
          id: 'test-user-id-12345',
          email: 'testexplorer@example.com',
          user_metadata: { full_name: 'Test Explorer' },
          app_metadata: {},
          aud: 'authenticated',
          created_at: new Date().toISOString()
        }
      };

      // Set in localStorage for async-storage
      window.localStorage.setItem('sb-phgizfyyywwjieruytsy-auth-token', JSON.stringify(mockSession));
      return { success: true };
    } catch (e) {
      return { success: false, error: e.message };
    }
  });
  console.log('LocalStorage injection result:', authInjected);

  // Also test desktop responsive viewport
  console.log('\n--- TESTING DESKTOP VIEWPORT ---');
  await page.setViewportSize({ width: 1280, height: 800 });
  await page.waitForTimeout(1000);
  await page.screenshot({ path: path.join(SCREENSHOT_DIR, '10_desktop_viewport.png') });
  console.log('Captured 10_desktop_viewport.png');

  // Summary of issues
  const report = {
    timestamp: new Date().toISOString(),
    pageTitle,
    pageUrl,
    consoleErrors: consoleMessages.filter(m => m.type === 'error'),
    consoleWarnings: consoleMessages.filter(m => m.type === 'warning'),
    pageErrors,
    failedRequests
  };

  fs.writeFileSync(path.join(ARTIFACT_DIR, 'playwright_test_report.json'), JSON.stringify(report, null, 2));
  console.log('Report saved to playwright_test_report.json');

  await browser.close();
  console.log('--- PLAYWRIGHT AUDIT COMPLETED ---');
}

runAudit().catch(err => {
  console.error('Playwright audit failed with error:', err);
  process.exit(1);
});
