/**
 * CircleGuard Secure Error Handler & User-Facing Message Humanizer
 * 
 * Prevents technical jargon, database error codes, and sensitive traces
 * from leaking to end users, replacing them with warm, gentle, reassuring,
 * and intuitive messages that are easy to understand.
 */

interface ErrorDetails {
  message?: string;
  code?: string | number;
  details?: string;
  hint?: string;
  stack?: string;
}

export interface HumanizedAlert {
  title: string;
  message: string;
  tag?: string;
  isStorageIssue?: boolean;
  isNetworkIssue?: boolean;
}

/**
 * Patterns that indicate internal error traces, file system paths, or SQL engines
 */
const SENSITIVE_PATTERNS = [
  // Stack traces & line references
  /^\s*at\s+[\w\s.<>/\\$:-]+/m,
  /\bat\s+(?:file:\/\/|[A-Za-z]:[\\/]|(?:\/[a-zA-Z0-9_.-]+)+)/,
  // File paths (Windows and POSIX)
  /[A-Za-z]:\\[\w\s.\\-]+/,
  /\/(?:Users|home|var|tmp|etc|app|node_modules)\/[\w\s./\\-]+/,
  // Database internal syntax and structure
  /\b(?:syntax error at or near|column "[^"]+" does not exist|relation "[^"]+" does not exist)\b/i,
  /\b(?:PGRST\d{3}|SQLSTATE\s*\[\w+\]|PostgREST)\b/i,
  /\b(?:pg_stat|pg_catalog|information_schema)\b/i,
  /\b(?:sqlite_\w+|SQLite\w+|code \d+|code 13)\b/i,
  // Node / OS system errors
  /\b(?:ENOENT|EACCES|ECONNREFUSED|ECONNRESET|ETIMEDOUT|EHOSTUNREACH|ENOSPC)\b/,
  // JavaScript runtime errors
  /\b(?:TypeError|ReferenceError|SyntaxError|UnhandledPromiseRejection|cannot read property|undefined is not an object|null is not an object)\b/i,
  /\b(?:status code \d{3}|HTTP \d{3})\b/i,
];

/**
 * Known PostgreSQL constraints / SQLite / Device / Auth error patterns mapped to soft, kind messages
 */
