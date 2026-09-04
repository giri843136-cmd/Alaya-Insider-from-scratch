import { NextRequest, NextResponse } from 'next/server';
import { ensureDbReady } from '@/lib/init';
import getDb from '@/lib/db';
import { getAuthUser } from '@/lib/auth';
import { validateOneLinkSnippet, ONELINK_SETTING_KEY } from '@/lib/onelink';

/**
 * OneLink script management.
 * GET — current install status (validated src URLs only, never raw HTML).
 * PUT — store a pasted OneLink snippet after strict validation. Only
 *   <script src="https://*.amazon-adsystem.com|*.amazon.com|*.amazon.co.uk">
 *   tags are accepted; anything else (inline JS, other hosts, other HTML) is
 *   rejected so we never inject arbitrary script into the root layout.
 */
export async function GET() {
  ensureDbReady();
  const raw = (getDb().prepare('SELECT value FROM site_settings WHERE key = ?').get(ONELINK_SETTING_KEY) as any)?.value || '';
  const v = validateOneLinkSnippet(raw);
  return NextResponse.json({
    installed: v.ok && v.srcs.length > 0,
    srcs: v.ok ? v.srcs : [],
    error: v.error || null,
  });
}

export async function PUT(req: NextRequest) {
  ensureDbReady();
  const user = await getAuthUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  try {
    const body = await req.json().catch(() => ({}));
    const snippet = (body.snippet || '').trim();
    const v = validateOneLinkSnippet(snippet);
    if (!v.ok) {
      return NextResponse.json({ error: v.error || 'Snippet rejected' }, { status: 400 });
    }

    getDb().prepare(`INSERT INTO site_settings (key, value, group_name, updated_at)
      VALUES (?, ?, 'creators', datetime('now'))
      ON CONFLICT(key) DO UPDATE SET value = excluded.value, updated_at = excluded.updated_at`)
      .run(ONELINK_SETTING_KEY, snippet);

    return NextResponse.json({ success: true, installed: true, srcs: v.srcs });
  } catch (e: any) {
    console.error('OneLink save error:', e);
    return NextResponse.json({ error: 'Failed to save OneLink snippet' }, { status: 500 });
  }
}