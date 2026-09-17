/**
 * TASK 2 FIX A — the AUTH_SECRET guard must hard-fail in production when the
 * secret is unset, and never fall back to a hard-coded value there.
 * Also covers the FIX B/C lockout counter semantics that guard production
 * logins (per-IP and per-account counters, success clears both keys).
 */

import { getAuthSecret, DEV_FALLBACK_SECRET, isServingProcess, assertUsableSessionSecret } from '../auth-secret';

describe('getAuthSecret (FIX A guard)', () => {
  const ORIGINAL_ENV = { ...process.env };

  beforeEach(() => {
    jest.resetModules();
  });

  afterEach(() => {
    process.env = { ...ORIGINAL_ENV };
  });

  it('throws when NODE_ENV=production and AUTH_SECRET is unset', () => {
    delete process.env.AUTH_SECRET;
    delete process.env.NEXT_PHASE;
    process.env.NODE_ENV = 'production';
    expect(() => getAuthSecret()).toThrow(/AUTH_SECRET is not set/);
  });

  it('throws when AUTH_SECRET is only whitespace in production', () => {
    process.env.AUTH_SECRET = '   ';
    delete process.env.NEXT_PHASE;
    process.env.NODE_ENV = 'production';
    expect(() => getAuthSecret()).toThrow(/AUTH_SECRET is not set/);
  });

  it('returns the configured secret in production when set', () => {
    process.env.AUTH_SECRET = 'a-real-production-secret';
    process.env.NODE_ENV = 'production';
    expect(getAuthSecret()).toBe('a-real-production-secret');
  });

  it('returns the dev sentinel (never the production path) outside production', () => {
    delete process.env.AUTH_SECRET;
    process.env.NODE_ENV = 'development';
    expect(getAuthSecret()).toBe(DEV_FALLBACK_SECRET);
  });

  it('allows the build phase (NEXT_PHASE) to proceed without a secret', () => {
    delete process.env.AUTH_SECRET;
    process.env.NODE_ENV = 'production';
    process.env.NEXT_PHASE = 'phase-production-build';
    expect(getAuthSecret()).toBe(DEV_FALLBACK_SECRET);
  });

  // FIX E: NODE_ENV alone is not trusted — a SERVING process must hard-fail
  // without a secret even under a non-standard NODE_ENV.
  it('FIX E: throws when started to serve with a non-standard NODE_ENV and no secret', () => {
    delete process.env.AUTH_SECRET;
    delete process.env.NEXT_PHASE;
    process.env.NODE_ENV = 'test';
    expect(() =>
      getAuthSecret(['node', '/srv/app/node_modules/next/dist/bin/next', 'start']),
    ).toThrow(/is not set but this process is serving/);
  });

  it('FIX E: getAuthSecret still throws for next start under NODE_ENV=production', () => {
    delete process.env.AUTH_SECRET;
    delete process.env.NEXT_PHASE;
    process.env.NODE_ENV = 'production';
    expect(() => getAuthSecret()).toThrow(/AUTH_SECRET is not set/);
  });

  it('FIX E: dev still gets the sentinel (next dev carries no start marker)', () => {
    delete process.env.AUTH_SECRET;
    delete process.env.NEXT_PHASE;
    process.env.NODE_ENV = 'development';
    expect(getAuthSecret()).toBe(DEV_FALLBACK_SECRET);
  });
});

describe('isServingProcess (FIX E argv detection)', () => {
  const ORIGINAL_ENV = { ...process.env };

  afterEach(() => {
    process.env = { ...ORIGINAL_ENV };
  });

  it('matches `next start` and npm/pm2-shaped serving argv', () => {
    expect(isServingProcess(['node', '/srv/app/node_modules/next/dist/bin/next', 'start'])).toBe(true);
    expect(isServingProcess(['/bin/sh', '-c', 'next start'])).toBe(true);
    expect(isServingProcess(['node', '/srv/app/node_modules/.bin/next', 'start', '-p', '3000'])).toBe(true);
  });

  it('matches the render/server workers Next spawns for a serve', () => {
    expect(isServingProcess(['node', '/srv/app/node_modules/next/dist/server/next-server.js'])).toBe(true);
    expect(isServingProcess(['node', '/srv/app/node_modules/next/dist/server/render-worker.js'])).toBe(true);
  });

  it('does NOT match next dev, builds, or jest', () => {
    expect(isServingProcess(['node', '/srv/app/node_modules/next/dist/bin/next', 'dev'])).toBe(false);
    expect(isServingProcess(['node', '/srv/app/node_modules/.bin/jest', '--runInBand'])).toBe(false);
    expect(isServingProcess(['node', '/srv/app/scripts/seed.ts'])).toBe(false);
  });

  it('a build phase (NEXT_PHASE) is never treated as a serve', () => {
    process.env.NEXT_PHASE = 'phase-production-build';
    expect(isServingProcess(['node', '/srv/app/node_modules/next/dist/bin/next', 'start'])).toBe(false);
  });
});

