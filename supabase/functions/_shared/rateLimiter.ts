/**
 * Production Rate Limiter for Supabase Edge Functions (Deno)
 * 
 * In-memory sliding-window rate limiting with IP extraction and configurable thresholds.
 */

interface ClientBucket {
  count: number;
  resetAt: number;
}

const buckets = new Map<string, ClientBucket>();

export interface EdgeRateLimitOptions {
  /** Maximum requests allowed in the given window */
  maxRequests?: number;
  /** Window duration in seconds */
  windowSeconds?: number;
}

/**
 * Extracts client IP from incoming request headers
 */
export function getClientIp(req: Request): string {
  return (
    req.headers.get("cf-connecting-ip") ||
    req.headers.get("x-real-ip") ||
    req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
    "unknown-client-ip"
  );
}

/**
 * Checks rate limit for an incoming request.
 * Returns { allowed, retryAfterSeconds, remaining }
 */
export function checkEdgeRateLimit(
  req: Request,
  actionKey: string,
  options?: EdgeRateLimitOptions
): { allowed: boolean; retryAfterSeconds: number; remaining: number } {
  const envMax = Deno.env.get("RATE_LIMIT_EDGE_MAX_REQUESTS");
  const envWindow = Deno.env.get("RATE_LIMIT_EDGE_WINDOW_SEC");

  const maxRequests = options?.maxRequests || (envMax ? parseInt(envMax, 10) : 60);
  const windowMs = (options?.windowSeconds || (envWindow ? parseInt(envWindow, 10) : 60)) * 1000;

  const ip = getClientIp(req);
  const compositeKey = `${actionKey}:${ip}`;
  const now = Date.now();

  let bucket = buckets.get(compositeKey);

  if (!bucket || now >= bucket.resetAt) {
    bucket = {
      count: 1,
      resetAt: now + windowMs,
    };
    buckets.set(compositeKey, bucket);
    return {
      allowed: true,
      retryAfterSeconds: 0,
      remaining: maxRequests - 1,
    };
  }

  bucket.count += 1;

  if (bucket.count > maxRequests) {
    const retryAfter = Math.ceil((bucket.resetAt - now) / 1000);
    return {
      allowed: false,
      retryAfterSeconds: Math.max(1, retryAfter),
      remaining: 0,
    };
  }

  return {
    allowed: true,
    retryAfterSeconds: 0,
    remaining: Math.max(0, maxRequests - bucket.count),
  };
}
