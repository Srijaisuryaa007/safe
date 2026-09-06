import { supabase } from './supabase';
import { SUPPORTED_COUNTRIES, CountryInfo } from '../store/useCountryStore';

export interface CountryPhoneRule {
  dialCode: string;
  minLen: number;
  maxLen: number;
  pattern?: RegExp;
  placeholder: string;
  hint: string;
  stripTrunkZero?: boolean;
}

export const COUNTRY_PHONE_RULES: Record<string, CountryPhoneRule> = {
  IN: {
    dialCode: '+91',
    minLen: 10,
    maxLen: 10,
    pattern: /^[6-9]\d{9}$/,
    placeholder: '98765 43210',
    hint: '10 digits starting with 6, 7, 8, or 9',
    stripTrunkZero: true,
  },
  US: {
    dialCode: '+1',
    minLen: 10,
    maxLen: 10,
    pattern: /^[2-9]\d{9}$/,
    placeholder: '(555) 123-4567',
    hint: '10 digits (area code + number)',
    stripTrunkZero: false,
  },
  CA: {
    dialCode: '+1',
    minLen: 10,
    maxLen: 10,
    pattern: /^[2-9]\d{9}$/,
    placeholder: '(555) 123-4567',
    hint: '10 digits (area code + number)',
    stripTrunkZero: false,
  },
  GB: {
    dialCode: '+44',
    minLen: 10,
    maxLen: 10,
    pattern: /^7\d{9}$/,
    placeholder: '7911 123456',
    hint: '10 digits starting with 7',
    stripTrunkZero: true,
  },
  AU: {
    dialCode: '+61',
    minLen: 9,
    maxLen: 9,
    pattern: /^4\d{8}$/,
    placeholder: '412 345 678',
    hint: '9 digits starting with 4',
    stripTrunkZero: true,
  },
  AE: {
    dialCode: '+971',
    minLen: 9,
    maxLen: 9,
    pattern: /^5\d{8}$/,
    placeholder: '50 123 4567',
    hint: '9 digits starting with 5',
    stripTrunkZero: true,
  },
  SG: {
    dialCode: '+65',
    minLen: 8,
    maxLen: 8,
    pattern: /^[89]\d{7}$/,
    placeholder: '8123 4567',
    hint: '8 digits starting with 8 or 9',
    stripTrunkZero: false,
  },
  DE: {
    dialCode: '+49',
    minLen: 10,
    maxLen: 11,
    pattern: /^1[5-7]\d{8,9}$/,
    placeholder: '151 23456789',
    hint: '10-11 digits starting with 15/16/17',
    stripTrunkZero: true,
  },
  FR: {
    dialCode: '+33',
    minLen: 9,
    maxLen: 9,
    pattern: /^[67]\d{8}$/,
    placeholder: '6 12 34 56 78',
    hint: '9 digits starting with 6 or 7',
    stripTrunkZero: true,
  },
  IT: {
    dialCode: '+39',
    minLen: 9,
    maxLen: 10,
    pattern: /^3\d{8,9}$/,
    placeholder: '312 3456789',
    hint: '9-10 digits starting with 3',
    stripTrunkZero: false,
  },
  ES: {
    dialCode: '+34',
    minLen: 9,
    maxLen: 9,
    pattern: /^[67]\d{8}$/,
    placeholder: '612 34 56 78',
    hint: '9 digits starting with 6 or 7',
    stripTrunkZero: false,
  },
  JP: {
    dialCode: '+81',
    minLen: 10,
    maxLen: 10,
    pattern: /^[789]0\d{8}$/,
    placeholder: '90 1234 5678',
    hint: '10 digits starting with 70, 80, or 90',
    stripTrunkZero: true,
  },
  KR: {
    dialCode: '+82',
    minLen: 9,
    maxLen: 10,
    pattern: /^10\d{7,8}$/,
    placeholder: '10 1234 5678',
    hint: '9-10 digits starting with 10',
    stripTrunkZero: true,
  },
  CN: {
    dialCode: '+86',
    minLen: 11,
    maxLen: 11,
    pattern: /^1[3-9]\d{9}$/,
    placeholder: '138 0013 8000',
    hint: '11 digits starting with 1',
    stripTrunkZero: false,
  },
  BR: {
    dialCode: '+55',
    minLen: 10,
    maxLen: 11,
    placeholder: '11 98765-4321',
    hint: '10-11 digits (including 2-digit area code)',
    stripTrunkZero: false,
  },
  MX: {
    dialCode: '+52',
    minLen: 10,
    maxLen: 10,
    pattern: /^[1-9]\d{9}$/,
    placeholder: '55 1234 5678',
    hint: '10 digits',
    stripTrunkZero: false,
  },
  SA: {
    dialCode: '+966',
    minLen: 9,
    maxLen: 9,
    pattern: /^5\d{8}$/,
    placeholder: '50 123 4567',
    hint: '9 digits starting with 5',
    stripTrunkZero: true,
  },
  ZA: {
    dialCode: '+27',
    minLen: 9,
    maxLen: 9,
    pattern: /^[678]\d{8}$/,
    placeholder: '82 123 4567',
    hint: '9 digits starting with 6, 7, or 8',
    stripTrunkZero: true,
  },
  NZ: {
    dialCode: '+64',
    minLen: 8,
    maxLen: 10,
    pattern: /^2\d{7,9}$/,
    placeholder: '21 123 4567',
    hint: '8-10 digits starting with 2',
    stripTrunkZero: true,
  },
  MY: {
    dialCode: '+60',
    minLen: 9,
    maxLen: 10,
    pattern: /^1\d{8,9}$/,
    placeholder: '12 345 6789',
    hint: '9-10 digits starting with 1',
    stripTrunkZero: true,
  },
  ID: {
    dialCode: '+62',
    minLen: 9,
    maxLen: 12,
    pattern: /^8\d{8,11}$/,
    placeholder: '812 3456 7890',
    hint: '9-12 digits starting with 8',
    stripTrunkZero: true,
  },
  PH: {
    dialCode: '+63',
    minLen: 10,
    maxLen: 10,
    pattern: /^9\d{9}$/,
    placeholder: '917 123 4567',
    hint: '10 digits starting with 9',
    stripTrunkZero: true,
  },
  TH: {
    dialCode: '+66',
    minLen: 9,
    maxLen: 9,
    pattern: /^[689]\d{8}$/,
    placeholder: '81 234 5678',
    hint: '9 digits starting with 6, 8, or 9',
    stripTrunkZero: true,
  },
  VN: {
    dialCode: '+84',
    minLen: 9,
    maxLen: 9,
    pattern: /^[35789]\d{8}$/,
    placeholder: '90 123 4567',
    hint: '9 digits starting with 3, 5, 7, 8, or 9',
    stripTrunkZero: true,
  },
  PK: {
    dialCode: '+92',
    minLen: 10,
    maxLen: 10,
    pattern: /^3\d{9}$/,
    placeholder: '300 1234567',
    hint: '10 digits starting with 3',
    stripTrunkZero: true,
  },
  BD: {
    dialCode: '+880',
    minLen: 10,
    maxLen: 10,
    pattern: /^1[3-9]\d{8}$/,
    placeholder: '1712 345678',
    hint: '10 digits starting with 1',
    stripTrunkZero: true,
  },
  LK: {
    dialCode: '+94',
    minLen: 9,
    maxLen: 9,
    pattern: /^7\d{8}$/,
    placeholder: '71 234 5678',
    hint: '9 digits starting with 7',
    stripTrunkZero: true,
  },
  NP: {
    dialCode: '+977',
    minLen: 10,
    maxLen: 10,
    pattern: /^9[78]\d{8}$/,
    placeholder: '9841 234567',
    hint: '10 digits starting with 97 or 98',
    stripTrunkZero: false,
  },
  TR: {
    dialCode: '+90',
    minLen: 10,
    maxLen: 10,
    pattern: /^5\d{9}$/,
    placeholder: '532 123 4567',
    hint: '10 digits starting with 5',
    stripTrunkZero: true,
  },
  RU: {
    dialCode: '+7',
    minLen: 10,
    maxLen: 10,
    pattern: /^9\d{9}$/,
    placeholder: '912 345-67-89',
    hint: '10 digits starting with 9',
    stripTrunkZero: true,
  },
  NL: {
    dialCode: '+31',
    minLen: 9,
    maxLen: 9,
    pattern: /^6\d{8}$/,
    placeholder: '6 12345678',
    hint: '9 digits starting with 6',
    stripTrunkZero: true,
  },
  CH: {
    dialCode: '+41',
    minLen: 9,
    maxLen: 9,
    pattern: /^7[5-9]\d{7}$/,
    placeholder: '79 123 45 67',
    hint: '9 digits starting with 7',
    stripTrunkZero: true,
  },
  SE: {
    dialCode: '+46',
    minLen: 9,
    maxLen: 9,
    pattern: /^7\d{8}$/,
    placeholder: '70 123 45 67',
    hint: '9 digits starting with 7',
    stripTrunkZero: true,
  },
  NO: {
    dialCode: '+47',
    minLen: 8,
    maxLen: 8,
    pattern: /^[49]\d{7}$/,
    placeholder: '412 34 567',
    hint: '8 digits starting with 4 or 9',
    stripTrunkZero: false,
  },
  DK: {
    dialCode: '+45',
    minLen: 8,
    maxLen: 8,
    placeholder: '20 12 34 56',
    hint: '8 digits',
    stripTrunkZero: false,
  },
  CZ: {
    dialCode: '+420',
    minLen: 9,
    maxLen: 9,
    placeholder: '601 123 456',
    hint: '9 digits',
    stripTrunkZero: false,
  },
};

