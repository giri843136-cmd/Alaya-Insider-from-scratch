/**
 * TASK 31b — snapshot core (WAVE 1): exit-free library form of the tool.
 *
 * Policy (hard rules from the queue, enforced by checkSnapshotDir):
 *   - SNAPSHOT_DIR is mandatory; UNSET means "snapshots disabled", never a guess.
 *   - The resolved directory must lie OUTSIDE the app root entirely — on hPanel
 *     every path inside the app dir is served or rewritten around the live DB,
 *     and public/ is doubly forbidden.
 *   - Copy via VACUUM INTO (consistent, online-safe read of the live DB).
 *   - The COPY is integrity_check'd; any failure is FATAL (error thrown, the
 *     failed file removed so a corrupt copy can never masquerade as a backup).
 *   - Retention (SNAPSHOT_KEEP, default 7) deletes oldest-first and NEVER the
 *     file just written.
 *   - Filenames carry a UTC timestamp only: no DB bytes, no secrets, no PII.
 */
import Database from 'better-sqlite3';
import fs from 'fs';
import path from 'path';
import { checkSnapshotDir } from './snapshot-policy';

const NAME_RE = /^alaya-\d{8}T\d{6}Z\.db$/;

export interface SnapshotResult {
  ok: boolean;
  file?: string;
  size?: number;
  integrity?: string;
  kept?: number;
  deleted?: string[];
  error?: string;
  reason?: string;
}

export async function runSnapshot(opts: {
  dbPath: string;
  snapshotDir: string;
  keep: number;
}): Promise<SnapshotResult> {
  const { dbPath, snapshotDir, keep } = opts;
  // e.g. alaya-20260919T101500Z.db (UTC, timestamp only)
  const stamp = new Date().toISOString().replace(/[-:]/g, '').replace(/\..+$/, '');
  const target = path.join(snapshotDir, `alaya-${stamp}Z.db`);

  if (!fs.existsSync(dbPath)) {
    return { ok: false, error: `source database not found at ${dbPath}` };
  }
  fs.mkdirSync(snapshotDir, { recursive: true });
  if (fs.existsSync(target)) fs.rmSync(target);

  // ── VACUUM INTO (the live DB is only read) ─────────────────────────────
  const db = new Database(dbPath);
  try {
    db.exec(`VACUUM INTO '${target.replace(/'/g, "''")}'`);
  } catch (e: any) {
    try { db.close(); } catch { /* noop */ }
    try { fs.rmSync(target); } catch { /* noop */ }
    return { ok: false, error: `VACUUM INTO failed: ${e?.message || e}` };
  }
  try { db.close(); } catch { /* noop */ }

  // ── integrity_check on the COPY — failure is FATAL for the snapshot ────
  let integrity: string;
  try {
    const copy = new Database(target, { readonly: true });
    integrity = copy.pragma('integrity_check', { simple: true }) as string;
    copy.close();
  } catch (e: any) {
    try { fs.rmSync(target); } catch { /* noop */ }
    return { ok: false, error: `snapshot failed integrity_check (open): ${e?.message || e}` };
  }
  if (integrity !== 'ok') {
    try { fs.rmSync(target); } catch { /* noop */ }
    return { ok: false, error: `snapshot failed integrity_check: ${integrity}` };
  }

  // ── Retention: oldest-first, never the file just written ───────────────
  const existing = fs.readdirSync(snapshotDir).filter((f) => NAME_RE.test(f)).sort();
  const doomed = existing.slice(0, Math.max(0, existing.length - keep));
  const deleted: string[] = [];
  for (const name of doomed) {
    if (path.join(snapshotDir, name) === target) continue;
    try {
      fs.rmSync(path.join(snapshotDir, name));
      deleted.push(name);
    } catch { /* best effort */ }
  }

  return {
    ok: true,
    file: path.basename(target),
    size: fs.statSync(target).size,
    integrity,
    kept: existing.length - deleted.length,
    deleted,
  };
}

/**
 * Runs the snapshot under the full policy gate. Shared by the admin trigger
 * endpoint and the cron endpoint; both surfaces refuse identically when
 * SNAPSHOT_DIR is unset or inside the app root.
 */
export async function runSnapshotUnderPolicy(env: {
  SNAPSHOT_DIR?: string;
  SNAPSHOT_KEEP?: string;
  DATABASE_PATH?: string;
}, appRoot: string): Promise<SnapshotResult> {
  const check = checkSnapshotDir(env.SNAPSHOT_DIR, appRoot);
  if (!check.ok) {
    return { ok: false, reason: check.code, error: check.message };
  }
  return runSnapshot({
    dbPath: path.resolve(env.DATABASE_PATH || './data/alaya.db'),
    snapshotDir: check.dir as string,
    keep: Math.max(1, parseInt(env.SNAPSHOT_KEEP || '7', 10) || 7),
  });
}
