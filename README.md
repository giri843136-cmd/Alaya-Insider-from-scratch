# Alaya Insider

Premium affiliate shopping platform with dual destination system (Global + India).

## Quick Start

```bash
npm install
cp .env.example .env    # Fill in your credentials
npm run build
npm run start
```

> **Live Amazon.in prices** use the Amazon Creators API (PA-API 5.0 was retired
> by Amazon in May 2026). Enter credentials at `Admin → Amazon API`, cache is
> 1 hour with "as of" stamps, and an hourly cron hits `/api/cron/amazon-prices`.
> Full runbook: [RUNBOOK.md](./RUNBOOK.md). Tests: `npm test`.

## Admin Panel

**URL:** `/admin`

On first run, set `ADMIN_SEED_PASSWORD` in `.env` to create the initial admin account (`admin@alayainsider.com`). Remove the variable after first login.

> ⚠️ `AUTH_SECRET` is required in production (min 32 chars). The application will not start without it.

## Architecture

- **Frontend:** Next.js 14 (App Router), React, Tailwind CSS
- **Backend:** Next.js API Routes
- **Database:** SQLite via better-sqlite3
- **Auth:** JWT with Bearer token
- **Uploads:** Local persistent storage

## Environment Variables

Copy `.env.example` to `.env` and configure:

| Variable | Description | Required |
|----------|-------------|----------|
| `NODE_ENV` | `production` for live deployment | Yes |
| `AUTH_SECRET` | Random 64+ char secret (`openssl rand -base64 48`) | Yes (production) |
| `ADMIN_SEED_PASSWORD` | Initial admin password (first-time setup only) | First run only |
| `DATABASE_PATH` | SQLite database path (default: `./data/alaya.db`) | Yes |
| `NEXT_PUBLIC_SITE_URL` | Production URL (e.g., `https://alayainsider.com`) | Yes |
| `SMTP_HOST` | SMTP server for email | No |
| `SMTP_USER` | SMTP username | No |
| `SMTP_PASS` | SMTP password | No |
| `NEXT_PUBLIC_ANALYTICS_ID` | Google Analytics ID | No |
| `CREATORS_CLIENT_ID` / `CREATORS_CLIENT_SECRET` / `CREATORS_VERSION` | Amazon Creators API credentials (amazon.in) — see [RUNBOOK.md](./RUNBOOK.md). Prefer Admin → Amazon API (secret stored encrypted in DB) | No |
| `CREATORS_PARTNER_TAG` | Amazon.in tag, e.g. `alayainsider-21` | No |
| `CRON_SECRET` | Secret for hourly refresh cron (`POST /api/cron/amazon-prices`) | No |

## Persistent Storage

**Critical:** These directories must be on persistent disk:

```
data/           # SQLite database — survives restarts/rebuilds
uploads/        # Uploaded media — survives restarts/rebuilds
```

They must **NOT** be inside `.next/` or any ephemeral directory.

## Deployment

See [DEPLOYMENT.md](./DEPLOYMENT.md) for complete VPS deployment instructions.

### Quick Deploy

```bash
# On VPS
git clone <repo-url> /var/www/alayainsider
cd /var/www/alayainsider
npm install
cp .env.example .env   # Edit with real credentials
npm run build
pm2 start npm --name alayainsider -- start
```

## Features

### Public Website
- Hero carousel (6 slides, autoplay, swipe, keyboard)
- Shop by Category (image-first, no product counts)
- Trending products, Editor's Picks, Collections
- Product detail with editorial recommendations
- Dual affiliate destination selector (product pages only)
- Newsletter signup, Contact form
- SEO: sitemap, robots.txt, JSON-LD, breadcrumbs

### Affiliate System
- **Shop Worldwide** → Global Amazon routing link
- **Shop in India** → Dedicated Amazon India link
- Click tracking per destination (global/india)
- `/go/[slug]?destination=global|india` redirect system
- Open redirect protection

### Admin Panel
- Product CRUD with dual destination fields
- Category, Brand, Collection, Article management
- Hero carousel editor with scheduling
- Media library with upload
- Newsletter subscribers with CSV export
- Analytics dashboard (clicks, destinations, top products)
- System health monitoring
- Activity audit log
- Role-based access (5 roles)

## Database

SQLite with non-destructive initialization:
- `CREATE TABLE IF NOT EXISTS` — safe on every startup
- Seed functions skip if data exists
- Production startup **never** resets data

## Security

- JWT authentication with httpOnly cookie + Bearer token fallback
- bcrypt password hashing
- Role-based authorization on all protected endpoints
- Input validation, XSS protection (React auto-escaping)
- Open redirect protection (only DB-approved URLs)
- No secrets in client-side code
