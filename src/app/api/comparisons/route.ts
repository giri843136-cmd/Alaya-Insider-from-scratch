import { NextRequest, NextResponse } from 'next/server';
import { ensureDbReady } from '@/lib/init';
import getDb from '@/lib/db';
import { getAuthUser } from '@/lib/auth';
import { v4 as uuid } from 'uuid';
import slugify from 'slugify';

export async function GET() {
  ensureDbReady();
  const db = getDb();
  const comparisons = db.prepare("SELECT * FROM comparisons WHERE status = 'published' ORDER BY created_at DESC").all();
  return NextResponse.json({
    comparisons: comparisons.map((c: any) => ({
      ...c,
      product_ids: JSON.parse(c.product_ids || '[]'),
      comparison_fields: JSON.parse(c.comparison_fields || '[]'),
    }))
  });
}

export async function POST(req: NextRequest) {
  ensureDbReady();
  const user = await getAuthUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const data = await req.json();
  const db = getDb();
  const id = uuid();
  const slug = data.slug || slugify(data.title || '', { lower: true, strict: true });

  db.prepare(`INSERT INTO comparisons (id, title, slug, description, product_ids, comparison_fields, status, seo_title, seo_description) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`)
    .run(id, data.title, slug, data.description||'', JSON.stringify(data.product_ids||[]),
      JSON.stringify(data.comparison_fields||[]), data.status||'draft', data.seo_title||'', data.seo_description||'');

  return NextResponse.json({ id, slug }, { status: 201 });
}
