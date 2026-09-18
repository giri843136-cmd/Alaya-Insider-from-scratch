# Task Queue

One task per session. Mark `[x]` when committed.

## State block (update after every task)

WORKFLOW RULE (2026-09-18, user-mandated): **NO `git push origin main`.**
Production auto-deploys from main on push, so merging to main = deploying.
Every task commits to branch `wip/<task>` only, pushes THAT branch, and
STOPS. Only the user authorises merges to main, after review.

```
TASK-QUEUE STATE (updated 2026-09-18)

DONE:
[x] TASK 1 — public API allow-list                 (commit 7c7c63d)
[x] TASK 2 — server-side auth on /admin/* + login lockout
        (commits 0383d1f, d578eb3, 535afa2, 2d09b34, 61f3795)
[x] TASK 3 — Product JSON-LD: drop offers/aggregateRating   (commit 15cc72d)
[x] TASK 4 — quarantine fabricated price/rating fields (+ scripts/NULL-commercial-fields.ts)
        (commit ecd2e0d)
[x] TASK 5 — price-claim wording + OneLink sentence removal  (commit 7e92b55)
[x] FIX D/E/F/G/H/I — TASK 2 follow-ups (2026-09-17/18): client-owned CTA
        beacon on compare pages (211c6c0), untrustable-IP lockout carve-out +
        debug peer-IP route (2d09b34), standalone-serving detection + dev
        sentinel gate (61f3795), hard-fail prod AUTH_SECRET + lockout
        recovery docs (d578eb3), client-IP trust + AUTH_SECRET serving guard
        (535afa2).

NOT STARTED (work in this order):
[ ] TASK 6  — link liveness
[ ] TASK 11 — cache-control   (RUN EARLY: TASK 2's middleware stamps no-store
        on every public page)
[ ] TASK 7  — canonical + meta
[ ] TASK 8  — og + og:image
[ ] TASK 9  — image provenance CSV + alt
[ ] TASK 10 — breadcrumb + sitemap
[ ] TASK 12 — internal links
[ ] TASK 13 — thin-content guard
[ ] TASK 14 — product template v2
[ ] TASK 15 — remove "Honest Review"/testing overclaims
[ ] TASK 16 — journal depth + affiliate links
[ ] TASK 17 — slug year fix
[ ] TASK 17b — repo-file exposure check
        purge scripts/price-workflow.md from history; rotate credentials for
        that host; repo was public since 68a016b (2026-08-24)
[ ] TASK 18 — click tracking via sendBeacon on the existing /api/clicks
[ ] TASK 19 — static + ISR
[ ] TASK 20 — performance
[ ] TASK 21 — 50k headroom test
[ ] TASK 22 — harden the EXISTING src/lib/creators-api.ts (do not rebuild;
        keep PRICE_ENRICHMENT_ENABLED off)
[ ] TASK 23 — GSC/Bing runbook
[ ] TASK 24 — revenue report
[ ] TASK 25 — deploy docs
[ ] TASK 26 — drop `id` from public /api/categories
[ ] TASK 27 — disclosure placement + contrast (today it is footer-only at
        text-white/25)
[x] TASK 28 — CANCELLED: built for a VPS that does not exist. Confirmed
        platform is Hostinger hPanel "Node.js app" (no pm2, no root, no SSH,
        no npm on the box; env vars live in hPanel, not .env). Commit
        b1f69af and both scripts stay as a dead record — NOT the deploy path.
[x] TASK 28b — CANCELLED with it: releases/<sha>/ + `current` symlink +
        pm2 are meaningless on hPanel. PLAN-28b.md stays as the RECORD;
        retain its DB-backup (VACUUM INTO + integrity_check, FATAL on
        failure) and boot-verification ideas; drop releases//current/pm2
        entirely.
[x] scripts/deploy.sh + scripts/security-setup.sh — NON-FUNCTIONAL AND
        NOT-DEPLOY-PATH (verified 2026-09-18): both sed-WRITE .env
        (deploy.sh lines 81–91 incl. AUTH_SECRET rewrite;
        security-setup.sh lines 9–11). On hPanel, .env is not the env
        mechanism — never run either script.
[ ] TASK 28d — DEPLOY ASSET SYNC, run from the USER's machine (NOT written
        yet; blocked until the user supplies the hPanel app root, start
        command and env var NAMES). Local npm ci && npm test && tsc &&
        npm run build -> upload .next, node_modules, public, package.json,
        ecosystem-agnostic start script -> backup data/alaya.db FIRST
        (better-sqlite3 VACUUM INTO, or a node script reading a user-provided
        db file) -> user restarts from hPanel -> only then delete stale
        public/auth-test.html and public/visual-test.html from the DEPLOYED
        public/ dir and prove a 404 with a curl. MUST refuse to run if any
        file matching /(auth-test|visual-test|debug|login)/i exists in
        public/. No .env upload, no secret in any script. Overwrites in
        place: .next/, node_modules/, public/, package.json. Rollback:
        restore the previous .next + restart from hPanel.
[ ] TASK 30 (URGENT — NEXT CODE TASK) — admin self-service password change.
        IMPLEMENTED on wip/task-30-password, AWAITING USER MERGE: POST
        /api/auth/change-password (session-gated) + src/lib/change-password.ts
        + Settings "Change Password" card + tests. Current password
        required, bcrypt cost 10, new password >= 12 chars, never logged or
        returned; test proves a wrong current password cannot change the
        hash. Merge-review fixes (same branch): (1) the endpoint shares the
        EXACT login buckets — in-memory rateLimit(login:<ip>, 10/min) AND the
        durable sqlite lockout (isLockedOut/recordFailure/recordSuccess,
        UNTRUSTABLE_BUCKET carve-out), checked BEFORE bcrypt; wrong
        current-password guesses lock the account at 5 failures (route test
        proves 429 without reaching bcrypt). (2) SIGN OUT EVERYWHERE: success
        clears the auth_token cookie AND getAuthUser rejects tokens whose iat
        predates users.updated_at — written ONLY by the password-change flow
        (grep-verified), fail-open on unparseable timestamps, no schema
        change; ≤1 s token-grace from second-precision timestamps.
        URGENT because
        raw.githubusercontent.com/giri843136-cmd/Alaya-Insider-from-scratch/eb09a2e^/public/auth-test.html
        still serves the credential literals (the repo is PUBLIC) — the fix
        is ROTATION, not deletion: deletion cannot remove old blobs from a
        public repo. NEVER print those values.
```

