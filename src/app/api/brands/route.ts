import { NextRequest, NextResponse } from 'next/server';
import { ensureDbReady } from '@/lib/init';
import getDb from '@/lib/db';
import { getAuthUser } from '@/lib/auth';
import { v4 as uuid } from 'uuid';
import slugify from 'slugify';

export async function GET() {
  ensureDbReady();
  const db = getDb();
  const brands = db.prepare(`
    SELECT b.*,
      (SELECT COUNT(*) FROM products p WHERE p.brand_id = b.id AND p.status = 'published' AND p.deleted_at IS NULL) as product_count
    FROM brands b
    ORDER BY b.name ASC
  `).all();
  return NextResponse.json({ brands });
}

export async function POST(req: NextRequest) {
  ensureDbReady();
  const user = await getAuthUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const data = await req.json();
  const db = getDb();
  const id = uuid();
  const slug = data.slug || slugify(data.name || '', { lower: true, strict: true });

  db.prepare(`INSERT INTO brands (id, name, slug, logo, description, website_url, is_featured, seo_title, seo_description) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`)
    .run(id, data.name, slug, data.logo || '', data.description || '', data.website_url || '', data.is_featured ? 1 : 0, data.seo_title || '', data.seo_description || '');

  return NextResponse.json({ id, slug }, { status: 201 });
}
