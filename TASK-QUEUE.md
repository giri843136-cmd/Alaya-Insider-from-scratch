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
[ ] TASK 27 — affiliate disclosure CONTRAST fix (implemented on
        wip/task-27-disclosure, awaiting merge). Accurate statement: the
        pre-merge VIOLATION was contrast — the footer rendered the sentence
        at text-white/25 (~1.4:1, effectively invisible). Amazon requires
        the sentence to be present and legible, NOT per-CTA placement, so
        the footer alone satisfied placement; per-template adjacency
        (disclosure immediately adjacent to the first CTA on product and
        compare pages) is OUR OWN stricter standard, also implemented there
        (>=14px, >=4.5:1, render-tested). TASK 16 will bring journal
        in-content affiliate links under the adjacency rule.
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
[x] TASK 28d — CANCELLED (2026-09-18): unnecessary and unsafe on this
        platform. VERIFIED FACTS: production auto-deploys from main via
        hPanel — a merge to main was LIVE on the next curl (new
        POST /api/auth/change-password returned 401 JSON where it 404'd
        before the merge; 12 unauthenticated POSTs returned 401 while the
        shared login limiter allowed TEN requests per its 60 s window and
        returned the first 429 on the ELEVENTH (10/60 s per code)); /admin still
        302s to /admin/login; /api/products?limit=1 still returns exactly
        the 12 allow-listed fields with status absent. main is the ONLY
        deploy trigger. A manual .next/node_modules upload would rewrite
        every file around the live SQLite DB and risks clobbering data/ —
        never do it.
[ ] TASK 31 — DB durability (PROPOSED — do not implement blind): on this
        hosting the SQLite file is the only copy of the catalogue and every
        deploy rewrites the files around it. Plan a scheduled snapshot of
        data/alaya.db via better-sqlite3 VACUUM INTO into a NON-public
        path, retaining N copies, with PLAN-28b's -wal/-shm handling
        (copy alongside if present; integrity_check the backup; any
        failure is FATAL/loud). NEVER snapshot into public/. PREREQUISITE
        (before any snapshot logic is written): harden /api/uploads/[filename]
        with realpath containment (realpathSync the uploads dir and the
        candidate; 404 unless the resolved path starts with the resolved
        uploads dir + path.sep), killing the sibling-prefix flaw and the
        symlink-following read. [DONE 2026-09-18 on
        wip/task-31-snapshot-hardening: route.ts realpathSync containment +
        uploads-route.containment.test.ts — fs-spy symlink-equivalent proof
        (404, EMPTY body, zero bytes read) + e2e on-disk symlink suite that
        runs on symlink-capable hosts; this Windows sandbox cannot create
        symlinks (EPERM), so the e2e layer is a NAMED GAP there, reported
        loudly by the suite, never silent. NOTE: commit d20843b accidentally
        dropped this prerequisite block; restored here.] HARD RULES
        (agreed 2026-09-18, before any implementation):
        - Snapshots may ONLY be written to a configurable SNAPSHOT_DIR;
          default = REFUSE TO RUN. If the resolved absolute path starts
          with <appRoot>/public OR lies inside the app root AT ALL, ABORT
          with a non-zero exit and NO file written. Never "just use
          ./backups inside the project".
        - Tests: assert the computed snapshot path is NOT under public/
          (implementation-time, needs the path resolver to exist), and a
          snapshot file existing in public/ fails the suite — that second
          assertion is ALREADY WIRED in public-dir.guard.test.ts
          (public/ must contain no *.db/*.sqlite* files).
        - Snapshot filenames contain NO secret material and NO PII.
        - Retention deletes oldest-first and MUST NEVER delete the file
          currently being written.
        UNKNOWN without hPanel: the real app-root path; whether any path
        OUTSIDE the app dir is writable; whether hPanel cron can run an
        internal script or only trigger an HTTP endpoint (if HTTP-only: a
        /api/cron/snapshot route guarded by CRON_SECRET writing to
        SNAPSHOT_DIR).
[ ] TASK 32 — hourly price-refresh wiring (BLOCKED on user): needs env
        var NAMES CREATORS_* (client id/secret) + CRON_SECRET set in
        hPanel — values are the user's to paste, never the agent's to
        print or read. Stays inert until the Creators API is configured in
        Admin -> Amazon API. CONFIRMED (2026-09-18):
        /api/cron/amazon-prices accepts header `x-cron-secret` (alias
        `x-api-key`, or ?secret=) — the SAME header name the admin page
        documents (src/app/admin/amazon/page.tsx:532-536); accepts POST
        and GET. Sub-item (security): query-string secrets land in access
        logs — prefer HEADER-ONLY auth for cron calls; the user verified a
        bogus secret -> 401. If GET stays supported, document that the URL
        with ?secret= must NEVER be pasted into a public place (the admin
        page renders a Copy-able block for this endpoint). Doc fix needed
        when wiring: the admin page still says CRON_SECRET "lives in
        .env" — on hPanel it is an env var.

QUEUE ORDER AFTER 31/32: resume TASK 27 (disclosure placement + contrast —
        1x per page today, footer-only at text-white/25), then TASK 11
        (cache-control — TASK 2's middleware no-ops every public page;
        critical now that hcdn sits in front), then the original order.

[x] TASK 30 — admin self-service password change (DONE; merged to main
        4bb7620 with the merge-review fixes below, LIVE in production):
        POST
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

- PROCESS RULE (user-mandated 2026-09-18, recorded in the TASK 31 step-1
  commit): **force-push is allowed ONLY on unmerged wip branches. NEVER on
  main. NEVER after a task has been review-approved.** Prefer a new commit
  over amending once the user has seen the sha.

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
