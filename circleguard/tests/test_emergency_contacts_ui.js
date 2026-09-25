const { chromium } = require('playwright');
const path = require('path');
const fs = require('fs');

const ARTIFACT_DIR = 'C:\\Users\\mylam\\.gemini\\antigravity-ide\\brain\\1552c728-fbd5-4a4e-9da5-fb93c3352ef3';
const SCREENSHOT_DIR = path.join(ARTIFACT_DIR, 'playwright_screenshots');

if (!fs.existsSync(SCREENSHOT_DIR)) {
  fs.mkdirSync(SCREENSHOT_DIR, { recursive: true });
}

async function testEmergencyContactsUI() {
  console.log('--- TESTING EMERGENCY CONTACTS CLEAN CLAN UI ---');
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

  console.log('Injecting mock session with Emergency Contacts matching user screenshot...');
  await page.evaluate(() => {
    const SELF_ID = '03ca6af3-b0f7-46a1-9e70-2bb96befb67c';
    const CIRCLE_ID = 'af00325e-7e26-4b5d-856d-907085b326d2';

    const mockContacts = [
      {
        id: '1',
        name: 'Mom',
        relationship: 'Emergency Contact',
        phone: '+917502966799',
      }
    ];

    const mockUser = { id: SELF_ID, email: 'sri@example.com' };
    const mockSession = { access_token: 't', token_type: 'bearer', user: mockUser };
    const mockProfile = {
      id: SELF_ID,
      full_name: 'Sri Jai Suryaa',
      phone: '+918072986912',
      is_ghost_mode: false,
      is_premium: true,
      emergency_contacts: mockContacts,
    };
    const mockCircle = { id: CIRCLE_ID, name: 'Family Circle', invite_code: 'HK3GJB', tracking_mode: 'continuous', owner_id: SELF_ID };

    const mockMembers = [
      { id: '1', circle_id: CIRCLE_ID, user_id: SELF_ID, role: 'owner', profile: mockProfile, isOnline: true },
    ];

    if (window.__useAuthStore) {
      window.__useAuthStore.setState({ user: mockUser, session: mockSession, profile: mockProfile, isLoaded: true });
    }
    if (window.__useCircleStore) {
      window.__useCircleStore.setState({ activeCircle: mockCircle, members: mockMembers, circles: [mockCircle], circleFetched: true, isLoading: false });
    }

    try {
      localStorage.setItem(`@circleguard_emergency_contacts_${SELF_ID}`, JSON.stringify(mockContacts));
      localStorage.setItem('@circleguard_emergency_contacts', JSON.stringify(mockContacts));
      localStorage.setItem(`@circleguard_primary_emergency_contact_${SELF_ID}`, JSON.stringify({ name: 'Mom', phone: '+917502966799' }));
      localStorage.setItem('@circleguard_primary_emergency_contact', JSON.stringify({ name: 'Mom', phone: '+917502966799' }));
    } catch (e) {}
  });

  await page.waitForTimeout(1000);

  // Navigate to SOS tab
  console.log('Navigating to SOS tab...');
  const sosTab = page.locator('text=SOS').last();
  await sosTab.click({ force: true });
  await page.waitForTimeout(1000);

  // Click 3 dots menu button on top right
  console.log('Opening SOS options menu...');
  // The 3 dots icon in SOS screen
  const threeDots = page.locator('svg[data-testid="ellipsis-vertical"], [name="ellipsis-vertical"]').first();
  if (await threeDots.isVisible()) {
    await threeDots.click({ force: true });
  } else {
    // Try clicking coordinates of top right 3 dots
    await page.mouse.click(315, 58);
  }

  await page.waitForTimeout(800);

  // Click Emergency Contacts option
  console.log('Clicking Emergency Contacts menu option...');
  const emergencyOpt = page.locator('text=Emergency Contacts').last();
  if (await emergencyOpt.isVisible()) {
    await emergencyOpt.click({ force: true });
  }

  await page.waitForTimeout(1200);

  // Take screenshot of the redesigned Emergency Contacts Modal
  const screenshotPath = path.join(SCREENSHOT_DIR, 'emergency_contacts_modal_redesign.png');
  await page.screenshot({ path: screenshotPath, fullPage: true });
  console.log('Screenshot saved to:', screenshotPath);

  await browser.close();
  console.log('Test complete!');
}

testEmergencyContactsUI().catch(err => {
  console.error('Test error:', err);
  process.exit(1);
});
