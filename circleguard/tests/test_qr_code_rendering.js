const { chromium } = require('playwright');
const path = require('path');
const fs = require('fs');

const ARTIFACT_DIR = 'C:\\Users\\mylam\\.gemini\\antigravity-ide\\brain\\a3377614-b22c-4960-8db7-02c3ece4891d';
const SCREENSHOT_DIR = path.join(ARTIFACT_DIR, 'playwright_screenshots');

(async () => {
  console.log('--- Testing Circle QR Code Rendering & Add Member Flow ---');
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

  await page.evaluate(() => {
    const SELF_ID = '03ca6af3-b0f7-46a1-9e70-2bb96befb67c';
    const CIRCLE_ID = 'af00325e-7e26-4b5d-856d-907085b326d2';

    const mockUser = { id: SELF_ID, email: 'sri@example.com' };
    const mockSession = { access_token: 't', token_type: 'bearer', user: mockUser };
    const mockProfile = { id: SELF_ID, full_name: 'Sri Jai Suryaa', phone: '+918072986912', is_ghost_mode: false, is_premium: true };
    const mockCircle = { id: CIRCLE_ID, name: 'Family Circle', invite_code: 'HK3GJB', tracking_mode: 'continuous', owner_id: SELF_ID };

    const mockMembers = [
      { id: '1', circle_id: CIRCLE_ID, user_id: SELF_ID, role: 'owner', profile: mockProfile, isOnline: true }
    ];

    if (window.__useAuthStore) window.__useAuthStore.setState({ user: mockUser, session: mockSession, profile: mockProfile, isLoaded: true });
    if (window.__useCircleStore) window.__useCircleStore.setState({ activeCircle: mockCircle, members: mockMembers, circles: [mockCircle], circleFetched: true, isLoading: false });
  });

  await page.waitForTimeout(1500);

  console.log('Navigating to Circle tab...');
  await page.locator('text=Circle').last().click({ force: true });
  await page.waitForTimeout(2000);

  // 1. Test "Add Member" button at top opening QR Code modal
  console.log('Clicking "Add Member" button...');
  await page.locator('text=Add Member').first().click({ force: true });
  await page.waitForTimeout(1500);

  const addMemberModalPath = path.join(SCREENSHOT_DIR, 'test_add_member_qr_modal.png');
  await page.screenshot({ path: addMemberModalPath });
  console.log('Saved Add Member QR modal screenshot:', addMemberModalPath);

  // Close the modal
  const closeBtn = page.locator('div[style*="border-radius: 18px"]').or(page.locator('text=PRIVATE ENCRYPTION KEY')).locator('..').locator('..').locator('div').last();
  await page.keyboard.press('Escape');
  // Click overlay or outside to close
  await page.mouse.click(100, 100);
  await page.waitForTimeout(1000);

  // 2. Scroll to Family Invite Key & QR card
  console.log('Scrolling to Family Invite Key & QR section...');
  await page.locator('text=Family Invite Key & QR').scrollIntoViewIfNeeded();
  await page.waitForTimeout(1000);

  const inviteSectionPath = path.join(SCREENSHOT_DIR, 'test_circle_invite_qr_card.png');
  await page.screenshot({ path: inviteSectionPath });
  console.log('Saved Invite & QR card screenshot:', inviteSectionPath);

  // 3. Click "View QR" button
  console.log('Clicking View QR button...');
  await page.locator('text=View QR').first().click({ force: true });
  await page.waitForTimeout(1500);

  const viewQrModalPath = path.join(SCREENSHOT_DIR, 'test_view_qr_modal_open.png');
  await page.screenshot({ path: viewQrModalPath });
  console.log('Saved View QR modal screenshot:', viewQrModalPath);

  await browser.close();
  console.log('--- Finished QR Code Test ---');
})();
