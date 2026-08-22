import { NextResponse } from 'next/server';
import { getAuthUser } from '@/lib/auth';
import { ensureDbReady } from '@/lib/init';

export async function GET() {
  ensureDbReady();
  const user = await getAuthUser();
  if (!user) {
    return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
  }
  return NextResponse.json({ user });
}
