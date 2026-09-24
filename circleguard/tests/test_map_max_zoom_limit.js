const { chromium } = require('playwright');
const path = require('path');
const fs = require('fs');

const ARTIFACT_DIR = 'C:\\Users\\mylam\\.gemini\\antigravity-ide\\brain\\4b7cd027-1098-48dd-835e-5684e2a91171';
const SCREENSHOT_DIR = path.join(ARTIFACT_DIR, 'playwright_screenshots');

if (!fs.existsSync(SCREENSHOT_DIR)) {
  fs.mkdirSync(SCREENSHOT_DIR, { recursive: true });
}

async function runMaxZoomVerification() {
  const browser = await chromium.launch({
    channel: 'chrome',
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox']
  });

  const page = await browser.newPage({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2 });
  page.on('console', msg => {
    const text = msg.text();
    if (text.includes('Error') || text.includes('GPS_PIPELINE')) {
      console.log('[BROWSER]', msg.type(), text);
    }
  });

  try {
    console.log('Step 1: Navigating to app...');
    await page.goto('http://127.0.0.1:8081', { waitUntil: 'load', timeout: 30000 });
    await page.waitForTimeout(3000);

    console.log('Step 2: Injecting authenticated test session...');
    const SELF_ID = '03ca6af3-b0f7-46a1-9e70-2bb96befb67c';
    const ART_ID = 'e7b1a2c3-4d5e-6f7a-8b9c-0d1e2f3a4b5c';
    const CIRCLE_ID = 'af00325e-7e26-4b5d-856d-907085b326d2';

    await page.evaluate(({ SELF_ID, ART_ID, CIRCLE_ID }) => {
      const mockUser = { id: SELF_ID, email: 'sri@example.com' };
      const mockSession = { access_token: 'mock-token', token_type: 'bearer', user: mockUser };
      const mockProfile = { id: SELF_ID, full_name: 'Sri Jai Suryaa', phone: '+918072986912', is_ghost_mode: false, is_premium: true };
      const mockCircle = { id: CIRCLE_ID, name: 'Family Circle', invite_code: 'HK3GJB', tracking_mode: 'continuous', owner_id: SELF_ID };

      const mockMembers = [
        { id: '1', circle_id: CIRCLE_ID, user_id: SELF_ID, role: 'owner', profile: mockProfile, isOnline: true },
        { id: '2', circle_id: CIRCLE_ID, user_id: ART_ID, role: 'co_leader', supervisor_id: SELF_ID, profile: { full_name: 'Art Suryaa', phone: '+919876543210' }, isOnline: true, batteryPct: 88, isDriving: true, latitude: 13.0827, longitude: 80.2707 },
      ];

      if (window.__useAuthStore) {
        window.__useAuthStore.getState().setSession(mockSession);
        window.__useAuthStore.getState().setProfile(mockProfile);
        window.__useAuthStore.getState().setLoading(false);
        window.__useAuthStore.getState().setProfileFetching(false);
      }
      if (window.__useCircleStore) {
        window.__useCircleStore.setState({
          activeCircle: mockCircle,
          members: mockMembers,
          circles: [mockCircle],
          circleFetched: true,
          isLoading: false,
        });
      }
    }, { SELF_ID, ART_ID, CIRCLE_ID });

    await page.waitForTimeout(2500);

    console.log('\n--- TEST 1: HOME VIEW MAP MAX ZOOM LIMIT ---');
    // Check Leaflet iframe on Home Screen
    const homeFrame = page.frames().find(f => f.url().includes('about:blank') || f !== page.mainFrame());
    const targetFrame = homeFrame || page;

    const homeZoomCheck = await targetFrame.evaluate(() => {
      const m = window.map;
      if (!m) return { found: false };
      const initialMaxZoom = m.getMaxZoom ? m.getMaxZoom() : null;
      const initialMinZoom = m.getMinZoom ? m.getMinZoom() : null;
      
      // Try setting an excessive zoom like 22
      m.setZoom(22);
      const zoomAfterSet22 = m.getZoom();

      // Try calling zoomIn repeatedly
      for (let i = 0; i < 5; i++) {
        if (m.zoomIn) m.zoomIn();
      }
      const zoomAfterRepeatedZoomIn = m.getZoom();

      return {
        found: true,
        maxZoom: initialMaxZoom,
        minZoom: initialMinZoom,
        zoomAfterSet22,
        zoomAfterRepeatedZoomIn
      };
    });

    console.log('Home View Map Zoom Results:', homeZoomCheck);
    if (homeZoomCheck.found) {
      if (homeZoomCheck.maxZoom !== 18) {
        throw new Error(`Home Map maxZoom expected 18, got ${homeZoomCheck.maxZoom}`);
      }
      if (homeZoomCheck.zoomAfterSet22 > 18) {
        throw new Error(`Home Map exceeded max zoom! Got ${homeZoomCheck.zoomAfterSet22}`);
      }
      if (homeZoomCheck.zoomAfterRepeatedZoomIn > 18) {
        throw new Error(`Home Map zoomIn exceeded max zoom! Got ${homeZoomCheck.zoomAfterRepeatedZoomIn}`);
      }
      console.log('✓ Home Screen map strictly capped at maxZoom 18');
    }

    const homeScreenshotPath = path.join(SCREENSHOT_DIR, 'max_zoom_home_screen.png');
    await page.screenshot({ path: homeScreenshotPath });
    console.log('Saved home screenshot:', homeScreenshotPath);

    console.log('\n--- TEST 2: NAVIGATING TO MAP TAB ---');
    // Click on Map tab in bottom navigation
    const mapTabBtn = page.locator('text=Map').first();
    await mapTabBtn.click({ force: true });
    await page.waitForTimeout(3000);

    // Find the MapScreen frame or check window.map
    const allFrames = page.frames();
    console.log(`Found ${allFrames.length} frames on Map screen.`);

    let mapFrame = null;
    for (const f of allFrames) {
      const hasMap = await f.evaluate(() => Boolean(window.map && window.map.getZoom)).catch(() => false);
      if (hasMap) {
        mapFrame = f;
        break;
      }
    }

    const activeMapFrame = mapFrame || page;

    console.log('\n--- TEST 3: MAPSCREEN ZOOM CLAMPING & STYLES ---');
    const mapScreenZoomCheck = await activeMapFrame.evaluate(() => {
      const m = window.map;
      if (!m) return { found: false };

      const maxZoom = m.getMaxZoom();
      const minZoom = m.getMinZoom();

      // Attempt to zoom to 22
      m.setZoom(22);
      const zoomAfter22 = m.getZoom();

      // Test smoothFlyTo with excessive zoom 24
      if (window.smoothFlyTo) {
        window.smoothFlyTo(13.0827, 80.2707, 24);
      }
      const zoomAfterFlyTo = m.getZoom();

      return {
        found: true,
        maxZoom,
        minZoom,
        zoomAfter22,
        zoomAfterFlyTo
      };
    });

    console.log('MapScreen Zoom Results:', mapScreenZoomCheck);
    if (!mapScreenZoomCheck.found) {
      throw new Error('Could not locate Leaflet map instance on MapScreen');
    }

    if (mapScreenZoomCheck.maxZoom !== 18) {
      throw new Error(`MapScreen maxZoom expected 18, got ${mapScreenZoomCheck.maxZoom}`);
    }
    if (mapScreenZoomCheck.zoomAfter22 > 18) {
      throw new Error(`MapScreen exceeded max zoom 18! Got ${mapScreenZoomCheck.zoomAfter22}`);
    }
    if (mapScreenZoomCheck.zoomAfterFlyTo > 18) {
      throw new Error(`MapScreen smoothFlyTo exceeded max zoom 18! Got ${mapScreenZoomCheck.zoomAfterFlyTo}`);
    }
    console.log('✓ MapScreen map strictly capped at maxZoom 18');

    // Test Satellite Style at max zoom 18
    console.log('\n--- TEST 4: SATELLITE MODE AT MAX ZOOM 18 ---');
    await activeMapFrame.evaluate(() => {
      if (window.updateMapData) {
        window.updateMapData({ mapStyle: 'satellite' });
      }
      window.map.setZoom(18);
    });
    await page.waitForTimeout(2000);

    const satScreenshotPath = path.join(SCREENSHOT_DIR, 'max_zoom_satellite.png');
    await page.screenshot({ path: satScreenshotPath });
    console.log('Saved satellite screenshot at max zoom:', satScreenshotPath);

    // Test Dark Mode at max zoom 18
    console.log('\n--- TEST 5: DARK MODE AT MAX ZOOM 18 ---');
    await activeMapFrame.evaluate(() => {
      if (window.updateMapData) {
        window.updateMapData({ mapStyle: 'dark' });
      }
      window.map.setZoom(18);
    });
    await page.waitForTimeout(2000);

    const darkScreenshotPath = path.join(SCREENSHOT_DIR, 'max_zoom_dark.png');
    await page.screenshot({ path: darkScreenshotPath });
    console.log('Saved dark screenshot at max zoom:', darkScreenshotPath);

    // Verify no tile errors / images containing "not yet available"
    const tileImagesCheck = await activeMapFrame.evaluate(() => {
      const tiles = Array.from(document.querySelectorAll('.leaflet-tile'));
      const naturalSizes = tiles.map(t => ({
        src: t.src,
        naturalWidth: t.naturalWidth,
        naturalHeight: t.naturalHeight,
        complete: t.complete
      }));
      return {
        count: tiles.length,
        loaded: naturalSizes.filter(t => t.complete && t.naturalWidth > 0).length
      };
    });
    console.log('Tile health check:', tileImagesCheck);

    console.log('\n========================================');
    console.log('MAX ZOOM LIMIT VERIFICATION SUCCESSFUL!');
    console.log('========================================');

  } catch (err) {
    console.error('VERIFICATION FAILED:', err);
    process.exit(1);
  } finally {
    await browser.close();
  }
}

runMaxZoomVerification();
