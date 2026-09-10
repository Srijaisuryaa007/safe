/**
 * Production Rate Limiting Service
 * 
 * Supports:
 * - Exponential backoff on authentication routes (no hard lockouts)
 * - Dual-key tracking: Per-Account (email/identifier) and Per-Client (device/IP identifier)
 * - Moderate sliding-window limits for public endpoints
 * - Loose limits for authenticated actions
 * - Persistent state across app reloads via AsyncStorage
 */

import AsyncStorage from '@react-native-async-storage/async-storage';
import { RATE_LIMIT_CONFIG, RateLimitActionType, EndpointRateLimitRule } from '../constants/rateLimitConfig';

export interface RateLimitResult {
  /** Whether the requested operation is currently allowed to execute */
  allowed: boolean;
  /** Milliseconds the client must wait before retrying (0 if allowed) */
  retryAfterMs: number;
  /** Rounded seconds the client must wait before retrying (0 if allowed) */
  retryAfterSec: number;
  /** How many attempts remain in the current window before backoff triggers */
  attemptsRemaining: number;
  /** Reason description for UI alerts */
  reason?: string;
  /** Whether this delay is due to exponential backoff */
  isBackoff: boolean;
}

interface AttemptRecord {
  attempts: number;
  consecutiveFailures: number;
  firstAttemptTime: number;
  lastAttemptTime: number;
  blockedUntil: number;
}

const STORAGE_KEY = '@circleguard_rate_limits_v2';
const CLIENT_ID_KEY = '@circleguard_client_instance_id';

class RateLimiterService {
  private cache: Map<string, AttemptRecord> = new Map();
  private initialized: boolean = false;
  private clientId: string | null = null;
  private saveTimeout: any = null;

  constructor() {
    this.init();
  }

  private async init() {
    try {
      // 1. Load or generate client ID
      let id = await AsyncStorage.getItem(CLIENT_ID_KEY);
      if (!id) {
        id = 'client_' + Math.random().toString(36).substring(2, 15) + '_' + Date.now().toString(36);
        await AsyncStorage.setItem(CLIENT_ID_KEY, id);
      }
      this.clientId = id;

      // 2. Load stored attempt records
      const raw = await AsyncStorage.getItem(STORAGE_KEY);
      if (raw) {
        const parsed = JSON.parse(raw);
        const now = Date.now();
        for (const [k, v] of Object.entries(parsed)) {
          const rec = v as AttemptRecord;
          // Keep records that are either actively blocked or occurred within the last 24h
          if (rec.blockedUntil > now || (now - rec.lastAttemptTime) < 86400000) {
            this.cache.set(k, rec);
          }
        }
      }
    } catch (e) {
      console.warn('[RateLimiter] Error initializing state:', e);
    } finally {
      this.initialized = true;
    }
  }

  public async getClientId(): Promise<string> {
    if (this.clientId) return this.clientId;
    try {
      let id = await AsyncStorage.getItem(CLIENT_ID_KEY);
      if (!id) {
        id = 'client_' + Math.random().toString(36).substring(2, 15) + '_' + Date.now().toString(36);
        await AsyncStorage.setItem(CLIENT_ID_KEY, id);
      }
      this.clientId = id;
      return id;
    } catch {
      return 'client_fallback_instance';
    }
  }

