import { NextRequest, NextResponse } from "next/server";

/**
 * Simple in-process rate limiter (per-cold-start window).
 * For production scale, replace with Upstash Redis:
 *   UPSTASH_REDIS_REST_URL + UPSTASH_REDIS_REST_TOKEN in .env
 *   and use @upstash/ratelimit + @upstash/redis
 */

const counters = new Map<string, { count: number; reset: number }>();

export interface RateLimitConfig {
  /** Max requests per window */
  limit: number;
  /** Window duration in ms */
  windowMs: number;
}

export function checkRateLimit(
  key: string,
  config: RateLimitConfig,
): { ok: boolean; remaining: number; resetAt: number } {
  const now = Date.now();
  const entry = counters.get(key);

  if (!entry || now > entry.reset) {
    counters.set(key, { count: 1, reset: now + config.windowMs });
    return { ok: true, remaining: config.limit - 1, resetAt: now + config.windowMs };
  }

  entry.count++;
  if (entry.count > config.limit) {
    return { ok: false, remaining: 0, resetAt: entry.reset };
  }

  return { ok: true, remaining: config.limit - entry.count, resetAt: entry.reset };
}

/** Returns a 429 NextResponse if rate-limited, or null if the request is allowed. */
export function rateLimit(
  req: NextRequest,
  keyPrefix: string,
  config: RateLimitConfig,
): NextResponse | null {
  const ip =
    req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ??
    req.headers.get("x-real-ip") ??
    "unknown";

  const result = checkRateLimit(`${keyPrefix}:${ip}`, config);

  if (!result.ok) {
    return NextResponse.json(
      { error: "Too many requests. Please try again later." },
      {
        status: 429,
        headers: {
          "Retry-After": String(Math.ceil((result.resetAt - Date.now()) / 1000)),
          "X-RateLimit-Limit": String(config.limit),
          "X-RateLimit-Remaining": "0",
        },
      },
    );
  }

  return null;
}
