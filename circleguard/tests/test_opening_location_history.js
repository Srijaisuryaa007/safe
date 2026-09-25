const { chromium } = require('playwright');

async function testOpening() {
  const browser = await chromium.launch({ channel: 'chrome', headless: true });
  const context = await browser.newContext({ viewport: { width: 412, height: 915 } });
  const page = await context.newPage();

  page.on('console', msg => console.log('PAGE LOG:', msg.type(), msg.text()));
  page.on('pageerror', err => console.log('PAGE ERROR:', err.message));

  const SELF_ID = '03ca6af3-b0f7-46a1-9e70-2bb96befb67c';
  const CIRCLE_ID = 'af00325e-7e26-4b5d-856d-907085b326d2';

  await page.route('**/rest/v1/places*', route => route.fulfill({ status: 200, contentType: 'application/json', body: '[]' }));
  await page.route('**/rest/v1/location_history*', route => route.fulfill({ status: 200, contentType: 'application/json', body: '[]' }));

  await page.goto('http://127.0.0.1:8081');
  await page.waitForSelector('text=SIGN IN', { timeout: 20000 });

  await page.evaluate(({ SELF_ID, CIRCLE_ID }) => {
    window.__useAuthStore.getState().setSession({ access_token: 'tk', token_type: 'bearer', user: { id: SELF_ID } });
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

  // Look for the "History" tile on HomeScreen
  console.log('Searching for "History" tile on Home screen...');
  const historyTile = page.locator('text=History').locator('visible=true').first();
  if (await historyTile.isVisible()) {
    console.log('Found History tile, clicking it...');
    await historyTile.click();
    await page.waitForTimeout(2500);

    const title = await page.$('text=LOCATION HISTORY');
    console.log('Navigated to Location History? (title found):', !!title);
  } else {
    console.log('History tile not found on screen');
  }

  await browser.close();
}

testOpening().catch(console.error);