const KNOWN_ERROR_MAPPINGS: Array<{ test: RegExp; message: string }> = [
  // Device Storage & SQLite
  {
    test: /database or disk is full|SQLITE_FULL|code 13|ENOSPC|no space left on device|disk.*full|storage.*full/i,
    message: "Your phone is running low on available storage space right now. Freeing up a little space will help everything run smoothly."
  },
  {
    test: /sqlite/i,
    message: "A temporary storage issue occurred. Please restart the app or try again in a moment."
  },

  // Contact Picker & Address Book
  {
    test: /contact picker|presentcontactpickerasync|unable to open phone contacts|error selecting contact|error picking phone contact/i,
    message: "We were unable to access your contacts list right now. You can try again in a moment or add your emergency responder directly in the directory."
  },
  {
    test: /contacts permission/i,
    message: "Contacts access is needed to select an emergency responder from your address book. You can enable it in your phone settings."
  },

  // Unique constraints (Phone)
  {
    test: /unique constraint.*profiles_phone/i,
    message: "This phone number is already registered to another account."
  },
  {
    test: /duplicate key.*phone/i,
    message: "This phone number is already registered to another account."
  },
  {
    test: /profiles_phone_key/i,
    message: "This phone number is already registered to another account."
  },

  // Unique constraints (Email)
  {
    test: /unique constraint.*(?:email|users_email)/i,
    message: "An account with this email already exists."
  },
  {
    test: /User already registered/i,
    message: "An account with this email already exists."
  },
  {
    test: /unique constraint.*(?:circle_members|circle_id.*user_id)/i,
    message: "You are already a member of this circle."
  },
  {
    test: /duplicate key value violates unique constraint/i,
    message: "A record with this information already exists."
  },

  // Check constraints
  {
    test: /violates check constraint.*phone/i,
    message: "Please enter a valid phone number with the country code (e.g. +1234567890)."
  },
  {
    test: /violates check constraint.*email/i,
    message: "Please enter a valid email address."
  },
  {
    test: /violates check constraint.*circle_name/i,
    message: "Circle name should be between 1 and 50 characters."
  },
  {
    test: /violates check constraint.*message_content/i,
    message: "Message should be between 1 and 2000 characters."
  },
  {
    test: /violates check constraint.*(?:latitude|longitude|coords)/i,
    message: "Invalid location coordinates provided."
  },
  {
    test: /violates check constraint/i,
    message: "Please double-check the entered details and try again."
  },

  // Foreign keys & references
  {
    test: /violates foreign key constraint/i,
    message: "The requested item or circle could not be found."
  },
  {
    test: /not present in table "circles"/i,
    message: "The circle could not be found. Please check your invite code."
  },
  {
    test: /not present in table/i,
    message: "The requested item could not be found."
  },

  // Row Level Security (RLS) & Permissions
  {
    test: /row-level security policy/i,
    message: "You do not have permission to perform this action."
  },
  {
    test: /permission denied/i,
    message: "Permission is needed to complete this action. You can update access in your device settings."
  },

  // Supabase Auth & JWT
  {
    test: /Invalid login credentials/i,
    message: "The email or password entered does not match our records. Please try again."
  },
  {
    test: /Email not confirmed/i,
    message: "Please confirm your email address through the link sent to your inbox before signing in."
  },
  {
    test: /Password should be at least/i,
    message: "For your security, please choose a password with at least 8 characters."
  },
  {
    test: /Token has expired or is invalid/i,
    message: "Your session or verification token has expired. Please try again."
  },
  {
    test: /Auth session missing!/i,
    message: "Your session has expired. Please sign in again."
  },
  {
    test: /Invalid API key/i,
    message: "We're having trouble connecting right now. Please restart the app or check your network."
  },
  {
    test: /already registered/i,
    message: "An account with this email address already exists. Please sign in instead."
  },
  {
    test: /rate limit|too many requests/i,
    message: "Please wait a moment before trying again."
  },
  {
    test: /Database error saving new user/i,
    message: "Unable to complete registration right now. Please try again."
  },
  {
    test: /Signups not allowed|Signup is disabled/i,
    message: "New registrations are temporarily unavailable. Please try again shortly."
  },

  // Network / Transport
  {
    test: /Network request failed|Failed to fetch|NetworkError/i,
    message: "It looks like your connection was interrupted. Please check your Wi-Fi or mobile data and try again."
  },
  {
    test: /timeout|timed out/i,
    message: "The connection took longer than expected. Please check your network and try again."
  },

  // Location
  {
    test: /location provider is disabled|location request timed out|kclerrordomain/i,
    message: "We could not determine your current location. Please ensure location services are turned on."
  }
];

/**
 * Extracts raw string message from unknown error object
 */
export function extractRawMessage(error: unknown): string {
  if (!error) return "";
  if (typeof error === "string") return error;
  if (typeof error === "object") {
    const err = error as ErrorDetails;
    const parts: string[] = [];
    if (err.message) parts.push(err.message);
    if (err.details) parts.push(err.details);
    if (err.hint) parts.push(err.hint);
    if (parts.length > 0) return parts.join(" ");
    try {
      return JSON.stringify(error);
    } catch {
      return String(error);
    }
  }
  return String(error);
}

/**
 * Sanitizes an error for end-user display.
 * Strips internal details, file paths, stack traces, and database structures.
 * 
 * @param error Any thrown error or Supabase error object
 * @param fallbackMessage Safe generic message to return if error cannot be matched safely
 * @returns Clean, user-friendly, non-leaking error message
 */
