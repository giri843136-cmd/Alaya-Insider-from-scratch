import { NextRequest, NextResponse } from 'next/server';
import { ensureDbReady } from '@/lib/init';
import getDb from '@/lib/db';
import { getAuthUser } from '@/lib/auth';
import slugify from 'slugify';

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  ensureDbReady();
  const { id } = await params;
  const db = getDb();
  const brand = db.prepare('SELECT * FROM brands WHERE id = ? OR slug = ?').get(id, id);
  if (!brand) return NextResponse.json({ error: 'Not found' }, { status: 404 });
  return NextResponse.json({ brand });
}

export async function PUT(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  ensureDbReady();
  const user = await getAuthUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  try {
    const { id } = await params;
    const data = await req.json();
    if (!data.name || !data.name.trim()) {
      return NextResponse.json({ error: 'Brand name is required' }, { status: 400 });
    }
    const db = getDb();

    // Check the brand exists
    const existing = db.prepare('SELECT id, slug FROM brands WHERE id = ?').get(id) as any;
    if (!existing) return NextResponse.json({ error: 'Brand not found' }, { status: 404 });

    const slug = data.slug || slugify(data.name.trim(), { lower: true, strict: true });

    // Check slug uniqueness if changed
    if (slug !== existing.slug) {
      const slugExists = db.prepare('SELECT id FROM brands WHERE slug = ? AND id != ?').get(slug, id);
      if (slugExists) {
        return NextResponse.json({ error: 'A brand with this URL slug already exists' }, { status: 400 });
      }
    }

    db.prepare(`UPDATE brands SET name=?, slug=?, logo=?, description=?, website_url=?, is_featured=?, seo_title=?, seo_description=?, updated_at=datetime('now') WHERE id=?`)
      .run(data.name.trim(), slug, data.logo||'', data.description||'', data.website_url||'', data.is_featured?1:0, data.seo_title||'', data.seo_description||'', id);

    return NextResponse.json({ success: true });
  } catch (e: any) {
    console.error('Brand update error:', e);
    return NextResponse.json({ error: 'Failed to update brand' }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  ensureDbReady();
  const user = await getAuthUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  try {
    const { id } = await params;
    const db = getDb();

    const brand = db.prepare('SELECT id FROM brands WHERE id = ?').get(id);
    if (!brand) return NextResponse.json({ error: 'Brand not found' }, { status: 404 });

    db.prepare('DELETE FROM brands WHERE id = ?').run(id);
    return NextResponse.json({ success: true });
  } catch (e: any) {
    console.error('Brand delete error:', e);
    return NextResponse.json({ error: 'Failed to delete brand' }, { status: 500 });
  }
}
