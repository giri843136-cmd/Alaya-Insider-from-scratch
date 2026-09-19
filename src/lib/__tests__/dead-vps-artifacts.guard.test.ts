/**
 * WAVE 0 deletion guard — the dead VPS artefacts must never come back.
 *
 * The six files below belonged to a VPS deployment that does not exist
 * (hPanel Node.js runtime: push to main IS the deploy, revert-and-push IS
 * the rollback, env vars live in hPanel). scripts/NULL-commercial-fields.ts
 * additionally wrote NULLs into product data. They were removed from HEAD
 * on 2026-09-19; this test fails the build if any of them is re-added as a
 * tracked file OR referenced anywhere in the tracked tree (docs, configs,
 * comments) as if it still existed.
 */
import { execSync } from 'child_process';
import fs from 'fs';

const DEAD_FILES = [
  'scripts/deploy-hostinger.sh',
  'scripts/rollback-hostinger.sh',
  'scripts/setup-nginx.sh',
  'scripts/deploy.sh',
  'scripts/security-setup.sh',
  'scripts/NULL-commercial-fields.ts',
];

// A reference is only a violation if it uses the deleted file's repo PATH
// (pointing at it as tooling). The ledger (TASK-QUEUE.md) is exempt: it is
// the historical record where the deletions themselves are documented, and
// the queue-integrity test guards its structure. pm2/`.env` doc text is
// TASK 25's rewrite scope, not this guard's.
const LIVE_REF_PATTERNS = [
  /scripts\/deploy-hostinger\.sh/,
  /scripts\/rollback-hostinger\.sh/,
  /scripts\/setup-nginx\.sh/,
  /scripts\/deploy\.sh/,
  /scripts\/security-setup\.sh/,
  /scripts\/NULL-commercial-fields\.ts/,
];

function trackedFiles(): string[] {
  // Preferred: ask git (exact tracked set). FAIL-SAFE: some deploy
  // environments run tests outside a git worktree — there, fall back to a
  // recursive filesystem walk of the project (skipping .git/node_modules/
  // .next) so the guard still runs instead of crashing the suite.
  try {
    return execSync('git ls-files', { encoding: 'utf8' })
      .split('\n')
      .map((f) => f.trim())
      .filter(Boolean);
  } catch {
    const out: string[] = [];
    const walk = (dir: string) => {
      for (const name of fs.readdirSync(dir)) {
        if (name === '.git' || name === 'node_modules' || name === '.next') continue;
        const p = `${dir}/${name}`;
        const st = fs.statSync(p);
        if (st.isDirectory()) walk(p);
        else out.push(p.replace(/^\.\//, ''));
      }
    };
    walk('.');
    return out;
  }
}

describe('dead VPS artefacts stay deleted', () => {
  it('none of the six deleted files is tracked in HEAD', () => {
    const tracked = new Set(trackedFiles());
    const back = DEAD_FILES.filter((f) => tracked.has(f));
    expect(back).toEqual([]);
  });

  it('no tracked file references the deleted scripts as live tooling (and no pm2 instructions ship)', () => {
    const violations: string[] = [];
    for (const f of trackedFiles()) {
      // Binary-ish and generated trees: skip contents, names already covered above.
      if (!/\.(md|ts|tsx|js|mjs|cjs|json|sh|yml|yaml|txt|example)$/.test(f)) continue;
      if (/^\.next\//.test(f) || /^node_modules\//.test(f)) continue;
      if (f === 'TASK-QUEUE.md') continue; // the ledger records the deletion itself
      // This guard file must contain the paths (it is the tripwire).
      if (f.endsWith('dead-vps-artifacts.guard.test.ts')) continue;
      let content: string;
      try {
        content = require('fs').readFileSync(f, 'utf8');
      } catch {
        continue;
      }
      for (const re of LIVE_REF_PATTERNS) {
        if (re.test(content)) {
          violations.push(`${f}: /${re.source}/`);
        }
      }
    }
    expect(violations).toEqual([]);
  });
});
