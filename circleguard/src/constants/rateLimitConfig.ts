/**
 * Production Rate Limiting Configuration
 * 
 * All thresholds, window intervals, and exponential backoff parameters are fully configurable.
 * Supports environment variable overrides (e.g. via EXPO_PUBLIC_*) or dynamic runtime updates.
 */

export interface EndpointRateLimitRule {
  /** Maximum number of attempts allowed before backoff or rate limit kicks in */
  maxAttempts: number;
  /** Time window in milliseconds across which attempts are evaluated */
  windowMs: number;
  /** Whether to use exponential backoff instead of a hard lockout */
  exponentialBackoff: boolean;
  /** Base delay in milliseconds for the first backoff stage */
  baseBackoffMs: number;
  /** Multiplier for each subsequent consecutive failure */
  backoffFactor: number;
  /** Maximum delay cap in milliseconds to avoid indefinite lockouts */
  maxBackoffMs: number;
  /** Whether attempts should be tracked per-account (e.g. email) */
  trackPerAccount?: boolean;
  /** Whether attempts should be tracked per-client (e.g. device/IP) */
  trackPerClient?: boolean;
  /** Descriptive label for UI notifications */
  label: string;
}

export type RateLimitActionType =
  // Authentication Routes (Strict, Exponential Backoff, Dual-Key)
  | 'AUTH_LOGIN'
  | 'AUTH_SIGNUP'
  | 'AUTH_PASSWORD_RESET'
  // Public Endpoints (Moderate, Sliding Window)
  | 'PUBLIC_INVITE_CODE'
  | 'PUBLIC_WEBHOOK'
  // Authenticated Actions (Loose, Burst Allowance)
  | 'AUTHED_CHAT_MESSAGE'
  | 'AUTHED_SOS_ALERT'
  | 'AUTHED_LOCATION_PING';

const parseEnvInt = (key: string, fallback: number): number => {
  const val = typeof process !== 'undefined' && process.env ? process.env[key] : undefined;
  if (!val) return fallback;
  const parsed = parseInt(val, 10);
  return isNaN(parsed) ? fallback : parsed;
};

