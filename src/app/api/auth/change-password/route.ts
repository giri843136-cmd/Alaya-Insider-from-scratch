import { NextRequest, NextResponse } from 'next/server';
import { ensureDbReady } from '@/lib/init';
import getDb from '@/lib/db';
import { getAuthUser } from '@/lib/auth';
import { changeOwnPassword } from '@/lib/change-password';

export const runtime = 'nodejs';

/**
 * TASK 30 — admin self-service password change.
 * Session-gated via the auth_token JWT (same as /api/auth/2fa/*).
 * The current password is required; the new hash is written with bcrypt
 * cost 10. Never logs and never returns any hash or password material.
 */
export async function POST(req: NextRequest) {
  ensureDbReady();
  const authUser = await getAuthUser();
  if (!authUser) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  let body: { current_password?: unknown; new_password?: unknown };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body.' }, { status: 400 });
  }

  const result = changeOwnPassword(getDb(), authUser.id, body?.current_password, body?.new_password);
  if (!result.ok) {
    return NextResponse.json({ error: result.error }, { status: result.status });
  }
  return NextResponse.json({ success: true });
}
