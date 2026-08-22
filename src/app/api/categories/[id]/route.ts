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

  try {
    const { id } = await params;
    const data = await req.json();
    if (!data.name || !data.name.trim()) {
      return NextResponse.json({ error: 'Category name is required' }, { status: 400 });
    }
    const db = getDb();

    // Prevent setting self as parent
    if (data.parent_id === id) {
      return NextResponse.json({ error: 'Category cannot be its own parent' }, { status: 400 });
    }

    // Check for duplicate slug (exclude self)
    if (data.slug) {
      const existing = db.prepare('SELECT id FROM categories WHERE slug = ? AND id != ?').get(data.slug, id) as any;
      if (existing) {
        return NextResponse.json({ error: 'Category slug already exists' }, { status: 400 });
      }
    }

    db.prepare(`
      UPDATE categories SET name = ?, slug = ?, description = ?, image = ?,
        parent_id = ?, sort_order = ?, is_featured = ?, seo_title = ?, seo_description = ?,
        updated_at = datetime('now')
      WHERE id = ?
    `).run(data.name.trim(), data.slug, data.description || '', data.image || '',
      data.parent_id || null, data.sort_order ?? 0, data.is_featured ? 1 : 0,
      data.seo_title || '', data.seo_description || '', id);

    return NextResponse.json({ success: true });
  } catch (e: any) {
    console.error('Category update error:', e);
    return NextResponse.json({ error: 'Failed to update category' }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  ensureDbReady();
  const user = await getAuthUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  try {
    const { id } = await params;
    const db = getDb();

    // Check the category exists
    const category = db.prepare('SELECT id FROM categories WHERE id = ?').get(id);
    if (!category) return NextResponse.json({ error: 'Category not found' }, { status: 404 });

    // Move children to top-level before deleting
    db.prepare('UPDATE categories SET parent_id = NULL WHERE parent_id = ?').run(id);

    // Unassign products from this category
    db.prepare('UPDATE products SET category_id = NULL WHERE category_id = ?').run(id);
    db.prepare('UPDATE products SET subcategory_id = NULL WHERE subcategory_id = ?').run(id);

    // Delete the category
    db.prepare('DELETE FROM categories WHERE id = ?').run(id);

    return NextResponse.json({ success: true });
  } catch (e: any) {
    console.error('Category delete error:', e);
    return NextResponse.json({ error: 'Failed to delete category' }, { status: 500 });
  }
}
