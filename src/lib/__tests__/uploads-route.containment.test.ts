/**
 * TASK 31 step 1 — /api/uploads/[filename] realpath containment.
 *
 * Weakness being closed (pre-fix): the route compared the UNRESOLVED join
 * against the uploads dir. A symlink planted INSIDE uploads/images pointing
 * at ../../data/alaya.db passed the string-prefix check and
 * existsSync/readFileSync FOLLOWED it — the whole SQLite database (the only
 * copy of the catalogue, with user password hashes) was readable from the
 * public internet. The sibling-prefix weakness (<dir>/uploads/images-private
 * starting with <dir>/uploads/images) was the same class of flaw.
 *
 * B2 contract under test: a containment-violating request gets status 404
 * AND an EMPTY response body — zero bytes of the target are READ (fs spy)
 * and zero bytes are SERVED (awaited text() === '').
 *
 * Two layers, honestly labelled:
 *   1. in-process route test — drives GET() directly with a jest spy making
 *      realpathSync resolve EXACTLY like a planted symlink would. This is
 *      the symlink-equivalent proof: it runs on EVERY host (this sandbox
 *      cannot create symlinks at all: EPERM), and it asserts the fs never
 *      READS the target.
 *   2. e2e symlink test — a REAL symlink planted in uploads/images pointing
 *      at a database copy, requested over the route, asserted 404 + empty
 *      body. Runs on any symlink-capable host; on Windows without Developer
 *      Mode/admin it is SKIPPED with an explicit, named gap (sandbox EPERM)
 *      — never silently.
 */
import fs from 'fs';
import os from 'os';
import path from 'path';

process.env.NODE_ENV = 'test';
// The route reads process.cwd()/uploads/images at request time. Tests run
// against a throwaway cwd copy so the real uploads/ and data/ are untouched.
const REAL_CWD = process.cwd();
const SANDBOX_CWD = fs.mkdtempSync(path.join(os.tmpdir(), 'alaya-uploads-'));
const IMAGES_DIR = path.join(SANDBOX_CWD, 'uploads', 'images');

// Decide symlink capability ONCE, at module scope, so the e2e suite below
// can be declared skipped (or not) at collection time. Uses absolute paths
// in the sandbox only.
const SYMLINK_PROBE = path.join(SANDBOX_CWD, 'uploads', 'images', '__capability_probe');
let CAN_SYMLINK = false;
let SYMLINK_ERROR = 'unknown';
fs.mkdirSync(IMAGES_DIR, { recursive: true });
try {
  fs.symlinkSync(path.join('..', '..', 'capability-target.txt'), SYMLINK_PROBE, 'file');
  CAN_SYMLINK = true;
  fs.rmSync(SYMLINK_PROBE, { force: true });
} catch (e: any) {
  SYMLINK_ERROR = `${e.code || ''} ${e.message}`.trim();
}

beforeAll(() => {
  fs.mkdirSync(IMAGES_DIR, { recursive: true });
  process.chdir(SANDBOX_CWD);
});
afterAll(() => {
  process.chdir(REAL_CWD);
  fs.rmSync(SANDBOX_CWD, { recursive: true, force: true });
});

const IMG_BYTES = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 1, 2, 3, 4]); // PNG magic

async function callRoute(filename: string): Promise<Response> {
  const { GET } = await import('@/app/api/uploads/[filename]/route');
  return GET(new Request(`http://localhost/api/uploads/${encodeURIComponent(filename)}`) as any, {
    params: Promise.resolve({ filename }),
  });
}

