/**
 * TASK 11 — cache-control policy tests for src/middleware.ts.
 *
 * Policy under test:
 *   /admin/*            -> no-store (authed pages, redirects, /admin/login)
 *   /api/admin/*        -> no-store (401s and authed responses)
 *   /api/* (public)     -> no-store (dynamic data)
 *   authed request to a public path -> no-store (defence in depth)
 *   anonymous public image -> public + s-maxage=86400 + SWR
 *   anonymous public HTML  -> public, max-age=0 must-revalidate, s-maxage=300 + SWR
 *   NO `Vary` on cookies anywhere in the public branch (must-not-vary-on-cookie)
 */
import type { NextRequest } from 'next/server';

jest.mock('@/lib/auth-secret', () => ({
  getAuthSecret: () => 'test-secret-value-0123456789abcdef',
  assertUsableSessionSecret: () => {},
}));

const middleware = require('@/middleware').middleware as (
  req: Partial<NextRequest>,
) => Response & { headers: Headers };

function makeReq(pathname: string, cookie?: string) {
  const url = new URL(`https://alayainsider.com${pathname}`);
  const cookies = cookie
    ? { get: (name: string) => (name === 'auth_token' ? { value: cookie } : undefined) }
    : { get: () => undefined };
  return {
    nextUrl: { pathname },
    url: url.toString(),
    cookies,
  } as unknown as Partial<NextRequest>;
}

function cc(res: Response): string {
  return res.headers.get('cache-control') || '';
}

describe('TASK 11 middleware cache policy', () => {
  // ── must stay no-store ──────────────────────────────────────────────────
  it('/admin/* authed page -> no-store', () => {
    const res = middleware(makeReq('/admin/products', 'tok'));
    expect(cc(res)).toContain('no-store');
  });

  it('/admin/* unauthenticated -> redirect with no-store', () => {
    const res = middleware(makeReq('/admin/products'));
    expect(res.status).toBe(302);
    expect(cc(res)).toContain('no-store');
  });

  it('/admin/login -> no-store', () => {
    expect(cc(middleware(makeReq('/admin/login')))).toContain('no-store');
  });

  it('/api/admin/* -> no-store', () => {
    expect(cc(middleware(makeReq('/api/admin/products')))).toContain('no-store');
    expect(cc(middleware(makeReq('/api/admin/snapshots')))).toContain('no-store');
  });

  it('public /api/* -> no-store (dynamic data)', () => {
    expect(cc(middleware(makeReq('/api/products?limit=1')))).toContain('no-store');
    expect(cc(middleware(makeReq('/api/contact')))).toContain('no-store');
  });

  it('authed request to a public page -> no-store (defence in depth)', () => {
    expect(cc(middleware(makeReq('/products/some-slug', 'tok')))).toContain('no-store');
    expect(cc(middleware(makeReq('/', 'tok')))).toContain('no-store');
  });

  // ── anonymous public: cacheable ─────────────────────────────────────────
  it('anonymous public HTML -> public, max-age=0 must-revalidate, s-maxage=300 + SWR', () => {
    for (const p of ['/', '/products/some-slug', '/collections/x', '/journal', '/robots.txt', '/sitemap.xml']) {
      const res = middleware(makeReq(p));
      const h = cc(res);
      expect(h).toContain('public');
      expect(h).toContain('max-age=0');
      expect(h).toContain('must-revalidate');
      expect(h).toContain('s-maxage=300');
      expect(h).toContain('stale-while-revalidate');
      expect(h).not.toContain('no-store');
    }
  });

  it('anonymous public images -> long CDN life (s-maxage=86400 + SWR)', () => {
    for (const p of ['/images/hero.webp', '/favicon.ico', '/logo.png']) {
      const h = cc(middleware(makeReq(p)));
      expect(h).toContain('public');
      expect(h).toContain('s-maxage=86400');
      expect(h).toContain('stale-while-revalidate');
      expect(h).not.toContain('no-store');
    }
  });

  it('no Set-Cookie added and NO Vary on cookies for anonymous public responses', () => {
    for (const p of ['/', '/products/some-slug', '/images/hero.webp']) {
      const res = middleware(makeReq(p));
      expect(res.headers.get('set-cookie')).toBeNull();
      const vary = res.headers.get('vary') || '';
      expect(vary.toLowerCase()).not.toContain('cookie');
    }
  });
});
