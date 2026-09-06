const { chromium } = require('playwright');
const path = require('path');
const fs = require('fs');

const ARTIFACT_DIR = 'C:\\Users\\mylam\\.gemini\\antigravity-ide\\brain\\0532c4a0-e44f-4f50-a1d6-e0e4e4caece4';
const SCREENSHOT_DIR = path.join(ARTIFACT_DIR, 'playwright_screenshots');

if (!fs.existsSync(SCREENSHOT_DIR)) {
  fs.mkdirSync(SCREENSHOT_DIR, { recursive: true });
}

async function testSplashStartup() {
  console.log('--- TESTING SPLASH & LOADING STARTUP TIMING ---');
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

  page.on('console', msg => {
    console.log(`[BROWSER ${msg.type().toUpperCase()}]: ${msg.text()}`);
  });

  console.log('Navigating to http://localhost:8081...');
  const t0 = Date.now();
  await page.goto('http://localhost:8081', { waitUntil: 'commit' });
  console.log(`Committed navigation in ${Date.now() - t0}ms`);

  // Capture frames at fast intervals to see startup transitions
  const capturePoints = [200, 400, 700, 1000, 1400, 1800, 2200, 2700, 3200, 3600];
  for (let i = 0; i < capturePoints.length; i++) {
    const targetMs = capturePoints[i];
    const elapsed = Date.now() - t0;
    const waitTime = Math.max(0, targetMs - elapsed);
    if (waitTime > 0) {
      await page.waitForTimeout(waitTime);
    }
    const currentElapsed = Date.now() - t0;
    const filename = `timing_${String(i).padStart(2, '0')}_${currentElapsed}ms.png`;
    await page.screenshot({ path: path.join(SCREENSHOT_DIR, filename) });
    console.log(`Saved screenshot ${filename} at ${currentElapsed}ms`);
  }

  await browser.close();
  console.log('--- TEST COMPLETED ---');
}

testSplashStartup().catch(err => {
  console.error('Error in testSplashStartup:', err);
  process.exit(1);
});
