/**
 * CircleGuard File Upload Security Test Suite
 * 
 * Verifies:
 * 1. Binary magic byte detection for JPEG, PNG, and WebP.
 * 2. Rejection of renamed executables, server scripts, and Linux binaries.
 * 3. Rejection of SVGs and HTML scripts to prevent Stored XSS.
 * 4. File size limits (5MB maximum).
 * 5. Deterministic path generation enforcing user isolation and preventing directory traversal.
 */

const {
  validateImageUpload,
  detectMagicBytes,
  hasExecutableOrScriptSignature,
  MAX_AVATAR_SIZE_BYTES
} = require('../src/lib/fileUploadSecurity.ts');

let passed = 0;
let failed = 0;

function assert(condition, message) {
  if (!condition) {
    console.error(`❌ FAIL: ${message}`);
    failed++;
  } else {
    console.log(`✅ PASS: ${message}`);
    passed++;
  }
}

console.log('--- CircleGuard File Upload Security Tests ---');

const VALID_USER_ID = '11111111-2222-3333-4444-555555555555';

// Test 1: Authentic JPEG Magic Bytes (FF D8 FF ...)
{
  const jpegHeader = Buffer.from([0xff, 0xd8, 0xff, 0xe0, 0x00, 0x10, 0x4a, 0x46, 0x49, 0x46, 0x00]);
  const jpegBase64 = jpegHeader.toString('base64');
  const result = validateImageUpload({
    base64Content: jpegBase64,
    userId: VALID_USER_ID,
  });

  assert(
    result.valid === true &&
    result.detectedMimeType === 'image/jpeg' &&
    result.extension === 'jpg' &&
    result.sanitizedPath.startsWith(`${VALID_USER_ID}/`) &&
    result.sanitizedPath.endsWith('.jpg'),
    'Authentic JPEG binary magic bytes correctly identified and validated'
  );
}

// Test 2: Authentic PNG Magic Bytes (89 50 4E 47 0D 0A 1A 0A)
{
  const pngHeader = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0x00, 0x00, 0x00, 0x0d]);
  const pngBase64 = pngHeader.toString('base64');
  const result = validateImageUpload({
    base64Content: pngBase64,
    userId: VALID_USER_ID,
  });

  assert(
    result.valid === true &&
    result.detectedMimeType === 'image/png' &&
    result.extension === 'png' &&
    result.sanitizedPath.startsWith(`${VALID_USER_ID}/`) &&
    result.sanitizedPath.endsWith('.png'),
    'Authentic PNG binary magic bytes correctly identified and validated'
  );
}

// Test 3: Authentic WebP Magic Bytes (RIFF ... WEBP)
{
  const webpHeader = Buffer.from([
    0x52, 0x49, 0x46, 0x46, // RIFF
    0x24, 0x00, 0x00, 0x00, // length
    0x57, 0x45, 0x42, 0x50, // WEBP
    0x56, 0x50, 0x38, 0x20  // VP8
  ]);
  const webpBase64 = webpHeader.toString('base64');
  const result = validateImageUpload({
    base64Content: webpBase64,
    userId: VALID_USER_ID,
  });

  assert(
    result.valid === true &&
    result.detectedMimeType === 'image/webp' &&
    result.extension === 'webp' &&
    result.sanitizedPath.startsWith(`${VALID_USER_ID}/`) &&
    result.sanitizedPath.endsWith('.webp'),
    'Authentic WebP binary magic bytes correctly identified and validated'
  );
}

// Test 4: Renamed Executable (DOS/Windows PE header 0x4D 0x5A)
{
  const exeHeader = Buffer.from([0x4d, 0x5a, 0x90, 0x00, 0x03, 0x00, 0x00, 0x00]);
  const exeBase64 = exeHeader.toString('base64');
  const result = validateImageUpload({
    base64Content: exeBase64,
    userId: VALID_USER_ID,
  });

  assert(
    result.valid === false &&
    (result.error.includes('rejected') || result.error.includes('Invalid image format')),
    'Renamed Windows executable (MZ header) is strictly rejected'
  );
}