/**
 * Universal fallback rule for countries not listed above
 */
export const DEFAULT_PHONE_RULE: CountryPhoneRule = {
  dialCode: '+1',
  minLen: 7,
  maxLen: 15,
  placeholder: '1234567890',
  hint: '7-15 digits',
  stripTrunkZero: true,
};

export interface PhoneValidationResult {
  isValid: boolean;
  error?: string;
  e164: string;
  nationalDigits: string;
  dialCode: string;
  formattedDisplay: string;
}

/**
 * Detects which country code corresponds to a stored phone number (e.g. "+919876543210" -> "IN").
 */
export function detectCountryFromPhone(phone?: string | null, fallbackCountry: string = 'IN'): string {
  if (!phone) return fallbackCountry;
  const clean = phone.trim();
  // Sort rules by dialCode length descending so +880 matches before +88 or +1 matches before +12
  const sorted = Object.entries(COUNTRY_PHONE_RULES).sort(
    (a, b) => b[1].dialCode.length - a[1].dialCode.length
  );
  for (const [code, rule] of sorted) {
    if (clean.startsWith(rule.dialCode) || clean.startsWith(rule.dialCode.replace('+', ''))) {
      return code;
    }
  }
  return fallbackCountry;
}

/**
 * Extracts national digits from a stored international or raw phone number.
 */
