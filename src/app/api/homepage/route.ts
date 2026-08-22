import { NextRequest, NextResponse } from 'next/server';
import { ensureDbReady } from '@/lib/init';
import getDb from '@/lib/db';
import { getAuthUser } from '@/lib/auth';

export async function GET() {
  ensureDbReady();
  const db = getDb();
  const sections = db.prepare('SELECT * FROM homepage_sections ORDER BY sort_order ASC').all();
  return NextResponse.json({
    sections: sections.map((s: any) => ({
      ...s,
      content: JSON.parse(s.content || '{}'),
    }))
  });
}

export async function PUT(req: NextRequest) {
  ensureDbReady();
  const user = await getAuthUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { sections } = await req.json();
  const db = getDb();

  const stmt = db.prepare(`
    UPDATE homepage_sections SET title = ?, subtitle = ?, content = ?, sort_order = ?, is_visible = ?, updated_at = datetime('now')
    WHERE id = ?
  `);

  for (const s of sections) {
    stmt.run(s.title || '', s.subtitle || '', JSON.stringify(s.content || {}), s.sort_order || 0, s.is_visible ? 1 : 0, s.id);
  }

  return NextResponse.json({ success: true });
}
