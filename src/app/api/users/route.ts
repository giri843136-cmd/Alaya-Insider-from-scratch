import { NextRequest, NextResponse } from 'next/server';
import { ensureDbReady } from '@/lib/init';
import getDb from '@/lib/db';
import { getAuthUser, hashPassword } from '@/lib/auth';
import { v4 as uuid } from 'uuid';

export async function GET() {
  ensureDbReady();
  const user = await getAuthUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const users = getDb().prepare(`
    SELECT u.id, u.email, u.username, u.first_name, u.last_name, u.is_active,
           u.last_login, u.created_at, r.name as role_name
    FROM users u JOIN roles r ON u.role_id = r.id
    ORDER BY u.created_at DESC
  `).all();

  return NextResponse.json({ users });
}

export async function POST(req: NextRequest) {
  ensureDbReady();
  const authUser = await getAuthUser();
  if (!authUser || !authUser.permissions.all) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const data = await req.json();
  const db = getDb();

  const existing = db.prepare('SELECT id FROM users WHERE email = ? OR username = ?').get(data.email, data.username);
  if (existing) return NextResponse.json({ error: 'Email or username already exists' }, { status: 400 });

  const role = db.prepare('SELECT id FROM roles WHERE name = ?').get(data.role || 'editor') as any;
  if (!role) return NextResponse.json({ error: 'Invalid role' }, { status: 400 });

  db.prepare('INSERT INTO users (id, email, username, password_hash, first_name, last_name, role_id) VALUES (?, ?, ?, ?, ?, ?, ?)')
    .run(uuid(), data.email, data.username, hashPassword(data.password || 'changeme123'), data.first_name || '', data.last_name || '', role.id);

  return NextResponse.json({ success: true }, { status: 201 });
}
