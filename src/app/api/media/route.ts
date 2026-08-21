import { NextRequest, NextResponse } from 'next/server';
import { ensureDbReady } from '@/lib/init';
import getDb from '@/lib/db';
import { getAuthUser } from '@/lib/auth';
import fs from 'fs';
import path from 'path';

export async function GET() {
  ensureDbReady();
  const user = await getAuthUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const media = getDb().prepare('SELECT * FROM media ORDER BY created_at DESC').all();
  return NextResponse.json({ media });
}

export async function DELETE(req: NextRequest) {
  ensureDbReady();
  const user = await getAuthUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { id } = await req.json();
  const db = getDb();

  const item = db.prepare('SELECT * FROM media WHERE id = ?').get(id) as any;
  if (!item) return NextResponse.json({ error: 'Not found' }, { status: 404 });

  // Delete file
  const filePath = path.resolve(process.cwd(), 'uploads/images', item.filename);
  if (fs.existsSync(filePath)) fs.unlinkSync(filePath);

  db.prepare('DELETE FROM media WHERE id = ?').run(id);
  return NextResponse.json({ success: true });
}
