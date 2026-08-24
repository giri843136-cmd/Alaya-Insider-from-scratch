import { NextRequest, NextResponse } from 'next/server';
import { getAuthUser } from '@/lib/auth';
import getDb from '@/lib/db';
import { ensureDbReady } from '@/lib/init';
import * as OTPAuth from 'otpauth';

export async function POST(req: NextRequest) {
  ensureDbReady();
  const authUser = await getAuthUser();
  if (!authUser) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { code } = await req.json();
  if (!code) return NextResponse.json({ error: 'Code required' }, { status: 400 });

  const db = getDb();
  const user = db.prepare('SELECT two_factor_secret FROM users WHERE id = ?').get(authUser.id) as any;
  if (!user?.two_factor_secret) {
    return NextResponse.json({ error: 'No 2FA setup found. Run setup first.' }, { status: 400 });
  }

  const totp = new OTPAuth.TOTP({
    issuer: 'Alaya Insider',
    label: authUser.email,
    algorithm: 'SHA1',
    digits: 6,
    period: 30,
    secret: OTPAuth.Secret.fromBase32(user.two_factor_secret),
  });

  const delta = totp.validate({ token: code, window: 1 });
  if (delta === null) {
    return NextResponse.json({ error: 'Invalid code. Try again.' }, { status: 400 });
  }

  // Enable 2FA
  db.prepare('UPDATE users SET two_factor_enabled = 1 WHERE id = ?').run(authUser.id);

  return NextResponse.json({ success: true, message: '2FA enabled successfully' });
}