export function sanitizeUserErrorMessage(
  error: unknown,
  fallbackMessage: string = "We could not complete this action right now. Please try again in a moment."
): string {
  if (!error) return fallbackMessage;

  const raw = extractRawMessage(error);
  if (!raw || raw.trim().length === 0) return fallbackMessage;

  // 1. Check against known mapping rules
  for (const mapping of KNOWN_ERROR_MAPPINGS) {
    if (mapping.test.test(raw)) {
      return mapping.message;
    }
  }

  // 2. Check for sensitive leak patterns (stack traces, paths, SQL keywords, internal codes)
  for (const pattern of SENSITIVE_PATTERNS) {
    if (pattern.test(raw)) {
      return fallbackMessage;
    }
  }

  // 3. Length cap: exceptionally long error messages typically contain raw payloads or stacks
  if (raw.length > 180) {
    return fallbackMessage;
  }

  // 4. Clean up any trailing codes like (code 13) or [13]
  let cleaned = raw.replace(/\s*\([a-zA-Z0-9_\s]*code\s*\d+[^)]*\)/gi, '');
  cleaned = cleaned.replace(/\s*\(code\s*\d+\)/gi, '');
  cleaned = cleaned.replace(/\bSQLITE_\w+/gi, '');
  cleaned = cleaned.trim();

  return cleaned || fallbackMessage;
}

/**
 * Transforms any raw title and message into gentle, non-technical, user-friendly sentences.
 */
export function humanizeUserAlert(
  rawTitle?: string,
  rawMessage?: unknown,
  rawType?: string
): HumanizedAlert {
  const msgStr = extractRawMessage(rawMessage);
  const titleStr = rawTitle ? String(rawTitle).trim() : '';
  const combined = `${titleStr} ${msgStr}`.toLowerCase();

  // 1. Device Storage / Disk Full / SQLite Full
  if (
    combined.includes('disk is full') ||
    combined.includes('sqlite_full') ||
    combined.includes('database or disk is full') ||
    combined.includes('code 13') ||
    combined.includes('enospc') ||
    combined.includes('no space left on device') ||
    combined.includes('storage full')
  ) {
    return {
      title: 'Device Storage Is Low',
      message: 'Your phone is currently low on storage space, so this action could not be completed. Freeing up a little space on your device will help everything run smoothly.',
      tag: '• STORAGE NOTICE',
      isStorageIssue: true,
    };
  }

  // 2. Contact Picker & Address Book
  if (
    combined.includes('contact picker') ||
    combined.includes('presentcontactpickerasync') ||
    combined.includes('unable to open phone contacts') ||
    combined.includes('error selecting contact') ||
    combined.includes('error picking phone contact')
  ) {
    return {
      title: 'Unable to Open Contacts',
      message: 'We could not open your contact list right now. You can try again in a moment, or add your emergency responder directly in the directory.',
      tag: '• CONTACTS NOTICE',
    };
  }

  // 3. Network & Connection
  if (
    combined.includes('network request failed') ||
    combined.includes('failed to fetch') ||
    combined.includes('networkerror') ||
    combined.includes('econnrefused') ||
    combined.includes('econnreset') ||
    combined.includes('enotfound') ||
    combined.includes('etimedout') ||
    combined.includes('timed out') ||
    combined.includes('offline') ||
    combined.includes('net::err_')
  ) {
    return {
      title: 'Connection Interrupted',
      message: 'It looks like your internet connection was interrupted. Please check your Wi-Fi or mobile data and try again.',
      tag: '• CONNECTION NOTICE',
      isNetworkIssue: true,
    };
  }

  // 4. Duplicate Phone or Email
  if (
    combined.includes('profiles_phone_key') ||
    (combined.includes('unique constraint') && combined.includes('phone')) ||
    (combined.includes('duplicate key') && combined.includes('phone'))
  ) {
    return {
      title: 'Phone Number Registered',
      message: 'This phone number is already registered to another account.',
      tag: '• ACCOUNT NOTICE',
    };
  }

  if (
    combined.includes('users_email') ||
    (combined.includes('unique constraint') && combined.includes('email')) ||
    combined.includes('user already registered')
  ) {
    return {
      title: 'Account Exists',
      message: 'An account with this email address already exists. Please sign in instead.',
      tag: '• ACCOUNT NOTICE',
    };
  }

  // 5. Soften Harsh Titles
  let cleanTitle = titleStr || (rawType === 'error' ? 'Notice' : 'Circle Notice');
  const lowTitle = cleanTitle.toLowerCase();

  if (
    lowTitle === 'error' ||
    lowTitle === 'system error' ||
    lowTitle === 'fatal error' ||
    lowTitle === 'critical error' ||
    lowTitle === 'failed'
  ) {
    cleanTitle = 'Unable to Complete';
  } else if (lowTitle === 'contact picker error') {
    cleanTitle = 'Unable to Open Contacts';
  } else if (lowTitle === 'validation error') {
    cleanTitle = 'Please Check Details';
  } else if (lowTitle === 'permission denied') {
    cleanTitle = 'Permission Needed';
  } else if (lowTitle === 'upload failed') {
    cleanTitle = 'Upload Incomplete';
  } else if (lowTitle === 'purchase error') {
    cleanTitle = 'Payment Assistance';
  } else if (lowTitle === 'restore failed') {
    cleanTitle = 'Restore Purchases';
  } else if (lowTitle === 'geofence error' || lowTitle === 'error deleting geofence') {
    cleanTitle = 'Geofence Notice';
  } else if (cleanTitle.endsWith(' Error')) {
    cleanTitle = cleanTitle.replace(/ Error$/i, ' Notice');
  }

  // 6. Check if Message Has Technical Jargon
  const hasTechnicalJargon = SENSITIVE_PATTERNS.some(p => p.test(msgStr));
  let finalMessage = hasTechnicalJargon
    ? sanitizeUserErrorMessage(rawMessage, 'We could not complete this action right now. Please try again in a moment.')
    : (sanitizeUserErrorMessage(rawMessage, msgStr) || 'We could not complete this action right now. Please try again in a moment.');

  // Clean any remaining code fragments
  finalMessage = finalMessage.replace(/\s*\([a-zA-Z0-9_\s]*code\s*\d+[^)]*\)/gi, '');
  finalMessage = finalMessage.replace(/\s*\(code\s*\d+\)/gi, '');
  finalMessage = finalMessage.replace(/\bSQLITE_\w+/gi, '');
  finalMessage = finalMessage.trim();

  if (!finalMessage) {
    finalMessage = 'We could not complete this action right now. Please try again in a moment.';
  }

  return {
    title: cleanTitle,
    message: finalMessage,
    tag: rawType === 'error' ? '• HELPFUL NOTICE' : undefined,
  };
}

