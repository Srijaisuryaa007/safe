import * as Contacts from 'expo-contacts/legacy';
import {
  validateAndNormalizePhone,
  detectCountryFromPhone,
  extractNationalDigits,
} from '../lib/phoneValidation';

export interface ExtractedContactResult {
  name: string;
  phoneNumbers: string[];
  rawPhoneNumber?: string;
  formattedPhone?: string;
  e164?: string;
  detectedCountry?: string;
  hasPhone: boolean;
}

/**
 * Resolves contact details from Android & iOS system pickers.
 * On Android, presentContactPickerAsync() commonly returns only basic contact metadata
 * with an empty/undefined phoneNumbers array because the picker intent only delivers a cursor URI.
 * This helper automatically queries getContactByIdAsync() by contact ID to reliably fetch
 * all phone numbers associated with the selected contact.
 */
export async function pickAndResolveContact(
  defaultCountryCode: string = 'IN'
): Promise<{ cancelled: boolean; contact?: ExtractedContactResult }> {
  const result = await Contacts.presentContactPickerAsync();
  if (!result) {
    return { cancelled: true };
  }

  const contactName =
    result.name ||
    [result.firstName, result.lastName].filter(Boolean).join(' ') ||
    (result as any).nickname ||
    'Emergency Contact';

  const collectedNumbers: string[] = [];

  const addNumberIfValid = (val: any) => {
    if (!val) return;
    const str = typeof val === 'string' ? val : (val.number || val.digits || val.value || '');
    if (typeof str === 'string') {
      const clean = str.trim();
      if (clean && !collectedNumbers.includes(clean)) {
        collectedNumbers.push(clean);
      }
    }
  };

  // 1. Check direct phone numbers array on result
  if (Array.isArray(result.phoneNumbers)) {
    result.phoneNumbers.forEach(addNumberIfValid);
  }
  if (Array.isArray((result as any).phones)) {
    (result as any).phones.forEach(addNumberIfValid);
  }
  if ((result as any).phoneNumber) {
    addNumberIfValid((result as any).phoneNumber);
  }

  // 2. Critical for Android: If no phone numbers returned, fetch full contact by ID
  if (collectedNumbers.length === 0 && result.id) {
    try {
      const detailed = await Contacts.getContactByIdAsync(result.id, [
        Contacts.Fields.PhoneNumbers,
        Contacts.Fields.Name,
      ]);
      if (detailed) {
        if (Array.isArray(detailed.phoneNumbers)) {
          detailed.phoneNumbers.forEach(addNumberIfValid);
        }
        if (Array.isArray((detailed as any).phones)) {
          (detailed as any).phones.forEach(addNumberIfValid);
        }
      }
    } catch (idErr) {
      console.warn('[contactPickerHelper] getContactByIdAsync fallback failed:', idErr);
    }
  }

  if (collectedNumbers.length === 0) {
    return {
      cancelled: false,
      contact: {
        name: contactName,
        phoneNumbers: [],
        hasPhone: false,
      },
    };
  }

  // Pick primary/best phone number
  const rawPhoneNumber = collectedNumbers[0];
  const detectedCountry = detectCountryFromPhone(rawPhoneNumber, defaultCountryCode);
  const normalized = validateAndNormalizePhone(rawPhoneNumber, detectedCountry);

  return {
    cancelled: false,
    contact: {
      name: contactName,
      phoneNumbers: collectedNumbers,
      rawPhoneNumber,
      formattedPhone: normalized.isValid ? normalized.formattedDisplay : rawPhoneNumber,
      e164: normalized.isValid ? normalized.e164 : undefined,
      detectedCountry,
      hasPhone: true,
    },
  };
}

