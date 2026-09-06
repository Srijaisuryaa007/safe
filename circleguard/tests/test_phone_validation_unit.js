// tests/test_phone_validation_unit.js
const {
  validateAndNormalizePhone,
  detectCountryFromPhone,
  extractNationalDigits,
  COUNTRY_PHONE_RULES,
} = require('../circleguard/src/lib/phoneValidation');

let totalTests = 0;
let passedTests = 0;

function assert(condition, message) {
  totalTests++;
  if (condition) {
    console.log(`  [PASS] ${message}`);
    passedTests++;
  } else {
    console.error(`  [FAIL] ${message}`);
    process.exitCode = 1;
  }
}

console.log('\n--- 1. Testing India (IN, +91) - Exactly 10 digits starting with 6-9 ---');
{
  const res1 = validateAndNormalizePhone('9876543210', 'IN');
  assert(res1.isValid && res1.e164 === '+919876543210', 'Valid 10-digit Indian mobile is accepted');

  const res2 = validateAndNormalizePhone('8072986912', 'IN');
  assert(res2.isValid && res2.e164 === '+918072986912', 'Valid starting with 8 accepted');

  const res3 = validateAndNormalizePhone('987654321', 'IN');
  assert(!res3.isValid && res3.error.includes('10 digits'), 'Reject 9 digits (too short) for India');

  const res4 = validateAndNormalizePhone('98765432100', 'IN');
  assert(!res4.isValid && res4.error.includes('10 digits'), 'Reject 11 digits (too long) for India');

  const res5 = validateAndNormalizePhone('1876543210', 'IN');
  assert(!res5.isValid && res5.error.includes('Expected: 10 digits starting with 6, 7, 8, or 9'), 'Reject invalid starting digit (starts with 1) for India');

  const res6 = validateAndNormalizePhone('+91 98765 43210', 'IN');
  assert(res6.isValid && res6.e164 === '+919876543210', 'Redundant dial code & formatting cleanly stripped to +919876543210');

  const res7 = validateAndNormalizePhone('09876543210', 'IN');
  assert(res7.isValid && res7.e164 === '+919876543210', 'Leading trunk 0 safely stripped');
}

console.log('\n--- 2. Testing United States (US, +1) - Exactly 10 digits ---');
{
  const res1 = validateAndNormalizePhone('4155552671', 'US');
  assert(res1.isValid && res1.e164 === '+14155552671', 'Valid 10-digit US number accepted');

  const res2 = validateAndNormalizePhone('415555267', 'US');
  assert(!res2.isValid && res2.error.includes('10 digits'), 'Reject 9 digits for US');

  const res3 = validateAndNormalizePhone('(415) 555-2671', 'US');
  assert(res3.isValid && res3.e164 === '+14155552671', 'Cleaned formatted US phone number');
}

console.log('\n--- 3. Testing United Kingdom (GB, +44) - Mobile 10 digits starting with 7 ---');
{
  const res1 = validateAndNormalizePhone('7911123456', 'GB');
  assert(res1.isValid && res1.e164 === '+447911123456', 'Valid 10-digit UK mobile accepted');

  const res2 = validateAndNormalizePhone('07911123456', 'GB');
  assert(res2.isValid && res2.e164 === '+447911123456', 'UK trunk 0 stripped and validated');

  const res3 = validateAndNormalizePhone('791112345', 'GB');
  assert(!res3.isValid, 'Reject 9 digits for UK');
}

console.log('\n--- 4. Testing Australia (AU, +61) - Exactly 9 digits starting with 4 ---');
{
  const res1 = validateAndNormalizePhone('412345678', 'AU');
  assert(res1.isValid && res1.e164 === '+61412345678', 'Valid 9-digit AU mobile accepted');

  const res2 = validateAndNormalizePhone('0412345678', 'AU');
  assert(res2.isValid && res2.e164 === '+61412345678', 'AU trunk 0 stripped');

  const res3 = validateAndNormalizePhone('41234567', 'AU');
  assert(!res3.isValid && res3.error.includes('9 digits'), 'Reject 8 digits for AU');

  const res4 = validateAndNormalizePhone('212345678', 'AU');
  assert(!res4.isValid, 'Reject non-mobile starting digit for AU');
}

console.log('\n--- 5. Testing UAE (AE, +971) - Exactly 9 digits starting with 5 ---');
{
  const res1 = validateAndNormalizePhone('501234567', 'AE');
  assert(res1.isValid && res1.e164 === '+971501234567', 'Valid 9-digit UAE mobile accepted');

  const res2 = validateAndNormalizePhone('0501234567', 'AE');
  assert(res2.isValid && res2.e164 === '+971501234567', 'UAE trunk 0 stripped');

  const res3 = validateAndNormalizePhone('201234567', 'AE');
  assert(!res3.isValid, 'Reject invalid starting digit for UAE');
}

console.log('\n--- 6. Testing Singapore (SG, +65) - Exactly 8 digits starting with 8 or 9 ---');
{
  const res1 = validateAndNormalizePhone('81234567', 'SG');
  assert(res1.isValid && res1.e164 === '+6581234567', 'Valid 8-digit SG mobile starting with 8');

  const res2 = validateAndNormalizePhone('91234567', 'SG');
  assert(res2.isValid && res2.e164 === '+6591234567', 'Valid 8-digit SG mobile starting with 9');

  const res3 = validateAndNormalizePhone('71234567', 'SG');
  assert(!res3.isValid, 'Reject invalid prefix for SG');

  const res4 = validateAndNormalizePhone('8123456', 'SG');
  assert(!res4.isValid && res4.error.includes('8 digits'), 'Reject 7 digits for SG');
}

console.log('\n--- 7. Testing Country Detection & National Extraction ---');
{
  assert(detectCountryFromPhone('+918072986912') === 'IN', 'Detects IN from +91');
  assert(detectCountryFromPhone('+14155552671') === 'US', 'Detects US from +1');
  assert(detectCountryFromPhone('+447911123456') === 'GB', 'Detects GB from +44');
  assert(detectCountryFromPhone('+971501234567') === 'AE', 'Detects AE from +971');
  assert(extractNationalDigits('+918072986912', 'IN') === '8072986912', 'Extracts national digits 8072986912');
}

console.log(`\nResults: ${passedTests}/${totalTests} tests passed.`);
if (passedTests === totalTests) {
  console.log('ALL PHONE VALIDATION UNIT TESTS PASSED PERFECTLY!\n');
} else {
  console.error('SOME TESTS FAILED!\n');
  process.exit(1);
}
