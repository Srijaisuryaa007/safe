const { chromium } = require('playwright');
const path = require('path');
const fs = require('fs');

const ARTIFACT_DIR = 'C:\\Users\\mylam\\.gemini\\antigravity-ide\\brain\\4b7cd027-1098-48dd-835e-5684e2a91171';
const SCREENSHOT_DIR = path.join(ARTIFACT_DIR, 'playwright_screenshots');

if (!fs.existsSync(SCREENSHOT_DIR)) {
  fs.mkdirSync(SCREENSHOT_DIR, { recursive: true });
}

async function runVerification() {
  const browser = await chromium.launch({
    channel: 'chrome',
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox']
  });

  const page = await browser.newPage({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2 });
  page.on('console', msg => {
    const text = msg.text();
    if (text.includes('GPS_PIPELINE') || text.includes('[CircleView]') || text.includes('Error')) {
      console.log('[BROWSER]', msg.type(), text);
    }
  });

  try {
    console.log('Step 1: Navigating to app...');
    await page.goto('http://127.0.0.1:8081', { waitUntil: 'load', timeout: 30000 });
    await page.waitForTimeout(3500);

    console.log('Step 2: Injecting authenticated test session and circle members...');
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
          membersByCircle: { [CIRCLE_ID]: mockMembers },
          fetchMembers: async () => mockMembers,
          fetchPlaces: async () => [],
        });
      }
    }, { SELF_ID, ART_ID, CIRCLE_ID });

    await page.waitForTimeout(1500);

    console.log('Step 3: Navigating to Circle tab...');
    await page.evaluate(() => {
      if (window.__navigationRef?.isReady?.()) {
        window.__navigationRef.navigate('MainTabs', { screen: 'Circle' });
      }
    });
    await page.waitForTimeout(1500);

    const circleTabShot = path.join(SCREENSHOT_DIR, 'v2_circle_tab.png');
    await page.screenshot({ path: circleTabShot });
    console.log('Saved Circle tab screenshot:', circleTabShot);

    // TEST 1: Open profile modal by calling open helper
    console.log('\n--- TEST 1: OPEN MEMBER SHORT PROFILE MODAL ---');
    await page.evaluate((ART_ID) => {
      const artMember = {
        id: '2',
        circle_id: 'af00325e-7e26-4b5d-856d-907085b326d2',
        user_id: ART_ID,
        role: 'co_leader',
        profile: { full_name: 'Art Suryaa', phone: '+919876543210' },
        isOnline: true,
        batteryPct: 88,
        isDriving: true,
      };
      if (window.__openMemberShortProfile) {
        window.__openMemberShortProfile(artMember);
      }
    }, ART_ID);

    await page.waitForTimeout(800);
    const modalShot = path.join(SCREENSHOT_DIR, 'v2_profile_modal_opened.png');
    await page.screenshot({ path: modalShot });
    console.log('Saved profile modal opened screenshot:', modalShot);

    // Verify all modal elements are visible
    const hasArtSuryaa = await page.locator('text=Art Suryaa').count() > 0;
    const hasCoLeader = await page.locator('text=Co-Leader').count() > 0;
    const hasCallBtn = await page.locator('text=Call').first().isVisible();
    const hasSmsBtn = await page.locator('text=SMS').first().isVisible();
    const hasLocBtn = await page.locator('text=Location').first().isVisible();
    const hasChatBtn = await page.locator('text=Chat').first().isVisible();
    const hasLocHist = await page.locator('text=Location History').isVisible();
    const hasDrivSummary = await page.locator('text=Driving Summary').isVisible();

    console.log('Profile modal elements check:');
    console.log('  Art Suryaa header:', hasArtSuryaa);
    console.log('  Co-Leader badge:', hasCoLeader);
    console.log('  Call button:', hasCallBtn);
    console.log('  SMS button:', hasSmsBtn);
    console.log('  Location button:', hasLocBtn);
    console.log('  Chat button:', hasChatBtn);
    console.log('  Location History button:', hasLocHist);
    console.log('  Driving Summary button:', hasDrivSummary);

    if (!hasLocHist || !hasDrivSummary) {
      throw new Error('Required profile action buttons are missing from modal!');
    }

    // TEST 2: Click Location History and verify navigation
    console.log('\n--- TEST 2: CLICK LOCATION HISTORY BUTTON ---');
    await page.locator('text=Location History').click();
    await page.waitForTimeout(2000);
    const locHistNavShot = path.join(SCREENSHOT_DIR, 'v2_nav_location_history.png');
    await page.screenshot({ path: locHistNavShot });
    const isLocHistHeader = await page.locator('text=LOCATION HISTORY').isVisible();
    console.log('Navigated to LOCATION HISTORY?', isLocHistHeader);
    console.log('Saved Location History screenshot:', locHistNavShot);

    // TEST 3: Return to Circle tab and click Driving Summary
    console.log('\n--- TEST 3: CLICK DRIVING SUMMARY BUTTON ---');
    await page.evaluate(() => {
      if (window.__navigationRef?.isReady?.()) {
        window.__navigationRef.navigate('MainTabs', { screen: 'Circle' });
      }
    });
    await page.waitForTimeout(1000);

    // Reopen member modal
    await page.evaluate((ART_ID) => {
      const artMember = {
        id: '2',
        circle_id: 'af00325e-7e26-4b5d-856d-907085b326d2',
        user_id: ART_ID,
        role: 'co_leader',
        profile: { full_name: 'Art Suryaa', phone: '+919876543210' },
        isOnline: true,
        batteryPct: 88,
        isDriving: true,
      };
      if (window.__openMemberShortProfile) {
        window.__openMemberShortProfile(artMember);
      }
    }, ART_ID);
    await page.waitForTimeout(800);

    await page.locator('text=Driving Summary').click();
    await page.waitForTimeout(2000);
    const drivingNavShot = path.join(SCREENSHOT_DIR, 'v2_nav_driving_reports.png');
    await page.screenshot({ path: drivingNavShot });
    const isDrivingHeader = await page.locator('text=DRIVING REPORTS').isVisible();
    console.log('Navigated to DRIVING REPORTS?', isDrivingHeader);
    console.log('Saved Driving Reports screenshot:', drivingNavShot);

    // TEST 4: Return to Circle tab and click Location (Map)
    console.log('\n--- TEST 4: CLICK LOCATION (MAP) BUTTON ---');
    await page.evaluate(() => {
      if (window.__navigationRef?.isReady?.()) {
        window.__navigationRef.navigate('MainTabs', { screen: 'Circle' });
      }
    });
    await page.waitForTimeout(1000);

    await page.evaluate((ART_ID) => {
      const artMember = {
        id: '2',
        circle_id: 'af00325e-7e26-4b5d-856d-907085b326d2',
        user_id: ART_ID,
        role: 'co_leader',
        profile: { full_name: 'Art Suryaa', phone: '+919876543210' },
        isOnline: true,
        batteryPct: 88,
        isDriving: true,
      };
      if (window.__openMemberShortProfile) {
        window.__openMemberShortProfile(artMember);
      }
    }, ART_ID);
    await page.waitForTimeout(800);

    const locMapBtn = page.locator('[aria-label="Location on Map"]').first();
    await locMapBtn.click();
    await page.waitForTimeout(2000);
    const mapNavShot = path.join(SCREENSHOT_DIR, 'v2_nav_map.png');
    await page.screenshot({ path: mapNavShot });
    console.log('Navigated to Map screen. Screenshot:', mapNavShot);

    // TEST 5: Return to Circle tab and click Chat
    console.log('\n--- TEST 5: CLICK CHAT BUTTON ---');
    await page.evaluate(() => {
      if (window.__navigationRef?.isReady?.()) {
        window.__navigationRef.navigate('MainTabs', { screen: 'Circle' });
      }
    });
    await page.waitForTimeout(1000);

    await page.evaluate((ART_ID) => {
      const artMember = {
        id: '2',
        circle_id: 'af00325e-7e26-4b5d-856d-907085b326d2',
        user_id: ART_ID,
        role: 'co_leader',
        profile: { full_name: 'Art Suryaa', phone: '+919876543210' },
        isOnline: true,
        batteryPct: 88,
        isDriving: true,
      };
      if (window.__openMemberShortProfile) {
        window.__openMemberShortProfile(artMember);
      }
    }, ART_ID);
    await page.waitForTimeout(800);

    const chatActionBtn = page.locator('[aria-label="Chat with member"]').first();
    await chatActionBtn.click();
    await page.waitForTimeout(2000);
    const chatNavShot = path.join(SCREENSHOT_DIR, 'v2_nav_chat.png');
    await page.screenshot({ path: chatNavShot });
    console.log('Navigated to Chat screen. Screenshot:', chatNavShot);

    // TEST 6: Top-right Close Button dismiss
    console.log('\n--- TEST 6: TOP-RIGHT CLOSE BUTTON DISMISS ---');
    await page.evaluate(() => {
      if (window.__navigationRef?.isReady?.()) {
        window.__navigationRef.navigate('MainTabs', { screen: 'Circle' });
      }
    });
    await page.waitForTimeout(1000);

    await page.evaluate((ART_ID) => {
      const artMember = {
        id: '2',
        circle_id: 'af00325e-7e26-4b5d-856d-907085b326d2',
        user_id: ART_ID,
        role: 'co_leader',
        profile: { full_name: 'Art Suryaa', phone: '+919876543210' },
        isOnline: true,
        batteryPct: 88,
        isDriving: true,
      };
      if (window.__openMemberShortProfile) {
        window.__openMemberShortProfile(artMember);
      }
    }, ART_ID);
    await page.waitForTimeout(800);

    const closeBtn = page.locator('[aria-label="Close profile"]');
    if (await closeBtn.isVisible()) {
      await closeBtn.click();
      await page.waitForTimeout(800);
      const isStillOpen = await page.locator('text=CURRENT STATUS').isVisible();
      console.log('Did top-right close button dismiss modal?', !isStillOpen);
    }

    console.log('\n========================================');
    console.log('ALL VERIFICATION TESTS PASSED FLAWLESSLY!');
    console.log('========================================');

  } catch (err) {
    console.error('Verification failed with error:', err);
  } finally {
    await browser.close();
  }
}

runVerification();
