import { NextRequest, NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';
import { ensureDbReady } from '@/lib/init';
import getDb from '@/lib/db';
import { getAuthUser } from '@/lib/auth';
import {
  IN_FIXES, US_FIXES, US_NEUTRALIZE, ARCHIVE_NO_LISTING, DRAFT_COM_ONLY,
  inUrl, usUrl,
} from '@/lib/amazon-link-fixes';

/**
 * Applies the verified amazon.in / amazon.com link fixes + the no-listing
 * status changes directly to this database (the server's live DB). Admin-only.
 *
 * Body: { } — safe by default: include { dryRun: true } to preview without
 * writing. Always takes a file backup (data/backups/) before writing.
 */
export async function POST(req: NextRequest) {
  const user = await getAuthUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  try {
    await ensureDbReady();
    const body = await req.json().catch(() => ({}));
    const dryRun = body?.dryRun === true;

    const db = getDb();
    const rows = db.prepare(
      `SELECT slug, name, status, india_affiliate_url, us_affiliate_url, affiliate_url, global_affiliate_url, archived_at
       FROM products WHERE deleted_at IS NULL`
    ).all() as any[];
    const bySlug = new Map(rows.map(r => [r.slug, r]));
    const slugExists = (s: string) => bySlug.has(s);

    const outcomes: { slug: string; action: string; detail: string }[] = [];
    const plan: { slug: string; kind: string; value: string }[] = [];

    for (const [slug, asin] of Object.entries(IN_FIXES)) {
      if (!slugExists(slug)) continue;
      const want = inUrl(asin);
      const row = bySlug.get(slug);
      if (row.india_affiliate_url === want) outcomes.push({ slug, action: 'ok', detail: '.in already set' });
      else { plan.push({ slug, kind: 'in', value: want }); outcomes.push({ slug, action: 'set .in', detail: asin }); }
    }
    for (const [slug, asin] of Object.entries(US_FIXES)) {
      if (!slugExists(slug)) continue;
      const want = usUrl(asin);
      const row = bySlug.get(slug);
      if (row.us_affiliate_url === want) outcomes.push({ slug, action: 'ok', detail: '.com already set' });
      else { plan.push({ slug, kind: 'us', value: want }); outcomes.push({ slug, action: 'set .com', detail: asin }); }
    }
    for (const slug of US_NEUTRALIZE) {
      if (!slugExists(slug)) continue;
      const row = bySlug.get(slug);
      const legacyCom = String(row.affiliate_url || '').includes('.amazon.com')
        || String(row.global_affiliate_url || '').includes('.amazon.com');
      if (!row.us_affiliate_url && !legacyCom) outcomes.push({ slug, action: 'ok', detail: '.com already neutralized' });
      else { plan.push({ slug, kind: 'neutralize', value: '' }); outcomes.push({ slug, action: 'neutralize .com', detail: 'fallback → .in' }); }
    }
    for (const slug of ARCHIVE_NO_LISTING) {
      if (!slugExists(slug)) continue;
      const row = bySlug.get(slug);
      if (row.status === 'archived') outcomes.push({ slug, action: 'ok', detail: 'already archived' });
      else { plan.push({ slug, kind: 'archive', value: '' }); outcomes.push({ slug, action: 'archive', detail: 'no listing on either store' }); }
    }
    for (const slug of DRAFT_COM_ONLY) {
      if (!slugExists(slug)) continue;
      const row = bySlug.get(slug);
      if (row.status === 'draft') outcomes.push({ slug, action: 'ok', detail: 'already draft' });
      else { plan.push({ slug, kind: 'draft', value: '' }); outcomes.push({ slug, action: 'draft', detail: '.com only — no amazon.in' }); }
    }

    if (dryRun) {
      return NextResponse.json({ ok: true, dryRun: true, changed: plan.length, outcomes });
    }
    if (!plan.length) {
      return NextResponse.json({ ok: true, changed: 0, outcomes, message: 'Nothing to change — fixes already applied.' });
    }

    // Backup before writing (same folder the terminal script uses).
    const dbPath = path.resolve(process.cwd(), process.env.DATABASE_PATH || './data/alaya.db');
    const backupsDir = path.join(path.dirname(dbPath), 'backups');
    fs.mkdirSync(backupsDir, { recursive: true });
    const stamp = new Date().toISOString().split('T').join('').split('-').join('').split(':').join('').split('.').join('').slice(0, 14);
    const backupFile = path.join(backupsDir, `alaya-amazonlinks-admin-${stamp}.db`);
    try {
      fs.copyFileSync(dbPath, backupFile);
    } catch (e: any) {
      return NextResponse.json({ error: `Backup failed: ${e?.message}` }, { status: 500 });
    }

    const setIn = db.prepare(`UPDATE products SET india_affiliate_url = ?, updated_at = datetime('now') WHERE slug = ?`);
    const setUs = db.prepare(`UPDATE products SET us_affiliate_url = ?, updated_at = datetime('now') WHERE slug = ?`);
    const neutralize = db.prepare(`
      UPDATE products SET us_affiliate_url = '',
        affiliate_url = CASE WHEN affiliate_url LIKE '%amazon.com%' THEN india_affiliate_url ELSE affiliate_url END,
        global_affiliate_url = CASE WHEN global_affiliate_url LIKE '%amazon.com%' THEN india_affiliate_url ELSE global_affiliate_url END,
        updated_at = datetime('now') WHERE slug = ?`);
    const setStatus = db.prepare(`
      UPDATE products SET status = ?,
        archived_at = CASE WHEN ? = 'archived' THEN datetime('now') ELSE archived_at END,
        updated_at = datetime('now') WHERE slug = ?`);

    const tx = db.transaction(() => {
      for (const p of plan) {
        if (p.kind === 'in') setIn.run(p.value, p.slug);
        else if (p.kind === 'us') setUs.run(p.value, p.slug);
        else if (p.kind === 'neutralize') neutralize.run(p.slug);
        else setStatus.run(p.kind, p.kind, p.slug);
      }
    });
    tx();

    db.prepare('INSERT INTO activity_logs (id, user_id, action, entity_type, entity_id, details) VALUES (?, ?, ?, ?, ?, ?)')
      .run(require('crypto').randomUUID(), user.id, 'applied_amazon_fixes', 'product', 'bulk',
        `Applied ${plan.length} verified amazon link/status fixes (backup: ${path.basename(backupFile)})`);

    return NextResponse.json({ ok: true, changed: plan.length, backup: path.basename(backupFile), outcomes });
  } catch (e: any) {
    console.error('apply-amazon-fixes error:', e);
    return NextResponse.json({ error: 'Failed to apply fixes' }, { status: 500 });
  }
}