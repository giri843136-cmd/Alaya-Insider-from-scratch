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
  const page = Math.max(1, parseInt(url.searchParams.get('page') || '1'));
  const limit = Math.min(50, parseInt(url.searchParams.get('limit') || '20'));
  const offset = (page - 1) * limit;
  const status = url.searchParams.get('status') || '';
  const category = url.searchParams.get('category') || '';
  const featured = url.searchParams.get('featured');
  const isAdmin = url.searchParams.get('admin') === 'true';

  let where = ['a.deleted_at IS NULL'];
  const params: any[] = [];

  if (!isAdmin) {
    where.push("a.status = 'published'");
  } else if (status) {
    where.push('a.status = ?');
    params.push(status);
  }

  if (category) {
    where.push('ac.slug = ?');
    params.push(category);
  }

  if (featured === 'true') {
    where.push('a.is_featured = 1');
  }

  const whereClause = where.length ? `WHERE ${where.join(' AND ')}` : '';

  const total = (db.prepare(`
    SELECT COUNT(*) as cnt FROM articles a
    LEFT JOIN article_categories ac ON a.category_id = ac.id
    ${whereClause}
  `).get(...params) as any).cnt;

  const articles = db.prepare(`
    SELECT a.*, ac.name as category_name, ac.slug as category_slug,
           u.first_name || ' ' || u.last_name as author_name
    FROM articles a
    LEFT JOIN article_categories ac ON a.category_id = ac.id
    LEFT JOIN users u ON a.author_id = u.id
    ${whereClause}
    ORDER BY a.created_at DESC
    LIMIT ? OFFSET ?
  `).all(...params, limit, offset);

  return NextResponse.json({
    articles,
    pagination: { page, limit, total, totalPages: Math.ceil(total / limit) },
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

  db.prepare(`
    INSERT INTO articles (id, title, slug, subtitle, featured_image, category_id, author_id,
      content, excerpt, reading_time, status, is_featured, seo_title, seo_description,
      tags, related_products, related_articles, published_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(id, data.title, slug, data.subtitle || '', data.featured_image || '',
    data.category_id || null, user.id, data.content || '', data.excerpt || '',
    data.reading_time || 0, data.status || 'draft', data.is_featured ? 1 : 0,
    data.seo_title || '', data.seo_description || '',
    JSON.stringify(data.tags || []), JSON.stringify(data.related_products || []),
    JSON.stringify(data.related_articles || []),
    data.status === 'published' ? new Date().toISOString() : null);

  return NextResponse.json({ id, slug }, { status: 201 });
}
