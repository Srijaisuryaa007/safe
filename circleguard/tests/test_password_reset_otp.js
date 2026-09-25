const { chromium } = require('playwright');
const path = require('path');

async function testPasswordResetOtp() {
  const browser = await chromium.launch({ channel: 'chrome', headless: true });
  const context = await browser.newContext({ viewport: { width: 412, height: 915 } });
  const page = await context.newPage();

  page.on('console', msg => {
    const text = msg.text();
    if (!text.includes('[Fast Refresh]') && !text.includes('Download the React DevTools')) {
      console.log('PAGE LOG:', text);
    }
  });
  page.on('pageerror', err => console.log('PAGE ERROR:', err.message));

  console.log('Navigating to app...');
  await page.goto('http://127.0.0.1:8081');
  await page.waitForSelector('text=SIGN IN', { timeout: 25000 });

  // Mock Supabase Auth reset password response
  await page.route('**/auth/v1/recover*', route => route.fulfill({
    status: 200,
    contentType: 'application/json',
    body: JSON.stringify({})
  }));

  console.log('Clicking FORGOT PASSWORD? button...');
  const forgotBtn = page.locator('text=FORGOT PASSWORD?').locator('visible=true').first();
  await forgotBtn.click();

  // Wait for Password Reset Modal Step 1 to appear
  await page.waitForSelector('text=1-TIME PASSWORD (OTP) RECOVERY', { timeout: 10000 });
  await page.waitForTimeout(500);
  console.log('Password Reset Modal Step 1 is visible!');

  const step1Screenshot = path.resolve(__dirname, '../../playwright_screenshots/password_reset_step1_otp_request.png');
  await page.screenshot({ path: step1Screenshot });
  console.log('Saved Step 1 screenshot:', step1Screenshot);

  // Type email and submit
  const emailInput = page.locator('input[placeholder="name@domain.com"]').locator('visible=true').first();
  await emailInput.fill('user@circleguard.com');

  console.log('Clicking SEND 1-TIME OTP CODE...');
  const sendOtpBtn = page.locator('text=SEND 1-TIME OTP CODE').locator('visible=true').first();
  await sendOtpBtn.click();

  // Wait for Step 2: 6-Digit OTP & New Password screen
  await page.waitForSelector('text=VERIFY OTP & RESET', { timeout: 10000 });
  await page.waitForSelector('text=6-DIGIT OTP CODE', { timeout: 10000 });
  console.log('Password Reset Modal Step 2 (6-digit OTP verification) is visible!');

  await page.waitForTimeout(1000);
  const step2Screenshot = path.resolve(__dirname, '../../playwright_screenshots/password_reset_step2_otp_verify.png');
  await page.screenshot({ path: step2Screenshot });
  console.log('Saved Step 2 screenshot:', step2Screenshot);

  await browser.close();
  console.log('Password Reset OTP test completed successfully!');
}

testPasswordResetOtp().catch(err => {
  console.error('Test error:', err);
  process.exit(1);
});
