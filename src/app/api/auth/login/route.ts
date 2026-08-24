import { NextRequest, NextResponse } from 'next/server';
import { ensureDbReady } from '@/lib/init';
import getDb from '@/lib/db';
import { verifyPassword, generateToken } from '@/lib/auth';
import { rateLimit, getClientIP } from '@/lib/rate-limit';

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

    const db = getDb();
    const user = db.prepare(`
      SELECT u.*, r.name as role_name, r.permissions as role_permissions
      FROM users u
      JOIN roles r ON u.role_id = r.id
      WHERE (u.email = ? OR u.username = ?) AND u.is_active = 1
    `).get(email, email) as any;

    if (!user || !verifyPassword(password, user.password_hash)) {
      return NextResponse.json({ error: 'Invalid credentials' }, { status: 401 });
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