export function extractNationalDigits(phone?: string | null, countryCode: string = 'IN'): string {
  if (!phone) return '';
  const country = SUPPORTED_COUNTRIES[countryCode];
  const rule = COUNTRY_PHONE_RULES[countryCode] || {
    ...DEFAULT_PHONE_RULE,
    dialCode: country?.dialCode || '+1',
  };
  const dialDigits = rule.dialCode.replace(/\D/g, '');
  let digits = phone.replace(/\D/g, '');
  if (digits.startsWith(dialDigits) && digits.length > dialDigits.length) {
    digits = digits.slice(dialDigits.length);
  }
  return digits;
}

/**
 * Normalizes and strictly validates a phone number according to country rules.
 */
export function validateAndNormalizePhone(
  rawInput: string,
  countryCode: string = 'IN'
): PhoneValidationResult {
  const country = SUPPORTED_COUNTRIES[countryCode];
  const rule = COUNTRY_PHONE_RULES[countryCode] || {
    ...DEFAULT_PHONE_RULE,
    dialCode: country?.dialCode || '+1',
  };

  const dialDigits = rule.dialCode.replace(/\D/g, '');
  const countryName = country?.name || countryCode;

  if (!rawInput || !rawInput.trim()) {
    return {
      isValid: false,
      error: `Please enter your mobile phone number for ${countryName}.`,
      e164: '',
      nationalDigits: '',
      dialCode: rule.dialCode,
      formattedDisplay: '',
    };
  }

  // Extract all digit characters
  let digits = rawInput.replace(/\D/g, '');

  if (!digits) {
    return {
      isValid: false,
      error: `Please enter valid numbers for ${countryName}.`,
      e164: '',
      nationalDigits: '',
      dialCode: rule.dialCode,
      formattedDisplay: '',
    };
  }

  // If user pasted or typed full international number starting with their country's dial code,
  // isolate the national number
  if (digits.startsWith(dialDigits) && digits.length > dialDigits.length) {
    digits = digits.slice(dialDigits.length);
  }

  // If national number starts with trunk 0 (e.g. 07... in UK or 09... in India), strip it if configured
  if (rule.stripTrunkZero && digits.startsWith('0') && digits.length > rule.minLen) {
    digits = digits.replace(/^0+/, '');
  }

  // Check Length Requirements
  const len = digits.length;
  if (rule.minLen === rule.maxLen) {
    if (len !== rule.minLen) {
      return {
        isValid: false,
        error: `${countryName} mobile numbers must be exactly ${rule.minLen} digits. (You entered ${len} digits)`,
        e164: '',
        nationalDigits: digits,
        dialCode: rule.dialCode,
        formattedDisplay: `${rule.dialCode} ${digits}`,
      };
    }
  } else {
    if (len < rule.minLen) {
      return {
        isValid: false,
        error: `${countryName} phone numbers must have at least ${rule.minLen} digits. (You entered ${len} digits)`,
        e164: '',
        nationalDigits: digits,
        dialCode: rule.dialCode,
        formattedDisplay: `${rule.dialCode} ${digits}`,
      };
    }
    if (len > rule.maxLen) {
      return {
        isValid: false,
        error: `${countryName} phone numbers cannot exceed ${rule.maxLen} digits. (You entered ${len} digits)`,
        e164: '',
        nationalDigits: digits,
        dialCode: rule.dialCode,
        formattedDisplay: `${rule.dialCode} ${digits}`,
      };
    }
  }

  // Check Leading Digits / Numbering Plan Pattern
  if (rule.pattern && !rule.pattern.test(digits)) {
    return {
      isValid: false,
      error: `Invalid format for ${countryName}. Expected: ${rule.hint}.`,
      e164: '',
      nationalDigits: digits,
      dialCode: rule.dialCode,
      formattedDisplay: `${rule.dialCode} ${digits}`,
    };
  }

  // Strict E.164 canonical format (e.g., +918072986912)
  const e164 = `+${dialDigits}${digits}`;
  const formattedDisplay = `${rule.dialCode} ${digits}`;

  return {
    isValid: true,
    e164,
    nationalDigits: digits,
    dialCode: rule.dialCode,
    formattedDisplay,
  };
}

