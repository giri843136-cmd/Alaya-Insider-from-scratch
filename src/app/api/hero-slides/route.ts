import { NextRequest, NextResponse } from 'next/server';
import { ensureDbReady } from '@/lib/init';
import getDb from '@/lib/db';
import { getAuthUser } from '@/lib/auth';
import { v4 as uuid } from 'uuid';

export async function GET(req: NextRequest) {
  ensureDbReady();
  const db = getDb();
  const isAdmin = new URL(req.url).searchParams.get('admin') === 'true';

  let slides;
  if (isAdmin) {
    slides = db.prepare('SELECT * FROM hero_slides ORDER BY sort_order ASC').all();
  } else {
    // Only published + within date range
    slides = db.prepare(`SELECT * FROM hero_slides WHERE status = 'published'
      AND (start_date IS NULL OR start_date <= datetime('now'))
      AND (end_date IS NULL OR end_date >= datetime('now'))
      ORDER BY sort_order ASC`).all();
  }

  const settings: Record<string, string> = {};
  (db.prepare('SELECT * FROM hero_settings').all() as any[]).forEach((s: any) => { settings[s.key] = s.value; });

  return NextResponse.json({ slides, settings });
}

export async function POST(req: NextRequest) {
  ensureDbReady();
  const user = await getAuthUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const data = await req.json();
  const db = getDb();
  const id = uuid();
  const maxOrder = (db.prepare('SELECT MAX(sort_order) as m FROM hero_slides').get() as any).m || 0;

  db.prepare(`INSERT INTO hero_slides (id, eyebrow, headline, description, primary_cta_label, primary_cta_url,
    secondary_cta_label, secondary_cta_url, desktop_image, tablet_image, mobile_image,
    background_color, text_alignment, text_color, layout, status, sort_order, start_date, end_date)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`)
    .run(id, data.eyebrow||'', data.headline||'', data.description||'',
      data.primary_cta_label||'', data.primary_cta_url||'',
      data.secondary_cta_label||'', data.secondary_cta_url||'',
      data.desktop_image||'', data.tablet_image||'', data.mobile_image||'',
      data.background_color||'#f8f6f3', data.text_alignment||'left', data.text_color||'dark',
      data.layout||'text-left', data.status||'draft', maxOrder + 1,
      data.start_date||null, data.end_date||null);

  return NextResponse.json({ id }, { status: 201 });
}

export async function PUT(req: NextRequest) {
  ensureDbReady();
  const user = await getAuthUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const data = await req.json();
  const db = getDb();

  // Update settings
  if (data.settings) {
    const stmt = db.prepare('INSERT OR REPLACE INTO hero_settings (key, value) VALUES (?, ?)');
    for (const [k, v] of Object.entries(data.settings)) stmt.run(k, v as string);
    return NextResponse.json({ success: true });
  }

  // Update slide
  if (data.id) {
    db.prepare(`UPDATE hero_slides SET eyebrow=?, headline=?, description=?,
      primary_cta_label=?, primary_cta_url=?, secondary_cta_label=?, secondary_cta_url=?,
      desktop_image=?, tablet_image=?, mobile_image=?, background_color=?,
      text_alignment=?, text_color=?, layout=?, status=?, sort_order=?,
      start_date=?, end_date=?, updated_at=datetime('now') WHERE id=?`)
      .run(data.eyebrow||'', data.headline||'', data.description||'',
        data.primary_cta_label||'', data.primary_cta_url||'',
        data.secondary_cta_label||'', data.secondary_cta_url||'',
        data.desktop_image||'', data.tablet_image||'', data.mobile_image||'',
        data.background_color||'#f8f6f3', data.text_alignment||'left', data.text_color||'dark',
        data.layout||'text-left', data.status||'draft', data.sort_order||0,
        data.start_date||null, data.end_date||null, data.id);
    return NextResponse.json({ success: true });
  }

  // Bulk reorder
  if (data.order) {
    const stmt = db.prepare('UPDATE hero_slides SET sort_order = ? WHERE id = ?');
    data.order.forEach((id: string, i: number) => stmt.run(i, id));
    return NextResponse.json({ success: true });
  }

  return NextResponse.json({ error: 'Invalid request' }, { status: 400 });
}

export async function DELETE(req: NextRequest) {
  ensureDbReady();
  const user = await getAuthUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { id } = await req.json();
  getDb().prepare('DELETE FROM hero_slides WHERE id = ?').run(id);
  return NextResponse.json({ success: true });
}
