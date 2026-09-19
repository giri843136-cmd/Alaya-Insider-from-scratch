/**
 * TASK 31b — shared snapshot path policy (WAVE 1).
 *
 * Single source of truth for the hard rules agreed in the queue:
 *   - SNAPSHOT_DIR must be set; absence is a hard refusal.
 *   - The resolved directory must lie OUTSIDE the app root entirely
 *     (public/ is inside the app root and is doubly named as forbidden).
 * The CLI tool (scripts/snapshot-db.mjs) and the admin endpoints both import
 * this module so the rules cannot drift apart.
 *
 * READ-TIME GUARD (2026-09-19, owner-approved): listing snapshots must run
 * each path through the SAME policy — a backup that somehow landed inside
 * public/ (written by anything, not just our writer) must be reported with
 * an explicit `exposed` flag on every listed entry, loud in the admin UI,
 * never silently unlisted by the write-time policy alone.
 */
import fs from 'fs';
import path from 'path';

export interface SnapshotDirCheck {
  ok: boolean;
  code: 'OK' | 'UNSET' | 'INSIDE_APP_ROOT' | 'INSIDE_PUBLIC';
  dir: string | null;
  message: string;
}

export function checkSnapshotDir(
  dirEnv: string | undefined,
  appRoot: string,
  sep: string = path.sep,
): SnapshotDirCheck {
  if (!dirEnv || !String(dirEnv).trim()) {
    return {
      ok: false,
      code: 'UNSET',
      dir: null,
      message: 'SNAPSHOT_DIR is not set — snapshots are disabled.',
    };
  }
  const dir = path.resolve(String(dirEnv));
  const publicRoot = path.join(appRoot, 'public');
  // public/ is named FIRST and separately: it is doubly forbidden (inside the
  // app root AND a served path), so it gets its own refusal code even though
  // the app-root rule would also catch it.
  if (dir === publicRoot || dir.startsWith(publicRoot + sep)) {
    return {
      ok: false,
      code: 'INSIDE_PUBLIC',
      dir,
      message: 'SNAPSHOT_DIR resolves inside public/ — refused.',
    };
  }
  if (dir === appRoot || dir.startsWith(appRoot + sep)) {
    return {
      ok: false,
      code: 'INSIDE_APP_ROOT',
      dir,
      message: `SNAPSHOT_DIR (${dir}) resolves inside the app root — refused.`,
    };
  }
  return { ok: true, code: 'OK', dir, message: 'SNAPSHOT_DIR accepted (outside app root).' };
}

export interface SnapshotListingEntry {
  file: string;
  size: number;
  mtime: string;
  /** True when this snapshot resolves under <appRoot>/public — loud, not hidden. */
  exposed: boolean;
  /** Where the file physically resolved, when readable (diagnostic only). */
  resolvedPath?: string;
}

/**
 * READ-TIME GUARD. Lists snapshot files in `dir`, marking every entry that
 * resolves under the app root's public/ (or inside the app root at all) as
 * `exposed: true`. Directories are pre-screened with the SAME checkSnapshotDir
 * policy the writer uses, so a mis-configured SNAPSHOT_DIR shows up here with
 * `configured: false`-style codes instead of a silent empty list.
 */
export function listSnapshots(
  dir: string | undefined,
  appRoot: string,
  opts: { nameRe?: RegExp } = {},
): { check: SnapshotDirCheck; snapshots: SnapshotListingEntry[] } {
  const check = checkSnapshotDir(dir, appRoot);
  if (!dir || !String(dir).trim()) {
    return { check, snapshots: [] }; // UNSET: there is no directory to inspect
  }
  const nameRe = opts.nameRe ?? /^[^/]*\.db$/;
  const publicRoot = path.join(appRoot, 'public');
  const sep = path.sep;
  const resolvedDir = path.resolve(String(dir));
  let entries: string[] = [];
  try {
    entries = fs.readdirSync(resolvedDir).filter((f) => nameRe.test(f));
  } catch {
    return { check, snapshots: [] }; // absent or unreadable: nothing to report
  }
  // If the DIRECTORY itself is in a forbidden zone (e.g. someone pointed
  // SNAPSHOT_DIR into public/), every entry found there is exposed BY
  // DEFINITION — the listing must be loud, never suppressed by the same
  // policy that refuses writes.
  const dirForbidden = !check.ok;
  const snapshots: SnapshotListingEntry[] = entries
    .map((f) => {
      const fullPath = path.join(resolvedDir, f);
      let st: fs.Stats;
      try {
        st = fs.statSync(fullPath);
      } catch {
        return null;
      }
      // Same containment logic as checkSnapshotDir, applied per entry.
      const exposed =
        dirForbidden ||
        fullPath === publicRoot ||
        fullPath.startsWith(publicRoot + sep) ||
        fullPath === appRoot ||
        fullPath.startsWith(appRoot + sep);
      return {
        file: f,
        size: st.size,
        mtime: st.mtime.toISOString(),
        exposed,
        resolvedPath: fullPath,
      } as SnapshotListingEntry;
    })
    .filter((e): e is SnapshotListingEntry => e !== null)
    .sort((a, b) => b.mtime.localeCompare(a.mtime));
  return { check, snapshots };
}
