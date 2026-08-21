import { NextRequest, NextResponse } from 'next/server';
import { ensureDbReady } from '@/lib/init';
import getDb from '@/lib/db';
import { getAuthUser } from '@/lib/auth';

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  ensureDbReady();
  const { id } = await params;
  const db = getDb();
  const comparison = db.prepare('SELECT * FROM comparisons WHERE id = ? OR slug = ?').get(id, id) as any;
  if (!comparison) return NextResponse.json({ error: 'Not found' }, { status: 404 });

  const productIds = JSON.parse(comparison.product_ids || '[]');
  const products = productIds.length
    ? db.prepare(`
        SELECT p.*, b.name as brand_name, b.slug as brand_slug
        FROM products p LEFT JOIN brands b ON p.brand_id = b.id
        WHERE p.id IN (${productIds.map(() => '?').join(',')})
      `).all(...productIds)
    : [];

  return NextResponse.json({
    comparison: { ...comparison, product_ids: productIds, comparison_fields: JSON.parse(comparison.comparison_fields || '[]') },
    products: products.map((p: any) => ({
      ...p,
      benefits: JSON.parse(p.benefits || '[]'),
      pros: JSON.parse(p.pros || '[]'),
      cons: JSON.parse(p.cons || '[]'),
    })),
  });
}

export async function PUT(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  ensureDbReady();
  const user = await getAuthUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const { id } = await params;
  const data = await req.json();
  const db = getDb();
  db.prepare(`UPDATE comparisons SET title=?, slug=?, description=?, product_ids=?, comparison_fields=?, status=?, seo_title=?, seo_description=?, updated_at=datetime('now') WHERE id=?`)
    .run(data.title, data.slug, data.description||'', JSON.stringify(data.product_ids||[]),
      JSON.stringify(data.comparison_fields||[]), data.status||'draft', data.seo_title||'', data.seo_description||'', id);
  return NextResponse.json({ success: true });
}

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  ensureDbReady();
  const user = await getAuthUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const { id } = await params;
  getDb().prepare('DELETE FROM comparisons WHERE id = ?').run(id);
  return NextResponse.json({ success: true });
}
