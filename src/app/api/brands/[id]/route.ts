import { NextRequest, NextResponse } from 'next/server';
import { ensureDbReady } from '@/lib/init';
import getDb from '@/lib/db';
import { getAuthUser } from '@/lib/auth';

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  ensureDbReady();
  const { id } = await params;
  const db = getDb();
  const brand = db.prepare('SELECT * FROM brands WHERE id = ? OR slug = ?').get(id, id);
  if (!brand) return NextResponse.json({ error: 'Not found' }, { status: 404 });
  return NextResponse.json({ brand });
}

export async function PUT(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  ensureDbReady();
  const user = await getAuthUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const { id } = await params;
  const data = await req.json();
  const db = getDb();
  db.prepare(`UPDATE brands SET name=?, slug=?, logo=?, description=?, website_url=?, is_featured=?, seo_title=?, seo_description=?, updated_at=datetime('now') WHERE id=?`)
    .run(data.name, data.slug, data.logo||'', data.description||'', data.website_url||'', data.is_featured?1:0, data.seo_title||'', data.seo_description||'', id);
  return NextResponse.json({ success: true });
}

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  ensureDbReady();
  const user = await getAuthUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const { id } = await params;
  getDb().prepare('DELETE FROM brands WHERE id = ?').run(id);
  return NextResponse.json({ success: true });
}
