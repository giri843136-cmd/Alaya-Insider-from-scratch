# PLAN-28b — deploy restructure: releases/ + `current` symlink

Planning only. **No script, src/ or .env file is modified in this step.**
`scripts/deploy-hostinger.sh` and `scripts/rollback-hostinger.sh` (commit b1f69af,
rejected in review — 3 blocking defects, recorded in TASK-QUEUE.md) stay
untouched until this plan is approved. Canonical deploy script remains
`scripts/deploy-hostinger.sh`; `scripts/deploy.sh` and
`scripts/security-setup.sh` are NOT part of the deploy path (they sed-edit
.env in place and must never run on the VPS).

## Target layout on the VPS

```
app-root/                      (e.g. /home/<user>/alaya-app)
  repo/                        git repo — never served, never checked out into
  releases/<sha>/              one immutable dir per deploy, built from `git archive`
  current -> releases/<sha>    symlink pm2 actually serves
  shared/data/alaya.db         THE database (moved once in the migration window)
  shared/uploads/              uploaded media (shared/uploads/images/...)
  shared/logs/                 pm2 logs
  shared/config/.env           source-of-truth env copy (never edited by scripts)
```

## DEFECT 1 — false FAIL that auto-rolls-back a healthy deploy

Today (b1f69af): verification check (f)4 greps the public payload for
`"status":"published"`. After TASK 1, `status` is allow-listed OUT of every
public response (`src/lib/public-product.ts` contains zero `status`
references — verified), so the count is always 0 → FAIL → branch (g) rolls
back a good deploy.

Planned replacement — every check asserts HTTP 200 **before** parsing:

- **(4a) slug count vs DB count.** `PUB_SLUGS` = count of `"slug"` keys in
  `GET /api/products?limit=100`; `DB_PUBLISHED` = `SELECT count(*) FROM
  products WHERE status='published'` read through better-sqlite3 opened
  **read-only** against the live DB file (small `node -e` snippet; no
  destructive SQL, no writes). Print BOTH numbers, then compare equal.
- **(4b) field-gone + filter-inert.** Assert `grep -c '"status"'` on the
  payload == 0 (field absent entirely), and that
  `GET /api/products?limit=100&status=draft` returns the SAME count as the
  unfiltered request — proving `?status=` is inert, not leaking drafts.
- **Tighten (f)2 to quoted keys**, case-sensitive: `'"current_price"'`,
  `'"offers"'`, `'"rating"'`, `'"review_count"'` must each match 0 times.
  Quoted-key patterns cannot hit ordinary copy like a bare `3456` or the
  word "offers" in prose/asset names.
- Every curl: `curl -fsS` plus an explicit `-w '%{http_code}'` assertion
  `== 200` before any grep runs.

## DEFECT 2 — unsound DB backup

Today: `cp -p data/alaya.db` while the app runs (WAL frames missed —
`journal_mode = WAL` is set in `src/lib/db.ts`), and integrity_check failure
is only a WARNING.

Planned:

1. Print `PRAGMA journal_mode` first (expect `wal`).
2. Backup via better-sqlite3 `VACUUM INTO
   'shared/data/backups/pre-<sha>-<ts>.db'` executed on the live DB —
   produces a self-contained, consistent snapshot without stopping the app.
   (`data/backups/` is gitignored — `.gitignore` lines `/data/*-backup*.db`
   and `/data/backups/`; under the new layout backups live in
   `shared/data/backups/`, also excluded.)
3. Copy `-wal`/`-shm` next to the backup **if present** (belt-and-braces;
   VACUUM INTO output does not need them).
4. Print source vs backup byte sizes (`stat -c%s`); assert backup is
   non-zero and plausible.
5. Open the BACKUP with a second connection and run `PRAGMA
   integrity_check`. **Any failure is FATAL: abort before any swap or pm2
   restart.** No warning-and-continue paths anywhere in the script.

## DEFECT 3 — the script must never mutate the live worktree

Today: `git checkout <sha>` + `npm ci` in the directory pm2 serves. A failed
gate leaves node_modules replaced from the target lockfile; the next
crash-restart can boot the old `.next` against mismatched deps.

Planned build + swap:

- Source: `git archive <sha> | tar -x -C releases/<sha>` (chosen over
  `git worktree add`: no `.git` inside the release, and the live worktree,
  its node_modules and .next are never touched).
- `npm ci` inside `releases/<sha>/`, then `npm run build` (non-standalone —
  see open question 3). Optionally `npm prune --omit=dev` after a successful
  build to shrink the release.
- All gates (Defect 1 checks + boot smoke) run with cwd inside
  `releases/<sha>/`.
- **Pre-swap boot smoke test (no pm2 involvement):** start the new build
  alone on a spare port (e.g. 3999) with the prod env sourced from
  `shared/config/.env` (read-only — never written):
  `PORT=3999 HOSTNAME=127.0.0.1 ./node_modules/.bin/next start &` →
  poll `curl /` and `curl /product/le-creuset-skillet` for HTTP 200 (≤ 30 s)
  → kill the PID → verify the port is free. **Any failure: ABORT — remove
  `releases/<sha>/`, exit non-zero; pm2 untouched, live site untouched.**
- Swap: `ln -sfn releases/<sha> current` → `pm2 restart alayainsider
  --update-env` → verify `/` returns 200.
- **Rollback = symlink flip** (`ln -sfn releases/<prev> current` + pm2
  restart): under 15 s, no rebuild.
