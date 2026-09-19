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
[ ] TASK 17b — repo-file exposure check (UPDATED WAVE 0, 2026-09-19):
        scripts/price-workflow.md REMOVED FROM HEAD (WAVE 0.2) — it carried
        the infrastructure host address, SSH port and username at a public
        raw URL; a full-tree token sweep proved it was the ONLY tracked file
        carrying that address and that no private key material or key file
        was ever tracked. HISTORY still holds it (repo public since
        68a016b, 2026-08-24) — the chosen remedy is ROTATION of that host's
        credentials by the owner, not history rewriting; the host belongs to
        the cancelled VPS path (TASK 28). ASK_ME: rotate or formally
        decommission those credentials.
        (was: purge scripts/price-workflow.md from history; rotate
        credentials for that host)
[ ] TASK 18 — click tracking via sendBeacon on the existing /api/clicks
[ ] TASK 19 — static + ISR
[ ] TASK 20 — performance
[ ] TASK 21 — 50k headroom test
[ ] TASK 22 — harden the EXISTING src/lib/creators-api.ts (do not rebuild;
        keep PRICE_ENRICHMENT_ENABLED off)
[ ] TASK 23 — GSC/Bing runbook
[ ] TASK 24 — revenue report
[ ] TASK 25 — deploy docs
[x] TASK 11 — cache-control (DONE 2026-09-19, WAVE 1; one commit,
        live-verified per RULE 11 with the double-curl proof). MIDDLEWARE
        AUDIT BEFORE (src/middleware.ts): /admin/* authed+redirect no-store
        (41-51), /admin/login no-store (55-58), /api/admin/* no-store
        (62-71) — all kept verbatim; the DEFAULT branch (87-93) stamped
        'no-store, no-cache, must-revalidate, proxy-revalidate' + Pragma:
        no-cache + Expires: 0 + Surrogate-Control: no-store on EVERYTHING
        public — HTML, images, robots.txt, sitemap — forcing hcdn to re-fetch
        origin for every request (the cache mistake). NEW POLICY: /api/*
        (non-admin) stays no-store; any cookie-bearing request to a public
        path stays no-store (defence in depth); anonymous public images get
        'public, max-age=300, s-maxage=86400, stale-while-revalidate=604800'
        + matching Surrogate-Control; anonymous public HTML/robots/sitemap
        get 'public, max-age=0, must-revalidate, s-maxage=300,
        stale-while-revalidate=86400'. NO Vary on cookies (must-not-vary-on-
        cookie: the cached object IS the anonymous render); no Set-Cookie is
        added. Tests: middleware.cache-policy.test.ts (9). next.config.mjs
        /admin/:path* no-store unchanged. HCDN CAVEAT (unverifiable from the
        repo): whether hcdn honours s-maxage/Surrogate-Control is host-side;
        the prod double-curl proof below shows what the edge actually does.
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
        CARRIER-SCAN LIMIT (recorded verbatim 2026-09-18): ProductCTA.tsx is
        a legitimate affiliate anchor whose disclosure is rendered one level
        up by DestinationSelector, so file-level registration covers NEW
        carriers only and cannot detect a refactor that moves the sentence
        away from an existing one. The served-bytes assertion on the product
        page is the real protection; the scan is a tripwire.
[x] TASK 28 — CANCELLED: built for a VPS that does not exist. Confirmed
        platform is Hostinger hPanel "Node.js app" (no pm2, no root, no SSH,
        no npm on the box; env vars live in hPanel, not .env). Commit
        b1f69af and both scripts stay as a dead record — NOT the deploy path.
[x] TASK 28b — CANCELLED with it: releases/<sha>/ + `current` symlink +
        pm2 are meaningless on hPanel. PLAN-28b.md stays as the RECORD;
        retain its DB-backup (VACUUM INTO + integrity_check, FATAL on
        failure) and boot-verification ideas; drop releases//current/pm2
        entirely.
[x] WAVE 0 FILE DELETION (executed 2026-09-19, user-approved; one commit,
        live-verified per RULE 11): REMOVED FROM HEAD — scripts/deploy-hostinger.sh,
        scripts/rollback-hostinger.sh, scripts/setup-nginx.sh, scripts/deploy.sh,
        scripts/security-setup.sh, scripts/NULL-commercial-fields.ts (the VPS
        that never existed; the last one wrote NULLs into product data). Every
        reference repaired: DEPLOYS.md header, RUNBOOK.md (deploy/rollback
        section → push-deploy truth; XFF switch section → hPanel-side edge;
        NULLing runbook → schema/code quarantine note; DEPLOYS.md column doc),
        README.md deploy section → push-deploy truth, DEPLOYMENT.md (truth
        banner + Update Code → push/revert), PLAN-28b.md record (de-pathed),
        src/lib/rate-limit.ts:50 comment → real chain (hcdn → Node, no nginx).
        KEPT per owner instruction: .env.example, ecosystem.config.cjs (pm2
        doc text remains for the TASK 25 rewrite; RUNBOOK/DEPLOYMENT now carry
        a PLATFORM TRUTH banner stating: hPanel Node runtime, push to main IS
        the deploy, revert-and-push IS the rollback, env vars in hPanel, no
        nginx layer we control). GUARD: dead-vps-artifacts.guard.test.ts fails
        the build if any of the six paths is re-tracked or referenced as
        tooling anywhere outside this ledger. History note: git history still
        holds all six files (and price-workflow.md from 0.2) — rotation, not
        rewriting, remains the chosen remedy.
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
        STATUS UPDATE (2026-09-19, WAVE 1, commit follows): 31b IMPLEMENTED
        as HTTP-only tooling — scripts/snapshot-db.mjs CLI was deliberately
        DISCARDED during development (importing a process.exit-calling CLI
        into the Next server is a footgun, and hPanel cron runs URLs, not
        shells). Shipped instead: src/lib/snapshot-policy.ts
        (checkSnapshotDir — UNSET/INSIDE_PUBLIC/INSIDE_APP_ROOT refusals,
        public/ checked FIRST so the doubly-forbidden case gets its own
        code), src/lib/snapshot.ts (runSnapshot: VACUUM INTO to a
        timestamp-only filename alaya-YYYYMMDDTHHMMSSZ.db, integrity_check
        on the COPY with any failure FATAL and the failed file REMOVED,
        retention oldest-first that never deletes the in-flight file),
        GET+POST /api/admin/snapshots (session-gated status listing size+
        mtime; env variable NAMES only, never values; POST = manual
        trigger) and /api/cron/snapshot (x-cron-secret/x-api-key HEADER-ONLY
        — no ?secret=, per the TASK 32 log-safe rule; GET aliases POST for
        cron UIs). Tests: snapshot.test.ts (9: policy refusals, happy path,
        integrity-fatal removal, retention) + snapshot.endpoints.test.ts
        (10: both gates, 409 UNSET semantics, alias, query-string
        rejection). READ-TIME GUARD (2026-09-19, owner-approved follow-up):
        GET /api/admin/snapshots now routes the listing through the SAME
        checkSnapshotDir policy via listSnapshots() — every entry carries an
        explicit `exposed` flag (true when it resolves under public/ or the
        app root) plus a top-level exposed/exposedCount summary, so a backup
        that somehow lands in a web-served path is LOUD in the admin response,
        never merely unlisted by the write-time policy. Found and fixed by
        the guard's own tests: the naive implementation suppressed the
        listing when the dir failed policy — exactly the case where a backup
        sits inside public/; forbidden-but-existing dirs are now still listed
        with every entry forced exposed:true (UNSET/absent dirs still list
        nothing). ASK_ME still stands: SNAPSHOT_DIR must be set in hPanel
        to a writable path OUTSIDE the app dir (and outside public/) —
        until then every snapshot surface answers 409 UNSET / disabled by
        design; nothing is guessed.
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

- WAVE 0 (2026-09-19, autonomous run; commits 5fc7d1b merge + 874e2a3):
  0.1 DONE — main adopted wip/task-31-snapshot-hardening (realpath
  containment, 31a prerequisite) via no-ff merge 5fc7d1b; wip/queue-ops was
  a STALE pre-merge snapshot (its only unique commit's text already on main
  verbatim; its tree would have reverted main 2,140 lines) so it was NOT
  merged, deliberately; wip/task-31-snapshot-hardening,
  wip/task-27-disclosure (already merged via PR #2) and wip/queue-ops
  deleted on the remote, plus wip/task-30-password (fully merged at
  4bb7620). Prod verify: traversal probes 400/404, nonexistent file 404
  with EMPTY body. 0.2 DONE — scripts/price-workflow.md removed from HEAD
  (874e2a3); token sweep proved it was the ONLY tracked file carrying the
  leaked infra address; no private keys/key files tracked; raw URL now 404;
  HISTORY still holds it — remedy is owner-side ROTATION (ASK_ME). 0.3
  DONE — public/ already clean (testers removed in eb09a2e); public-dir
  guard extended with a content-based check: no static page may contain a
  password input, whatever its filename. 0.4 PENDING (honest): the prod
  DB is unreachable from this sandbox (no SSH/host access) and BOTH
  mutation paths need the current password — bootstrap endpoints would
  recreate the hole class; owner steps handed over below (ASK_ME). 0.5
  DONE — deploy mechanism confirmed: NO GitHub workflows, NO postbuild
  scripts, NOTHING in-repo pulls from main; hPanel's git integration is
  the sole deploy trigger. 0.4 owner steps (admin UI): sign in →
  /admin/settings → Change Password → require current password → new
  >=20-char password from a password manager → the 4bb7620 rule kills
  every existing session on save.

- WAVE 0.5 (2026-09-19, user-directed interrupt; DONE, commits 3b7d14e +
  a77322d): admin product add/edit was BROKEN in production —
  ProductEditor.tsx POSTs/PUTs/GET-deletes on /api/admin/products[/id], but
  only the list GET ever existed (bare 405/404). Root cause: TASK 1 moved
  admin reads to /api/admin/* and never created the write handlers. FIXED:
  (1) public /api/products write path DELETED — every mutating method on
  /api/products and /api/products/[id] answers a uniform 401, session or no
  session (public-write-path.closed.test.ts; the old public POST was
  session-gated and reached its handler before 401). (2) The admin write
  handlers now EXIST (route.ts POST + [id]/route.ts GET/PUT/DELETE) with
  per-field human-readable validation (400 field_errors), server-side
  publish blockers (422, texts = editor modal), FK reference checks
  ("choose from the list"), and NULL-safe commercial fields — absent stores
  NULL, explicit 0 stays 0, explicit null clears; public projection keeps
  them stripped (admin-product-flow.test.ts, 16 steps, green). Admin list
  Archive buttons repointed to the admin route. Authenticated production
  verify (user session, create→read→delete probe) PENDING on the user.
  Step-10 sweep RESULT (report-only): contact GET leaks ALL submissions
  unauthenticated; settings GET + newsletter POST ungated; articles/hero
  ?admin=true serve drafts unauthenticated; comparisons/collections public
  GETs include drafts; categories ?flat=true leaks id/slug/parent_id/
  sort_order; users POST lacks a role gate (super_admin only by
  convention); brands/[id] + categories/[id] GET full rows unauthenticated.
- WAVE 0.5b (2026-09-19, user probes + repo verify; same session): nine
  admin-read GET endpoints were ungated. FIXED (all in-handler, fail CLOSED,
  before any row lookup so no 404-vs-200 existence oracle): /api/settings GET
  (full site_settings incl. contact_email — USER-PROVEN leak), /api/contact
  GET (every submission incl. emails), /api/articles?admin=true (drafts +
  status filter — USER-PROVEN), /api/hero-slides?admin=true (drafts —
  USER-PROVEN), /api/articles/[id|slug] (COMPLETE row incl. drafts),
  /api/categories/[id|slug] (full row + children tree). /api/brands/[id|slug]
  keeps a PUBLIC allow-listed shape (name/slug/logo/description) because the
  public list serves brands; full row needs a session (FULL-ROW leak proven
  live via a real slug: internal UUID, website_url, is_featured). SWEEP
  CORRECTIONS recorded honestly: (1) users POST ALREADY required
  permissions.all — no escalation hole, my earlier flag was wrong;
  (2) newsletter POST ALREADY rate-limited 5/min;
  (3) comparisons/collections GETs ALREADY filtered published/active — my
  sweep line was wrong; (4) the user's ZERO-BYTE comparisons 200 was an
  hcdn JS-challenge interstitial artifact (repro'd 403 HTML + stable 845 B
  JSON after) — NOT an app response; (5) the [id] 404s in the user's probes
  were numeric-id artifacts — these routes match UUID-OR-SLUG, so slugs DID
  leak (proven). Known remaining: public /api/categories?flat=true still
  carries id/parent_id/sort_order (TASK 26 owns it; the admin category tree
  currently consumes that endpoint — give it a gated variant when 26 lands).
  Tests: admin-read-gates.test.ts (13 + 1 todo), suite 22/208 green, tsc 0.

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
