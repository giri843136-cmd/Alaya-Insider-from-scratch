import { NextResponse } from 'next/server';
import { getAuthUser } from '@/lib/auth';
import getDb from '@/lib/db';
import { ensureDbReady } from '@/lib/init';
import * as OTPAuth from 'otpauth';

// eslint-disable-next-line @typescript-eslint/no-require-imports
const QRCode = require('qrcode');

export async function POST() {
  ensureDbReady();
  const authUser = await getAuthUser();
  if (!authUser) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const db = getDb();

  const totp = new OTPAuth.TOTP({
    issuer: 'Alaya Insider',
    label: authUser.email,
    algorithm: 'SHA1',
    digits: 6,
    period: 30,
  });

  const secret = totp.secret.base32;
  const uri = totp.toString();

  // Generate QR code as data URI
  const qrDataUrl = await QRCode.toDataURL(uri, { width: 200, margin: 2 });

  // Save secret (not enabled yet — user must verify first)
  db.prepare('UPDATE users SET two_factor_secret = ? WHERE id = ?').run(secret, authUser.id);

  return NextResponse.json({ secret, uri, qr: qrDataUrl });
}
