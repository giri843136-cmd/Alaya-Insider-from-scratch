# RUNBOOK — Going live with the Amazon Creators API (Amazon.in + Amazon.com)

This is the step-by-step guide for **alayainsider.com**. The site is a
**dual-store** system:

| Store | Marketplace | Tag | Credential version | Token endpoint | Currency |
|---|---|---|---|---|---|
| India 🇮🇳 | www.amazon.in | `alayainsider-21` | 3.2 (EU) | api.amazon.co.uk | INR ₹ |
| United States 🇺🇸 | www.amazon.com | `alayainsider-20` | 3.1 (NA) | api.amazon.com | USD $ |

Visitors are routed **server-side**: India → amazon.in + ₹; any other
**detected** country (US, DE, GB, AE, …) → amazon.com + $ with the `-20` tag
— the international default — and **Amazon OneLink** rewrites those `.com`
anchors to each visitor's local store (a German visitor lands on amazon.de
with `-20`). Products without a US ASIN — and visitors whose country cannot
be detected — keep the .in rendering: those products only exist on
amazon.in.

Geo detection chain (first hit wins): `CF-IPCountry` header → MaxMind
GeoLite2 local DB (`data/GeoLite2-Country.mmdb`, optional) → default India.
As of 2026-09-04 the site is served by Hostinger's hcdn (not Cloudflare), so
`CF-IPCountry` is currently absent — install GeoLite2 (see "Install
GeoLite2") to activate IP-based routing; until then every visitor defaults to
the India store (.in rendering).

> ⚠️ **PA-API 5.0 no longer exists.** Amazon deprecated Product Advertising
> API 5.0 on **April 30, 2026** and retired the endpoint on **May 15, 2026**
> (`webservices.amazon.in/paapi5/...` now returns HTTP 404). The AWS Access
> Key + Secret + SigV4 flow from older tutorials **cannot work anymore**, with
> real keys or dummy keys. The official replacement is the **Amazon Creators
> API**: OAuth 2.0 (Credential ID + Credential Secret + Version), one global
> endpoint (`creatorsapi.amazon`), and a marketplace header. This codebase is
> already built against it. See "Credentials" below.

---

## What success looks like (your checklist)

- [ ] Product boxes show the real Amazon.in image, live ₹ price, availability
- [ ] An "as of <date/time> IST" stamp sits next to product-page prices
- [ ] All Amazon links carry your real tag ending `-21` (`alayainsider-21`)
- [ ] One test click lands on the right amazon.in product with your tag in the URL
- [ ] No errors in `data/logs/creators-api.log` after 24h; hourly cron refreshes visible per store
- [ ] (US optional) US visitors see $ + amazon.com links; other detected countries get the .com default that OneLink localizes

> Timezone note: "as of" stamps show **IST** for India-store prices and **UTC**
> for US-store prices (each price is stamped in its own store's timezone).

---

## Adding the US store later

The US store is **optional** and the site works perfectly India-first without
it — the US tab simply shows "Not configured". Add it whenever the US
Associates account is approved:

1. Get US credentials from **affiliate-program.amazon.com** → Tools → Creators
   API (primary owner; approval / qualifying-sales gate applies per store).
   Amazon.com accounts use credential version **3.1** (NA).
2. Admin → **Amazon API** → **United States 🇺🇸** tab.
3. Paste Credential ID / Secret / Version (`3.1`) / Partner Tag
   (`alayainsider-20`). Marketplace is fixed to www.amazon.com.
4. Click **Run connection test** with three amazon.com ASINs (clothing /
   handbag / watch). Dummy keys → `invalid_client` = plumbing OK.
5. Products need a **US ASIN**. Set it per product in Admin → Products →
   Affiliate → **US Shopping (amazon.com)** URL field. ⚠️ **The seeded
   ASINs are not valid on either marketplace.** A 2026-09-04 live audit found
   the catalog reused one fabricated ASIN string per product: 19/20 return
   404 on amazon.in (1 maps to a different product) and 18/20 return 404 on
   amazon.com (2 map to different products). Run `node scripts/fix-amazon-links.js`
   on the server (dry-run first, then `--apply`; it backs up the DB) to write
   the 12 verified amazon.in ASINs + 16 verified amazon.com ASINs and
   neutralize the 4 products with no US listing. Products with **no genuine
   amazon.in listing** (MUJI items, Away toiletry bag, Aesop Reverence Hand
   Balm — printed by the script as a REVIEW list) keep their dead India CTA
   until you decide editorially: find a real listing, or unpublish/rewrite
   the product. To source a listing for a new product run
   `node scripts/find-in-listing.js "Product Name"`.
6. US visitors now see $ prices + amazon.com links with `alayainsider-20`.
   Products without a US listing fall back to the .in price/link automatically.
   Once GeoLite2 is installed (below), the same .com default serves every
   non-India visitor, with OneLink localizing their links.

## Bulk product import (CSV)

Admin → **Import CSV** (`/admin/import`) pastes a CSV and creates products as
**drafts** (safe default — review in Admin → Products before publishing).

Required columns: `name`, `category` (created if missing). Optional columns:
`brand`, `short_description`, `why_we_recommend`, `best_for`, `pros`,
`cons`, `tags`, `buying_advice`, `primary_image` (URL), `india_asin`,
`us_asin`, `current_price`, `currency`, `rating`, `review_count`, `status`
(`draft`|`published`), `seo_title`, `seo_description`. Pros/cons/tags are
pipe (`|`) separated. `india_asin` / `us_asin` build the tagged
amazon.in / amazon.com URLs automatically (`alayainsider-21` / `-20`).

⚠️ Verify every ASIN in your browser before importing — the seeded catalog's
ASINs were invalid on both marketplaces (see the audit note in “Adding the US
store later”). Endpoint: `POST /api/products/import` (admin auth).

## Installing OneLink in admin

OneLink rewrites Amazon anchors for the **9 secondary marketplaces** to each
visitor's local store with the `-20` tag. Everything on this site is already
OneLink-ready — product links are **direct amazon.in / amazon.com anchors**
(no `/go/` redirector), so OneLink can see and rewrite them.

1. In the **US** Associates account: Account Settings → OneLink → generate the
   snippet (or copy from the "OneLink" product linking tool).
2. Admin → **Amazon API** → **Amazon OneLink** section → paste the snippet →
   **Save & validate**.
3. Only `<script src="https://…amazon-adsystem.com|amazon.com|amazon.co.uk">`
   is accepted — inline JS or other hosts are rejected. The validated src(s)
   are injected site-wide via `next/script` (`afterInteractive`).
4. Status chip turns **Installed**. Verify on a live page with a German/UK
   visitor (or `x-test-geo: DE` in a dev build) that the anchor still points
   directly at amazon.in — OneLink performs the rewrite in the visitor's
   browser.

---

## Before you start (get the credentials)

Creators API credentials come from **Amazon Associates Central**, not from the
old PA-API console:

1. Sign in to Associates Central with the **primary account owner** of your
   Amazon.in store (final-accepted status; the store may need recent
   qualifying referred sales — Amazon gates Creators API access per region).
2. Menu → **Tools → Creators API** (or the "CreatorsAPI" tab).
3. **Create Application** → name it (e.g. "Alaya Insider").
4. **Create Credential** → copy and store:
   - **Credential ID** (replaces the old Access Key)
   - **Credential Secret** (replaces the old Secret Key — shown **once**)
   - **Version** — Amazon.in accounts are **3.2** (EU region)
5. Your **Partner Tag stays the same**: `alayainsider-21`.

If you don't see the Creators API tab, you don't have access yet — apply via
Associates Central support. **Do not** try to reuse old PA-API access/secret
keys; Amazon explicitly states they will not work.

---

## Switch to real keys (≈2 minutes per store)

1. Deploy this code (see the repo's DEPLOYMENT.md / Hostinger git deploy).
2. Open **https://alayainsider.com/admin** → **Amazon API** (left sidebar).
3. Pick the store tab (**India 🇮🇳** or **United States 🇺🇸**).
4. Paste:
   - **Credential ID**
   - **Credential Secret** (blank = keep the stored one if you're just fixing a tag)
   - **Credential Version** → `3.2` (India) or `3.1` (US)
   - **Partner Tag** → `alayainsider-21` (India) or `alayainsider-20` (US)
   - **Marketplace** → fixed per store, not editable
5. Click **Save credentials**. (Each secret is encrypted separately in the
   database with `AUTH_SECRET`; never shown again or sent to the browser.)
6. Click **Run connection test** with three ASINs for that store's marketplace.
   - Real keys ⇒ items appear with images + prices. Done.
   - Any error ⇒ see "Troubleshooting" below.
7. Repeat on the other tab if you have that store's credentials.

### 60-second post-entry smoke test

1. Open any product page → you should see a price with
   *"as of … · Live price from Amazon.(in|com), refreshed hourly"* for your
   geo store (India visitors: ₹ + IST; US visitors with a US ASIN on the
   product: $ + UTC).
2. Open the homepage → product cards show prices for your store.
3. Click the primary shopping button → the correct amazon marketplace opens
   **with your real tag** (`-21` or `-20`) in the URL — a **direct** amazon
   URL, not a `/go/` redirect.
4. Open **Admin → Amazon API** → each store's "Last connection test" + "Last
   successful API call" show recent timestamps; the cron card shows
   `live / refreshed` counts per store.
5. Check `data/logs/creators-api.log` (server-side only) — lines are prefixed
   `[in]` / `[us]` per store.
6. Geo simulation (dev only): send header `x-test-geo: US` to see the US
   rendering, `x-test-geo: DE` to see the .com international default (products
   with a US ASIN), `x-test-geo: IN` for the India rendering.

---

## Install GeoLite2 (activate per-country routing)

Routing is India-first until a country can be detected per request. Detection
is free and stays entirely server-side (no third-party geo API, no
client-side lookup): drop a MaxMind **GeoLite2-Country.mmdb** into
`data/GeoLite2-Country.mmdb` (or point `GEOIP_DB_PATH` at it). Until the file
exists every visitor is treated as India (.in rendering); once installed,
non-India visitors get the amazon.com default (`-20`) that OneLink localizes
for their local marketplace.

1. Create a free MaxMind account: maxmind.com → GeoLite2 → Sign up.
2. Account → **Manage License Keys** → generate a key.
3. On the server, download + install the DB (≈6 MB):
   ```bash
   node scripts/install-geolite2.js --license-key=XXXXXXXX
   ```
   (the installer also accepts `MAXMIND_LICENSE_KEY` in `.env`)
4. Restart the app (`pm2 restart <app>`). No code changes — `src/lib/geo.ts`
   picks the file up on the first request.

Verify with a real IP: `curl -s -H 'x-forwarded-for: 1.2.3.4' …` is dev-only;
simplest is the smoke-test header `x-test-geo: DE|US|IN` on a dev build, or a
VPN test in production.

### Monthly auto-refresh (recommended)

MaxMind publishes weekly; a monthly refresh is plenty. The DB swap is
atomic and failure-safe — a failed download leaves the previous `.mmdb`
untouched and the endpoint never throws.

1. Add `MAXMIND_LICENSE_KEY=<your key>` to `.env` on the server (needed only
   for the refresh; the one-off installer can use the flag instead).
2. In the same cron-job.org account as the price refresh, add a second job:
   ```
   URL:    https://alayainsider.com/api/cron/geolite2
   Method: POST
   Header: x-cron-secret: <CRON_SECRET from .env>
   Every:  monthly (1st of the month is fine)
   ```
3. Response: `ok:true` + new file size/build date on success;
   `skipped:true` when the license key is unset; `502` with a reason on
   failure (the old DB is kept). The running process serves the DB it loaded
   at boot — the new file is picked up on the next restart/redeploy.

---

## Hourly refresh (cron)

Prices are cached for **1 hour** and refresh automatically on page views, but
Amazon policy (and low traffic) wants a guaranteed hourly refresh. Point an
external cron service at the refresh endpoint:

**cron-job.org / UptimeRobot (recommended)**
```
URL:    https://alayainsider.com/api/cron/amazon-prices
Method: POST
Header: x-cron-secret: <CRON_SECRET from .env>
Every:  60 minutes
```

**Server crontab alternative**
```bash
echo "0 * * * * curl -s -X POST -H 'x-cron-secret: <CRON_SECRET>' https://alayainsider.com/api/cron/amazon-prices >/dev/null" | crontab -
```

Set `CRON_SECRET` in `.env` first (any long random string). The same endpoint
can also be triggered from **Admin → Amazon API → "Refresh all prices now"**
(signed in as admin).

---

## Rollback plan (if real keys misbehave)

Fallback mode is always one click away and is safe/compliant:

1. **Admin → Amazon API → Clear credentials** on the offending store tab (it
   asks for confirmation). The site instantly returns to "Check current price
   on Amazon" text-link boxes for that store — no blank pages, no errors.
   Clearing the US store only returns the site to the India-first state.
2. If you also set `CREATORS_*` / `CREATORS_US_*` in `.env`, remove those
   lines and restart.
3. Restore-point backups taken before the dual-store integration:
   - Database: `data/backups/alaya-dualstore-20260904-144753.db` (pre-migration)
     and `data/backups/alaya-backup-20260904-131421.db` (original India build)
     (restore: `cp data/backups/alaya-dualstore-20260904-144753.db data/alaya.db` then restart)
   - Code: this repo — commit `4950381` is the pre-dual-store HEAD (India-only;
     `8a75c26` is the same code one commit earlier) and commit `3bda9a0` is the
     dual-store build. Undo a bad deploy by checking out / reverting to
     `4950381` and redeploying.

---

## Troubleshooting

| Symptom | Meaning / fix |
|---|---|
| Token test returns HTTP 401/400 `invalid_client` | Credentials rejected. Re-check Credential ID/Secret/Version. **With dummy keys this is the expected PASS result.** |
| `NotAuthorizedException` / "not approved" on GetItems | Credentials work but Creators API access isn't approved for the marketplace/region yet (or wrong Partner Tag for the store). |
| `ItemNotAccessible` | The ASIN isn't sold on that marketplace (amazon.in vs amazon.com) or isn't API-accessible. Paste an ASIN from an open product page on the same marketplace. |
| HTTP 429 throttling | Expected occasionally under bursts; the 1-hour cache absorbs it. Don't raise request volume — the cache refresh cadence already exceeds requirements. |
| Product shows fallback text after saving keys | Cache retains failed lookups for 60s per store. Wait a minute, or run "Refresh all prices now". |
| Secret decryption error in logs | `AUTH_SECRET` changed after saving the secret → re-enter the Credential Secret once. |
| International visitor still sees ₹ | Product has no US ASIN (no `us_affiliate_url` and no amazon.com `global_affiliate_url`) → intentional .in fallback (the product only exists on amazon.in). Add the US URL in the product editor. |
| International visitor gets .in links for everything | Country not detected (no GeoLite2 DB, no CF header) → everyone currently defaults to India. Install GeoLite2 (see above) to activate per-country routing. |
| OneLink "Installed" but links not rewritten | Confirm product anchors are direct amazon.in/com URLs (they are — the `/go/` redirector was removed for Amazon links) and the snippet src host is amazon-adsystem.com. |
| Page loads but price empty / stale | Confirm the product row has an affiliate URL for that store. Products without one intentionally show fallback text. |

---

## Compliance notes (Amazon policy)

- **Refresh cadence**: prices refresh hourly (1-hour cache per store) **and** carry an
  "as of …" stamp on product pages (IST for India, UTC for US) — exceeds the hourly requirement.
- **No scraping**: the old HTML-scraping price fetcher was removed. All live
  data comes from the official Creators API.
- **Images**: the site displays its own editorial product images; the admin
  connection test hotlinks Amazon CDN images (never re-hosted/downloaded).
- **Ratings**: the Creators API does not return star-ratings in responses, so
  rating/review counts continue to come from your editorial database fields.
- **Disclosure**: all outbound buttons are `rel="nofollow sponsored"`,
  `target="_blank"`, and the FTC/Associates disclosure is rendered with PaidLinkTag.
- **OneLink**: product links are direct amazon.in/amazon.com anchors (no `/go/`
  internal redirector), so OneLink can rewrite them for secondary markets.
- **Secrets**: Credential Secret is encrypted at rest (AES-256-GCM keyed by
  `AUTH_SECRET`), never returned to the browser, never logged, never in
  sitemap/RSS/JSON. Failures log only to `data/logs/creators-api.log`.

---

## Where the code lives

| Concern | File |
|---|---|
| Store definitions (in/us, tags, token endpoints) | `src/lib/stores.ts` |
| Creators API client (OAuth2 per store, GetItems, encryption, diagnostics) | `src/lib/creators-api.ts` |
| Geo detection (CF-IPCountry → MaxMind → India default; non-India → .com) | `src/lib/geo.ts` |
| Price cache + page helpers (per-store 1h TTL, ASIN resolution, direct URLs) | `src/lib/amazon-price.ts`, `src/lib/price-format.ts` |
| Product JSON-LD builder (store-consistent, omit-when-no-price) | `src/lib/product-schema.ts` |
| OneLink sanitizer + root-layout injection | `src/lib/onelink.ts`, `src/lib/onelink-server.ts`, `src/app/layout.tsx` |
| Cache table + dual-store migration + amazon_clicks | `src/lib/schema.ts` |
| Credentials UI (two tabs) + OneLink + logs + cache table | `src/app/admin/amazon/page.tsx`, `src/app/api/creators/*` |
| Hourly refresh endpoint (both stores) | `src/app/api/cron/amazon-prices/route.ts` |
| Click beacon (direct anchors stay direct) | `src/app/api/clicks/route.ts`, `src/components/public/DestinationSelector.tsx` |
| Standalone plumbing diagnostic (both token endpoints) | `scripts/diagnose-creators.js` |
| Env reference | `.env.example` (CREATORS_*, CREATORS_US_*, GEOIP_DB_PATH, CRON_SECRET) |
