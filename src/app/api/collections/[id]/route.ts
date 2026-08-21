import { NextRequest, NextResponse } from 'next/server';
import { ensureDbReady } from '@/lib/init';
import getDb from '@/lib/db';
import { getAuthUser } from '@/lib/auth';

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  ensureDbReady();
  const { id } = await params;
  const db = getDb();
  const collection = db.prepare('SELECT * FROM collections WHERE id = ? OR slug = ?').get(id, id) as any;
  if (!collection) return NextResponse.json({ error: 'Not found' }, { status: 404 });

  const products = db.prepare(`
    SELECT p.*, b.name as brand_name, b.slug as brand_slug,
           c.name as category_name, c.slug as category_slug
    FROM collection_products cp
    JOIN products p ON cp.product_id = p.id
    LEFT JOIN brands b ON p.brand_id = b.id
    LEFT JOIN categories c ON p.category_id = c.id
    WHERE cp.collection_id = ? AND p.status = 'published' AND p.deleted_at IS NULL
    ORDER BY cp.sort_order ASC
  `).all(collection.id);

  return NextResponse.json({ collection, products });
}

export async function PUT(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  ensureDbReady();
  const user = await getAuthUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const { id } = await params;
  const data = await req.json();
  const db = getDb();
  db.prepare(`UPDATE collections SET name=?, slug=?, description=?, cover_image=?, sort_order=?, is_active=?, seo_title=?, seo_description=?, updated_at=datetime('now') WHERE id=?`)
    .run(data.name, data.slug, data.description||'', data.cover_image||'', data.sort_order||0, data.is_active!==false?1:0, data.seo_title||'', data.seo_description||'', id);

  if (data.product_ids) {
    db.prepare('DELETE FROM collection_products WHERE collection_id = ?').run(id);
    const stmt = db.prepare('INSERT INTO collection_products (collection_id, product_id, sort_order) VALUES (?, ?, ?)');
    data.product_ids.forEach((pid: string, i: number) => stmt.run(id, pid, i));
  }

  return NextResponse.json({ success: true });
}

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  ensureDbReady();
  const user = await getAuthUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const { id } = await params;
  const db = getDb();
  db.prepare('DELETE FROM collection_products WHERE collection_id = ?').run(id);
  db.prepare('DELETE FROM collections WHERE id = ?').run(id);
  return NextResponse.json({ success: true });
}
