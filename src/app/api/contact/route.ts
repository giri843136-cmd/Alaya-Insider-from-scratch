import { NextRequest, NextResponse } from 'next/server';
import { ensureDbReady } from '@/lib/init';
import getDb from '@/lib/db';
import { v4 as uuid } from 'uuid';
import { rateLimit, getClientIP } from "@/lib/rate-limit";

export async function POST(req: NextRequest) {
  ensureDbReady();
  const rl = rateLimit(`contact:${getClientIP(req)}`, 5, 60000);
  if (!rl.allowed) return NextResponse.json({ error: "Too many submissions. Please wait." }, { status: 429 });
  const { name, email, reason, message } = await req.json();

  if (!email || !message) {
    return NextResponse.json({ error: 'Email and message are required' }, { status: 400 });
  }

  getDb().prepare('INSERT INTO contact_submissions (id, name, email, reason, message) VALUES (?, ?, ?, ?, ?)')
    .run(uuid(), name || '', email, reason || '', message);

  return NextResponse.json({ message: 'Thank you for your message. We will get back to you soon.' }, { status: 201 });
}

export async function GET() {
  ensureDbReady();
  const submissions = getDb().prepare('SELECT * FROM contact_submissions ORDER BY created_at DESC').all();
  return NextResponse.json({ submissions });
}
