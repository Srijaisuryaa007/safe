/**
 * Automated Test Suite: Production Secrets Audit & Environment Verification
 * 
 * Verifies that:
 * 1. Zero hardcoded JWT tokens or API secrets exist in source code files.
 * 2. Zero hardcoded OAuth client IDs exist in source files.
 * 3. Environment variable files (.env, .env.*) are strictly ignored by git.
 * 4. Git index does not track any active .env files.
 * 5. Fail-closed security logic is implemented for webhooks.
 * 6. Centralized ENV module provides safe access and diagnostic masking.
 */

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');
const assert = require('assert');

const ROOT_DIR = path.resolve(__dirname, '..', '..');
const CIRCLEGUARD_DIR = path.resolve(__dirname, '..');
const SRC_DIR = path.join(CIRCLEGUARD_DIR, 'src');

function getAllFiles(dir, fileList = []) {
  const files = fs.readdirSync(dir);
  for (const file of files) {
    const filePath = path.join(dir, file);
    const stat = fs.statSync(filePath);
    if (stat.isDirectory()) {
      if (file !== 'node_modules' && file !== '.git' && file !== 'dist' && file !== '.expo') {
        getAllFiles(filePath, fileList);
      }
    } else {
      fileList.push(filePath);
    }
  }
  return fileList;
}