## Notes

- TASK 1 (done): allow-list in `src/lib/public-product.ts`; applied to
  `/api/products`, `/api/products/[id]`, `/api/brands`, `/api/categories` and
  `/api/search`. Admin full rows via new session-authenticated
  `/api/admin/products`; admin products page + ProductEditor repointed.
  `?status=` and `admin=true` removed from the public list; detail route 404s
  non-published rows for unauthenticated callers.
- TASK 2 (done): `src/middleware.ts` gates /admin/* (302 → /admin/login) and
  /api/admin/* (401) server-side with the auth_token JWT, Node runtime
  (`runtime: 'nodejs'`, stable in Next 16; no experimental flag). AdminShell
  client gate kept as UX. Login lockout in sqlite `login_lockouts`:
  5 consecutive failures → 15-min lock, enforced per account AND per IP
  (`src/lib/login-lockout.ts`, wired into POST /api/auth/login). Existing
  10/min in-memory limiter kept.
- TASK 2 finding (REPORTED, not silently fixed): the admin password is set by
  the `ADMIN_SEED_PASSWORD` env var. Its configured value was not read by the
  agent (secret); the seeding code only enforces length >= 8 and the
  variable exists in .env, so no hard evidence of a default/weak value — but
  rotation + a stronger policy (>= 12 chars, mixed classes) is recommended.
- Carry-over watch item for TASK 4: `StarRating` still renders DB
  `rating`/`review_count` on the compare page and was re-extracted to
  `src/components/public/StarRating.tsx`; the product page rating render was
  removed in TASK 1's commit. The compare page also still renders
  `priceText()` / live price fields (server-rendered from Creators API cache).
- Homepage/category/collection/brand public pages still call
  `enrichProductsWithLivePrice` server-side and render live price boxes; they
  are page rendering, not the public JSON API — touch in TASK 3/4/5 as needed.
- TASK 4 (done): `enrichProductsWithLivePrice` is a display NO-OP
  (explicit null live_* shape + tagged direct URLs only; zero network on page
  renders). Re-enable path: `PRICE_ENRICHMENT_ENABLED=1` — only together with
  an approved official-source display. Creators plumbing kept for the
  10-sales/30-days threshold (admin/ops callers: `/api/cron/amazon-prices`,
  `/api/creators/cache`). seed-demo + CSV import now default the commercial
  columns to NULL (schema untouched). Product page passes an allow-listed
  object to the ProductCTA client boundary — the raw DB row was being
  serialized into the RSC flight payload (real leak, found by live verify).
  `scripts/NULL-commercial-fields.ts` (staging-only, --apply/--restore) is
  ready for the user to run on a staging copy.
