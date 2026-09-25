const { chromium } = require('playwright');

(async () => {
  console.log('--- VERIFYING LIVE MAP FIX IN CIRCLGUARD ---');
  const browser = await chromium.launch({
    channel: 'chrome',
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox']
  });

  const context = await browser.newContext({
    viewport: { width: 390, height: 844 },
    deviceScaleFactor: 2,
    hasTouch: true,
    geolocation: { latitude: 13.0827, longitude: 80.2707 },
    permissions: ['geolocation'],
  });

  const page = await context.newPage();
  page.on('console', msg => {
    if (msg.text().includes('GPS') || msg.text().includes('Map') || msg.text().includes('Error')) {
      console.log('APP LOG:', msg.text());
    }
  });

  console.log('Opening http://127.0.0.1:8081...');
  await page.goto('http://127.0.0.1:8081', { waitUntil: 'commit', timeout: 35000 });
  await page.waitForSelector('text=SIGN IN', { timeout: 35000 });

  console.log('Setting mock auth & circle...');
  await page.evaluate(() => {
    const SELF_ID = '03ca6af3-b0f7-46a1-9e70-2bb96befb67c';
    const CIRCLE_ID = 'af00325e-7e26-4b5d-856d-907085b326d2';

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

    window.__useAuthStore.getState().setSession({ access_token: 'mock-token', user: { id: SELF_ID } });
    window.__useAuthStore.getState().setProfile(mockProfile);
    window.__useAuthStore.getState().setProfileFetching(false);
    window.__useAuthStore.getState().setLoading(false);

    if (window.__useCircleStore) {
      window.__useCircleStore.getState().setActiveCircle({
        id: CIRCLE_ID,
        name: 'Test Family',
        invite_code: 'HK3GJB',
        owner_id: SELF_ID,
        created_at: new Date().toISOString(),
      });
      window.__useCircleStore.getState().setMembers([
        {
          circle_id: CIRCLE_ID,
          user_id: SELF_ID,
          role: 'owner',
          isOnline: true,
          latitude: 13.0827,
          longitude: 80.2707,
          profile: mockProfile
        },
        {
          circle_id: CIRCLE_ID,
          user_id: 'member-2',
          role: 'member',
          isOnline: true,
          latitude: 13.0845,
          longitude: 80.2720,
          profile: {
            id: 'member-2',
            full_name: 'Priya',
            phone: '+919876543210'
          }
        }
      ]);
    }
  });

  await page.waitForTimeout(1500);

  console.log('Navigating to Map tab...');
  const mapBtn = await page.locator('text=Map');
  if (await mapBtn.count() > 0) {
    await mapBtn.first().click();
    console.log('Clicked Map tab');
  }

  await page.waitForTimeout(2000);

  // Dismiss permission modal if present
  const okBtn = await page.locator('text=OK');
  if (await okBtn.count() > 0) {
    await okBtn.first().click();
    console.log('Dismissed permission modal');
    await page.waitForTimeout(1500);
  }

  // Inspect map iframe
  const mapReport = await page.evaluate(() => {
    const iframe = document.getElementById('mapScreenIframe');
    if (!iframe) return { found: false, error: 'mapScreenIframe element not found' };
    const win = iframe.contentWindow;
    const doc = iframe.contentDocument;
    if (!win) return { found: true, error: 'iframe contentWindow not accessible' };

    const isLeafletMap = !!(win.map && typeof win.map.setView === 'function');
    const images = Array.from(doc ? doc.getElementsByTagName('img') : []);
    const tileImages = images.filter(img => img.src && (img.src.includes('tile.openstreetmap') || img.src.includes('arcgisonline') || img.src.includes('leaflet')));

    return {
      found: true,
      hasL: typeof win.L,
      isLeafletMap: isLeafletMap,
      center: isLeafletMap ? win.map.getCenter() : null,
      zoom: isLeafletMap ? win.map.getZoom() : null,
      mapSize: isLeafletMap ? win.map.getSize() : null,
      totalImagesCount: images.length,
      tileImagesCount: tileImages.length,
      tileSampleSources: tileImages.slice(0, 3).map(i => i.src),
      hasUpdateMapData: typeof win.updateMapData,
      selfMarker: !!win.selfMarker,
      memberMarkersCount: win.memberMarkers ? Object.keys(win.memberMarkers).length : 0
    };
  });

  console.log('Map Report:', JSON.stringify(mapReport, null, 2));

  await page.screenshot({ path: 'tests/verify_map_fix_live.png' });
  console.log('Screenshot saved to tests/verify_map_fix_live.png');

  await browser.close();
})().catch(e => {
  console.error('Test error:', e);
  process.exit(1);
});