// Test 5: Renamed Linux Executable (0x7F 'E' 'L' 'F')
{
  const elfHeader = Buffer.from([0x7f, 0x45, 0x4c, 0x46, 0x02, 0x01, 0x01, 0x00]);
  const elfBase64 = elfHeader.toString('base64');
  const result = validateImageUpload({
    base64Content: elfBase64,
    userId: VALID_USER_ID,
  });

  assert(
    result.valid === false,
    'Renamed Linux ELF binary is strictly rejected'
  );
}

// Test 6: SVG Payload (Stored XSS Prevention)
{
  const svgHeader = Buffer.from('<svg width="100" height="100" xmlns="http://www.w3.org/2000/svg"></svg>');
  const svgBase64 = svgHeader.toString('base64');
  const result = validateImageUpload({
    base64Content: svgBase64,
    userId: VALID_USER_ID,
  });

  assert(
    result.valid === false &&
    result.error.includes('SVG, script, and executable files are not allowed'),
    'SVG image is strictly rejected to prevent Stored XSS'
  );
}

// Test 7: Server Script Header (0x3C 0x3F 0x70 0x68 0x70)
{
  const scriptHeader = Buffer.from([0x3c, 0x3f, 0x70, 0x68, 0x70, 0x20, 0x65, 0x63, 0x68, 0x6f, 0x20, 0x22, 0x31, 0x22, 0x3b]);
  const scriptBase64 = scriptHeader.toString('base64');
  const result = validateImageUpload({
    base64Content: scriptBase64,
    userId: VALID_USER_ID,
  });

  assert(
    result.valid === false,
    'Server script disguised as image is strictly rejected'
  );
}

// Test 8: File Size Limit (5MB) Enforcement
{
  const jpegHeader = Buffer.from([0xff, 0xd8, 0xff, 0xe0]);
  const jpegBase64 = jpegHeader.toString('base64');
  const oversizedBytes = 6 * 1024 * 1024; // 6MB

  const result = validateImageUpload({
    base64Content: jpegBase64,
    fileSizeBytes: oversizedBytes,
    userId: VALID_USER_ID,
  });

  assert(
    result.valid === false &&
    result.error.includes('exceeds the maximum allowed limit of 5MB'),
    'Oversized image (> 5MB) is strictly rejected'
  );
}

// Test 9: Directory Traversal Prevention & User Isolation
{
  const jpegHeader = Buffer.from([0xff, 0xd8, 0xff, 0xe0]);
  const jpegBase64 = jpegHeader.toString('base64');

  // Attempt traversal via malicious user ID
  const traversalUserId = '../../etc/passwd';
  const result = validateImageUpload({
    base64Content: jpegBase64,
    userId: traversalUserId,
  });

  assert(
    result.valid === false &&
    result.error.includes('Invalid user session'),
    'Directory traversal characters (../) in user path are rejected'
  );
}

// Test 10: Path conforms to Supabase Storage RLS Regex
{
  const jpegHeader = Buffer.from([0xff, 0xd8, 0xff, 0xe0]);
  const jpegBase64 = jpegHeader.toString('base64');
  const result = validateImageUpload({
    base64Content: jpegBase64,
    userId: VALID_USER_ID,
  });

  const rlsRegex = /^[0-9a-fA-F-]{36}\/[0-9]+\.(jpg|jpeg|png|webp)$/;
  assert(
    result.valid === true &&
    rlsRegex.test(result.sanitizedPath),
    'Generated path matches Supabase Storage RLS security regex constraint'
  );
}

console.log(`\n===============================`);
console.log(`Total: ${passed + failed}, Passed: ${passed}, Failed: ${failed}`);
console.log(`===============================`);

if (failed > 0) {
  process.exit(1);
} else {
  console.log('All file upload security tests PASSED.');
}
