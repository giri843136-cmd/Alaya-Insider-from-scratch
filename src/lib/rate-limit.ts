// Simple in-memory rate limiter for sensitive endpoints.
// For production with multiple instances, use Redis-backed limiter.

const store = new Map<string, { count: number; resetAt: number }>();

// Clean expired entries periodically
setInterval(() => {
  const now = Date.now();
  const keys = Array.from(store.keys());
  keys.forEach(key => {
    const val = store.get(key);
    if (val && val.resetAt < now) store.delete(key);
  });
}, 60000);

export function rateLimit(
  key: string,
  maxRequests: number = 10,
  windowMs: number = 60000
): { allowed: boolean; remaining: number } {
  const now = Date.now();
  const entry = store.get(key);

  if (!entry || entry.resetAt < now) {
    store.set(key, { count: 1, resetAt: now + windowMs });
    return { allowed: true, remaining: maxRequests - 1 };
  }

  entry.count++;
  if (entry.count > maxRequests) {
    return { allowed: false, remaining: 0 };
  }

  return { allowed: true, remaining: maxRequests - entry.count };
}

/**
 * Client IP for rate-limiting and per-IP login lockout (TASK 2 FIX B).
 *
 * Deployment chain: client → hcdn (Hostinger CDN) → nginx (setup-nginx.sh:
 * `proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for`) → Node.
 * hcdn's exact header behaviour is not publicly documented, so we trust ONLY
 * the header our own nginx demonstrably sets and only its LEFTMOST value —
 * that is the client IP as hcdn handed it to nginx. Anything appended to the
 * right of it (including anything a client sent) is appended by proxies we
 * don't control and is spoofable, so it is ignored.
 *
 *  - X-Real-IP is deliberately NOT trusted: it is trivially settable by the
 *    client, and nginx overwrites it anyway.
 *  - X-Forwarded-Host / Forwarded (RFC 7239) are not set anywhere in this
 *    stack, so they are not read.
 *
 * A missing or unparseable value returns IP_UNTRUSTABLE — callers MUST treat
 * that as "we do not know who is asking" and apply their explicit fallback
 * policy (the login route accounts for it by IP-bucketing those requests;
 * see src/app/api/auth/login/route.ts).
 */
export const IP_UNTRUSTABLE = 'ip-untrustable';

const IPV4_RE = /^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/;
const IPV6_RE = /^[0-9a-f:]{2,45}$/i;

export function getClientIP(req: Request): string {
  const xff = req.headers.get('x-forwarded-for');
  if (xff) {
    // Leftmost value only; trim whitespace, reject anything that is not a
    // plausible IP literal (defeats "1.2.3.4, garbage" style games).
    const leftmost = xff.split(',')[0].trim();
    if (isPlausibleIP(leftmost)) return leftmost;
    return IP_UNTRUSTABLE;
  }
  return IP_UNTRUSTABLE;
}

function isPlausibleIP(value: string): boolean {
  if (!value) return false;
  const v4 = value.match(IPV4_RE);
  if (v4) return v4.slice(1).every(o => parseInt(o, 10) <= 255);
  // Accept IPv6 literals only in their plain form (no zone id, no brackets —
  // the edge chain always sends bare addresses).
  return value.includes(':') && IPV6_RE.test(value);
}
