import { NextRequest, NextResponse } from 'next/server';
import { ensureDbReady } from '@/lib/init';
import getDb from '@/lib/db';
import { getAuthUser } from '@/lib/auth';
import { v4 as uuid } from 'uuid';
import slugify from 'slugify';

export async function GET(req: NextRequest) {
  ensureDbReady();
  const db = getDb();
  const url = new URL(req.url);
  const flat = url.searchParams.get('flat') === 'true';
  const featured = url.searchParams.get('featured');

  let where = '';
  const params: any[] = [];

  if (featured === 'true') {
    where = 'WHERE is_featured = 1';
  }

  const categories = db.prepare(`
    SELECT c.*,
      (SELECT COUNT(*) FROM products p WHERE (p.category_id = c.id OR p.subcategory_id = c.id) AND p.status = 'published' AND p.deleted_at IS NULL) as product_count,
      pc.name as parent_name
    FROM categories c
    LEFT JOIN categories pc ON c.parent_id = pc.id
    ${where}
    ORDER BY c.sort_order ASC, c.name ASC
  `).all(...params);

  if (flat) {
    return NextResponse.json({ categories });
  }

  // Build tree
  const tree: any[] = [];
  const map = new Map();
  categories.forEach((c: any) => map.set(c.id, { ...c, children: [] }));
  categories.forEach((c: any) => {
    const node = map.get(c.id);
    if (c.parent_id && map.has(c.parent_id)) {
      map.get(c.parent_id).children.push(node);
    } else if (!c.parent_id) {
      tree.push(node);
    }
  });

  return NextResponse.json({ categories: tree });
}

export async function POST(req: NextRequest) {
  ensureDbReady();
  const user = await getAuthUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  try {
    const data = await req.json();
    if (!data.name || !data.name.trim()) {
      return NextResponse.json({ error: 'Category name is required' }, { status: 400 });
    }
    const db = getDb();
    const id = uuid();
    const slug = data.slug || slugify(data.name.trim(), { lower: true, strict: true });

    const existing = db.prepare('SELECT id FROM categories WHERE slug = ?').get(slug);
    if (existing) return NextResponse.json({ error: 'Category slug already exists' }, { status: 400 });

    db.prepare(`
      INSERT INTO categories (id, name, slug, description, image, parent_id, sort_order, is_featured, seo_title, seo_description)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(id, data.name.trim(), slug, data.description || '', data.image || '',
      data.parent_id || null, data.sort_order || 0, data.is_featured ? 1 : 0,
      data.seo_title || '', data.seo_description || '');

    return NextResponse.json({ id, slug }, { status: 201 });
  } catch (e: any) {
    console.error('Category create error:', e);
    return NextResponse.json({ error: 'Failed to create category' }, { status: 500 });
  }
}
