import { NextResponse } from 'next/server';
import { getAuthUser } from '@/lib/auth';
import getDb from '@/lib/db';
import { ensureDbReady } from '@/lib/init';
import * as OTPAuth from 'otpauth';

export async function POST() {
  ensureDbReady();
  const authUser = await getAuthUser();
  if (!authUser) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const db = getDb();

  // Generate new TOTP secret
  const totp = new OTPAuth.TOTP({
    issuer: 'Alaya Insider',
    label: authUser.email,
    algorithm: 'SHA1',
    digits: 6,
    period: 30,
  });

  const secret = totp.secret.base32;
  const uri = totp.toString();

  // Save secret (not enabled yet — user must verify first)
  db.prepare('UPDATE users SET two_factor_secret = ? WHERE id = ?').run(secret, authUser.id);

  return NextResponse.json({ secret, uri });
}