describe('TASK 31 step 1: /api/uploads/[filename] realpath containment', () => {
  it('CONTROL: a real image inside uploads/images is served byte-for-byte (guard does not over-block)', async () => {
    fs.writeFileSync(path.join(IMAGES_DIR, 'real.png'), IMG_BYTES);
    const res = await callRoute('real.png');
    expect(res.status).toBe(200);
    const body = Buffer.from(await res.arrayBuffer());
    expect(body.equals(IMG_BYTES)).toBe(true);
  });

  it('traversal strings stay rejected with no read of any file', async () => {
    const readSpy = jest.spyOn(fs, 'readFileSync');
    try {
      const res = await callRoute('..%2F..%2Fdata%2Falaya.db');
      expect(res.status).toBe(400);
      expect((await res.text()).length).toBeGreaterThan(0); // JSON error; the empty-404 contract is for escapes
      expect(readSpy).not.toHaveBeenCalled();
    } finally {
      readSpy.mockRestore();
    }
  });

  it('SYMLINK-EQUIVALENT: a candidate resolving OUTSIDE uploads/images returns 404 with an EMPTY body and ZERO bytes read', async () => {
    // Decoy file whose PATH lives inside uploads/images but whose realpath
    // resolves to the database — byte-for-byte the observable a planted
    // symlink produces on disk (symlink(name -> db): name exists, realpath
    // is the db). The route under test must react identically.
    const decoy = path.join(IMAGES_DIR, 'planted-symlink.png');
    fs.writeFileSync(decoy, '');
    const dbReal = path.join(REAL_CWD, 'data', 'alaya.db');
    // Capture the REAL function BEFORE spying: jest.requireActual('fs') can
    // return the same singleton the spy mutates, which would recurse forever.
    const originalRealpath = fs.realpathSync;

    const realSpy = jest.spyOn(fs, 'realpathSync').mockImplementation((p: any) => {
      if (path.resolve(String(p)) === path.resolve(decoy)) return dbReal as any;
      return originalRealpath(p) as any; // untouched passthrough for everything else
    });
    const readSpy = jest.spyOn(fs, 'readFileSync');

    try {
      const res = await callRoute('planted-symlink.png');
      expect(res.status).toBe(404);
      // THE B2 ASSERTIONS: zero bytes leaked — the body is empty AND the fs
      // never READ the database (or anything) to answer the request.
      expect(await res.text()).toBe('');
      expect(readSpy).not.toHaveBeenCalled();
      expect(readSpy.mock.calls.some((c) => String(c[0]).includes('alaya.db'))).toBe(false);
    } finally {
      realSpy.mockRestore();
      readSpy.mockRestore();
    }
  });

  it('NEGATIVE CONTROL: the old string-prefix logic passes the planted symlink, the spy reproduces its resolution', () => {
    // (1) The OLD check — join(uploadsDir, name).startsWith(uploadsDir) —
    // is true for the decoy regardless of where it resolves: this is the
    // flaw, and the test above would have caught it had the fix regressed.
    const oldCheck = path
      .join(path.resolve(SANDBOX_CWD, 'uploads', 'images'), 'planted-symlink.png')
      .startsWith(path.resolve(SANDBOX_CWD, 'uploads', 'images'));
    expect(oldCheck).toBe(true);
    // (2) The spy mechanism is exactly what the route observes: with the
    // decoy present, the mocked realpathSync returns the db path (what a
    // real symlink's realpathSync returns), while a NON-symlink file still
    // resolves to itself through the same spy.
    const decoy = path.join(IMAGES_DIR, 'planted-symlink.png');
    fs.writeFileSync(decoy, '');
    const realImg = path.join(IMAGES_DIR, 'real.png');
    fs.writeFileSync(realImg, IMG_BYTES);
    const dbReal = path.join(REAL_CWD, 'data', 'alaya.db');
    const originalRealpath = fs.realpathSync; // captured BEFORE spying
    const realSpy = jest.spyOn(fs, 'realpathSync').mockImplementation((p: any) => {
      if (path.resolve(String(p)) === path.resolve(decoy)) return dbReal as any;
      return originalRealpath(p) as any;
    });
    try {
      expect(fs.realpathSync(decoy)).toBe(dbReal);
      expect(fs.realpathSync(realImg)).toBe(realImg);
    } finally {
      realSpy.mockRestore();
    }
  });

  it('missing uploads dir yields an empty 404 (nothing can legitimately be served)', async () => {
    fs.rmSync(path.join(SANDBOX_CWD, 'uploads'), { recursive: true, force: true });
    const res = await callRoute('whatever.png');
    expect(res.status).toBe(404);
    expect(await res.text()).toBe('');
  });

  // ── e2e: a REAL symlink on disk (runs wherever the OS allows symlinks) ──
  (CAN_SYMLINK ? describe : describe.skip)('e2e: real planted symlink -> database', () => {
    let linkPath = '';
    let dbCopy = '';
    beforeAll(() => {
      fs.mkdirSync(IMAGES_DIR, { recursive: true });
      dbCopy = path.join(SANDBOX_CWD, 'capability-target.db');
      fs.writeFileSync(dbCopy, 'ALAYA-DB-CANARY-NOT-REAL-DATA'); // canary, not the real db
      linkPath = path.join(IMAGES_DIR, 'leak.png');
      fs.symlinkSync(path.join('..', '..', 'capability-target.db'), linkPath, 'file');
    });
    afterAll(() => {
      try {
        if (linkPath) fs.rmSync(linkPath, { force: true });
      } catch {
        /* best effort */
      }
    });

    it('planted symlink returns 404 with an EMPTY body (zero bytes leaked)', async () => {
      const res = await callRoute('leak.png');
      expect(res.status).toBe(404);
      expect(await res.text()).toBe('');
    });
  });

  // The skip MUST be loud and named, never silent:
  if (!CAN_SYMLINK) {
    it('e2e symlink suite status: SKIPPED on this host — named gap', () => {
      // eslint-disable-next-line no-console
      console.warn(
        `[TASK 31 B2 GAP] e2e on-disk symlink suite SKIPPED on this host (${SYMLINK_ERROR}). ` +
          'The symlink-equivalent fs-spy test above carries the proof here; ' +
          're-run this suite on Linux/macOS or Windows with Developer Mode for the on-disk symlink assertion.',
      );
      expect(CAN_SYMLINK).toBe(false); // only reached while the gap exists
    });
  }
});
