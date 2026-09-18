import { NextRequest, NextResponse } from 'next/server';
import { ensureDbReady } from '@/lib/init';
import getDb from '@/lib/db';
import { getAuthUser } from '@/lib/auth';
import { rateLimit, getClientIP, IP_UNTRUSTABLE } from '@/lib/rate-limit';
import {
  isLockedOut,
  recordFailure,
  recordSuccess,
  getLockStatus,
  UNTRUSTABLE_BUCKET,
} from '@/lib/login-lockout';
import { changeOwnPassword } from '@/lib/change-password';

export const runtime = 'nodejs';

/**
 * TASK 30 — admin self-service password change.
 *
 * Throttling: shares the EXACT buckets with /api/auth/login — the in-memory
 * rateLimit("login:<ip>", 10/min) key and the durable sqlite lockout
 * (5 consecutive failures -> 15-minute lock, per account AND per IP, with
 * the UNTRUSTABLE_BUCKET never locking). Locked identifiers never reach
 * bcrypt. A wrong CURRENT password records a failure into both buckets,
 * so guessing here is bounded identically to guessing at the login form.
 *
 * Sessions (sign out everywhere): a successful change clears the caller's
 * auth_token cookie AND invalidates every existing session for the user,
 * because getAuthUser rejects tokens whose iat predates users.updated_at —
 * the timestamp changeOwnPassword writes (it is the ONLY writer of that
 * column; schema untouched). Never logs and never returns any hash or
 * password material.
 */
export async function POST(req: NextRequest) {
  ensureDbReady();

  const ip = getClientIP(req);
  const rl = rateLimit(`login:${ip}`, 10, 60000);
  if (!rl.allowed) {
    return NextResponse.json({ error: 'Too many attempts. Please wait a moment.' }, { status: 429 });
  }

  const authUser = await getAuthUser();
  if (!authUser) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const accountKey = String(authUser.email).trim().toLowerCase();
  const ipKey = ip === IP_UNTRUSTABLE ? UNTRUSTABLE_BUCKET : ip;
  if (isLockedOut(accountKey, ipKey)) {
    const status = getLockStatus(accountKey).locked ? getLockStatus(accountKey) : getLockStatus(ipKey);
    const minutes = Math.max(1, Math.ceil(status.retryAfterSeconds / 60));
    return NextResponse.json(
      { error: `Too many failed attempts. Locked for ${minutes} more minute${minutes === 1 ? '' : 's'}.` },
      { status: 429, headers: { 'Retry-After': String(status.retryAfterSeconds) } },
    );
  }

  let body: { current_password?: unknown; new_password?: unknown };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body.' }, { status: 400 });
  }

  const result = changeOwnPassword(getDb(), authUser.id, body?.current_password, body?.new_password);
  if (!result.ok) {
    // Only a wrong CURRENT password is a credential-guessing signal;
    // validation errors (length, same-as-current) are not.
    if (result.reason === 'wrong-current') recordFailure(accountKey, ipKey);
    return NextResponse.json({ error: result.error }, { status: result.status });
  }
  recordSuccess(accountKey, ipKey);

  const res = NextResponse.json({ success: true, signedOut: true });
  res.cookies.set('auth_token', '', {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    maxAge: 0,
    path: '/',
  });
  return res;
}
