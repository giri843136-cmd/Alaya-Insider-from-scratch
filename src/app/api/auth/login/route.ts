import { NextRequest, NextResponse } from 'next/server';
import { ensureDbReady } from '@/lib/init';
import getDb from '@/lib/db';
import { verifyPassword, generateToken } from '@/lib/auth';
import { rateLimit, getClientIP, IP_UNTRUSTABLE } from '@/lib/rate-limit';
import { isLockedOut, recordFailure, recordSuccess, getLockStatus, MAX_FAILURES } from '@/lib/login-lockout';

/**
 * FIX B (TASK 2) — explicit policy when the client IP is untrustable
 * (missing or unparseable X-Forwarded-For, i.e. the request did not come
 * through our nginx edge):
 *
 *   FALL BACK TO ACCOUNT LOCK ONLY, PLUS A SHARED "UNTRUSTABLE" IP BUCKET.
 *
 * Why not refuse after N untrustable attempts outright: the account lock
 * already bounds guessing per credential, and a blanket refusal would let an
 * attacker DoS the admin login for everyone by simply stripping headers.
 * The shared bucket keeps a coarse brake (MAX_FAILURES failures from ALL
 * untrustable sources, e.g. direct-to-port scanners) without per-attacker
 * granularity we cannot have anyway. Trusted-IP requests keep the exact
 * per-IP behaviour.
 */

export async function POST(req: NextRequest) {
  ensureDbReady();

  const ip = getClientIP(req);
  const rl = rateLimit(`login:${ip}`, 10, 60000);
  if (!rl.allowed) {
    return NextResponse.json({ error: 'Too many login attempts. Please wait a moment.' }, { status: 429 });
  }

  try {
    const { email, password, twoFactorCode } = await req.json();
    if (!email || !password) {
      return NextResponse.json({ error: 'Email and password required' }, { status: 400 });
    }

    // Durable lockout (sqlite): 5 consecutive failures lock the account AND
    // the source IP for 15 minutes. Checked before credential verification so
    // locked identifiers never reach bcrypt. Untrustable-IP requests share
    // one lockout bucket (see the policy note above).
    const accountKey = String(email).trim().toLowerCase();
    const ipKey = ip === IP_UNTRUSTABLE ? 'shared:untrustable-ip' : ip;
    if (isLockedOut(accountKey, ipKey)) {
      const status = getLockStatus(accountKey).locked ? getLockStatus(accountKey) : getLockStatus(ipKey);
      const minutes = Math.max(1, Math.ceil(status.retryAfterSeconds / 60));
      return NextResponse.json(
        { error: `Too many failed attempts. Locked for ${minutes} more minute${minutes === 1 ? '' : 's'}.` },
        { status: 429, headers: { 'Retry-After': String(status.retryAfterSeconds) } },
      );
    }

    const db = getDb();
    const user = db.prepare(`
      SELECT u.*, r.name as role_name, r.permissions as role_permissions
      FROM users u
      JOIN roles r ON u.role_id = r.id
      WHERE (LOWER(u.email) = LOWER(?) OR u.username = ?) AND u.is_active = 1
    `).get(email, email) as any;

    if (!user || !verifyPassword(password, user.password_hash)) {
      recordFailure(accountKey, ipKey);
      const left = MAX_FAILURES - getLockStatus(accountKey).failures;
      return NextResponse.json(
        { error: left > 0 ? `Invalid credentials` : 'Too many failed attempts. Account locked for 15 minutes.' },
        { status: 401 },
      );
    }

    // Check if 2FA is enabled
    if (user.two_factor_enabled && user.two_factor_secret) {
      if (!twoFactorCode) {
        // Password correct but need 2FA code
        return NextResponse.json({ requires2FA: true, message: 'Enter your 2FA code' }, { status: 200 });
      }
      // Verify TOTP code
      const OTPAuth = await import('otpauth');
      const totp = new OTPAuth.TOTP({
        issuer: 'Alaya Insider',
        label: user.email,
        algorithm: 'SHA1',
        digits: 6,
        period: 30,
        secret: OTPAuth.Secret.fromBase32(user.two_factor_secret),
      });
      const delta = totp.validate({ token: twoFactorCode, window: 2 });
      if (delta === null) {
        return NextResponse.json({ error: 'Invalid 2FA code' }, { status: 401 });
      }
    }

    db.prepare("UPDATE users SET last_login = datetime('now') WHERE id = ?").run(user.id);
    // FIX C (TASK 2): successful login clears the lockout for BOTH the
    // account and the IP/bucket that made this request.
    recordSuccess(accountKey, ipKey);

    const authUser = {
      id: user.id,
      email: user.email,
      username: user.username,
      first_name: user.first_name,
      last_name: user.last_name,
      role_id: user.role_id,
      role_name: user.role_name,
      permissions: JSON.parse(user.role_permissions || '{}'),
    };

    const token = generateToken(authUser);

    const response = NextResponse.json({ user: authUser, token });
    response.cookies.set('auth_token', token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: 7 * 24 * 60 * 60,
      path: '/',
    });

    return response;
  } catch (e: any) {
    console.error('Login error:', e);
    return NextResponse.json({ error: 'Login failed' }, { status: 500 });
  }
}
