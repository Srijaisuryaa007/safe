const { chromium } = require('playwright');
const path = require('path');
const fs = require('fs');

const ARTIFACT_DIR = 'C:\\Users\\mylam\\.gemini\\antigravity-ide\\brain\\1552c728-fbd5-4a4e-9da5-fb93c3352ef3';
const SCREENSHOT_DIR = path.join(ARTIFACT_DIR, 'playwright_screenshots');

if (!fs.existsSync(SCREENSHOT_DIR)) {
  fs.mkdirSync(SCREENSHOT_DIR, { recursive: true });
}

async function runTest() {
  console.log('--- STARTING PLAYWRIGHT TEST: LUXURY BIOMETRIC APP LOCK UI ---');
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

  console.log('1. Navigating to http://127.0.0.1:8081 ...');
  await page.goto('http://127.0.0.1:8081', { waitUntil: 'commit', timeout: 30000 });
  await page.waitForTimeout(4000);

  // 1. Trigger Android / Biometrics mode
  console.log('2. Triggering Luxury Biometric Lock Screen (Android / Biometrics)...');
  await page.evaluate(async () => {
    if (window.__triggerBiometricLock) {
      await window.__triggerBiometricLock('biometric');
    }
  });

  await page.waitForTimeout(1000);

  const lockTitle = page.locator('text=CircleGuard Locked');
  const isLockVisible = await lockTitle.isVisible({ timeout: 5000 }).catch(() => false);
  console.log(`Lock screen visible: ${isLockVisible}`);

  // Check that "AES-256" or "HARDWARE VAULT" is NOT in the DOM
  const pageContent = await page.content();
  const hasAes = pageContent.includes('AES-256') || pageContent.includes('AES 256') || pageContent.includes('HARDWARE VAULT');
  console.log(`Contains robotic AES-256 / HARDWARE VAULT: ${hasAes} (MUST BE FALSE)`);

  const shotPath = path.join(SCREENSHOT_DIR, 'biometric_lock_screen_luxury.png');
  await page.screenshot({ path: shotPath });
  console.log(`Saved screenshot to: ${shotPath}`);

  // Test interactive unlock button
  const unlockBtn = page.locator('text=Unlock with').first();
  const isBtnVis = await unlockBtn.isVisible();
  console.log(`Primary Unlock button visible: ${isBtnVis}`);

  if (isBtnVis) {
    console.log('Clicking unlock button...');
    await unlockBtn.click();
    await page.waitForTimeout(1500);
    const isStillLocked = await lockTitle.isVisible().catch(() => false);
    console.log(`Is still locked after click: ${isStillLocked} (should be false)`);
  }

  // 2. Test iOS Face ID mode
  console.log('3. Triggering Luxury Biometric Lock Screen (iOS Face ID Mode)...');
  await page.evaluate(async () => {
    if (window.__triggerBiometricLock) {
      await window.__triggerBiometricLock('face_id');
    }
  });
  await page.waitForTimeout(1000);

  const shotPathFace = path.join(SCREENSHOT_DIR, 'biometric_lock_face_id.png');
  await page.screenshot({ path: shotPathFace });
  console.log(`Saved Face ID screenshot to: ${shotPathFace}`);

  await browser.close();
  console.log('--- TEST FINISHED SUCCESSFULLY ---');
}

runTest().catch((e) => {
  console.error('Test failed with error:', e);
  process.exit(1);
});
