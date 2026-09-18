# Task Queue

One task per session. Mark `[x]` when committed.

## State block (update after every task)

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
[ ] TASK 28 — deploy scripts (COMMITTED BUT UNUSABLE — commit b1f69af)
        Deploy script rejected in review — 3 blocking defects (false FAIL
        that auto-rolls back a healthy deploy; unsound DB backup; mutates the
        live worktree).
        CANONICAL deploy script: scripts/deploy-hostinger.sh (plus
        scripts/rollback-hostinger.sh).
        scripts/deploy.sh and scripts/security-setup.sh are NOT part of the
        deploy path — NEVER run them on the VPS: they sed-edit .env in place
        (rewriting the AUTH_SECRET line). Do not wire them into pm2, cron,
        CI, or any runbook.
[ ] TASK 28b — deploy restructure (NEXT: releases/<sha>/ + `current` symlink;
        written plan pending approval, no script rewrite yet)
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
