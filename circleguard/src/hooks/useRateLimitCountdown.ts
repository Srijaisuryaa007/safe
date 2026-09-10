import { useState, useEffect, useCallback, useRef } from 'react';
import { RateLimiter, RateLimitResult } from '../services/RateLimiter';
import { RateLimitActionType } from '../constants/rateLimitConfig';

export interface UseRateLimitCountdownResult {
  /** Whether the operation is currently in backoff/blocked */
  isBlocked: boolean;
  /** Seconds remaining in the countdown */
  secondsRemaining: number;
  /** Formatted human-readable alert/reason */
  reason: string | null;
  /** Explicitly re-check status */
  checkStatus: () => Promise<RateLimitResult>;
  /** Record an attempt result (success or failure) and update local countdown */
  recordAttempt: (success: boolean) => Promise<RateLimitResult>;
  /** Clear backoff penalty */
  reset: () => Promise<void>;
}

export function useRateLimitCountdown(
  action: RateLimitActionType,
  accountId?: string | null
): UseRateLimitCountdownResult {
  const [secondsRemaining, setSecondsRemaining] = useState<number>(0);
  const [reason, setReason] = useState<string | null>(null);
  const timerRef = useRef<any>(null);

  const checkStatus = useCallback(async (): Promise<RateLimitResult> => {
    const res = await RateLimiter.checkLimit(action, accountId);
    if (!res.allowed && res.retryAfterSec > 0) {
      setSecondsRemaining(res.retryAfterSec);
      setReason(res.reason || `Please wait ${res.retryAfterSec}s before trying again.`);
    } else {
      setSecondsRemaining(0);
      setReason(null);
    }
    return res;
  }, [action, accountId]);

  const recordAttempt = useCallback(
    async (success: boolean): Promise<RateLimitResult> => {
      const res = await RateLimiter.recordAttempt(action, success, accountId);
      if (!res.allowed && res.retryAfterSec > 0) {
        setSecondsRemaining(res.retryAfterSec);
        setReason(res.reason || `Please wait ${res.retryAfterSec}s before trying again.`);
      } else {
        setSecondsRemaining(0);
        setReason(null);
      }
      return res;
    },
    [action, accountId]
  );

  const reset = useCallback(async () => {
    await RateLimiter.reset(action, accountId);
    setSecondsRemaining(0);
    setReason(null);
  }, [action, accountId]);

  // Handle countdown interval
  useEffect(() => {
    if (secondsRemaining > 0) {
      timerRef.current = setInterval(() => {
        setSecondsRemaining((prev) => {
          if (prev <= 1) {
            clearInterval(timerRef.current);
            timerRef.current = null;
            // When timer hits 0, recheck
            checkStatus();
            return 0;
          }
          return prev - 1;
        });
      }, 1000);
    }

    return () => {
      if (timerRef.current) {
        clearInterval(timerRef.current);
        timerRef.current = null;
      }
    };
  }, [secondsRemaining > 0, checkStatus]);

  // Initial check on mount or when account changes
  useEffect(() => {
    checkStatus();
  }, [checkStatus]);

  return {
    isBlocked: secondsRemaining > 0,
    secondsRemaining,
    reason,
    checkStatus,
    recordAttempt,
    reset,
  };
}
