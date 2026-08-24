import { NextRequest, NextResponse } from 'next/server';
import { ensureDbReady } from '@/lib/init';
import getDb from '@/lib/db';
import { verifyPassword, generateToken } from '@/lib/auth';
import { rateLimit, getClientIP } from '@/lib/rate-limit';

// Progressive lockout: track failed attempts per IP
const failedAttempts = new Map<string, { count: number; lastAttempt: number; lockedUntil?: number }>();
const LOCKOUT_THRESHOLD = 5;  // lock after 5 failed attempts
const LOCKOUT_DURATION = 15 * 60 * 1000;  // 15 minute lockout
const ATTEMPT_WINDOW = 15 * 60 * 1000;  // 15 minute window

function checkBruteForce(ip: string): { allowed: boolean; waitSeconds?: number } {
  const entry = failedAttempts.get(ip);
  if (!entry) return { allowed: true };

  // Check if lockout has expired
  if (entry.lockedUntil && Date.now() > entry.lockedUntil) {
    failedAttempts.delete(ip);
    return { allowed: true };
  }

  // Currently locked out
  if (entry.lockedUntil) {
    const waitSeconds = Math.ceil((entry.lockedUntil - Date.now()) / 1000);
    return { allowed: false, waitSeconds };
  }

  return { allowed: true };
}

function recordFailedAttempt(ip: string): void {
  const entry = failedAttempts.get(ip);
  if (!entry || Date.now() - entry.lastAttempt > ATTEMPT_WINDOW) {
    failedAttempts.set(ip, { count: 1, lastAttempt: Date.now() });
  } else {
    entry.count++;
    entry.lastAttempt = Date.now();
    if (entry.count >= LOCKOUT_THRESHOLD) {
      entry.lockedUntil = Date.now() + LOCKOUT_DURATION;
      console.warn(`[SECURITY] IP ${ip} locked out for ${LOCKOUT_DURATION / 1000}s after ${entry.count} failed login attempts`);
    }
  }
}

function clearFailedAttempts(ip: string): void {
  failedAttempts.delete(ip);
}

export async function POST(req: NextRequest) {
  ensureDbReady();

  // Rate limit: 10 login attempts per minute per IP
  const ip = getClientIP(req);
  const rl = rateLimit(`login:${ip}`, 10, 60000);
  if (!rl.allowed) {
    return NextResponse.json({ error: 'Too many login attempts. Please wait a moment.' }, { status: 429 });
  }

  // Progressive brute-force protection
  const bruteCheck = checkBruteForce(ip);
  if (!bruteCheck.allowed) {
    return NextResponse.json(
      { error: `Account temporarily locked. Try again in ${bruteCheck.waitSeconds} seconds.` },
      { status: 429 }
    );
  }

  try {
    const { email, password } = await req.json();
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
      recordFailedAttempt(ip);
      return NextResponse.json({ error: 'Invalid credentials' }, { status: 401 });
    }

    // Clear failed attempts on successful login
    clearFailedAttempts(ip);

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