describe('assertUsableSessionSecret (FIX E belt)', () => {
  const ORIGINAL_ENV = { ...process.env };

  afterEach(() => {
    process.env = { ...ORIGINAL_ENV };
  });

  it('REFUSES the dev sentinel on a serving process', () => {
    delete process.env.NEXT_PHASE;
    expect(() =>
      assertUsableSessionSecret(DEV_FALLBACK_SECRET, [
        'node', '/srv/app/node_modules/next/dist/bin/next', 'start',
      ]),
    ).toThrow(/refusing to verify sessions/);
  });

  it('refuses the sentinel in the spawned next-server worker too', () => {
    delete process.env.NEXT_PHASE;
    expect(() =>
      assertUsableSessionSecret(DEV_FALLBACK_SECRET, [
        'node', '/srv/app/node_modules/next/dist/server/next-server.js',
      ]),
    ).toThrow(/refusing to verify sessions/);
  });

  it('allows a real secret everywhere, and the sentinel outside serving', () => {
    delete process.env.NEXT_PHASE;
    expect(() =>
      assertUsableSessionSecret('a-real-production-secret', [
        'node', '/srv/app/node_modules/next/dist/bin/next', 'start',
      ]),
    ).not.toThrow();
    expect(() => assertUsableSessionSecret(DEV_FALLBACK_SECRET, ['node', 'jest'])).not.toThrow();
  });
});

describe('login-lockout counters (FIX B/C semantics)', () => {
  const ORIGINAL_ENV = { ...process.env };
  let tmpDbPath = '';
  let lockout: typeof import('../login-lockout');

  beforeAll(async () => {
    process.env = { ...ORIGINAL_ENV };
    process.env.DATABASE_PATH = tmpDbPath = require('os').tmpdir() + `/alaya-lockout-${Date.now()}.db`;
    process.env.AUTH_SECRET = 'test-auth-secret-0123456789abcdef0123456789abcdef';
    lockout = await import('../login-lockout');
  });

  afterAll(() => {
    process.env = { ...ORIGINAL_ENV };
    try { require('fs').unlinkSync(tmpDbPath); } catch { /* ignore */ }
  });

  it('locks after MAX_FAILURES consecutive failures', () => {
    const { MAX_FAILURES } = lockout;
    for (let i = 1; i < MAX_FAILURES; i++) {
      lockout.recordFailure('acct-a', '203.0.113.10');
      expect(lockout.isLockedOut('acct-a', '203.0.113.10')).toBe(false);
    }
    lockout.recordFailure('acct-a', '203.0.113.10');
    expect(lockout.isLockedOut('acct-a', '203.0.113.10')).toBe(true);
    expect(lockout.getLockStatus('acct-a').retryAfterSeconds).toBeGreaterThan(0);
  });

  it('keeps per-IP counters independent (FIX B semantics)', () => {
    // acct-b failed 5x from .20 → that IP is locked, but .21 is untouched.
    for (let i = 0; i < 5; i++) lockout.recordFailure('acct-b', '203.0.113.20');
    expect(lockout.isLockedOut('acct-c', '203.0.113.20')).toBe(true);
    expect(lockout.isLockedOut('acct-c', '203.0.113.21')).toBe(false);
  });

  it('recordSuccess clears BOTH the account and the IP key (FIX C)', () => {
    for (let i = 0; i < 3; i++) lockout.recordFailure('acct-d', '203.0.113.30');
    lockout.recordSuccess('acct-d', '203.0.113.30');
    expect(lockout.getLockStatus('acct-d').failures).toBe(0);
    expect(lockout.getLockStatus('203.0.113.30').failures).toBe(0);
  });

  it('recordSuccess with the untrustable bucket clears the bucket, not other IPs', () => {
    for (let i = 0; i < 2; i++) lockout.recordFailure('acct-e', 'shared:untrustable-ip');
    lockout.recordFailure('acct-f', '203.0.113.40');
    lockout.recordSuccess('acct-e', 'shared:untrustable-ip');
    expect(lockout.getLockStatus('shared:untrustable-ip').failures).toBe(0);
    expect(lockout.getLockStatus('203.0.113.40').failures).toBe(1);
  });
});