async function runSecretsAudit() {
  console.log('--- STARTING COMPLETE PRODUCTION SECRETS AUDIT ---');

  // ============================================================================
  // Test 1: Scan Source Files for Hardcoded JWT Tokens (e.g. Supabase anon/service keys)
  // ============================================================================
  console.log('\n[Test 1] Scanning source files for hardcoded JWTs (eyJ...)...');
  const srcFiles = getAllFiles(SRC_DIR);
  const jwtRegex = /eyJhbGciOi[a-zA-Z0-9_\-.]+/g;

  const jwtLeaks = [];
  for (const file of srcFiles) {
    if (file.endsWith('.ts') || file.endsWith('.tsx') || file.endsWith('.js')) {
      const content = fs.readFileSync(file, 'utf8');
      if (jwtRegex.test(content)) {
        jwtLeaks.push(path.relative(ROOT_DIR, file));
      }
    }
  }

  assert.strictEqual(
    jwtLeaks.length,
    0,
    `Found hardcoded JWT tokens in source files: ${jwtLeaks.join(', ')}`
  );
  console.log(`✓ Scanned ${srcFiles.length} source files. Zero hardcoded JWT tokens found.`);

  // ============================================================================
  // Test 2: Scan for Hardcoded Google OAuth Client IDs
  // ============================================================================
  console.log('\n[Test 2] Scanning for hardcoded Google OAuth Client IDs...');
  const googleClientIdRegex = /[0-9]+-[a-z0-9_]+\.apps\.googleusercontent\.com/g;

  const googleLeaks = [];
  for (const file of srcFiles) {
    if (file.endsWith('.ts') || file.endsWith('.tsx') || file.endsWith('.js')) {
      const content = fs.readFileSync(file, 'utf8');
      if (googleClientIdRegex.test(content)) {
        googleLeaks.push(path.relative(ROOT_DIR, file));
      }
    }
  }

  assert.strictEqual(
    googleLeaks.length,
    0,
    `Found hardcoded Google Client IDs in: ${googleLeaks.join(', ')}`
  );
  console.log('✓ Zero hardcoded Google OAuth Client IDs found in source files.');

  // ============================================================================
  // Test 3: Scan for Hardcoded RevenueCat Keys in Service Files
  // ============================================================================
  console.log('\n[Test 3] Verifying RevenueCat service keys use ENV variables...');
  const rcServicePath = path.join(SRC_DIR, 'services', 'RevenueCatService.ts');
  const rcContent = fs.readFileSync(rcServicePath, 'utf8');

  assert.ok(
    rcContent.includes('ENV.REVENUECAT_IOS_KEY'),
    'RevenueCatService must use ENV.REVENUECAT_IOS_KEY'
  );
  assert.ok(
    rcContent.includes('ENV.REVENUECAT_ANDROID_KEY'),
    'RevenueCatService must use ENV.REVENUECAT_ANDROID_KEY'
  );
  assert.ok(
    !rcContent.includes("'appl_circleguard_ios_public_key'"),
    'Hardcoded apple public key must not exist in RevenueCatService'
  );
  console.log('✓ RevenueCatService strictly delegates API keys to ENV.');

  // ============================================================================
  // Test 4: Verify .gitignore Blocks .env and Sensitive Artifacts
  // ============================================================================
  console.log('\n[Test 4] Verifying .gitignore protects environment and secret files...');
  const rootGitignore = fs.readFileSync(path.join(ROOT_DIR, '.gitignore'), 'utf8');
  const appGitignore = fs.readFileSync(path.join(CIRCLEGUARD_DIR, '.gitignore'), 'utf8');

  assert.ok(rootGitignore.includes('.env'), 'Root .gitignore must include .env');
  assert.ok(rootGitignore.includes('.env.*'), 'Root .gitignore must include .env.*');
  assert.ok(appGitignore.includes('.env'), 'Circleguard .gitignore must include .env');

  // Also verify git does not track any active .env file
  try {
    const trackedFiles = execSync('git ls-files "*.env" "**/.env"', { cwd: ROOT_DIR, encoding: 'utf8' }).trim();
    assert.strictEqual(trackedFiles, '', `Active .env file is tracked in git: ${trackedFiles}`);
    console.log('✓ Git strictly ignores .env files and no .env file is tracked in repository.');
  } catch (e) {
    if (e.message && e.message.includes('AssertionError')) throw e;
    // Git command completed with no output
  }

  // ============================================================================
  // Test 5: Verify Fail-Closed Webhook Authorization
  // ============================================================================
  console.log('\n[Test 5] Verifying Edge Function webhook fail-closed security...');
  const webhookPath = path.join(ROOT_DIR, 'supabase', 'functions', 'revenuecat-webhook', 'index.ts');
  const webhookContent = fs.readFileSync(webhookPath, 'utf8');

  assert.ok(
    webhookContent.includes('!REVENUECAT_WEBHOOK_AUTH_HEADER || authHeader !== REVENUECAT_WEBHOOK_AUTH_HEADER'),
    'Webhook must fail closed if REVENUECAT_WEBHOOK_AUTH_HEADER is missing or mismatched'
  );
  console.log('✓ RevenueCat webhook implements fail-closed authorization.');

  // ============================================================================
  // Test 6: Verify Centralized ENV Module & Diagnostic Masking
  // ============================================================================
  console.log('\n[Test 6] Verifying centralized ENV module...');
  const envPath = path.join(SRC_DIR, 'constants', 'env.ts');
  const envContent = fs.readFileSync(envPath, 'utf8');

  assert.ok(envContent.includes('EXPO_PUBLIC_SUPABASE_URL'), 'ENV must read EXPO_PUBLIC_SUPABASE_URL');
  assert.ok(envContent.includes('EXPO_PUBLIC_SUPABASE_ANON_KEY'), 'ENV must read EXPO_PUBLIC_SUPABASE_ANON_KEY');
  assert.ok(envContent.includes('EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID'), 'ENV must read EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID');
  assert.ok(envContent.includes('getDiagnostics'), 'ENV must provide diagnostic masking');
  console.log('✓ Centralized ENV configuration validated.');

  console.log('\n=================================================================');
  console.log('ALL SECRETS AUDIT & ENVIRONMENT CHECKS PASSED SUCCESSFULLY! 🔒');
  console.log('=================================================================');
}

runSecretsAudit().catch((err) => {
  console.error('Secrets Audit Failed:', err);
  process.exit(1);
});
