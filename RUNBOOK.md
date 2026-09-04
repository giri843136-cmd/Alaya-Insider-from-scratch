# RUNBOOK — Going live with the Amazon Creators API (Amazon.in)

This is the step-by-step "switch to real keys" guide for **alayainsider.com**.

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
- [ ] No errors in `data/logs/creators-api.log` after 24h; hourly cron refreshes visible

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

## Switch to real keys (≈2 minutes)

1. Deploy this code (`git pull`, `npm install`, `npm run build`,
   `pm2 restart alayainsider`).
2. Open **https://alayainsider.com/admin** → **Amazon API** (left sidebar).
3. Paste:
   - **Credential ID**
   - **Credential Secret** (blank = keep the stored one if you're just fixing a tag)
   - **Credential Version** → `3.2`
   - **Partner Tag** → `alayainsider-21`
   - **Marketplace** → `www.amazon.in`
4. Click **Save credentials**. (The secret is encrypted in the database with
   `AUTH_SECRET`; it is never shown again or sent to the browser.)
5. Click **Run connection test** with your three test ASINs.
   - Real keys ⇒ items appear with images + ₹ prices. Done.
   - Any error ⇒ see "Troubleshooting" below.

### 60-second post-entry smoke test

1. Open any product page that has an amazon.in link → you should see a ₹ price
   with *"as of … IST · Live price from Amazon.in, refreshed hourly"*.
2. Open the homepage → product cards show ₹ prices.
3. Click a "Shop in India" button → amazon.in page opens **with
   `tag=alayainsider-21`** in the URL.
4. Open **Admin → Amazon API** → "Last successful API call" shows a recent
   timestamp and the hourly-run card shows `live / refreshed` counts.
5. Check `data/logs/creators-api.log` (server-side only) for any errors.

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

1. **Admin → Amazon API → Clear credentials.** The site instantly returns to
   "Check current price on Amazon" text-link boxes everywhere — no blank
   pages, no errors. The content/design is untouched.
2. If you also set `CREATORS_*` in `.env`, remove those lines and restart.
3. Restore-point backups taken before this integration:
   - Database: `data/backups/alaya-backup-20260904-131421.db`
     (restore: `cp data/backups/alaya-backup-20260904-131421.db data/alaya.db && pm2 restart alayainsider`)
   - Code: this repo (commit `e7a2719` is the pre-change HEAD).

---

## Troubleshooting

| Symptom | Meaning / fix |
|---|---|
| Token test returns HTTP 401/400 `invalid_client` | Credentials rejected. Re-check Credential ID/Secret/Version. **With dummy keys this is the expected PASS result.** |
| `NotAuthorizedException` / "not approved" on GetItems | Credentials work but Creators API access isn't approved for the marketplace/region yet (or wrong Partner Tag for amazon.in). |
| `ItemNotAccessible` | The ASIN isn't sold on Amazon.in or isn't API-accessible. Paste an ASIN from an open amazon.in product page. |
| HTTP 429 throttling | Expected occasionally under bursts; the 1-hour cache absorbs it. Don't raise request volume — the cache refresh cadence already exceeds requirements. |
| Product shows fallback text after saving keys | Cache retains failed lookups for 60s. Wait a minute, or run "Refresh all prices now". |
| Secret decryption error in logs | `AUTH_SECRET` changed after saving the secret → re-enter the Credential Secret once. |
| Page loads but price empty / stale | Confirm the product row has an **india_affiliate_url** (amazon.in link). Products without one intentionally show fallback text. |

---

## Compliance notes (Amazon policy)

- **Refresh cadence**: prices refresh hourly (1-hour cache) **and** carry an
  "as of … IST" stamp on product pages — exceeds the hourly requirement.
- **No scraping**: the old HTML-scraping price fetcher was removed. All live
  data comes from the official Creators API.
- **Images**: the site displays its own editorial product images; the admin
  connection test hotlinks Amazon CDN images (never re-hosted/downloaded).
- **Ratings**: the Creators API does not return star-ratings in responses, so
  rating/review counts continue to come from your editorial database fields.
- **Disclosure**: all outbound buttons are `rel="nofollow sponsored"`,
  `target="_blank"`, and the FTC/Associates disclosure is rendered with PaidLinkTag.
- **Secrets**: Credential Secret is encrypted at rest (AES-256-GCM keyed by
  `AUTH_SECRET`), never returned to the browser, never logged, never in
  sitemap/RSS/JSON. Failures log only to `data/logs/creators-api.log`.

---

## Where the code lives

| Concern | File |
|---|---|
| Creators API client (OAuth2, GetItems, encryption, diagnostics) | `src/lib/creators-api.ts` |
| Price cache + page helpers (1h TTL, India ASIN) | `src/lib/amazon-price.ts`, `src/lib/price-format.ts` |
| Cache table | `src/lib/schema.ts` (`amazon_price_cache`) |
| Credentials UI + connection test + verification | `src/app/admin/amazon/page.tsx`, `src/app/api/creators/*` |
| Hourly refresh endpoint | `src/app/api/cron/amazon-prices/route.ts` |
| Standalone plumbing diagnostic (server shell) | `scripts/diagnose-creators.js` |
| Env reference | `.env.example` (CREATORS_*, CRON_SECRET) |
