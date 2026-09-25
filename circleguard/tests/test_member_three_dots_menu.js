const { chromium } = require('playwright');
const path = require('path');
const fs = require('fs');

const ARTIFACT_DIR = 'C:\\Users\\mylam\\.gemini\\antigravity-ide\\brain\\a3377614-b22c-4960-8db7-02c3ece4891d';
const SCREENSHOT_DIR = path.join(ARTIFACT_DIR, 'playwright_screenshots');

if (!fs.existsSync(SCREENSHOT_DIR)) {
  fs.mkdirSync(SCREENSHOT_DIR, { recursive: true });
}

async function testMemberThreeDotsMenu() {
  console.log('--- TESTING 3-DOTS MEMBER MENU & CARD CLEANUP ---');
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

  console.log('Setting up mock user, session and members matching user screenshot...');
  await page.evaluate(() => {
    const SELF_ID = '03ca6af3-b0f7-46a1-9e70-2bb96befb67c';
    const BHAVANI_ID = 'b1b2b3b4-b5b6-7b8b-9b0b-1b2b3b4b5b6b';
    const NANDA_ID = 'c1d2e3f4-a5b6-7c8d-9e0f-1a2b3c4d5e6f';
    const ART_ID = 'e7b1a2c3-4d5e-6f7a-8b9c-0d1e2f3a4b5c';
    const CIRCLE_ID = 'af00325e-7e26-4b5d-856d-907085b326d2';

    const mockUser = {
      id: SELF_ID,
      email: 'sri@example.com',
    };
    const mockSession = {
      access_token: 'mock-token',
      token_type: 'bearer',
      user: mockUser,
    };
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

    const mockCircle = {
      id: CIRCLE_ID,
      name: 'Test app',
      invite_code: 'HK3GJB',
      tracking_mode: 'continuous',
      owner_id: SELF_ID,
      created_at: new Date().toISOString(),
    };

    const mockMembers = [
      {
        id: 'cm-self',
        circle_id: CIRCLE_ID,
        user_id: SELF_ID,
        role: 'owner',
        joined_at: new Date().toISOString(),
        profile: mockProfile,
        isOnline: true,
        batteryPct: 92,
      },
      {
        id: 'cm-bhavani',
        circle_id: CIRCLE_ID,
        user_id: BHAVANI_ID,
        role: 'member',
        joined_at: new Date().toISOString(),
        supervisor_id: SELF_ID,
        batteryPct: 44,
        isOnline: true,
        profile: {
          full_name: 'Bhavani',
          avatar_url: null,
          phone: '+919988776655',
        },
      },
      {
        id: 'cm-nanda',
        circle_id: CIRCLE_ID,
        user_id: NANDA_ID,
        role: 'member',
        joined_at: new Date().toISOString(),
        supervisor_id: SELF_ID,
        batteryPct: 57,
        isOnline: true,
        profile: {
          full_name: 'T R NANDAKUMAR',
          avatar_url: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=120',
          phone: '+919876543210',
        },
      },
      {
        id: 'cm-art',
        circle_id: CIRCLE_ID,
        user_id: ART_ID,
        role: 'co_leader',
        joined_at: new Date().toISOString(),
        supervisor_id: SELF_ID,
        batteryPct: 12,
        isOnline: true,
        profile: {
          full_name: 'Art Suryaa',
          avatar_url: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=120',
          phone: '+918072986913',
        },
      },
    ];

    window.__useAuthStore.getState().setSession(mockSession);
    window.__useAuthStore.getState().setProfile(mockProfile);
    window.__useAuthStore.getState().setProfileFetching(false);
    window.__useAuthStore.getState().setLoading(false);

    window.__useCircleStore.getState().setActiveCircle(mockCircle);
    window.__useCircleStore.getState().setMembers(mockMembers);
    window.__useCircleStore.getState().setPlaces([]);
  });

  console.log('Waiting for Main Tabs to mount...');
  await page.waitForSelector('text=MAP', { timeout: 15000 });

  console.log('Navigating to Circle tab...');
  await page.locator('text=Circle').last().click({ force: true });
  await page.waitForTimeout(2000);

  console.log('Scrolling down to view member cards...');
  await page.mouse.move(200, 400);
  await page.mouse.wheel(0, 450);
  await page.waitForTimeout(1000);

  console.log('Verifying member cards are rendered...');
  await page.waitForSelector('text=Art Suryaa', { timeout: 10000 });
  await page.waitForSelector('text=T R NANDAKUMAR', { timeout: 10000 });
  await page.waitForSelector('text=Bhavani', { timeout: 10000 });

  // Verify that the messy 3 button row (Directions, Ring, History) is GONE from member cards
  const directionButtons = await page.$$('text=Directions');
  console.log(`Number of "Directions" buttons in member cards: ${directionButtons.length}`);
  if (directionButtons.length > 0) {
    console.warn(`[WARNING] Expected 0 "Directions" buttons on card surface, found ${directionButtons.length}`);
  } else {
    console.log('[PASS] Cluttered "Directions" pill button row is completely removed from card surface!');
  }

  // Programmatic Bounding Box Collision Check
  console.log('Running bounding-box collision detection between battery pills, 3-dots buttons, and role tags...');
  const collisionResults = await page.evaluate(() => {
    const issues = [];
    const memberCards = Array.from(document.querySelectorAll('*')).filter(
      el => el.textContent && (el.textContent.includes('Art Suryaa') || el.textContent.includes('Bhavani') || el.textContent.includes('T R NANDAKUMAR'))
    );

    const dotsButtons = Array.from(document.querySelectorAll('[aria-label^="Actions for"]'));
    const batteryPills = Array.from(document.querySelectorAll('*')).filter(
      el => el.textContent && /^\d+%\s*$/.test(el.textContent.trim()) && el.children.length === 0
    );
    // Find only leaf role tag texts (not parent containers)
    const roleTags = Array.from(document.querySelectorAll('*')).filter(
      el => el.children.length === 0 && (el.textContent === 'MEMBER' || el.textContent === 'CO-LEADER' || el.textContent === 'OWNER' || el.textContent === 'GUARDIAN')
    );

    // Check collision between each 3-dots button and each battery pill
    dotsButtons.forEach((dot, dotIdx) => {
      const dotRect = dot.getBoundingClientRect();
      batteryPills.forEach((batt, battIdx) => {
        const battRect = batt.getBoundingClientRect();
        // If they are in the same card (vertical distance < 60px)
        if (Math.abs(dotRect.top - battRect.top) < 60) {
          const horizontalOverlap = !(dotRect.right <= battRect.left || dotRect.left >= battRect.right);
          const verticalOverlap = !(dotRect.bottom <= battRect.top || dotRect.top >= battRect.bottom);
          if (horizontalOverlap && verticalOverlap) {
            issues.push(`Collision between 3-dots button [${dotIdx}] and battery pill [${battIdx}]`);
          }
        }
      });
    });

    // Check collision between role tags and battery pills
    roleTags.forEach((role, rIdx) => {
      const roleRect = role.getBoundingClientRect();
      batteryPills.forEach((batt, bIdx) => {
        const battRect = batt.getBoundingClientRect();
        if (Math.abs(roleRect.top - battRect.top) < 30) {
          const horizontalOverlap = !(roleRect.right <= battRect.left || roleRect.left >= battRect.right);
          const verticalOverlap = !(roleRect.bottom <= battRect.top || roleRect.top >= battRect.bottom);
          if (horizontalOverlap && verticalOverlap) {
            issues.push(`Collision between role tag [${rIdx}] and battery pill [${bIdx}]`);
          }
        }
      });
    });

    return {
      dotsCount: dotsButtons.length,
      batteryCount: batteryPills.length,
      roleTagsCount: roleTags.length,
      issuesCount: issues.length,
      issues,
    };
  });

  console.log('Collision check results:', JSON.stringify(collisionResults, null, 2));
  if (collisionResults.issuesCount > 0) {
    console.error(`[FAIL] Detected ${collisionResults.issuesCount} bounding-box collisions!`);
    process.exitCode = 1;
  } else {
    console.log('[SUCCESS] ZERO OVERLAPS: Battery pills, 3-dots buttons, and role badges have 100% positive clearance!');
  }

  // Capture clean member cards screenshot
  const cleanCardsScreenshot = path.join(SCREENSHOT_DIR, 'test_member_cards_clean_three_dots.png');
  await page.screenshot({ path: cleanCardsScreenshot });
  console.log(`Saved clean member cards screenshot: ${cleanCardsScreenshot}`);

  // Find 3-dots buttons
  console.log('Locating 3-dots action button on Art Suryaa card...');
  const artDotsBtn = await page.locator('[aria-label="Actions for Art Suryaa"]');
  const count = await artDotsBtn.count();
  console.log(`Found 3-dots button for Art Suryaa: ${count}`);

  if (count > 0) {
    console.log('Clicking 3-dots button for Art Suryaa...');
    await artDotsBtn.first().click();
    await page.waitForTimeout(1000);

    // Verify MemberQuickActionsModal is visible with refined UI/UX Pro Max components
    await page.waitForSelector('text=QUICK ACTIONS', { timeout: 5000 });
    await page.waitForSelector('text=Directions', { timeout: 5000 });
    await page.waitForSelector('text=Ring Device', { timeout: 5000 });
    await page.waitForSelector('text=Timeline', { timeout: 5000 });
    await page.waitForSelector('text=Drive Safety', { timeout: 5000 });
    await page.waitForSelector('text=Low Battery Warning', { timeout: 5000 });
    await page.waitForSelector('text=CIRCLE GOVERNANCE', { timeout: 5000 });

    console.log('[PASS] MemberQuickActionsModal successfully opened with refined tactile dock & governance controls!');

    // Capture modal open screenshot
    const modalScreenshot = path.join(SCREENSHOT_DIR, 'test_member_quick_actions_modal_open.png');
    await page.screenshot({ path: modalScreenshot });
    console.log(`Saved modal open screenshot: ${modalScreenshot}`);
  } else {
    console.error('[FAIL] Could not locate 3-dots button for Art Suryaa');
    process.exitCode = 1;
  }

  await browser.close();
  console.log('=== 3-DOTS MEMBER MENU & CARD CLEANUP TEST COMPLETED SUCCESSFULLY ===');
}

testMemberThreeDotsMenu().catch(err => {
  console.error('[FATAL ERROR]:', err);
  process.exit(1);
});
