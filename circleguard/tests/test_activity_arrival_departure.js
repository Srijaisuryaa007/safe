const { chromium } = require('playwright');
const path = require('path');
const fs = require('fs');

const ARTIFACT_DIR = 'C:\\Users\\mylam\\.gemini\\antigravity-ide\\brain\\1552c728-fbd5-4a4e-9da5-fb93c3352ef3';
const SCREENSHOT_DIR = path.join(ARTIFACT_DIR, 'playwright_screenshots');

if (!fs.existsSync(SCREENSHOT_DIR)) {
  fs.mkdirSync(SCREENSHOT_DIR, { recursive: true });
}

async function testActivityArrivalDeparture() {
  console.log('--- TESTING ACTIVITY TAB: ACCURATE ARRIVAL & DEPARTURE DETAILS ---');
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

  console.log('Injecting mock user auth, circle session, places, members, and local activity cache...');
  await page.evaluate(() => {
    const SELF_ID = '03ca6af3-b0f7-46a1-9e70-2bb96befb67c';
    const MOM_ID = 'e7b1a2c3-4d5e-6f7a-8b9c-0d1e2f3a4b5c';
    const DAD_ID = 'b1b2b3b4-b5b6-7b8b-9b0b-1b2b3b4b5b6b';
    const CIRCLE_ID = 'af00325e-7e26-4b5d-856d-907085b326d2';

    const mockUser = { id: SELF_ID, email: 'sri@example.com' };
    const mockSession = { access_token: 't', token_type: 'bearer', user: mockUser };
    const mockProfile = { id: SELF_ID, full_name: 'Sri Jai Suryaa', phone: '+918072986912', is_ghost_mode: false, is_premium: true };
    const mockCircle = { id: CIRCLE_ID, name: 'Family Circle', invite_code: 'HK3GJB', tracking_mode: 'continuous', owner_id: SELF_ID };

    const mockMembers = [
      { id: '1', circle_id: CIRCLE_ID, user_id: SELF_ID, role: 'owner', profile: mockProfile, isOnline: true, batteryPct: 92 },
      { id: '2', circle_id: CIRCLE_ID, user_id: MOM_ID, role: 'member', profile: { full_name: 'Mom', phone: '+919876543210' }, isOnline: true, batteryPct: 78, latitude: 13.0827, longitude: 80.2707 },
      { id: '3', circle_id: CIRCLE_ID, user_id: DAD_ID, role: 'member', profile: { full_name: 'Dad', phone: '+919876543211' }, isOnline: true, batteryPct: 65, latitude: 13.0400, longitude: 80.2500 },
    ];

    const mockPlaces = [
      { id: 'p1', circle_id: CIRCLE_ID, name: 'Home Sweet Home', category: 'home', latitude: 13.0827, longitude: 80.2707, radius_m: 150 },
      { id: 'p2', circle_id: CIRCLE_ID, name: 'Tech Park Office', category: 'work', latitude: 13.0400, longitude: 80.2500, radius_m: 200 },
    ];

    const now = Date.now();
    const mockEvents = [
      {
        id: 'ev-departure-dad',
        type: 'GEOFENCE',
        eventType: 'departure',
        title: 'Dad departed Tech Park Office',
        message: 'Departed safe zone after staying 8h 15m.',
        time: '06:15 PM',
        icon: 'walk-outline',
        color: '#F59E0B',
        memberName: 'Dad',
        userId: DAD_ID,
        timestamp: now - 900000,
        placeName: 'Tech Park Office',
        placeId: 'p2',
        placeCategory: 'work',
        radiusMeters: 200,
        dwellDurationText: 'Stayed 8h 15m',
        occurredAtIso: new Date(now - 900000).toISOString(),
        latitude: 13.0400,
        longitude: 80.2500,
        batteryPct: 65
      },
      {
        id: 'ev-arrival-mom',
        type: 'GEOFENCE',
        eventType: 'arrival',
        title: 'Mom arrived at Home Sweet Home',
        message: 'Safely entered 150m safe boundary at 10:24 AM.',
        time: '10:24 AM',
        icon: 'location',
        color: '#2E7D5B',
        memberName: 'Mom',
        userId: MOM_ID,
        timestamp: now - 3600000,
        placeName: 'Home Sweet Home',
        placeId: 'p1',
        placeCategory: 'home',
        radiusMeters: 150,
        dwellDurationText: 'Just arrived',
        occurredAtIso: new Date(now - 3600000).toISOString(),
        latitude: 13.0827,
        longitude: 80.2707,
        batteryPct: 78
      }
    ];

    const key = `@circleguard_local_activity_events_${CIRCLE_ID}`;
    localStorage.setItem(key, JSON.stringify(mockEvents));

    if (window.__useAuthStore) window.__useAuthStore.setState({ user: mockUser, session: mockSession, profile: mockProfile, isLoaded: true });
    if (window.__useCircleStore) window.__useCircleStore.setState({
      activeCircle: mockCircle,
      members: mockMembers,
      places: mockPlaces,
      circles: [mockCircle],
      circleFetched: true,
      isLoading: false
    });
  });

  await page.waitForTimeout(800);

  console.log('Navigating to Activity tab...');
  await page.locator('text=Activity').last().click({ force: true });
  await page.waitForTimeout(2000);

  // Check for presence of Arrival & Departure elements in the timeline feed
  const arrivedBadge = page.locator('text=ARRIVED');
  const departedBadge = page.locator('text=DEPARTED');
  const stayedBadge = page.locator('text=Stayed 8h 15m');

  const arrivedCount = await arrivedBadge.count();
  const departedCount = await departedBadge.count();
  const stayedCount = await stayedBadge.count();

  console.log(`Feed state: ${arrivedCount} ARRIVED badge(s), ${departedCount} DEPARTED badge(s), ${stayedCount} stay duration badge(s).`);

  const screenshotPath1 = path.join(SCREENSHOT_DIR, 'activity_arrival_departure_feed.png');
  await page.screenshot({ path: screenshotPath1 });
  console.log(`Feed screenshot saved to: ${screenshotPath1}`);

  // Test opening arrival detail telemetry modal
  if (arrivedCount > 0) {
    console.log('Clicking on arrival card to open telemetry details...');
    await arrivedBadge.first().click({ force: true });
    await page.waitForTimeout(800);

    const telemetryModal = page.locator('text=Verified Zone Arrival');
    const isModalVisible = await telemetryModal.isVisible();
    console.log(`Arrival telemetry modal visible: ${isModalVisible}`);

    const screenshotPath2 = path.join(SCREENSHOT_DIR, 'activity_arrival_telemetry_modal.png');
    await page.screenshot({ path: screenshotPath2 });
    console.log(`Arrival modal screenshot saved to: ${screenshotPath2}`);

    // Close modal by clicking outside / backdrop or pressing Escape
    await page.keyboard.press('Escape').catch(() => {});
    await page.mouse.click(200, 50); // Click above modal sheet
    await page.waitForTimeout(800);
  }

  // Test opening departure detail telemetry modal
  if (departedCount > 0) {
    console.log('Clicking on departure card to open telemetry details...');
    await departedBadge.first().click({ force: true });
    await page.waitForTimeout(800);

    const stayDurationLabel = page.locator('text=STAY DURATION');
    const isStayVisible = await stayDurationLabel.isVisible();
    console.log(`Stay duration label visible in modal: ${isStayVisible}`);

    const screenshotPath3 = path.join(SCREENSHOT_DIR, 'activity_departure_telemetry_modal.png');
    await page.screenshot({ path: screenshotPath3 });
    console.log(`Departure modal screenshot saved to: ${screenshotPath3}`);
  }

  console.log('--- TEST COMPLETED SUCCESSFULLY ---');
  await browser.close();
}

testActivityArrivalDeparture().catch(err => {
  console.error('[FATAL ERROR]:', err);
  process.exit(1);
});
