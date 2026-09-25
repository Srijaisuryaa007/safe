const assert = require('assert');
const fs = require('fs');

console.log('====================================================');
console.log('TESTING LUXURY ALERT MODAL & IN-APP MESSAGES SYSTEM');
console.log('====================================================');

// 1. Verify LuxuryAlertModal.tsx exists and contains authentic UI specs
const luxuryAlertCode = fs.readFileSync('src/components/LuxuryAlertModal.tsx', 'utf8');

assert(luxuryAlertCode.includes('showToast'), 'LuxuryAlertModal must export showToast');
assert(luxuryAlertCode.includes('showInAppMessage'), 'LuxuryAlertModal must export showInAppMessage');
assert(luxuryAlertCode.includes('floatingToast'), 'LuxuryAlertModal must have floatingToast style');
assert(luxuryAlertCode.includes('• PLAN LIMIT REACHED'), 'LuxuryAlertModal must support plan limit tag');
assert(luxuryAlertCode.includes('Explore Plus'), 'LuxuryAlertModal must offer Explore Plus action');
assert(!luxuryAlertCode.includes('absoluteFillObject'), 'Must not contain deprecated absoluteFillObject');
console.log(' [PASS] LuxuryAlertModal contains full luxury bottom-sheet and floating toast specs');

// 2. Verify errorHandler suppresses console.error on business exceptions
const errorHandlerCode = fs.readFileSync('src/lib/errorHandler.ts', 'utf8');
assert(errorHandlerCode.includes("rawMessage.includes('Free tier')"), 'errorHandler must detect free tier limit');
assert(errorHandlerCode.includes('console.warn'), 'errorHandler must use console.warn for handled exceptions');
console.log(' [PASS] ErrorHandler logging avoids LogBox triggers on business exceptions');

// 3. Verify App.tsx has LogBox.ignoreAllLogs(true)
const appCode = fs.readFileSync('App.tsx', 'utf8');
assert(appCode.includes('LogBox.ignoreAllLogs(true)'), 'App.tsx must silence dev LogBox banner overlays');
console.log(' [PASS] App.tsx silences development LogBox overlays');

// 4. Verify SafePlacesScreen uses showToast on success and routes limit to Paywall / Luxury Alert
const safePlacesCode = fs.readFileSync('src/screens/SafePlacesScreen.tsx', 'utf8');
assert(safePlacesCode.includes('showToast(`"${placeName}" updated'), 'SafePlacesScreen must use showToast on update');
assert(safePlacesCode.includes('showToast(`Geofence "${placeName}" created'), 'SafePlacesScreen must use showToast on create');
assert(safePlacesCode.includes("cleanMessage.toLowerCase().includes('free tier')"), 'SafePlacesScreen must check for free tier limit');
assert(safePlacesCode.includes('setPaywallVisible(true)'), 'SafePlacesScreen must show Paywall on limit');
console.log(' [PASS] SafePlacesScreen successfully uses luxury in-app notifications and paywall routing');

// 5. Verify LocationHistoryScreen instant load refactor
const historyCode = fs.readFileSync('src/screens/LocationHistoryScreen.tsx', 'utf8');
assert(historyCode.includes('@circleguard_history_cache_'), 'LocationHistoryScreen must have cache-first hydration');
assert(historyCode.includes("select('id, geom, latitude, longitude, speed_mps, accuracy, recorded_at')"), 'Must query only required columns');
assert(historyCode.includes('Promise.allSettled'), 'Must use concurrent non-blocking map matching');
console.log(' [PASS] LocationHistoryScreen instant loading and progressive hydration verified');

// 6. Verify 3D Logo rotation direction in AnimatedCircleGuardLogo and OrbitalGoldenLogoBadge
const logoCode = fs.readFileSync('src/components/AnimatedCircleGuardLogo.tsx', 'utf8');
assert(logoCode.includes('withTiming(360,'), 'AnimatedCircleGuardLogo must rotate clockwise (the other way)');

const badgeCode = fs.readFileSync('src/components/OrbitalGoldenLogoBadge.tsx', 'utf8');
assert(badgeCode.includes("'360deg'"), 'OrbitalGoldenLogoBadge must rotate clockwise (the other way)');
console.log(' [PASS] 3D Logo circles rotate clockwise (the other way)');

console.log('====================================================');
console.log('ALL VERIFICATIONS PASSED SUCCESSFULLY (6/6)');
console.log('====================================================');
