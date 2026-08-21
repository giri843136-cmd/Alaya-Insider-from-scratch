import { NextRequest, NextResponse } from 'next/server';
import { ensureDbReady } from '@/lib/init';
import getDb from '@/lib/db';
import { getAuthUser } from '@/lib/auth';

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  ensureDbReady();
  const { id } = await params;
  const db = getDb();

  const category = db.prepare(`
    SELECT c.*, pc.name as parent_name
    FROM categories c
    LEFT JOIN categories pc ON c.parent_id = pc.id
    WHERE c.id = ? OR c.slug = ?
  `).get(id, id) as any;

  if (!category) return NextResponse.json({ error: 'Not found' }, { status: 404 });

  const children = db.prepare('SELECT * FROM categories WHERE parent_id = ? ORDER BY sort_order').all(category.id);

  return NextResponse.json({ category, children });
}

export async function PUT(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  ensureDbReady();
  const user = await getAuthUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { id } = await params;
  const data = await req.json();
  const db = getDb();

  db.prepare(`
    UPDATE categories SET name = ?, slug = ?, description = ?, image = ?,
      parent_id = ?, sort_order = ?, is_featured = ?, seo_title = ?, seo_description = ?,
      updated_at = datetime('now')
    WHERE id = ?
  `).run(data.name, data.slug, data.description || '', data.image || '',
    data.parent_id || null, data.sort_order || 0, data.is_featured ? 1 : 0,
    data.seo_title || '', data.seo_description || '', id);

  return NextResponse.json({ success: true });
}

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  ensureDbReady();
  const user = await getAuthUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { id } = await params;
  const db = getDb();
  db.prepare('DELETE FROM categories WHERE id = ?').run(id);
  return NextResponse.json({ success: true });
}
