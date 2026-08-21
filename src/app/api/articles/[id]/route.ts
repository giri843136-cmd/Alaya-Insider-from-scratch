import { NextRequest, NextResponse } from 'next/server';
import { ensureDbReady } from '@/lib/init';
import getDb from '@/lib/db';
import { getAuthUser } from '@/lib/auth';

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  ensureDbReady();
  const { id } = await params;
  const db = getDb();
  const article = db.prepare(`
    SELECT a.*, ac.name as category_name, ac.slug as category_slug,
           u.first_name || ' ' || u.last_name as author_name
    FROM articles a
    LEFT JOIN article_categories ac ON a.category_id = ac.id
    LEFT JOIN users u ON a.author_id = u.id
    WHERE (a.id = ? OR a.slug = ?) AND a.deleted_at IS NULL
  `).get(id, id) as any;

  if (!article) return NextResponse.json({ error: 'Not found' }, { status: 404 });

  return NextResponse.json({
    article: {
      ...article,
      tags: JSON.parse(article.tags || '[]'),
      related_products: JSON.parse(article.related_products || '[]'),
      related_articles: JSON.parse(article.related_articles || '[]'),
    }
  });
}

export async function PUT(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  ensureDbReady();
  const user = await getAuthUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const { id } = await params;
  const data = await req.json();
  const db = getDb();

  db.prepare(`
    UPDATE articles SET title=?, slug=?, subtitle=?, featured_image=?, category_id=?,
      content=?, excerpt=?, reading_time=?, status=?, is_featured=?,
      seo_title=?, seo_description=?, tags=?, related_products=?, related_articles=?,
      updated_at=datetime('now'),
      published_at = CASE WHEN ? = 'published' AND published_at IS NULL THEN datetime('now') ELSE published_at END
    WHERE id=?
  `).run(data.title, data.slug, data.subtitle||'', data.featured_image||'',
    data.category_id||null, data.content||'', data.excerpt||'',
    data.reading_time||0, data.status||'draft', data.is_featured?1:0,
    data.seo_title||'', data.seo_description||'',
    JSON.stringify(data.tags||[]), JSON.stringify(data.related_products||[]),
    JSON.stringify(data.related_articles||[]), data.status||'draft', id);

  return NextResponse.json({ success: true });
}

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  ensureDbReady();
  const user = await getAuthUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const { id } = await params;
  getDb().prepare("UPDATE articles SET deleted_at = datetime('now') WHERE id = ?").run(id);
  return NextResponse.json({ success: true });
}