  private scheduleSave() {
    if (this.saveTimeout) return;
    this.saveTimeout = setTimeout(async () => {
      this.saveTimeout = null;
      try {
        const obj: Record<string, AttemptRecord> = {};
        const now = Date.now();
        for (const [k, v] of this.cache.entries()) {
          if (v.blockedUntil > now || (now - v.lastAttemptTime) < 86400000) {
            obj[k] = v;
          }
        }
        await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(obj));
      } catch (e) {
        console.warn('[RateLimiter] Failed to persist state:', e);
      }
    }, 500);
  }

  private buildKey(action: RateLimitActionType, type: 'client' | 'account', identifier: string): string {
    const cleanId = identifier.trim().toLowerCase();
    return `${action}:${type}:${cleanId}`;
  }

  /**
   * Evaluates a single record against the rule
   */
  private evaluateRecord(record: AttemptRecord | undefined, rule: EndpointRateLimitRule, now: number): {
    allowed: boolean;
    retryAfterMs: number;
    attemptsRemaining: number;
    isBackoff: boolean;
  } {
    if (!record) {
      return {
        allowed: true,
        retryAfterMs: 0,
        attemptsRemaining: rule.maxAttempts,
        isBackoff: false,
      };
    }

    // 1. Check if currently blocked by exponential backoff or window lockout
    if (record.blockedUntil > now) {
      const waitMs = record.blockedUntil - now;
      return {
        allowed: false,
        retryAfterMs: waitMs,
        attemptsRemaining: 0,
        isBackoff: rule.exponentialBackoff,
      };
    }

    // 2. Window expiration check
    const windowElapsed = now - record.firstAttemptTime;
    if (windowElapsed > rule.windowMs) {
      // Window expired, allowed fresh
      return {
        allowed: true,
        retryAfterMs: 0,
        attemptsRemaining: rule.maxAttempts,
        isBackoff: false,
      };
    }

    // 3. For exponential backoff routes, if blockedUntil has elapsed, retry is permitted (no hard lockout)
    if (rule.exponentialBackoff) {
      return {
        allowed: true,
        retryAfterMs: 0,
        attemptsRemaining: Math.max(0, rule.maxAttempts - record.attempts),
        isBackoff: true,
      };
    }

    // 4. For non-exponential endpoints (standard sliding window), enforce window attempt limit
    const remaining = Math.max(0, rule.maxAttempts - record.attempts);
    if (remaining === 0) {
      // Window limit reached without exponential backoff
      const windowRemainingMs = Math.max(0, rule.windowMs - windowElapsed);
      return {
        allowed: false,
        retryAfterMs: windowRemainingMs,
        attemptsRemaining: 0,
        isBackoff: false,
      };
    }

    return {
      allowed: true,
      retryAfterMs: 0,
      attemptsRemaining: remaining,
      isBackoff: false,
    };
  }

  /**
   * Checks if an action is currently permitted under both client and account constraints.
   * Does NOT increment attempt counter.
   */
  public async checkLimit(
    action: RateLimitActionType,
    accountId?: string | null,
    customClientId?: string
  ): Promise<RateLimitResult> {
    if (!this.initialized) await this.init();
    const rule = RATE_LIMIT_CONFIG[action];
    const now = Date.now();
    const cId = customClientId || (await this.getClientId());

    // 1. Check client limit
    let clientResult = { allowed: true, retryAfterMs: 0, attemptsRemaining: rule.maxAttempts, isBackoff: false };
    if (rule.trackPerClient) {
      const clientKey = this.buildKey(action, 'client', cId);
      clientResult = this.evaluateRecord(this.cache.get(clientKey), rule, now);
    }

    // 2. Check account limit
    let accountResult = { allowed: true, retryAfterMs: 0, attemptsRemaining: rule.maxAttempts, isBackoff: false };
    if (rule.trackPerAccount && accountId) {
      const accountKey = this.buildKey(action, 'account', accountId);
      accountResult = this.evaluateRecord(this.cache.get(accountKey), rule, now);
    }

    // The stricter constraint governs
    const allowed = clientResult.allowed && accountResult.allowed;
    const retryAfterMs = Math.max(clientResult.retryAfterMs, accountResult.retryAfterMs);
    const retryAfterSec = Math.ceil(retryAfterMs / 1000);
    const attemptsRemaining = Math.min(clientResult.attemptsRemaining, accountResult.attemptsRemaining);
    const isBackoff = clientResult.isBackoff || accountResult.isBackoff;

    let reason: string | undefined;
    if (!allowed) {
      if (!accountResult.allowed) {
        reason = `Too many failed attempts for this account. Please wait ${retryAfterSec}s before retrying.`;
      } else {
        reason = `Too many requests from this device. Please wait ${retryAfterSec}s before retrying.`;
      }
    }

    return {
      allowed,
      retryAfterMs,
      retryAfterSec,
      attemptsRemaining,
      reason,
      isBackoff,
    };
  }

  /**
   * Records the outcome of an action.
   * If success: clears backoff and consecutive failures.
   * If failure: increments attempt count and computes exponential backoff if configured.
   */
  public async recordAttempt(
    action: RateLimitActionType,
    success: boolean,
    accountId?: string | null,
    customClientId?: string
  ): Promise<RateLimitResult> {
    if (!this.initialized) await this.init();
    const rule = RATE_LIMIT_CONFIG[action];
    const now = Date.now();
    const cId = customClientId || (await this.getClientId());

    const keysToUpdate: { key: string; isAccount: boolean }[] = [];
    if (rule.trackPerClient) {
      keysToUpdate.push({ key: this.buildKey(action, 'client', cId), isAccount: false });
    }
    if (rule.trackPerAccount && accountId) {
      keysToUpdate.push({ key: this.buildKey(action, 'account', accountId), isAccount: true });
    }

    for (const item of keysToUpdate) {
      let record = this.cache.get(item.key);

      if (success && rule.exponentialBackoff) {
        // Auth success resets consecutive failures & active backoffs
        if (record) {
          record.consecutiveFailures = 0;
          record.blockedUntil = 0;
          record.attempts = 0;
          record.firstAttemptTime = now;
          record.lastAttemptTime = now;
        }
      } else {
        // General action tracking (success or failure) & auth failure tracking
        if (!record || (now - record.firstAttemptTime) > rule.windowMs) {
          record = {
            attempts: 1,
            consecutiveFailures: success ? 0 : ((record?.consecutiveFailures || 0) + 1),
            firstAttemptTime: now,
            lastAttemptTime: now,
            blockedUntil: 0,
          };
        } else {
          record.attempts += 1;
          if (!success) {
            record.consecutiveFailures += 1;
          } else {
            record.consecutiveFailures = 0;
          }
          record.lastAttemptTime = now;
        }

        // Apply exponential backoff or standard window lockout
        if (rule.exponentialBackoff && !success) {
          if (record.consecutiveFailures >= rule.maxAttempts) {
            const exponent = record.consecutiveFailures - rule.maxAttempts;
            // delay = base * (factor ^ exponent), capped at maxBackoffMs
            const delayMs = Math.min(
              rule.maxBackoffMs,
              Math.round(rule.baseBackoffMs * Math.pow(rule.backoffFactor, exponent))
            );
            record.blockedUntil = now + delayMs;
          }
        } else if (!rule.exponentialBackoff && record.attempts >= rule.maxAttempts) {
          record.blockedUntil = Math.max(record.blockedUntil, record.firstAttemptTime + rule.windowMs);
        }

        this.cache.set(item.key, record);
      }
    }

    this.scheduleSave();
    return this.checkLimit(action, accountId, customClientId);
  }

  /**
   * Resets rate limit for a specific action and identifier (e.g. after successful login or verified email)
   */
  public async reset(action: RateLimitActionType, accountId?: string | null, customClientId?: string): Promise<void> {
    if (!this.initialized) await this.init();
    const cId = customClientId || (await this.getClientId());
    const rule = RATE_LIMIT_CONFIG[action];

    if (rule.trackPerClient) {
      this.cache.delete(this.buildKey(action, 'client', cId));
    }
    if (rule.trackPerAccount && accountId) {
      this.cache.delete(this.buildKey(action, 'account', accountId));
    }
    this.scheduleSave();
  }

  /**
   * Clear all records (useful for test suites and dev diagnostics)
   */
  public async clearAll(): Promise<void> {
    this.cache.clear();
    await AsyncStorage.removeItem(STORAGE_KEY);
  }
}

export const RateLimiter = new RateLimiterService();
