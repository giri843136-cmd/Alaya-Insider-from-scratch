import { NextRequest, NextResponse } from 'next/server';
import { ensureDbReady } from '@/lib/init';
import getDb from '@/lib/db';
import { getAuthUser } from '@/lib/auth';
import { v4 as uuid } from 'uuid';
import slugify from 'slugify';

export async function GET() {
  ensureDbReady();
  const db = getDb();
  const collections = db.prepare(`
    SELECT c.*,
      (SELECT COUNT(*) FROM collection_products cp WHERE cp.collection_id = c.id) as product_count
    FROM collections c
    WHERE c.is_active = 1
    ORDER BY c.sort_order ASC
  `).all();
  return NextResponse.json({ collections });
}

export async function POST(req: NextRequest) {
  ensureDbReady();
  const user = await getAuthUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const data = await req.json();
  const db = getDb();
  const id = uuid();
  const slug = data.slug || slugify(data.name || '', { lower: true, strict: true });

  db.prepare(`INSERT INTO collections (id, name, slug, description, cover_image, sort_order, seo_title, seo_description)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)`)
    .run(id, data.name, slug, data.description||'', data.cover_image||'', data.sort_order||0, data.seo_title||'', data.seo_description||'');

  if (data.product_ids?.length) {
    const stmt = db.prepare('INSERT INTO collection_products (collection_id, product_id, sort_order) VALUES (?, ?, ?)');
    data.product_ids.forEach((pid: string, i: number) => stmt.run(id, pid, i));
  }

  return NextResponse.json({ id, slug }, { status: 201 });
}
