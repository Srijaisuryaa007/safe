/**
 * CircleGuard Error Handling & Information Leakage Test Suite
 * 
 * Verifies that:
 * 1. Stack traces, internal file paths, database constraints, and PostgREST codes
 *    are never leaked to end users.
 * 2. User-friendly generic or translated messages are returned.
 * 3. Server-side/internal logs retain full debugging details.
 */

const { sanitizeUserErrorMessage, logInternalError, handleServiceError } = require('../src/lib/errorHandler.ts');

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

console.log('--- CircleGuard Error Handling & Info Leakage Tests ---');

// Test 1: PostgreSQL Unique Constraint on Phone
{
  const dbError = {
    message: 'duplicate key value violates unique constraint "profiles_phone_key"',
    details: 'Key (phone)=(+1234567890) already exists.',
    code: '23505'
  };
  const sanitized = sanitizeUserErrorMessage(dbError);
  assert(
    !sanitized.includes('profiles_phone_key') &&
    !sanitized.includes('23505') &&
    sanitized.includes('already registered'),
    'PostgreSQL unique phone constraint is sanitized into friendly message without table/key leak'
  );
}

// Test 2: PostgreSQL Check Constraint Violation
{
  const checkError = {
    message: 'new row for relation "profiles" violates check constraint "valid_phone_e164"',
    code: '23514'
  };
  const sanitized = sanitizeUserErrorMessage(checkError);
  assert(
    !sanitized.includes('relation "profiles"') &&
    !sanitized.includes('valid_phone_e164') &&
    sanitized.includes('phone number'),
    'Check constraint is mapped to clean validation message'
  );
}

// Test 3: Raw SQL Syntax / PostgREST Internal Leak
{
  const pgrstError = {
    message: 'syntax error at or near "SELECT" in relation "places"',
    code: 'PGRST204',
    hint: 'Check table schema cache at postgres://admin:secret@db.internal:5432'
  };
  const sanitized = sanitizeUserErrorMessage(pgrstError, 'Operation failed. Please try again.');
  assert(
    !sanitized.includes('PGRST') &&
    !sanitized.includes('postgres://') &&
    !sanitized.includes('syntax error') &&
    sanitized === 'Operation failed. Please try again.',
    'PostgREST internal error & schema cache hints are scrubbed to fallback'
  );
}

// Test 4: Internal Windows File Path & Stack Trace Leak
{
  const errorWithStack = new Error('Database connection failed');
  errorWithStack.stack = `Error: Database connection failed
    at Client._handleError (C:\\Users\\admin\\circleguard\\node_modules\\pg\\lib\\client.js:124:15)
    at Connection.emit (node:events:517:28)
    at Socket.<anonymous> (C:\\Users\\admin\\circleguard\\src\\db.ts:45:9)`;

  const sanitized = sanitizeUserErrorMessage(errorWithStack.stack);
  assert(
    !sanitized.includes('C:\\Users\\admin') &&
    !sanitized.includes('client.js') &&
    !sanitized.includes('at Client._handleError'),
    'Windows file paths and stack trace lines are scrubbed'
  );
}

// Test 5: POSIX File Path Leak
{
  const posixError = 'Failed to load module /Users/deploy/circleguard/src/secret.key: file not found';
  const sanitized = sanitizeUserErrorMessage(posixError);
  assert(
    !sanitized.includes('/Users/deploy') &&
    !sanitized.includes('secret.key'),
    'POSIX file paths are scrubbed'
  );
}

// Test 6: Network Failure
{
  const netError = new Error('Network request failed');
  const sanitized = sanitizeUserErrorMessage(netError);
  assert(
    sanitized.includes('internet connection'),
    'Network request failed maps to friendly internet connection notice'
  );
}

// Test 7: Safe user-friendly message passes through unchanged
{
  const safeMsg = 'Invalid email or password. Please try again.';
  const sanitized = sanitizeUserErrorMessage(safeMsg);
  assert(
    sanitized === safeMsg,
    'Clean concise message passes through'
  );
}

// Test 8: Server-side diagnostic logging retains full details
{
  let capturedLog = null;
  const originalError = console.error;
  console.error = (...args) => { capturedLog = args; };

  try {
    const sensitiveErr = new Error('Internal DB Deadlock');
    sensitiveErr.stack = 'at C:\\secret\\app.js:10';
    logInternalError('PaymentService:charge', sensitiveErr, { userId: 'u-123' });

    assert(
      capturedLog !== null &&
      capturedLog[0].includes('PaymentService:charge') &&
      capturedLog[1].message === 'Internal DB Deadlock' &&
      capturedLog[1].metadata.userId === 'u-123',
      'Server-side logging records full technical context, stack trace, and metadata'
    );
  } finally {
    console.error = originalError;
  }
}

// Test 9: handleServiceError combines logging and sanitization
{
  let logCalled = false;
  const originalError = console.error;
  console.error = () => { logCalled = true; };

  try {
    const rawError = { message: 'permission denied for table "audit_logs"', code: '42501' };
    const userMsg = handleServiceError('AuditScreen', rawError);

    assert(
      logCalled === true &&
      !userMsg.includes('audit_logs') &&
      userMsg.includes('permission'),
      'handleServiceError logs internally and returns safe user message'
    );
  } finally {
    console.error = originalError;
  }
}

console.log(`\n===============================`);
console.log(`Total: ${passed + failed}, Passed: ${passed}, Failed: ${failed}`);
console.log(`===============================`);

if (failed > 0) {
  process.exit(1);
} else {
  console.log('All error handling and information leakage tests PASSED.');
}
