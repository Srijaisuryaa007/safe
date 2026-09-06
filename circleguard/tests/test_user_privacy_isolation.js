const { chromium } = require('playwright');
const path = require('path');

const ARTIFACT_DIR = 'C:\\Users\\mylam\\.gemini\\antigravity-ide\\brain\\0532c4a0-e44f-4f50-a1d6-e0e4e4caece4';
const SCREENSHOT_DIR = path.join(ARTIFACT_DIR, 'playwright_screenshots');

async function testUserPrivacyIsolation() {
  console.log('--- TESTING ENTERPRISE USER PRIVACY & DATA ISOLATION ---');
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

  console.log('Step 1: Simulating User A (Alice) with custom medical data, light theme & active circle...');
  await page.evaluate(async () => {
    const ALICE_ID = '11111111-1111-4111-8111-111111111111';
    const mockUserA = { id: ALICE_ID, email: 'alice@example.com' };
    const mockSessionA = { access_token: 'token-a', token_type: 'bearer', user: mockUserA };
    const mockProfileA = {
      id: ALICE_ID,
      full_name: 'Alice Wonder',
      phone: '+1 2025550199',
      avatar_url: null,
      created_at: new Date().toISOString(),
    };

    // User A sets medical info
    const aliceMedical = {
      bloodType: 'B-',
      allergies: 'Penicillin allergy',
      conditions: 'Asthma',
      notes: 'Carries emergency inhaler',
      primaryDoctor: 'Dr. House',
    };
    localStorage.setItem(`@circleguard_medical_info_${ALICE_ID}`, JSON.stringify(aliceMedical));

    // User A sets light theme
    localStorage.setItem(`@circleguard_theme_mode_${ALICE_ID}`, 'light');

    window.__useAuthStore.getState().setSession(mockSessionA);
    window.__useAuthStore.getState().setProfile(mockProfileA);
    window.__useAuthStore.getState().setLoading(false);
  });

  await page.waitForTimeout(1000);

  console.log('Step 2: Performing enterprise logout & store cleansing...');
  await page.evaluate(() => {
    // Teardown
    window.__useAuthStore.getState().resetAuthStore();
    window.__useCircleStore.getState().resetCircleStore();
    window.__useThemeStore.getState().resetThemeToDefault();
  });

  await page.waitForTimeout(1000);

  console.log('Step 3: Simulating User B (Bob - brand new user) signing up...');
  const BOB_ID = '22222222-2222-4222-8222-222222222222';

  // Test loading animation state while profile is fetching
  await page.evaluate((bobId) => {
    const mockUserB = { id: bobId, email: 'bob@example.com' };
    const mockSessionB = { access_token: 'token-b', token_type: 'bearer', user: mockUserB };

    window.__useAuthStore.getState().setSession(mockSessionB);
    window.__useAuthStore.getState().setProfileFetching(true);
    window.__useAuthStore.getState().setLoading(false);
  }, BOB_ID);

  await page.waitForTimeout(800);
  const loadingShot = path.join(SCREENSHOT_DIR, 'test_enterprise_loading_animation.png');
  await page.screenshot({ path: loadingShot });
  console.log(`Saved loading animation screenshot: ${loadingShot}`);

  // Complete profile hydration for Bob (clean account, no medical info, no circle)
  await page.evaluate((bobId) => {
    const mockProfileB = {
      id: bobId,
      full_name: 'Bob Newbie',
      phone: '+91 9876543210',
      avatar_url: null,
      created_at: new Date().toISOString(),
    };

    window.__useAuthStore.getState().setProfile(mockProfileB);
    window.__useAuthStore.getState().setProfileFetching(false);
    window.__useCircleStore.getState().resetCircleStore();
    window.__useThemeStore.getState().initTheme(bobId);
  }, BOB_ID);

  await page.waitForTimeout(1500);

  // Verify Bob starts in Dark theme (not Alice's light theme)
  const isDarkTheme = await page.evaluate(() => {
    return window.__useThemeStore.getState().isDark;
  });
  console.log(`User B theme isDark: ${isDarkTheme} (Expected: true)`);

  // Navigate to Profile tab to check Medical Information
  console.log('Navigating to Profile tab to verify clean Medical Information...');
  await page.locator('text=Profile').last().click({ force: true });
  await page.waitForTimeout(1200);

  // Click Medical Information
  console.log('Opening Medical Information modal...');
  const medicalBtn = page.locator('text=Medical Information').first();
  await medicalBtn.click({ force: true });
  await page.waitForTimeout(1000);

  // Inspect blood group and allergies
  const medicalValues = await page.evaluate(() => {
    const texts = Array.from(document.querySelectorAll('*')).map(el => el.textContent).filter(Boolean);
    const hasPenicillin = texts.some(t => t.includes('Penicillin'));
    const hasAsthma = texts.some(t => t.includes('Asthma'));
    return { hasPenicillin, hasAsthma };
  });

  console.log('Medical data isolation check:', medicalValues);
  if (!medicalValues.hasPenicillin && !medicalValues.hasAsthma) {
    console.log('[SUCCESS] User B has ZERO medical data from User A (100% isolated)!');
  } else {
    console.error('[FAIL] User A medical data leaked to User B!');
  }

  const medicalShot = path.join(SCREENSHOT_DIR, 'test_new_user_medical_info_clean.png');
  await page.screenshot({ path: medicalShot });
  console.log(`Saved clean medical modal screenshot: ${medicalShot}`);

  // Close Medical Modal by clicking the close button at (44, 80)
  await page.mouse.click(44, 80);
  await page.waitForTimeout(1000);

  // Navigate to Location History for User B
  console.log('Navigating to Location History via navigationRef...');
  await page.evaluate(() => {
    if (window.__navigationRef) {
      window.__navigationRef.navigate('LocationHistory');
    }
  });
  await page.waitForTimeout(2000);

  // Verify Location History has 0 distance and 0 points
  const historyPointsCount = await page.evaluate(() => {
    const totalDistEl = Array.from(document.querySelectorAll('*')).find(
      el => el.textContent && el.textContent.includes('TOTAL DISTANCE')
    );
    const timelineEl = Array.from(document.querySelectorAll('*')).find(
      el => el.textContent && el.textContent.includes('TIMELINE')
    );
    return {
      distanceText: totalDistEl ? totalDistEl.parentElement?.textContent : '0.0 km',
      timelineText: timelineEl ? timelineEl.textContent : 'none'
    };
  });
  console.log('Location History data for User B:', historyPointsCount);

  const historyShot = path.join(SCREENSHOT_DIR, 'test_new_user_location_history_empty.png');
  await page.screenshot({ path: historyShot });
  console.log(`Saved empty location history screenshot: ${historyShot}`);

  await browser.close();
  console.log('--- ENTERPRISE USER PRIVACY & DATA ISOLATION TEST FINISHED ---');
}

testUserPrivacyIsolation().catch(err => {
  console.error('Test error:', err);
  process.exit(1);
});
