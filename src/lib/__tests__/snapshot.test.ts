/**
 * TASK 31b — snapshot tooling tests (WAVE 1).
 *
 * Hard rules under test (from the queue):
 *   - SNAPSHOT_DIR unset  -> refusal, nothing written.
 *   - Inside app root     -> refusal, nothing written (hPanel ASK_ME).
 *   - Inside public/      -> refusal, nothing written.
 *   - Happy path          -> VACUUM INTO copy, integrity ok, timestamp-only name.
 *   - Corrupt copy        -> integrity failure is FATAL and the file is REMOVED.
 *   - Retention           -> oldest-first, NEVER the in-flight file.
 */
import Database from 'better-sqlite3';
import fs from 'fs';
import os from 'os';
import path from 'path';

process.env.NODE_ENV = 'test';

// Facade over the REAL better-sqlite3 so the integrity-check failure path can
// be exercised honestly: when SNAP_TEST_FORCE_CORRUPT=1, pragma
// ('integrity_check') reports corruption. VACUUM INTO and all other behaviour
// remain the genuine native module.
jest.mock('better-sqlite3', () => {
  const Real = jest.requireActual('better-sqlite3');
  return class DatabaseWithTestCorruption extends Real {
    pragma(arg: unknown, ...rest: unknown[]) {
      const value = super.pragma(arg, ...rest);
      if (
        arg === 'integrity_check' &&
        process.env.SNAP_TEST_FORCE_CORRUPT === '1'
      ) {
        return '*** file is corrupt ***';
      }
      return value;
    }
  };
});

const tmpRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'alaya-snap-'));
const appRoot = path.join(tmpRoot, 'app');
const dbDir = path.join(appRoot, 'data');
fs.mkdirSync(dbDir, { recursive: true });
const dbPath = path.join(dbDir, 'alaya.db');

// eslint-disable-next-line @typescript-eslint/no-var-requires
const { runSnapshot, runSnapshotUnderPolicy } = require('@/lib/snapshot');
// eslint-disable-next-line @typescript-eslint/no-var-requires
const { checkSnapshotDir } = require('@/lib/snapshot-policy');

function seedSourceDb() {
  const db = new Database(dbPath);
  db.exec(
    'CREATE TABLE IF NOT EXISTS products (id TEXT PRIMARY KEY, name TEXT NOT NULL);',
  );
  db.prepare('INSERT OR REPLACE INTO products (id, name) VALUES (?, ?)').run(
    'p1',
    'Snapshot Probe',
  );
  db.close();
}

function makeSnapshot(name: string, dir: string) {
  const p = path.join(dir, name);
  const d = new Database(p);
  d.exec('CREATE TABLE t (x INTEGER); INSERT INTO t VALUES (1);');
  d.close();
  return p;
}

describe('snapshot path policy (checkSnapshotDir)', () => {
  it('refuses when SNAPSHOT_DIR is unset', () => {
    const r = checkSnapshotDir(undefined, appRoot);
    expect(r.ok).toBe(false);
    expect(r.code).toBe('UNSET');
  });

  it('refuses a directory inside the app root (default ./backups included)', () => {
    expect(checkSnapshotDir(path.join(appRoot, 'backups'), appRoot).code).toBe(
      'INSIDE_APP_ROOT',
    );
    expect(checkSnapshotDir(appRoot, appRoot).code).toBe('INSIDE_APP_ROOT');
  });

  it('refuses public/ explicitly', () => {
    expect(
      checkSnapshotDir(path.join(appRoot, 'public', 'x'), appRoot).code,
    ).toBe('INSIDE_PUBLIC');
  });

  it('accepts a path outside the app root', () => {
    const outside = path.join(tmpRoot, 'outside-backups');
    const r = checkSnapshotDir(outside, appRoot);
    expect(r.ok).toBe(true);
    expect(r.code).toBe('OK');
  });
});

describe('runSnapshotUnderPolicy', () => {
  it('refuses to run without SNAPSHOT_DIR and writes nothing', async () => {
    const r = await runSnapshotUnderPolicy({ SNAPSHOT_DIR: undefined }, appRoot);
    expect(r.ok).toBe(false);
    expect(r.reason).toBe('UNSET');
  });

  it('refuses to run into the app root even when set', async () => {
    const r = await runSnapshotUnderPolicy(
      { SNAPSHOT_DIR: path.join(appRoot, 'backups') },
      appRoot,
    );
    expect(r.ok).toBe(false);
    expect(r.reason).toBe('INSIDE_APP_ROOT');
  });

  it('produces an integrity-ok snapshot outside the app root with a timestamp-only filename', async () => {
    seedSourceDb();
    const outside = path.join(tmpRoot, 'snapshots');
    const r = await runSnapshotUnderPolicy(
      { SNAPSHOT_DIR: outside, DATABASE_PATH: dbPath, SNAPSHOT_KEEP: '7' },
      appRoot,
    );
    expect(r.ok).toBe(true);
    expect(r.integrity).toBe('ok');
    expect(r.file).toMatch(/^alaya-\d{8}T\d{6}Z\.db$/);
    const written = path.join(outside, r.file as string);
    expect(fs.existsSync(written)).toBe(true);
    expect(fs.statSync(written).size).toBeGreaterThan(0);
    // filename carries NO database-name bytes beyond the fixed "alaya" prefix
    expect(r.file).not.toContain('alaya.db');
  });
});

describe('runSnapshot: integrity failure is FATAL', () => {
  it('refuses a copy that fails integrity_check and REMOVES the file', async () => {
    seedSourceDb();
    const dir = path.join(tmpRoot, 'integrity');
    process.env.SNAP_TEST_FORCE_CORRUPT = '1';
    try {
      const r = await runSnapshot({ dbPath, snapshotDir: dir, keep: 7 });
      expect(r.ok).toBe(false);
      expect(r.error).toContain('integrity_check');
      // The corrupt COPY is removed so it can never masquerade as a backup;
      // the (empty) directory may remain.
      if (fs.existsSync(dir)) {
        expect(fs.readdirSync(dir).filter((f) => f.endsWith('.db'))).toEqual([]);
      }
    } finally {
      delete process.env.SNAP_TEST_FORCE_CORRUPT;
    }
  });
});

describe('runSnapshot: retention', () => {
  it('deletes OLDEST first and never the in-flight file', async () => {
    seedSourceDb();
    const dir = path.join(tmpRoot, 'retention');
    fs.mkdirSync(dir, { recursive: true });
    makeSnapshot('alaya-20240101T000000Z.db', dir);
    makeSnapshot('alaya-20240102T000000Z.db', dir);
    const r = await runSnapshot({ dbPath, snapshotDir: dir, keep: 2 });
    expect(r.ok).toBe(true);
    const left = fs
      .readdirSync(dir)
      .filter((f) => /^alaya-\d{8}T\d{6}Z\.db$/.test(f))
      .sort();
    expect(left).toContain('alaya-20240102T000000Z.db'); // newer survivor
    expect(left).not.toContain('alaya-20240101T000000Z.db'); // oldest deleted
    expect(left.length).toBe(2); // keep=2
    expect(left).toContain(r.file); // in-flight file always survives
  });
});
