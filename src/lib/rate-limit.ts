// Simple in-memory rate limiter for sensitive endpoints.
// For production with multiple instances, use Redis-backed limiter.

const store = new Map<string, { count: number; resetAt: number }>();

// Clean expired entries periodically. The timer is unref'd so importing this
// module never keeps a Node process (jest worker, script) alive; under jest
// the clock is faked/absent, so we skip the interval entirely there.
const canSweep =
  typeof setTimeout === 'function' &&
  typeof (setTimeout as unknown as { ___promisify__?: unknown }).___promisify__ === 'undefined' &&
  !process.env.JEST_WORKER_ID;

if (canSweep) {
  const sweep = setInterval(() => {
    const now = Date.now();
    const keys = Array.from(store.keys());
    keys.forEach(key => {
      const val = store.get(key);
      if (val && val.resetAt < now) store.delete(key);
    });
  }, 60000);
  (sweep as unknown as { unref?: () => void }).unref?.();
}

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
 * Client IP for rate-limiting and per-IP login lockout (TASK 2 FIX B + FIX D).
 *
 * Deployment chain: client → hcdn (Hostinger CDN) → Node (hPanel Node.js
 * runtime). There is no nginx layer we control; the edge is configured in
 * hPanel and must OVERWRITE X-Forwarded-For, not append.
 *
 * FIX D: a correctly-configured edge overwrites X-Forwarded-For with the
 * single address it saw, so a well-formed header has ONE element. A header
 * with MORE than one comma-separated element therefore cannot have come from
 * a compliant edge (client-injected at the last hop, or an appending proxy
 * in front of us) — it is treated as spoofed and the request is marked
 * IP_UNTRUSTABLE even if the leftmost value parses as a valid IP.
 *
 *  - X-Real-IP is deliberately NOT trusted: it is trivially settable by the
 *    client, and the edge overwrites it anyway.
 *  - X-Forwarded-Host / Forwarded (RFC 7239) are not set anywhere in this
 *    stack, so they are not read.
 *
 * A missing, multi-element, or unparseable value returns IP_UNTRUSTABLE —
 * callers MUST treat that as "we do not know who is asking" and apply their
 * explicit fallback policy (the login route buckets those requests together;
 * see src/app/api/auth/login/route.ts).
 */
export const IP_UNTRUSTABLE = 'ip-untrustable';

const IPV4_RE = /^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/;
const IPV6_RE = /^[0-9a-f:]{2,45}$/i;

export function getClientIP(req: Request): string {
  const xff = req.headers.get('x-forwarded-for');
  if (xff) {
    // FIX D: our nginx OVERWRITES this header, so a conforming request has
    // exactly ONE element. More than one element ⇒ a client-injected chain
    // survived to the app ⇒ the leftmost value is attacker-chosen: reject.
    if (xff.includes(',')) return IP_UNTRUSTABLE;
    const value = xff.trim();
    if (isPlausibleIP(value)) return value;
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
