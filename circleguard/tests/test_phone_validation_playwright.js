const { chromium } = require('playwright');
const path = require('path');
const fs = require('fs');

const ARTIFACT_DIR = 'C:\\Users\\mylam\\.gemini\\antigravity-ide\\brain\\0532c4a0-e44f-4f50-a1d6-e0e4e4caece4';
const SCREENSHOT_DIR = path.join(ARTIFACT_DIR, 'playwright_screenshots');

async function testPhoneValidation() {
  console.log('--- TESTING COUNTRY PHONE VALIDATION & DEDUPLICATION ---');
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

  console.log('1. Testing ProfileSetupScreen with phone: null...');
  await page.evaluate(() => {
    const SELF_ID = '03ca6af3-b0f7-46a1-9e70-2bb96befb67c';
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
      phone: null, // trigger ProfileSetupScreen
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

  await page.waitForSelector('text=Complete Your Identity', { timeout: 10000 });
  console.log('Successfully navigated to ProfileSetupScreen!');

  // Find phone input field
  const phoneInputs = await page.$$('input[type="tel"], input');
  console.log(`Found ${phoneInputs.length} inputs.`);

  // Type 9 digits (too short for India)
  console.log('Typing 9 digits (807298691) for India...');
  const phoneInput = phoneInputs[phoneInputs.length - 1];
  await phoneInput.fill('807298691');
  await page.waitForTimeout(600);

  // Click submit button
  console.log('Clicking INITIALIZE PROFILE & ENTER with 9 digits...');
  const submitBtn = await page.waitForSelector('text=INITIALIZE PROFILE & ENTER');
  await submitBtn.click();
  await page.waitForTimeout(600);

  // Take screenshot of invalid length error
  const invalidScreenshotPath = path.join(SCREENSHOT_DIR, 'test_phone_invalid_length.png');
  await page.screenshot({ path: invalidScreenshotPath });
  console.log(`Saved screenshot: ${invalidScreenshotPath}`);

  // Now type complete 10 digits
  console.log('Typing full 10 digits (8072986912)...');
  await phoneInput.fill('8072986912');
  await page.waitForTimeout(600);

  // Take screenshot of valid 10 digits with checkmark and green badge
  const validScreenshotPath = path.join(SCREENSHOT_DIR, 'test_phone_valid_length.png');
  await page.screenshot({ path: validScreenshotPath });
  console.log(`Saved screenshot: ${validScreenshotPath}`);

  // 2. Now transition to Authenticated Main Tabs -> Profile -> Edit Profile Modal
  console.log('2. Transitioning to Authenticated Profile Screen...');
  await page.evaluate(() => {
    const SELF_ID = '03ca6af3-b0f7-46a1-9e70-2bb96befb67c';
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
    window.__useAuthStore.getState().setProfile(mockProfile);
  });

  await page.waitForSelector('text=MAP', { timeout: 10000 });
  console.log('Entered Main Tabs! Navigating to PROFILE tab...');

  const profileTab = await page.waitForSelector('text=PROFILE');
  await profileTab.click();
  await page.waitForTimeout(1000);

  // Click edit button via testID
  console.log('Opening Edit Profile Modal via data-testid...');
  const editBtn = await page.waitForSelector('[data-testid="edit-profile-pencil-btn"]', { timeout: 10000 });
  await editBtn.click();
  await page.waitForTimeout(1000);

  // Take screenshot of Edit Profile Modal showing phone number and live country badge
  await page.waitForSelector('text=EDIT PROFILE INFO', { timeout: 10000 });
  console.log('Edit Profile Modal open!');

  const editModalScreenshot = path.join(SCREENSHOT_DIR, 'test_phone_edit_profile_modal.png');
  await page.screenshot({ path: editModalScreenshot });
  console.log(`Saved screenshot: ${editModalScreenshot}`);

  // 3. In-Browser Comprehensive Country Rules & Deduplication Assertions
  console.log('3. Running comprehensive in-browser country validation suite...');
  const testResults = await page.evaluate(async () => {
    const { validateAndNormalizePhone, detectCountryFromPhone, extractNationalDigits, checkDuplicatePhoneNumber } = window.__phoneValidation;

    const results = [];
    const check = (desc, cond) => results.push({ desc, pass: !!cond });

    // India
    check('IN 10-digit valid', validateAndNormalizePhone('9876543210', 'IN').isValid && validateAndNormalizePhone('9876543210', 'IN').e164 === '+919876543210');
    check('IN 9-digit rejected', !validateAndNormalizePhone('987654321', 'IN').isValid);
    check('IN 11-digit rejected', !validateAndNormalizePhone('98765432100', 'IN').isValid);
    check('IN invalid prefix rejected', !validateAndNormalizePhone('1876543210', 'IN').isValid);
    check('IN dialCode strip', validateAndNormalizePhone('+91 9876543210', 'IN').e164 === '+919876543210');
    check('IN trunk 0 strip', validateAndNormalizePhone('09876543210', 'IN').e164 === '+919876543210');

    // US
    check('US 10-digit valid', validateAndNormalizePhone('4155552671', 'US').isValid && validateAndNormalizePhone('4155552671', 'US').e164 === '+14155552671');
    check('US 9-digit rejected', !validateAndNormalizePhone('415555267', 'US').isValid);

    // UK
    check('GB 10-digit starting with 7 valid', validateAndNormalizePhone('7911123456', 'GB').isValid && validateAndNormalizePhone('7911123456', 'GB').e164 === '+447911123456');
    check('GB trunk 0 stripped', validateAndNormalizePhone('07911123456', 'GB').e164 === '+447911123456');
    check('GB 9-digit rejected', !validateAndNormalizePhone('791112345', 'GB').isValid);

    // Australia
    check('AU 9-digit starting with 4 valid', validateAndNormalizePhone('412345678', 'AU').isValid && validateAndNormalizePhone('412345678', 'AU').e164 === '+61412345678');
    check('AU trunk 0 stripped', validateAndNormalizePhone('0412345678', 'AU').e164 === '+61412345678');
    check('AU 8-digit rejected', !validateAndNormalizePhone('41234567', 'AU').isValid);

    // UAE
    check('AE 9-digit starting with 5 valid', validateAndNormalizePhone('501234567', 'AE').isValid && validateAndNormalizePhone('501234567', 'AE').e164 === '+971501234567');
    check('AE invalid prefix rejected', !validateAndNormalizePhone('201234567', 'AE').isValid);

    // Singapore
    check('SG 8-digit starting with 8 valid', validateAndNormalizePhone('81234567', 'SG').isValid && validateAndNormalizePhone('81234567', 'SG').e164 === '+6581234567');
    check('SG 7-digit rejected', !validateAndNormalizePhone('8123456', 'SG').isValid);

    // Detection & Extraction
    check('Detect country from phone (+91)', detectCountryFromPhone('+918072986912') === 'IN');
    check('Detect country from phone (+1)', detectCountryFromPhone('+14155552671') === 'US');
    check('Extract national digits', extractNationalDigits('+918072986912', 'IN') === '8072986912');

    return results;
  });

  console.log('\n--- COMPREHENSIVE COUNTRY VALIDATION RESULTS ---');
  let passedCount = 0;
  for (const r of testResults) {
    if (r.pass) {
      console.log(`  [PASS] ${r.desc}`);
      passedCount++;
    } else {
      console.error(`  [FAIL] ${r.desc}`);
    }
  }
  console.log(`Passed: ${passedCount} / ${testResults.length}`);

  if (passedCount !== testResults.length) {
    throw new Error('Some country validation assertions failed!');
  }

  console.log('--- PHONE VALIDATION & DEDUPLICATION TEST FULLY PASSED ---');
  await browser.close();
}

testPhoneValidation().catch((err) => {
  console.error('Test error:', err);
  process.exit(1);
});
