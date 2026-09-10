/**
 * CircleGuard Secure Error Handler
 * 
 * Prevents information leakage (stack traces, internal file paths,
 * raw database schema names, constraint details) to the end user,
 * while ensuring full diagnostic logging for internal/server-side debugging.
 */

interface ErrorDetails {
  message?: string;
  code?: string | number;
  details?: string;
  hint?: string;
  stack?: string;
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
  // Node / OS system errors
  /\b(?:ENOENT|EACCES|ECONNREFUSED|ECONNRESET|ETIMEDOUT|EHOSTUNREACH)\b/
];

/**
 * Known PostgreSQL constraints / Supabase Auth error patterns mapped to clean messages
 */
const KNOWN_ERROR_MAPPINGS: Array<{ test: RegExp; message: string }> = [
  // Unique constraints
  {
    test: /unique constraint.*profiles_phone/i,
    message: "This phone number is already registered to another account."
  },
  {
    test: /duplicate key.*phone/i,
    message: "This phone number is already registered to another account."
  },
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
    message: "Please enter a valid phone number in E.164 format (e.g. +1234567890)."
  },
  {
    test: /violates check constraint.*email/i,
    message: "Please enter a valid email address."
  },
  {
    test: /violates check constraint.*circle_name/i,
    message: "Circle name must be between 1 and 50 characters."
  },
  {
    test: /violates check constraint.*message_content/i,
    message: "Message must be between 1 and 2000 characters."
  },
  {
    test: /violates check constraint.*(?:latitude|longitude|coords)/i,
    message: "Invalid location coordinates provided."
  },
  {
    test: /violates check constraint/i,
    message: "One or more inputs failed validation rules."
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
    message: "Referenced resource does not exist."
  },

  // Row Level Security (RLS) & Permissions
  {
    test: /row-level security policy/i,
    message: "You do not have permission to perform this action."
  },
  {
    test: /permission denied/i,
    message: "You do not have permission to perform this action."
  },

  // Supabase Auth & JWT
  {
    test: /Invalid login credentials/i,
    message: "Invalid email or password. Please try again."
  },
  {
    test: /Email not confirmed/i,
    message: "Please verify your email address before signing in."
  },
  {
    test: /Password should be at least/i,
    message: "Password is too weak. Please use at least 8 characters."
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
    message: "Service connection issue. Please restart the app or check network."
  },
  {
    test: /already registered/i,
    message: "An account with this email address already exists. Please sign in instead."
  },
  {
    test: /rate limit/i,
    message: "Email sending limit reached. Please wait a few minutes before trying again."
  },
  {
    test: /Database error saving new user/i,
    message: "Unable to complete registration at this time. Please try again."
  },
  {
    test: /Signups not allowed|Signup is disabled/i,
    message: "Signups are currently disabled. Please contact support."
  },

  // Network / Transport
  {
    test: /Network request failed|Failed to fetch/i,
    message: "Network error. Please check your internet connection and try again."
  },
  {
    test: /timeout|timed out/i,
    message: "Request timed out. Please check your connection and try again."
  }
];

/**
 * Extracts raw string message from unknown error object
 */
function extractRawMessage(error: unknown): string {
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
  fallbackMessage: string = "An unexpected error occurred. Please try again later."
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
  if (raw.length > 200) {
    return fallbackMessage;
  }

  // 4. Safe to display as-is if clean and concise
  return raw.trim();
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
  const stack = error instanceof Error ? error.stack : undefined;

  // In production, this can forward to Sentry / Datadog / Supabase error logs
  console.error(`[CircleGuard:Error][${timestamp}][${context}] ${rawMessage || 'Unknown error'}`, {
    message: rawMessage,
    stack,
    metadata,
    rawError: error
  });
}

/**
 * Helper to both log full diagnostic details internally and return a safe message for the UI.
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
