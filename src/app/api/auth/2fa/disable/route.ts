import { NextRequest, NextResponse } from 'next/server';
import { getAuthUser } from '@/lib/auth';
import getDb from '@/lib/db';
import { ensureDbReady } from '@/lib/init';

export async function POST(req: NextRequest) {
  ensureDbReady();
  const authUser = await getAuthUser();
  if (!authUser) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const db = getDb();
  db.prepare('UPDATE users SET two_factor_enabled = 0, two_factor_secret = "" WHERE id = ?').run(authUser.id);

  return NextResponse.json({ success: true, message: '2FA disabled' });
}