export const RATE_LIMIT_CONFIG: Record<RateLimitActionType, EndpointRateLimitRule> = {
  // ============================================================================
  // 1. AUTHENTICATION ROUTES (STRICT, EXPONENTIAL BACKOFF, DUAL-KEY)
  // ============================================================================
  AUTH_LOGIN: {
    maxAttempts: parseEnvInt('EXPO_PUBLIC_RL_LOGIN_MAX_ATTEMPTS', 5),
    windowMs: parseEnvInt('EXPO_PUBLIC_RL_LOGIN_WINDOW_SEC', 300) * 1000, // 5 minutes
    exponentialBackoff: true,
    baseBackoffMs: parseEnvInt('EXPO_PUBLIC_RL_LOGIN_BASE_BACKOFF_SEC', 2) * 1000, // 2s -> 4s -> 8s -> 16s...
    backoffFactor: 2.0,
    maxBackoffMs: parseEnvInt('EXPO_PUBLIC_RL_LOGIN_MAX_BACKOFF_SEC', 300) * 1000, // Cap at 5 minutes
    trackPerAccount: true,
    trackPerClient: true,
    label: 'Sign In',
  },

  AUTH_SIGNUP: {
    maxAttempts: parseEnvInt('EXPO_PUBLIC_RL_SIGNUP_MAX_ATTEMPTS', 3),
    windowMs: parseEnvInt('EXPO_PUBLIC_RL_SIGNUP_WINDOW_SEC', 600) * 1000, // 10 minutes
    exponentialBackoff: true,
    baseBackoffMs: parseEnvInt('EXPO_PUBLIC_RL_SIGNUP_BASE_BACKOFF_SEC', 5) * 1000, // 5s -> 10s -> 20s...
    backoffFactor: 2.0,
    maxBackoffMs: parseEnvInt('EXPO_PUBLIC_RL_SIGNUP_MAX_BACKOFF_SEC', 600) * 1000, // Cap at 10 minutes
    trackPerAccount: true,
    trackPerClient: true,
    label: 'Sign Up',
  },

  AUTH_PASSWORD_RESET: {
    maxAttempts: parseEnvInt('EXPO_PUBLIC_RL_PW_RESET_MAX_ATTEMPTS', 3),
    windowMs: parseEnvInt('EXPO_PUBLIC_RL_PW_RESET_WINDOW_SEC', 900) * 1000, // 15 minutes
    exponentialBackoff: true,
    baseBackoffMs: parseEnvInt('EXPO_PUBLIC_RL_PW_RESET_BASE_BACKOFF_SEC', 10) * 1000, // 10s -> 20s -> 40s...
    backoffFactor: 2.0,
    maxBackoffMs: parseEnvInt('EXPO_PUBLIC_RL_PW_RESET_MAX_BACKOFF_SEC', 900) * 1000, // Cap at 15 minutes
    trackPerAccount: true,
    trackPerClient: true,
    label: 'Password Reset',
  },

  // ============================================================================
  // 2. PUBLIC ENDPOINTS (MODERATE LIMITS, SLIDING WINDOW)
  // ============================================================================
  PUBLIC_INVITE_CODE: {
    maxAttempts: parseEnvInt('EXPO_PUBLIC_RL_INVITE_MAX_ATTEMPTS', 10), // 10 attempts per minute
    windowMs: parseEnvInt('EXPO_PUBLIC_RL_INVITE_WINDOW_SEC', 60) * 1000, // 1 minute
    exponentialBackoff: false,
    baseBackoffMs: 10000, // 10s cooldown if threshold exceeded
    backoffFactor: 1.5,
    maxBackoffMs: 60000,
    trackPerAccount: false,
    trackPerClient: true,
    label: 'Circle Invite Code Lookup',
  },

  PUBLIC_WEBHOOK: {
    maxAttempts: parseEnvInt('EXPO_PUBLIC_RL_WEBHOOK_MAX_ATTEMPTS', 60), // 60 requests per minute
    windowMs: parseEnvInt('EXPO_PUBLIC_RL_WEBHOOK_WINDOW_SEC', 60) * 1000, // 1 minute
    exponentialBackoff: false,
    baseBackoffMs: 15000,
    backoffFactor: 1.0,
    maxBackoffMs: 60000,
    trackPerAccount: false,
    trackPerClient: true,
    label: 'Public Webhook',
  },

  // ============================================================================
  // 3. AUTHENTICATED USER ACTIONS (LOOSER LIMITS, HIGH BURST ALLOWANCE)
  // ============================================================================
  AUTHED_CHAT_MESSAGE: {
    maxAttempts: parseEnvInt('EXPO_PUBLIC_RL_CHAT_MAX_ATTEMPTS', 30), // 30 messages per 30 seconds
    windowMs: 30 * 1000,
    exponentialBackoff: false,
    baseBackoffMs: 5000,
    backoffFactor: 1.2,
    maxBackoffMs: 30000,
    trackPerAccount: true,
    trackPerClient: true,
    label: 'Chat Message',
  },

  AUTHED_SOS_ALERT: {
    maxAttempts: parseEnvInt('EXPO_PUBLIC_RL_SOS_MAX_ATTEMPTS', 5), // 5 SOS triggers per 60 seconds
    windowMs: 60 * 1000,
    exponentialBackoff: false,
    baseBackoffMs: 5000,
    backoffFactor: 1.0,
    maxBackoffMs: 15000,
    trackPerAccount: true,
    trackPerClient: true,
    label: 'SOS Alert Trigger',
  },

  AUTHED_LOCATION_PING: {
    maxAttempts: parseEnvInt('EXPO_PUBLIC_RL_LOC_MAX_ATTEMPTS', 120), // 120 pings per minute
    windowMs: 60 * 1000,
    exponentialBackoff: false,
    baseBackoffMs: 2000,
    backoffFactor: 1.0,
    maxBackoffMs: 10000,
    trackPerAccount: true,
    trackPerClient: false,
    label: 'Location Telemetry Ping',
  },
};
