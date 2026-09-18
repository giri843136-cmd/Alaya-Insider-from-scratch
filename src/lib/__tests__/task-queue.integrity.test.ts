/**
 * TASK-QUEUE.md integrity guard (docs-only — asserts NO src behaviour).
 *
 * Motivation: commit d20843b silently deleted the TASK 31 prerequisite
 * block from TASK-QUEUE.md; it was only noticed by luck during review.
 * The task queue is the operational memory of this project — a commit that
 * drops a recorded marker must FAIL the suite, not rely on a human diff read.
 *
 * Every marker below is a literal string that exists in the queue as of
 * commit 18aaed8. If this test fails, a commit removed queue content:
 * restore it from git history (git log -p TASK-QUEUE.md) — do NOT delete
 * the marker here to make the test pass.
 */
import fs from 'fs';
import path from 'path';

const QUEUE = path.join(process.cwd(), 'TASK-QUEUE.md');
const ROOT = process.cwd();

/** name -> literal marker that must be present verbatim */
const REQUIRED_MARKERS: Record<string, string> = {
  // TASK 31 prerequisite block (hardening of /api/uploads before snapshots)
  'TASK 31 prerequisite block': 'PREREQUISITE',
  'uploads realpath containment note': 'realpath containment',
  // cancellations are RECORDS, not clutter — dropping them re-opens dead work
  'TASK 28 cancellation record': 'TASK 28 — CANCELLED',
  'TASK 28b cancellation record': 'TASK 28b — CANCELLED',
  'TASK 28d cancellation record': 'TASK 28d — CANCELLED',
  // user-mandated process rule (recorded in the TASK 31 step-1 commit)
  'force-push process rule': 'force-push is allowed ONLY on unmerged wip branches',
  // TASK 27 adjacency scope line (what TASK 16 will extend)
  'TASK 16 adjacency scope line': 'TASK 16 will bring journal',
  // TASK 27 implementation-state entry
  'TASK 27 contrast-fix entry': 'TASK 27 — affiliate disclosure CONTRAST fix',
  // TASK 30 merged-state record
  'TASK 30 merged record': 'TASK 30 — admin self-service password change',
};

describe('TASK-QUEUE.md integrity (docs-only guard)', () => {
  it('queue file exists (guard is wired to the right file)', () => {
    expect(fs.existsSync(QUEUE)).toBe(true);
  });

  it('still contains the literal marker of every task recorded in the queue', () => {
    const text = fs.readFileSync(QUEUE, 'utf8');
    const missing = Object.entries(REQUIRED_MARKERS)
      .filter(([, marker]) => !text.includes(marker))
      .map(([name]) => name);
    // eslint-disable-next-line no-console
    console.log(
      '[queue-integrity] markers checked: ' +
        Object.keys(REQUIRED_MARKERS).length +
        ', present: ' +
        (Object.keys(REQUIRED_MARKERS).length - missing.length),
    );
    if (missing.length > 0) {
      throw new Error(
        `TASK-QUEUE.md lost recorded content — missing marker(s): ${missing.join('; ')}. ` +
          'A commit dropped queue content. Restore from git history (git log -p TASK-QUEUE.md); ' +
          'do NOT delete the marker from this test to make it pass.',
      );
    }
    expect(missing).toEqual([]);
  });

  it('tailwind scanner: the contrast module stays OUTSIDE every tailwind content glob (src/lib/testing must never return)', () => {
    // 2026-09-18: the contrast module quoting class-like strings lived in
    // src/lib/testing/ and the scanner (content globs cover all of src/)
    // emitted 74 B of spurious utilities (text-black et al.) into the prod
    // stylesheet — same bug class as commit 336f707. The module was
    // relocated to repo-root testing/. This marker makes any move back
    // under src/ (or any glob widened to cover testing/) FAIL the suite
    // instead of silently shipping junk CSS.
    const cfgSrc = fs.readFileSync(path.join(ROOT, 'tailwind.config.ts'), 'utf8');
    const contentMatch = cfgSrc.match(/content:\s*\[([\s\S]*?)\]/);
    expect(contentMatch).toBeTruthy(); // guard wired to the real config
    const globs = [...(contentMatch![1].matchAll(/['"]([^'"]+)['"]/g))].map((m) => m[1]);
    expect(globs.length).toBeGreaterThanOrEqual(1);

    // Base directory of each glob (portion before the first glob-magic char).
    const bases = globs.map((g) => path.resolve(ROOT, g.split(/[*{[]/)[0]));

    const insideScan = (absPath: string) =>
      bases.some((b) => absPath === b || absPath.startsWith(b.endsWith(path.sep) ? b : b + path.sep));

    // (a) the canonical home must exist and be outside every scan base
    const home = path.resolve(ROOT, 'testing', 'disclosure-contrast.ts');
    expect(fs.existsSync(home)).toBe(true);
    for (const g of globs) {
      expect(insideScan(home)).toBe(false);
    }

    // (b) the forbidden location must be empty AND provably inside the scan:
    //     the exact regression this guards against
    const forbiddenDir = path.resolve(ROOT, 'src', 'lib', 'testing');
    expect(fs.existsSync(forbiddenDir)).toBe(false);
    expect(insideScan(path.join(forbiddenDir, 'disclosure-contrast.ts'))).toBe(true);

    // (c) no copy of the module anywhere under src/, whatever the subpath —
    //     catches a move to any src/ location, not just the old one
    const offenders: string[] = [];
    const walk = (dir: string) => {
      if (!fs.existsSync(dir)) return;
      for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
        const full = path.join(dir, e.name);
        if (e.isDirectory()) walk(full);
        else if (e.name === 'disclosure-contrast.ts') offenders.push(path.relative(ROOT, full));
      }
    };
    walk(path.join(ROOT, 'src'));
    if (offenders.length > 0) {
      throw new Error(
        `tailwind scanner regression: ${offenders.join(', ')} is inside the content globs ` +
          'and its class-like strings will be emitted as CSS utilities (74 B of junk, cf. 336f707). ' +
          'Keep the module at repo-root testing/ (resolve via the ~/* alias) or narrow the globs.',
      );
    }
    expect(offenders).toEqual([]);
  });
});
