/**
 * In-Memory Sliding Window Rate Limiter
 * Provides thread-safe, dependency-free rate limiting for single-instance Next.js deployment.
 */

interface RateLimitEntry {
  timestamps: number[];
}

const rateLimitStore = new Map<string, RateLimitEntry>();

// Periodic garbage collection every 5 minutes to prevent memory leak
const CLEANUP_INTERVAL_MS = 5 * 60 * 1000;

if (typeof globalThis !== 'undefined') {
  const globalWithRateLimit = globalThis as typeof globalThis & {
    __rateLimitCleanupInterval?: NodeJS.Timeout;
  };

  if (!globalWithRateLimit.__rateLimitCleanupInterval) {
    globalWithRateLimit.__rateLimitCleanupInterval = setInterval(() => {
      const now = Date.now();
      for (const [key, entry] of rateLimitStore.entries()) {
        // Keep timestamps younger than 10 minutes
        entry.timestamps = entry.timestamps.filter((ts) => now - ts < 10 * 60 * 1000);
        if (entry.timestamps.length === 0) {
          rateLimitStore.delete(key);
        }
      }
    }, CLEANUP_INTERVAL_MS);
    // Unref interval so it won't block process exit in tests/scripts
    if (globalWithRateLimit.__rateLimitCleanupInterval.unref) {
      globalWithRateLimit.__rateLimitCleanupInterval.unref();
    }
  }
}

export interface RateLimitResult {
  success: boolean;
  limit: number;
  remaining: number;
  resetInSeconds: number;
}

/**
 * Check if an action is within rate limits using sliding window counter
 * @param key Unique identifier (e.g. IP address or `login:${ip}`)
 * @param limit Max requests allowed in the window
 * @param windowMs Window duration in milliseconds
 */
export function checkRateLimit(
  key: string,
  limit: number,
  windowMs: number
): RateLimitResult {
  const now = Date.now();
  const windowStart = now - windowMs;

  let entry = rateLimitStore.get(key);
  if (!entry) {
    entry = { timestamps: [] };
    rateLimitStore.set(key, entry);
  }

  // Remove timestamps outside the sliding window
  entry.timestamps = entry.timestamps.filter((ts) => ts > windowStart);

  const resetInSeconds = Math.max(
    1,
    Math.ceil(
      (entry.timestamps.length > 0
        ? entry.timestamps[0] + windowMs - now
        : windowMs) / 1000
    )
  );

  if (entry.timestamps.length >= limit) {
    return {
      success: false,
      limit,
      remaining: 0,
      resetInSeconds,
    };
  }

  // Record this attempt
  entry.timestamps.push(now);

  return {
    success: true,
    limit,
    remaining: limit - entry.timestamps.length,
    resetInSeconds,
  };
}

const FALLBACK_IP = '127.0.0.1';
const DEFAULT_TRUSTED_PROXY_HOPS = 1;

function trustedProxyHops(): number {
  const raw = process.env.TRUSTED_PROXY_HOPS;
  if (raw === undefined || raw.trim() === '') return DEFAULT_TRUSTED_PROXY_HOPS;
  const parsed = Number(raw);
  return Number.isInteger(parsed) && parsed >= 0 ? parsed : DEFAULT_TRUSTED_PROXY_HOPS;
}

/**
 * Resolve the client IP behind a reverse proxy we operate.
 *
 * Forwarded headers are client-controlled, so the leftmost x-forwarded-for entry is never used.
 * With N trusted proxies the real client is the Nth entry from the right; entries to its left are
 * attacker-supplied. TRUSTED_CLIENT_IP_HEADER names a header the proxy overwrites (for example
 * cf-connecting-ip) and takes precedence when set. TRUSTED_PROXY_HOPS=0 means no proxy: all
 * forwarded headers are ignored.
 */
export function getClientIp(headers: Headers): string {
  const hops = trustedProxyHops();
  if (hops === 0) return FALLBACK_IP;

  const trustedHeader = process.env.TRUSTED_CLIENT_IP_HEADER?.trim().toLowerCase();
  if (trustedHeader) {
    const value = headers.get(trustedHeader)?.trim();
    if (value) return value;
  }

  const forwarded = headers.get('x-forwarded-for');
  if (forwarded) {
    const ips = forwarded.split(',').map((ip) => ip.trim()).filter(Boolean);
    if (ips.length > 0) return ips[Math.max(ips.length - hops, 0)];
  }

  return FALLBACK_IP;
}

