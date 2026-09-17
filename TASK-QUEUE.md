# Task Queue

One task per session. Mark `[x]` when committed.

## State block (update after every task)

```
TASK-QUEUE STATE (updated 2026-09-17)
[x] TASK 1 — public API allow-list                (commit 7c7c63d)
[x] TASK 2 — server-side auth on /admin/* + login lockout   (commit see git log)
[ ] TASK 3 — Product JSON-LD: drop offers/aggregateRating
[ ] TASK 4 — quarantine fabricated price/rating fields (+ scripts/NULL-commercial-fields.ts)
[ ] TASK 5 — price-claim wording + OneLink sentence removal
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
