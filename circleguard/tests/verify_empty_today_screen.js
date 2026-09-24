const { chromium } = require('playwright');
const path = require('path');

const CONVERSATION_ID = '4b7cd027-1098-48dd-835e-5684e2a91171';
const SCREENSHOT_DIR = path.join('C:\\Users\\mylam\\.gemini\\antigravity-ide\\brain', CONVERSATION_ID, 'playwright_screenshots');

async function checkTodayEmpty() {
  const browser = await chromium.launch({ channel: 'chrome', headless: true, args: ['--no-sandbox'] });
  const page = await browser.newPage({ viewport: { width: 412, height: 915 } });

  const SELF_ID = '03ca6af3-b0f7-46a1-9e70-2bb96befb67c';
  const CIRCLE_ID = 'af00325e-7e26-4b5d-856d-907085b326d2';

  // Empty location history for Today
  await page.route('**/rest/v1/places*', async route => route.fulfill({ status: 200, contentType: 'application/json', body: '[]' }));
  await page.route('**/rest/v1/location_history*', async route => route.fulfill({ status: 200, contentType: 'application/json', body: '[]' }));

  await page.goto('http://127.0.0.1:8081', { waitUntil: 'commit' });
  await page.waitForSelector('text=SIGN IN', { timeout: 20000 });

  await page.evaluate(({ SELF_ID, CIRCLE_ID }) => {
    localStorage.clear();
    const mockUser = { id: SELF_ID, email: 'sri@example.com', user_metadata: { full_name: 'Sri Jai Suryaa' } };
    window.__useAuthStore.getState().setSession({ access_token: 'tok', token_type: 'bearer', user: mockUser });
    window.__useAuthStore.getState().setProfile({ id: SELF_ID, full_name: 'Sri Jai Suryaa', is_premium: true });
    window.__useAuthStore.getState().setLoading(false);
    window.__useCircleStore.getState().setActiveCircle({ id: CIRCLE_ID, name: 'Family Circle', owner_id: SELF_ID });
    window.__useCircleStore.getState().setMembers([{
      circle_id: CIRCLE_ID, user_id: SELF_ID, role: 'owner', isOnline: true,
      latitude: 13.0827, longitude: 80.2707,
      profile: { id: SELF_ID, full_name: 'Sri Jai Suryaa' }
    }]);
  }, { SELF_ID, CIRCLE_ID });

  await page.waitForTimeout(1000);
  await page.evaluate(() => window.__navigationRef.navigate('LocationHistory'));
  await page.waitForTimeout(3000);

  const shotPath = path.join(SCREENSHOT_DIR, 'clean_today_no_duplicates.png');
  await page.screenshot({ path: shotPath });
  console.log('Saved clean Today screenshot to', shotPath);
  await browser.close();
}

checkTodayEmpty().catch(console.error);
