import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import jwt from 'jsonwebtoken';
import { getAuthSecret, assertUsableSessionSecret } from '@/lib/auth-secret';

/**
 * Server-side gate for the admin panel.
 *
 * Every /admin/* page except /admin/login and every /api/admin/* route
 * requires a valid session JWT (the existing auth_token cookie — same name,
 * flags and secret as src/lib/auth.ts; no new auth system). Unauthenticated:
 *   - /admin/*          → 302 redirect to /admin/login
 *   - /api/admin/*      → 401 JSON
 * This replaces the old client-side-only "Loading… shell → login form"
 * behaviour, which served 200 + the admin HTML to anyone.
 *
 * The Node.js runtime (`runtime: 'nodejs'` in the config below — stable in
 * Next 15.5+/16, no experimental flag needed) is required for jwt
 * verification, since jsonwebtoken is not edge-compatible.
 * Read-only here: no DB access, no cookie mutation.
 *
 * FIX A (TASK 2): no insecure secret fallback. getAuthSecret() throws at
 * module load when NODE_ENV=production runs without AUTH_SECRET, so an
 * under-configured deploy refuses to start instead of silently accepting
 * attacker-forged cookies.
 *
 * Defence in depth, not the only layer: every /api/* mutating handler keeps
 * its own getAuthUser() check, so authorization never depends on middleware
 * matching alone.
 */

const AUTH_SECRET = getAuthSecret();

function hasValidSession(req: NextRequest): boolean {
  // FIX E belt: a serving process must never verify sessions against the
  // public dev sentinel, even if one was somehow loaded at boot.
  assertUsableSessionSecret(AUTH_SECRET);
  const token = req.cookies.get('auth_token')?.value;
  if (!token) return false;
  try {
    jwt.verify(token, AUTH_SECRET);
    return true;
  } catch {
    return false;
  }
}

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // ── Admin gate ──────────────────────────────────────────────────────────
  if (pathname === '/admin' || pathname.startsWith('/admin/')) {
    if (pathname !== '/admin/login') {
      if (!hasValidSession(request)) {
        const login = new URL('/admin/login', request.url);
        const res = NextResponse.redirect(login, 302);
        res.headers.set('Cache-Control', 'no-store, no-cache, must-revalidate');
        res.headers.set('Pragma', 'no-cache');
        return res;
      }
      // Authenticated admin page: never cache, so one user's HTML can never
      // be served to another from the CDN.
      const res = NextResponse.next();
      res.headers.set('Cache-Control', 'no-store, no-cache, must-revalidate');
      res.headers.set('Pragma', 'no-cache');
      res.headers.set('Surrogate-Control', 'no-store');
      return res;
    }
    // /admin/login: the login page itself must stay public and uncacheable.
    const res = NextResponse.next();
    res.headers.set('Cache-Control', 'no-store, no-cache, must-revalidate');
    res.headers.set('Pragma', 'no-cache');
    return res;
  }

  // ── Authenticated admin API gate ────────────────────────────────────────
  // Handlers still enforce auth themselves (defence in depth); this guarantees
  // the 401 for cookie-less callers even if a route forgets.
  if (pathname === '/api/admin' || pathname.startsWith('/api/admin/')) {
    if (!hasValidSession(request)) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401, headers: { 'Cache-Control': 'no-store' } },
      );
    }
    const res = NextResponse.next();
    res.headers.set('Cache-Control', 'no-store');
    return res;
  }

  // ── Non-admin APIs: dynamic, never CDN-cached ───────────────────────────
  // Route handlers own their data freshness; caching JSON here risks serving
  // one user's error/empty state to another. Explicit no-store keeps the
  // pre-TASK-11 guarantee for APIs while public HTML becomes cacheable below.
  if (pathname === '/api' || pathname.startsWith('/api/')) {
    const res = NextResponse.next();
    res.headers.set('Cache-Control', 'no-store, no-cache, must-revalidate');
    res.headers.set('Pragma', 'no-cache');
    return res;
  }

  // ── Any authenticated request to a non-admin path: never cache ──────────
  // A response rendered for a session-bearing request must never enter a
  // shared cache — defence in depth even though public pages are identical
  // for anonymous and logged-in visitors.
  if (request.cookies.get('auth_token')?.value) {
    const res = NextResponse.next();
    res.headers.set('Cache-Control', 'no-store, no-cache, must-revalidate');
    res.headers.set('Pragma', 'no-cache');
    return res;
  }

  // ── TASK 11: anonymous public traffic becomes CDN-cacheable ───────────
  // Deliberately NO `Vary` on cookies (must-not-vary-on-cookie): the cached
  // object is the anonymous render, identical for every visitor.
  const IMAGE_RE = /\.(png|jpe?g|webp|avif|gif|svg|ico|woff2?|ttf|otf)$/i;
  const response = NextResponse.next();
  if (IMAGE_RE.test(pathname)) {
    // Static-ish assets: long CDN life, short browser life.
    response.headers.set(
      'Cache-Control',
      'public, max-age=300, s-maxage=86400, stale-while-revalidate=604800',
    );
    response.headers.set(
      'Surrogate-Control',
      'max-age=86400, stale-while-revalidate=604800',
    );
  } else {
    // Public HTML (+ sitemap.xml / robots.txt): CDN caches 5 min and serves
    // stale while revalidating; browsers always revalidate (max-age=0).
    response.headers.set(
      'Cache-Control',
      'public, max-age=0, must-revalidate, s-maxage=300, stale-while-revalidate=86400',
    );
    response.headers.set(
      'Surrogate-Control',
      'max-age=300, stale-while-revalidate=86400',
    );
  }
  return response;
}

export const config = {
  // Node.js runtime — jsonwebtoken is not edge-compatible.
  runtime: 'nodejs',
  matcher: [
    // Everything except Next.js internals and static assets.
    '/((?!_next/static|_next/image|favicon.ico).*)',
  ],
};