- Keep the last 3 releases; prune only dirs that are NOT the current target
  (`readlink current` guard), pruning runs last.
- `trap` on any post-swap failure: flip `current` back to the previous sha,
  restart, and never leave the site pointing at a pruned or deleted dir.

## Open questions — answered from repo evidence (UNKNOWN = needs the VPS)

1. **pm2 script/cwd today.** `ecosystem.config.cjs` (committed): name
   `alayainsider`, `script: 'npm'`, `args: 'start'`, `PORT: 3000`,
   `NODE_OPTIONS: '--max-old-space-size=200'`, `max_memory_restart: '256M'`,
   logs `./logs/…`. **`cwd` is NOT set in the file** → effective cwd is
   wherever `pm2 start` was run. Actual runtime cwd: **UNKNOWN** (verify on
   the VPS with `pm2 describe alayainsider` / `pm2 prettylist | grep -i cwd`).
2. **One change to run `./current`.** Set `cwd: '<absolute app-root>/current'`
   in `ecosystem.config.cjs` and keep `script: 'npm'`, `args: 'start'`.
   Linux resolves a symlinked cwd at exec, so `next start` boots from inside
   the release (reads `current/package.json`, serves `current/.next`, and
   every `path.resolve(process.cwd(), …)` lands inside the release).
   One-time during migration: `pm2 delete alayainsider && pm2 start
   ecosystem.config.cjs && pm2 save`.
3. **`next start` vs standalone.** PROVEN non-standalone: `package.json` has
   `"start": "next start"` and `next.config.mjs` sets no `output` key (no
   `output: 'standalone'`, no `server.js`). Boot path is
   `node_modules/.bin/next start` reading package.json + `.next` from the
   process cwd. Consequence: each release carries its own node_modules +
   `.next`; there is no standalone bundle to copy around.
4. **data/alaya.db relative path across release dirs — answered.**
   `src/lib/db.ts:5` → `DB_PATH = process.env.DATABASE_PATH ||
   './data/alaya.db'`, resolved at `src/lib/db.ts:9` with
   `path.resolve(process.cwd(), DB_PATH)` — **relative to process cwd**.
   With cwd = `…/current`, each release would resolve its OWN
   `releases/<sha>/data/alaya.db` — an empty DB per deploy. Fix (no src
   change): after `git archive`, the script symlinks
   `releases/<sha>/data -> ../../shared/data` so the relative path traverses
   into shared storage; AND copy `shared/config/.env` into the release with
   an **absolute** `DATABASE_PATH=…/shared/data/alaya.db` as belt-and-braces.
   The `.env` copy is mandatory anyway: `.env` is gitignored so `git archive`
   does not include it, and commit d578eb3 hard-fails prod boot without
   AUTH_SECRET. Same treatment for `uploads/` (see 5) and `logs/` (pm2
   out_file is relative to cwd).
   **UNKNOWN:** whether the VPS .env already sets DATABASE_PATH (rules forbid
   me reading .env — user verifies during migration).
5. **uploads/ — same defect class, no env escape.** Six call sites resolve
   `path.resolve(process.cwd(), 'uploads…')` with NO env override
   (`api/upload/route.ts:37`, `api/media/route.ts:29`,
   `api/system-health/route.ts:21`, `api/uploads/[filename]/route.ts:14`,
   plus db/log helpers). Fix inside the script:
   `ln -sfn ../../shared/uploads releases/<sha>/uploads` after archive, and
   `ln -sfn ../../shared/logs releases/<sha>/logs` for pm2's relative
   out_file/error_file.
6. **.next build-cache reuse across releases.** Copy
   `releases/<prev>/.next/cache` → `releases/<new>/.next/cache` before
   `next build` ONLY when the previous release exists and
   `package-lock.json` hash matches (same Next version). Treat strictly as
   an optimization: the build must also succeed from an empty cache (periodic
   clean-build validation), and any failed build deletes the copied cache.
   Correctness risk is low (Turbopack/Next cache is content-addressed), but
   it must never mask a real build failure.

## First-time migration (one maintenance window, site down ~10–15 min)

1. `pm2 stop alayainsider`.
2. Create `shared/{data,uploads,logs,config}`; `mv` today's
   `data/alaya.db*` → `shared/data/`, move `uploads/` → `shared/uploads/`
   (files live under `uploads/images/`), copy `.env` →
   `shared/config/.env` (add absolute `DATABASE_PATH` at this point — the
   only .env edit, done by hand, not by script).
3. Run the NEW deploy script for current HEAD → builds
   `releases/<sha>/`, creates data/uploads/logs symlinks inside it, runs
   gates + boot smoke (pm2 is stopped; the smoke test runs independently).
4. Update `ecosystem.config.cjs` with `cwd: '<app-root>/current'` →
   `pm2 delete alayainsider && pm2 start ecosystem.config.cjs && pm2 save`.
5. Verify: `/` and `/product/le-creuset-skillet` → 200; admin login works
   (proves shared DB reached); `logs/error.log` clean.
6. Keep the old in-place directory intact for one release cycle as a last
   fallback (28b never mutated it — see Defect 3).
   Migration rollback: `pm2 delete`, restore the old ecosystem cwd,
   `pm2 start` from the old dir (its node_modules/.next are untouched).

## Out of scope for 28b implementation

No src/ edits, no .env writes from scripts, no DB-schema changes, no new
paid services. The scripts are still executed only by the user on the VPS.
