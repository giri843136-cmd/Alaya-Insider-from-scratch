import { NextRequest, NextResponse } from 'next/server';
import { ensureDbReady } from '@/lib/init';
import getDb from '@/lib/db';
import { getAuthUser } from '@/lib/auth';
import { v4 as uuid } from 'uuid';

export async function GET(req: NextRequest) {
  ensureDbReady();
  const user = await getAuthUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const db = getDb();
  const url = new URL(req.url);
  const page = Math.max(1, parseInt(url.searchParams.get('page') || '1'));
  const limit = parseInt(url.searchParams.get('limit') || '50');
  const offset = (page - 1) * limit;

  const total = (db.prepare('SELECT COUNT(*) as cnt FROM newsletter_subscribers').get() as any).cnt;
  const subscribers = db.prepare('SELECT * FROM newsletter_subscribers ORDER BY subscribed_at DESC LIMIT ? OFFSET ?').all(limit, offset);

  return NextResponse.json({ subscribers, pagination: { page, limit, total, totalPages: Math.ceil(total / limit) } });
}

export async function POST(req: NextRequest) {
  ensureDbReady();
  const { email, first_name, source } = await req.json();

  if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return NextResponse.json({ error: 'Please enter a valid email address' }, { status: 400 });
  }

  const db = getDb();
  const existing = db.prepare('SELECT id, is_active FROM newsletter_subscribers WHERE email = ?').get(email) as any;

  if (existing) {
    if (existing.is_active) {
      return NextResponse.json({ message: 'You are already subscribed!' });
    }
    db.prepare('UPDATE newsletter_subscribers SET is_active = 1, unsubscribed_at = NULL WHERE id = ?').run(existing.id);
    return NextResponse.json({ message: 'Welcome back! You have been resubscribed.' });
  }

  db.prepare('INSERT INTO newsletter_subscribers (id, email, first_name, source) VALUES (?, ?, ?, ?)')
    .run(uuid(), email, first_name || '', source || 'website');

  return NextResponse.json({ message: 'Thank you for subscribing!' }, { status: 201 });
}
