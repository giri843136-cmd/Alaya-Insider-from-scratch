# Alaya Insider — Affiliate Commerce Platform

A complete, production-ready affiliate marketing website with a full admin panel. Built with Next.js 14, SQLite, and Tailwind CSS.

**Live Preview:** The site runs on port 3000.

## Quick Start

```bash
# Install dependencies
npm install

# Start development server
npm run dev

# Production build
npm run build
npm run start
```

## Admin Panel

**URL:** `/admin`

**Default Credentials:**
- Email: `admin@alayainsider.com`
- Password: `((Alaya)1923@+-)`

> ⚠️ Change these credentials immediately in production.

## Architecture

- **Frontend:** Next.js 14 (App Router), React, Tailwind CSS
- **Backend:** Next.js API Routes
- **Database:** SQLite via better-sqlite3
- **Auth:** JWT with httpOnly cookies, bcrypt password hashing
- **Uploads:** Local file storage (CDN-ready)

## Project Structure

```
src/
├── app/
│   ├── (public)/           # Public pages (home, products, journal, etc.)
│   │   ├── page.tsx        # Homepage
│   │   ├── products/       # Product listing
│   │   ├── product/[slug]/ # Product detail
│   │   ├── category/[slug]/
│   │   ├── brand/[slug]/
│   │   ├── journal/        # Articles
│   │   ├── collections/
│   │   ├── compare/[slug]/ # Comparisons
│   │   ├── search/
│   │   ├── about/
│   │   ├── contact/
│   │   └── [slug]/         # Legal pages
│   ├── admin/              # Admin panel
│   │   ├── page.tsx        # Dashboard
│   │   ├── products/       # Product management
│   │   ├── categories/
│   │   ├── brands/
│   │   ├── articles/
│   │   ├── collections/
│   │   ├── comparisons/
│   │   ├── media/          # Media library
│   │   ├── affiliate-links/
│   │   ├── newsletter/
│   │   ├── analytics/
│   │   ├── homepage/       # Homepage builder
│   │   ├── users/
│   │   ├── settings/
│   │   ├── activity/       # Activity log
│   │   └── system-health/
│   ├── api/                # API routes
│   │   ├── auth/
│   │   ├── products/
│   │   ├── categories/
│   │   ├── brands/
│   │   ├── articles/
│   │   ├── collections/
│   │   ├── comparisons/
│   │   ├── newsletter/
│   │   ├── clicks/
│   │   ├── search/
│   │   ├── homepage/
│   │   ├── settings/
│   │   ├── analytics/
│   │   ├── upload/
│   │   ├── media/
│   │   ├── contact/
│   │   ├── users/
│   │   ├── activity/
│   │   └── system-health/
│   ├── go/[slug]/          # Affiliate redirect
│   ├── sitemap.ts
│   └── robots.ts
├── components/
│   ├── public/             # Public components
│   └── admin/              # Admin components
├── lib/
│   ├── db.ts               # Database connection
│   ├── schema.ts           # Database schema + seeds
│   ├── seed-demo.ts        # Demo data
│   ├── auth.ts             # Authentication
│   ├── init.ts             # DB initialization
│   └── api-helpers.ts      # API utilities
data/                       # SQLite database
uploads/                    # Uploaded media
```

## Database Schema

Core tables:
- `users`, `roles` — Authentication & authorization
- `products`, `product_images` — Product catalog
- `brands` — Brand management
- `categories` — Hierarchical categories
- `collections`, `collection_products` — Curated collections
- `articles`, `article_categories` — Editorial content
- `comparisons` — Product comparisons
- `affiliate_links`, `affiliate_clicks` — Affiliate tracking
- `newsletter_subscribers` — Email capture
- `media` — Media library
- `homepage_sections` — Homepage CMS
- `site_settings` — Site configuration
- `activity_logs` — Admin audit trail
- `contact_submissions` — Contact form
- `pages` — Static/legal pages
- `page_views`, `search_logs` — Analytics
- `redirects` — URL redirects

## Environment Variables

Copy `.env.example` to `.env` and configure:

```
DATABASE_PATH=./data/alaya.db
AUTH_SECRET=your-secret-key-min-32-characters
JWT_EXPIRY=7d
NEXT_PUBLIC_SITE_URL=https://your-domain.com
NEXT_PUBLIC_SITE_NAME=Alaya Insider
```

## Key Features

### Public Website
- Clean, editorial design
- Product discovery with search, filters, sorting
- Product detail pages with editorial recommendations
- Category and brand browsing
- Curated collections
- Product comparisons
- Blog/journal with articles
- Newsletter signup
- Affiliate link tracking and redirection
- SEO: sitemap, robots.txt, schema markup, meta tags
- Mobile-first responsive design
- 404 page with navigation

### Admin Panel
- Dashboard with analytics
- Full CRUD for products, categories, brands
- Article management
- Media library with upload
- Homepage section editor
- Newsletter subscriber management with CSV export
- Affiliate link management
- Click analytics
- User management with roles
- Activity audit log
- Site settings
- System health monitoring
- Bulk product import (CSV)
- Pre-publish checklist

### Affiliate System
- Centralized link management
- `/go/[slug]` redirect with tracking
- Click tracking (device, source, date)
- UTM parameter support
- Multiple marketplace support (Amazon, Impact, CJ, ShareASale)

### User Roles
- **Super Admin** — Full access
- **Admin** — Products, content, settings, analytics
- **Editor** — Articles, products, collections
- **Content Manager** — Articles, product content
- **Analyst** — Analytics only

## Demo Data

The database seeds with:
- 20 sample products (Muji, Aesop, Le Creuset, Bang & Olufsen, Away)
- 8 parent categories with subcategories
- 5 brands
- 5 articles
- 3 collections
- 3 comparison pages
- 15 sample clicks
- 3 newsletter subscribers

## Deployment

### Production Build
```bash
npm run build
npm run start
```

### Environment
- Node.js 18+
- No external database required (SQLite)
- Uploads stored locally (configure CDN for production)

### Caching
- Compatible with CDN caching
- Static assets cached aggressively
- Affiliate redirects use 302 (not cached)
- API responses can be cached at the CDN layer

## Security
- JWT authentication with httpOnly cookies
- bcrypt password hashing
- Role-based access control
- Input validation on all endpoints
- SQL injection protection (parameterized queries)
- XSS protection (React auto-escaping)
- Admin route protection
- Activity logging
- No secrets in frontend code

## Known Limitations

1. **Rich Text Editor** — Article content is edited as HTML. A WYSIWYG editor (TinyMCE, Tiptap) can be added.
2. **Image Optimization** — Images are stored as-is. sharp-based optimization pipeline can be added.
3. **Email** — SMTP integration is architecture-ready but not connected. Add nodemailer for transactional emails.
4. **2FA** — Architecture supports it but not implemented in v1.
5. **Full-text Search** — Uses SQLite LIKE queries. FTS5 extension or external search can be added.
6. **Internationalization** — Database schema supports it but UI is English-only in v1.

## Future Expansion

- Full-text search with SQLite FTS5
- WYSIWYG content editor
- Image optimization pipeline
- Email automation integration
- Two-factor authentication
- A/B testing for CTAs
- Product availability monitoring
- Social sharing optimization
- API rate limiting middleware
- Webhook integrations
- Multi-language support
