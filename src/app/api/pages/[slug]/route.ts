import { NextRequest, NextResponse } from 'next/server';
import { ensureDbReady } from '@/lib/init';
import getDb from '@/lib/db';
import { getAuthUser } from '@/lib/auth';

export async function GET(req: NextRequest, { params }: { params: Promise<{ slug: string }> }) {
  ensureDbReady();
  const { slug } = await params;
  const page = getDb().prepare('SELECT * FROM pages WHERE slug = ?').get(slug);
  if (!page) return NextResponse.json({ error: 'Page not found' }, { status: 404 });
  return NextResponse.json({ page });
}

export async function PUT(req: NextRequest, { params }: { params: Promise<{ slug: string }> }) {
  ensureDbReady();
  const user = await getAuthUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const { slug } = await params;
  const data = await req.json();
  getDb().prepare('UPDATE pages SET title=?, content=?, seo_title=?, seo_description=?, updated_at=datetime("now") WHERE slug=?')
    .run(data.title, data.content, data.seo_title||'', data.seo_description||'', slug);
  return NextResponse.json({ success: true });
}
