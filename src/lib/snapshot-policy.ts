/**
 * TASK 31b — shared snapshot path policy (WAVE 1).
 *
 * Single source of truth for the hard rules agreed in the queue:
 *   - SNAPSHOT_DIR must be set; absence is a hard refusal.
 *   - The resolved directory must lie OUTSIDE the app root entirely
 *     (public/ is inside the app root and is doubly named as forbidden).
 * The CLI tool (scripts/snapshot-db.mjs) and the admin endpoints both import
 * this module so the rules cannot drift apart.
 */
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