/**
 * Logs technical diagnostics server-side / console-side for developer inspection.
 * This ensures developers have full debugging fidelity without exposing it to the user.
 * 
 * @param context Module or action name where the error occurred
 * @param error The original un-sanitized error
 * @param metadata Additional safe debugging metadata (e.g. userId, circleId)
 */
export function logInternalError(
  context: string,
  error: unknown,
  metadata?: Record<string, unknown>
): void {
  const timestamp = new Date().toISOString();
  const rawMessage = extractRawMessage(error);

  const isBusinessOrValidation =
    rawMessage.includes('Free tier') ||
    rawMessage.includes('limit') ||
    rawMessage.includes('violates') ||
    rawMessage.includes('registered') ||
    rawMessage.includes('required');

  if (isBusinessOrValidation) {
    console.warn(`[CircleGuard:Notice][${timestamp}][${context}] ${rawMessage || 'Handled notice'}`);
  } else {
    console.warn(`[CircleGuard:Diagnostic][${timestamp}][${context}] ${rawMessage || 'Handled exception'}`);
  }
}

/**
 * Helper to both log full diagnostic details internally and return a safe, gentle message for the UI.
 * 
 * @param context Module or action name
 * @param error Original error
 * @param fallbackMessage User-facing fallback
 * @param metadata Optional metadata to attach to server log
 * @returns Safe message for Alert or UI state
 */
export function handleServiceError(
  context: string,
  error: unknown,
  fallbackMessage?: string,
  metadata?: Record<string, unknown>
): string {
  logInternalError(context, error, metadata);
  return sanitizeUserErrorMessage(error, fallbackMessage);
}