/**
 * Checks if a normalized phone number is already registered to another profile.
 * Proactively prevents duplicate accounts and ensures every phone number is unique.
 */
export async function checkDuplicatePhoneNumber(
  e164Phone: string,
  currentUserId?: string
): Promise<{ isDuplicate: boolean; ownerName?: string; error?: string }> {
  if (!e164Phone) return { isDuplicate: false };

  try {
    const rawDigits = e164Phone.replace(/\D/g, '');
    
    // Check possible storage variants:
    // 1. Strict E.164: "+918072986912"
    // 2. Unprefixed digits: "918072986912"
    // 3. Spaced legacy variant: "+91 8072986912"
    const searchVariants = [e164Phone, rawDigits];
    
    // Attempt match with leading space after dial code if identifiable
    for (const prefix of ['+91', '+1', '+44', '+61', '+971', '+65', '+49', '+33', '+81', '+86']) {
      if (e164Phone.startsWith(prefix)) {
        const national = e164Phone.slice(prefix.length);
        searchVariants.push(`${prefix} ${national}`);
        break;
      }
    }

    const { data, error } = await supabase
      .from('profiles')
      .select('id, full_name, phone')
      .in('phone', searchVariants)
      .limit(5);

    if (error) {
      console.warn('Duplicate phone check query warning:', error.message);
      return { isDuplicate: false };
    }

    if (data && data.length > 0) {
      const duplicate = data.find((p) => !currentUserId || p.id !== currentUserId);
      if (duplicate) {
        return {
          isDuplicate: true,
          ownerName: duplicate.full_name || 'Another user',
          error: `This phone number (${e164Phone}) is already registered to another account. Every member must have a unique phone number.`,
        };
      }
    }

    return { isDuplicate: false };
  } catch (err: any) {
    console.warn('Duplicate check caught exception:', err);
    return { isDuplicate: false };
  }
}

if (typeof window !== 'undefined') {
  (window as any).__phoneValidation = {
    validateAndNormalizePhone,
    checkDuplicatePhoneNumber,
    detectCountryFromPhone,
    extractNationalDigits,
    COUNTRY_PHONE_RULES,
  };
}
