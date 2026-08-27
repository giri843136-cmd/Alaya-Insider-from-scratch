import getDb from './db';
import bcryptjs from 'bcryptjs';
import { v4 as uuid } from 'uuid';

export function initializeDatabase() {
  const db = getDb();
  db.exec(`
    CREATE TABLE IF NOT EXISTS roles (
      id TEXT PRIMARY KEY, name TEXT NOT NULL UNIQUE, permissions TEXT NOT NULL DEFAULT '{}',
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );
    CREATE TABLE IF NOT EXISTS users (
      id TEXT PRIMARY KEY, email TEXT NOT NULL UNIQUE, username TEXT NOT NULL UNIQUE,
      password_hash TEXT NOT NULL, first_name TEXT DEFAULT '', last_name TEXT DEFAULT '',
      role_id TEXT NOT NULL, avatar TEXT DEFAULT '', is_active INTEGER NOT NULL DEFAULT 1,
      two_factor_enabled INTEGER NOT NULL DEFAULT 0, two_factor_secret TEXT DEFAULT '',
      last_login TEXT, created_at TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at TEXT NOT NULL DEFAULT (datetime('now')),
      FOREIGN KEY (role_id) REFERENCES roles(id)
    );
    CREATE TABLE IF NOT EXISTS categories (
      id TEXT PRIMARY KEY, name TEXT NOT NULL, slug TEXT NOT NULL UNIQUE,
      description TEXT DEFAULT '', image TEXT DEFAULT '', parent_id TEXT,
      sort_order INTEGER DEFAULT 0, is_featured INTEGER DEFAULT 0,
      seo_title TEXT DEFAULT '', seo_description TEXT DEFAULT '',
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at TEXT NOT NULL DEFAULT (datetime('now')),
      FOREIGN KEY (parent_id) REFERENCES categories(id) ON DELETE SET NULL
    );
    CREATE TABLE IF NOT EXISTS brands (
      id TEXT PRIMARY KEY, name TEXT NOT NULL, slug TEXT NOT NULL UNIQUE,
      logo TEXT DEFAULT '', description TEXT DEFAULT '', website_url TEXT DEFAULT '',
      is_featured INTEGER DEFAULT 0, seo_title TEXT DEFAULT '', seo_description TEXT DEFAULT '',
      created_at TEXT NOT NULL DEFAULT (datetime('now')), updated_at TEXT NOT NULL DEFAULT (datetime('now'))
    );
    CREATE TABLE IF NOT EXISTS products (
      id TEXT PRIMARY KEY, name TEXT NOT NULL, slug TEXT NOT NULL UNIQUE,
      brand_id TEXT, category_id TEXT, subcategory_id TEXT, sku TEXT DEFAULT '',
      current_price REAL DEFAULT 0, previous_price REAL, currency TEXT DEFAULT 'USD',
      price_updated_at TEXT, rating REAL DEFAULT 0, review_count INTEGER DEFAULT 0,
      primary_image TEXT DEFAULT '', gallery_images TEXT DEFAULT '[]',
      thumbnail TEXT DEFAULT '', image_alt TEXT DEFAULT '',
      short_description TEXT DEFAULT '', full_description TEXT DEFAULT '',
      why_we_recommend TEXT DEFAULT '', best_for TEXT DEFAULT '',
      benefits TEXT DEFAULT '[]', pros TEXT DEFAULT '[]', cons TEXT DEFAULT '[]',
      buying_advice TEXT DEFAULT '', specifications TEXT DEFAULT '{}',
      tags TEXT DEFAULT '[]',
      status TEXT DEFAULT 'draft' CHECK(status IN ('draft','in_review','ready','published','archived','out_of_stock','expired')),
      is_featured INTEGER DEFAULT 0, is_trending INTEGER DEFAULT 0, is_editors_pick INTEGER DEFAULT 0,
      -- DUAL DESTINATION SYSTEM
      global_affiliate_url TEXT DEFAULT '', global_affiliate_network TEXT DEFAULT '',
      global_tracking_id TEXT DEFAULT '', global_cta_label TEXT DEFAULT 'Explore Global Options',
      global_active INTEGER DEFAULT 1,
      india_affiliate_url TEXT DEFAULT '', india_affiliate_network TEXT DEFAULT '',
      india_tracking_id TEXT DEFAULT '', india_cta_label TEXT DEFAULT 'Explore India',
      india_active INTEGER DEFAULT 1,
      -- Legacy single-link fields kept for backward compat
      affiliate_url TEXT DEFAULT '', marketplace TEXT DEFAULT '',
      affiliate_network TEXT DEFAULT '', tracking_id TEXT DEFAULT '',
      cta_text TEXT DEFAULT 'Check Price',
      additional_retailers TEXT DEFAULT '[]',
      seo_title TEXT DEFAULT '', seo_description TEXT DEFAULT '',
      canonical_url TEXT DEFAULT '', focus_keyword TEXT DEFAULT '',
      schema_type TEXT DEFAULT 'Product',
      click_count INTEGER DEFAULT 0, view_count INTEGER DEFAULT 0,
      global_click_count INTEGER DEFAULT 0, india_click_count INTEGER DEFAULT 0,
      created_by TEXT, updated_by TEXT, published_at TEXT, archived_at TEXT,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at TEXT NOT NULL DEFAULT (datetime('now')), deleted_at TEXT,
      FOREIGN KEY (brand_id) REFERENCES brands(id) ON DELETE SET NULL,
      FOREIGN KEY (category_id) REFERENCES categories(id) ON DELETE SET NULL,
      FOREIGN KEY (subcategory_id) REFERENCES categories(id) ON DELETE SET NULL
    );
    CREATE INDEX IF NOT EXISTS idx_products_status ON products(status);
    CREATE INDEX IF NOT EXISTS idx_products_category ON products(category_id);
    CREATE INDEX IF NOT EXISTS idx_products_brand ON products(brand_id);
    CREATE INDEX IF NOT EXISTS idx_products_slug ON products(slug);
    CREATE INDEX IF NOT EXISTS idx_products_featured ON products(is_featured);
    CREATE INDEX IF NOT EXISTS idx_products_trending ON products(is_trending);

    CREATE TABLE IF NOT EXISTS product_images (
      id TEXT PRIMARY KEY, product_id TEXT NOT NULL, url TEXT NOT NULL,
      alt_text TEXT DEFAULT '', caption TEXT DEFAULT '', sort_order INTEGER DEFAULT 0,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      FOREIGN KEY (product_id) REFERENCES products(id) ON DELETE CASCADE
    );
    CREATE TABLE IF NOT EXISTS collections (
      id TEXT PRIMARY KEY, name TEXT NOT NULL, slug TEXT NOT NULL UNIQUE,
      description TEXT DEFAULT '', cover_image TEXT DEFAULT '', sort_order INTEGER DEFAULT 0,
      is_active INTEGER DEFAULT 1, seo_title TEXT DEFAULT '', seo_description TEXT DEFAULT '',
      created_at TEXT NOT NULL DEFAULT (datetime('now')), updated_at TEXT NOT NULL DEFAULT (datetime('now'))
    );
    CREATE TABLE IF NOT EXISTS collection_products (
      collection_id TEXT NOT NULL, product_id TEXT NOT NULL, sort_order INTEGER DEFAULT 0,
      PRIMARY KEY (collection_id, product_id),
      FOREIGN KEY (collection_id) REFERENCES collections(id) ON DELETE CASCADE,
      FOREIGN KEY (product_id) REFERENCES products(id) ON DELETE CASCADE
    );
    CREATE TABLE IF NOT EXISTS article_categories (
      id TEXT PRIMARY KEY, name TEXT NOT NULL, slug TEXT NOT NULL UNIQUE,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );
    CREATE TABLE IF NOT EXISTS articles (
      id TEXT PRIMARY KEY, title TEXT NOT NULL, slug TEXT NOT NULL UNIQUE,
      subtitle TEXT DEFAULT '', featured_image TEXT DEFAULT '', category_id TEXT,
      author_id TEXT, content TEXT DEFAULT '', excerpt TEXT DEFAULT '',
      reading_time INTEGER DEFAULT 0,
      status TEXT DEFAULT 'draft' CHECK(status IN ('draft','published','archived')),
      is_featured INTEGER DEFAULT 0, seo_title TEXT DEFAULT '', seo_description TEXT DEFAULT '',
      canonical_url TEXT DEFAULT '', tags TEXT DEFAULT '[]',
      related_products TEXT DEFAULT '[]', related_articles TEXT DEFAULT '[]',
      published_at TEXT, created_at TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at TEXT NOT NULL DEFAULT (datetime('now')), deleted_at TEXT,
      FOREIGN KEY (category_id) REFERENCES article_categories(id) ON DELETE SET NULL,
      FOREIGN KEY (author_id) REFERENCES users(id) ON DELETE SET NULL
    );
    CREATE INDEX IF NOT EXISTS idx_articles_status ON articles(status);
    CREATE INDEX IF NOT EXISTS idx_articles_slug ON articles(slug);

    CREATE TABLE IF NOT EXISTS comparisons (
      id TEXT PRIMARY KEY, title TEXT NOT NULL, slug TEXT NOT NULL UNIQUE,
      description TEXT DEFAULT '', product_ids TEXT DEFAULT '[]',
      comparison_fields TEXT DEFAULT '[]', status TEXT DEFAULT 'draft',
      seo_title TEXT DEFAULT '', seo_description TEXT DEFAULT '',
      created_at TEXT NOT NULL DEFAULT (datetime('now')), updated_at TEXT NOT NULL DEFAULT (datetime('now'))
    );
    CREATE TABLE IF NOT EXISTS affiliate_links (
      id TEXT PRIMARY KEY, product_id TEXT, slug TEXT NOT NULL UNIQUE,
      destination_url TEXT NOT NULL, destination_type TEXT DEFAULT 'global',
      marketplace TEXT DEFAULT '', affiliate_network TEXT DEFAULT '',
      tracking_id TEXT DEFAULT '', utm_source TEXT DEFAULT '', utm_medium TEXT DEFAULT '',
      utm_campaign TEXT DEFAULT '', is_active INTEGER DEFAULT 1, click_count INTEGER DEFAULT 0,
      created_at TEXT NOT NULL DEFAULT (datetime('now')), updated_at TEXT NOT NULL DEFAULT (datetime('now')),
      FOREIGN KEY (product_id) REFERENCES products(id) ON DELETE SET NULL
    );
    CREATE INDEX IF NOT EXISTS idx_affiliate_links_slug ON affiliate_links(slug);

    CREATE TABLE IF NOT EXISTS affiliate_clicks (
      id TEXT PRIMARY KEY, link_id TEXT, product_id TEXT,
      destination_type TEXT DEFAULT 'global',
      source_page TEXT DEFAULT '', device TEXT DEFAULT '', country TEXT DEFAULT '',
      utm_source TEXT DEFAULT '', utm_medium TEXT DEFAULT '', utm_campaign TEXT DEFAULT '',
      ip_hash TEXT DEFAULT '', user_agent TEXT DEFAULT '', referrer TEXT DEFAULT '',
      clicked_at TEXT NOT NULL DEFAULT (datetime('now')),
      FOREIGN KEY (link_id) REFERENCES affiliate_links(id) ON DELETE SET NULL,
      FOREIGN KEY (product_id) REFERENCES products(id) ON DELETE SET NULL
    );
    CREATE INDEX IF NOT EXISTS idx_clicks_date ON affiliate_clicks(clicked_at);
    CREATE INDEX IF NOT EXISTS idx_clicks_product ON affiliate_clicks(product_id);
    CREATE INDEX IF NOT EXISTS idx_clicks_dest ON affiliate_clicks(destination_type);

    CREATE TABLE IF NOT EXISTS newsletter_subscribers (
      id TEXT PRIMARY KEY, email TEXT NOT NULL UNIQUE, first_name TEXT DEFAULT '',
      source TEXT DEFAULT 'website', is_active INTEGER DEFAULT 1,
      subscribed_at TEXT NOT NULL DEFAULT (datetime('now')), unsubscribed_at TEXT
    );
    CREATE TABLE IF NOT EXISTS media (
      id TEXT PRIMARY KEY, filename TEXT NOT NULL, original_name TEXT NOT NULL,
      mime_type TEXT NOT NULL, file_size INTEGER DEFAULT 0,
      width INTEGER DEFAULT 0, height INTEGER DEFAULT 0, alt_text TEXT DEFAULT '',
      url TEXT NOT NULL, thumbnail_url TEXT DEFAULT '', uploaded_by TEXT,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      FOREIGN KEY (uploaded_by) REFERENCES users(id) ON DELETE SET NULL
    );
    CREATE TABLE IF NOT EXISTS seo_metadata (
      id TEXT PRIMARY KEY, page_type TEXT NOT NULL, page_id TEXT DEFAULT '',
      seo_title TEXT DEFAULT '', meta_description TEXT DEFAULT '',
      canonical_url TEXT DEFAULT '', og_title TEXT DEFAULT '', og_description TEXT DEFAULT '',
      og_image TEXT DEFAULT '', robots TEXT DEFAULT 'index,follow', schema_type TEXT DEFAULT '',
      created_at TEXT NOT NULL DEFAULT (datetime('now')), updated_at TEXT NOT NULL DEFAULT (datetime('now'))
    );
    CREATE TABLE IF NOT EXISTS homepage_sections (
      id TEXT PRIMARY KEY, section_key TEXT NOT NULL UNIQUE, title TEXT DEFAULT '',
      subtitle TEXT DEFAULT '', content TEXT DEFAULT '{}', sort_order INTEGER DEFAULT 0,
      is_visible INTEGER DEFAULT 1, created_at TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at TEXT NOT NULL DEFAULT (datetime('now'))
    );
    CREATE TABLE IF NOT EXISTS site_settings (
      key TEXT PRIMARY KEY, value TEXT DEFAULT '', group_name TEXT DEFAULT 'general',
      updated_at TEXT NOT NULL DEFAULT (datetime('now'))
    );
    CREATE TABLE IF NOT EXISTS menus (
      id TEXT PRIMARY KEY, location TEXT NOT NULL, items TEXT NOT NULL DEFAULT '[]',
      updated_at TEXT NOT NULL DEFAULT (datetime('now'))
    );
    CREATE TABLE IF NOT EXISTS activity_logs (
      id TEXT PRIMARY KEY, user_id TEXT, action TEXT NOT NULL,
      entity_type TEXT DEFAULT '', entity_id TEXT DEFAULT '', details TEXT DEFAULT '',
      ip_address TEXT DEFAULT '', created_at TEXT NOT NULL DEFAULT (datetime('now')),
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE SET NULL
    );
    CREATE INDEX IF NOT EXISTS idx_activity_date ON activity_logs(created_at);
    CREATE TABLE IF NOT EXISTS contact_submissions (
      id TEXT PRIMARY KEY, name TEXT DEFAULT '', email TEXT NOT NULL,
      reason TEXT DEFAULT '', message TEXT NOT NULL, is_read INTEGER DEFAULT 0,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );
    CREATE TABLE IF NOT EXISTS redirects (
      id TEXT PRIMARY KEY, from_path TEXT NOT NULL UNIQUE, to_url TEXT NOT NULL,
      status_code INTEGER DEFAULT 301, is_active INTEGER DEFAULT 1, hit_count INTEGER DEFAULT 0,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );
    CREATE TABLE IF NOT EXISTS pages (
      id TEXT PRIMARY KEY, slug TEXT NOT NULL UNIQUE, title TEXT NOT NULL,
      content TEXT DEFAULT '', seo_title TEXT DEFAULT '', seo_description TEXT DEFAULT '',
      updated_at TEXT NOT NULL DEFAULT (datetime('now'))
    );
    CREATE TABLE IF NOT EXISTS page_views (
      id TEXT PRIMARY KEY, page_path TEXT NOT NULL, page_type TEXT DEFAULT '',
      entity_id TEXT DEFAULT '', referrer TEXT DEFAULT '', device TEXT DEFAULT '',
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );
    CREATE INDEX IF NOT EXISTS idx_pageviews_date ON page_views(created_at);
    CREATE TABLE IF NOT EXISTS search_logs (
      id TEXT PRIMARY KEY, query TEXT NOT NULL, results_count INTEGER DEFAULT 0,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    -- Hero Carousel Slides
    CREATE TABLE IF NOT EXISTS hero_slides (
      id TEXT PRIMARY KEY,
      eyebrow TEXT DEFAULT '',
      headline TEXT DEFAULT '',
      description TEXT DEFAULT '',
      primary_cta_label TEXT DEFAULT '',
      primary_cta_url TEXT DEFAULT '',
      secondary_cta_label TEXT DEFAULT '',
      secondary_cta_url TEXT DEFAULT '',
      desktop_image TEXT DEFAULT '',
      tablet_image TEXT DEFAULT '',
      mobile_image TEXT DEFAULT '',
      background_color TEXT DEFAULT '#f8f6f3',
      text_alignment TEXT DEFAULT 'left',
      text_color TEXT DEFAULT 'dark',
      overlay_strength REAL DEFAULT 0,
      layout TEXT DEFAULT 'text-left',
      status TEXT DEFAULT 'draft' CHECK(status IN ('draft','published','archived')),
      sort_order INTEGER DEFAULT 0,
      start_date TEXT,
      end_date TEXT,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at TEXT NOT NULL DEFAULT (datetime('now'))
    );
    CREATE INDEX IF NOT EXISTS idx_hero_slides_status ON hero_slides(status);

    -- Hero Settings
    CREATE TABLE IF NOT EXISTS hero_settings (
      key TEXT PRIMARY KEY,
      value TEXT DEFAULT ''
    );
  `);

  // Migration: add 2FA columns if missing (for existing databases)
  try { db.exec(`ALTER TABLE users ADD COLUMN two_factor_enabled INTEGER NOT NULL DEFAULT 0`); } catch {}
  try { db.exec(`ALTER TABLE users ADD COLUMN two_factor_secret TEXT DEFAULT ''`); } catch {}

  return db;
}

export function seedRoles() {
  const db = getDb();
  if ((db.prepare('SELECT COUNT(*) as cnt FROM roles').get() as any).cnt > 0) return;
  const roles = [
    { name: 'super_admin', permissions: JSON.stringify({ all: true }) },
    { name: 'admin', permissions: JSON.stringify({ products: true, content: true, settings: true, analytics: true }) },
    { name: 'editor', permissions: JSON.stringify({ articles: true, products: true, collections: true }) },
    { name: 'content_manager', permissions: JSON.stringify({ articles: true, products_content: true }) },
    { name: 'analyst', permissions: JSON.stringify({ analytics: true }) },
  ];
  const stmt = db.prepare('INSERT INTO roles (id, name, permissions) VALUES (?, ?, ?)');
  for (const r of roles) stmt.run(uuid(), r.name, r.permissions);
}

export function seedAdmin() {
  const db = getDb();
  if ((db.prepare('SELECT COUNT(*) as cnt FROM users').get() as any).cnt > 0) return;

  const seedPassword = process.env.ADMIN_SEED_PASSWORD;
  if (!seedPassword) {
    console.warn('ADMIN_SEED_PASSWORD not set. Skipping admin user creation.');
    console.warn('Set ADMIN_SEED_PASSWORD in .env to create the initial admin account.');
    return;
  }
  if (seedPassword.length < 8) {
    console.warn('ADMIN_SEED_PASSWORD must be at least 8 characters. Skipping admin creation.');
    return;
  }

  const role = db.prepare("SELECT id FROM roles WHERE name = 'super_admin'").get() as any;
  if (!role) return;
  db.prepare('INSERT INTO users (id, email, username, password_hash, first_name, last_name, role_id) VALUES (?, ?, ?, ?, ?, ?, ?)')
    .run(uuid(), 'Alayainsider@gmail.com', 'admin', bcryptjs.hashSync(seedPassword, 10), 'Alaya', 'Insider', role.id);
  console.log('Admin user created: Alayainsider@gmail.com');
}

export function seedHomepageSections() {
  const db = getDb();
  if ((db.prepare('SELECT COUNT(*) as cnt FROM homepage_sections').get() as any).cnt > 0) return;
  const sections = [
    { key: 'announcement', title: 'New: Summer essentials now curated — Explore the collection', content: '{"link":"/collections","is_dismissible":true}', order: 0 },
    { key: 'hero', title: 'Everyday Finds, Better Chosen.', content: '{"subtitle":"Curated products worth discovering, from everyday essentials to considered upgrades.","primary_cta":"Explore the Collection","primary_cta_link":"/products","secondary_cta":"Read Our Guides","secondary_cta_link":"/journal"}', order: 1 },
    { key: 'featured_categories', title: 'Shop by Category', content: '{"subtitle":"Browse our curated selections"}', order: 2 },
    { key: 'trending', title: 'Trending Picks', content: '{"subtitle":"Products our readers are loving right now"}', order: 3 },
    { key: 'editors_picks', title: "Editor\\'s Picks", content: '{"subtitle":"Hand-selected by our editorial team"}', order: 4 },
    { key: 'popular', title: 'Popular Products', content: '{"subtitle":"Most viewed this month"}', order: 5 },
    { key: 'collections', title: 'Curated For You', content: '{"subtitle":"Thoughtfully grouped collections"}', order: 6 },
    { key: 'guides', title: 'Smart Shopping Guides', content: '{"subtitle":"Practical advice to help you choose well"}', order: 7 },
    { key: 'destinations', title: 'Shop Where It Works Best for You', content: '{"subtitle":"Choose the shopping experience that matches your location.","global_heading":"Shop Worldwide","global_desc":"One smart link takes you to the Amazon store available in your region.","global_cta":"Explore Global Options","india_heading":"Shop in India","india_desc":"Explore local availability and pricing through our India shopping experience.","india_cta":"Explore India"}', order: 8 },
    { key: 'newsletter', title: 'Get the Good Finds First', content: '{"subtitle":"One useful email with curated products, shopping guides and new discoveries.","cta_text":"Join Free"}', order: 9 },
  ];
  const stmt = db.prepare('INSERT INTO homepage_sections (id, section_key, title, content, sort_order, is_visible) VALUES (?, ?, ?, ?, ?, 1)');
  for (const s of sections) stmt.run(uuid(), s.key, s.title, s.content, s.order);
}

export function seedSettings() {
  const db = getDb();
  if ((db.prepare('SELECT COUNT(*) as cnt FROM site_settings').get() as any).cnt > 0) return;
  const settings = [
    { key: 'site_name', value: 'Alaya Insider', group: 'general' },
    { key: 'site_tagline', value: 'Everyday Finds, Better Chosen.', group: 'general' },
    { key: 'site_description', value: 'Curated products, honest comparisons, and practical recommendations.', group: 'general' },
    { key: 'site_url', value: 'https://alayainsider.com', group: 'general' },
    { key: 'contact_email', value: 'hello@alayainsider.com', group: 'general' },
    { key: 'affiliate_disclosure', value: 'We may earn a commission from qualifying purchases made through links on this site. This does not affect the price you pay.', group: 'affiliate' },
    { key: 'default_currency', value: 'USD', group: 'general' },
    { key: 'social_twitter', value: '', group: 'social' },
    { key: 'social_instagram', value: '', group: 'social' },
    { key: 'social_pinterest', value: '', group: 'social' },
    { key: 'social_youtube', value: '', group: 'social' },
    { key: 'analytics_id', value: '', group: 'analytics' },
    { key: 'maintenance_mode', value: 'false', group: 'system' },
    // Destination settings
    { key: 'dest_global_name', value: 'Shop Worldwide', group: 'destinations' },
    { key: 'dest_global_heading', value: 'Shop Worldwide', group: 'destinations' },
    { key: 'dest_global_desc', value: 'One smart link takes you to the Amazon store available in your region.', group: 'destinations' },
    { key: 'dest_global_cta', value: 'Explore Global Options', group: 'destinations' },
    { key: 'dest_india_name', value: 'Shop in India', group: 'destinations' },
    { key: 'dest_india_heading', value: 'Shop in India', group: 'destinations' },
    { key: 'dest_india_desc', value: 'Explore local availability and pricing through our India shopping experience.', group: 'destinations' },
    { key: 'dest_india_cta', value: 'Explore India', group: 'destinations' },
    { key: 'dest_section_heading', value: 'Choose Your Shopping Destination', group: 'destinations' },
    { key: 'dest_section_desc', value: 'Pick the shopping experience that works best for you.', group: 'destinations' },
    { key: 'dest_disclaimer', value: 'Prices, availability and regional selection may vary.', group: 'destinations' },
  ];
  const stmt = db.prepare('INSERT INTO site_settings (key, value, group_name) VALUES (?, ?, ?)');
  for (const s of settings) stmt.run(s.key, s.value, s.group);
}

export function seedHeroSlides() {
  const db = getDb();
  if ((db.prepare('SELECT COUNT(*) as cnt FROM hero_slides').get() as any).cnt > 0) return;

  const slides = [
    { eyebrow: 'CURATED THIS SEASON', headline: 'Everyday Finds, Better Chosen', description: 'Discover useful pieces for work, home and everything in between.', primary_cta_label: 'Explore the Collection', primary_cta_url: '/products', secondary_cta_label: 'Browse New Finds', secondary_cta_url: '/collections', bg: '#f0eff5', layout: 'text-left' },
    { eyebrow: 'STYLE EDIT', headline: 'Easy Pieces Worth Repeating', description: 'Practical fashion picks designed for everyday wardrobes.', primary_cta_label: 'Explore Fashion', primary_cta_url: '/category/fashion', secondary_cta_label: '', secondary_cta_url: '', bg: '#f5f0eb', layout: 'text-left' },
    { eyebrow: 'HOME EDIT', headline: 'Small Changes. A Better Home.', description: 'Thoughtful upgrades for spaces that feel more like you.', primary_cta_label: 'Explore Home', primary_cta_url: '/category/home', secondary_cta_label: '', secondary_cta_url: '', bg: '#eef2eb', layout: 'text-left' },
    { eyebrow: 'TRAVEL EDIT', headline: 'Pack Better. Travel Lighter.', description: 'Smart essentials for weekends away and longer journeys.', primary_cta_label: 'Explore Travel', primary_cta_url: '/category/travel', secondary_cta_label: '', secondary_cta_url: '', bg: '#ebe9f0', layout: 'text-left' },
    { eyebrow: 'BEAUTY PICKS', headline: 'Simple Additions, Better Routines', description: 'Curated beauty essentials worth making room for.', primary_cta_label: 'Explore Beauty', primary_cta_url: '/category/beauty', secondary_cta_label: '', secondary_cta_url: '', bg: '#f5eeee', layout: 'text-left' },
    { eyebrow: 'SMART LIVING', headline: 'Useful Tech Without the Noise', description: 'Practical gadgets and everyday upgrades selected with purpose.', primary_cta_label: 'Explore Tech', primary_cta_url: '/category/electronics', secondary_cta_label: '', secondary_cta_url: '', bg: '#edf0f5', layout: 'text-left' },
  ];

  const s = db.prepare(`INSERT INTO hero_slides (id, eyebrow, headline, description, primary_cta_label, primary_cta_url, secondary_cta_label, secondary_cta_url, background_color, layout, status, sort_order) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'published', ?)`);
  slides.forEach((sl, i) => s.run(uuid(), sl.eyebrow, sl.headline, sl.description, sl.primary_cta_label, sl.primary_cta_url, sl.secondary_cta_label, sl.secondary_cta_url, sl.bg, sl.layout, i));

  // Hero settings
  const hs = db.prepare("INSERT OR IGNORE INTO hero_settings (key, value) VALUES (?, ?)");
  hs.run('autoplay', 'true');
  hs.run('interval', '5000');
  hs.run('transition', 'fade');
  hs.run('transition_duration', '500');
}

export function seedArticleCategories() {
  const db = getDb();
  if ((db.prepare('SELECT COUNT(*) as cnt FROM article_categories').get() as any).cnt > 0) return;
  const cats = ['Buying Guides', 'Product Reviews', 'Comparisons', 'How To', 'Trends', 'Ideas', 'Inspiration'];
  const stmt = db.prepare('INSERT INTO article_categories (id, name, slug) VALUES (?, ?, ?)');
  for (const c of cats) stmt.run(uuid(), c, c.toLowerCase().replace(/\s+/g, '-'));
}

export function seedPages() {
  const db = getDb();
  if ((db.prepare('SELECT COUNT(*) as cnt FROM pages').get() as any).cnt > 0) return;
  const pages = [
    { slug: 'affiliate-disclosure', title: 'Affiliate Disclosure', content: '<p><strong>As an Amazon Associate I earn from qualifying purchases.</strong></p><h2>How We Fund This Site</h2><p>Alaya Insider is reader-supported. When you purchase through links on our site, we may earn an affiliate commission at no additional cost to you.</p><p>This commission helps us maintain and improve the site, research products, and continue providing editorial recommendations.</p><h3>Our Editorial Independence</h3><p>Affiliate relationships do not influence our editorial decisions. We recommend products based on research, testing when possible, and editorial judgment — not commission rates.</p><h3>How Affiliate Links Work</h3><p>When you click a product link on our site and make a purchase, the retailer may pay us a small commission. The price you pay remains the same whether you use our link or not.</p><p>We clearly label affiliate links and include disclosures on pages where affiliate links appear.</p>' },
    { slug: 'privacy-policy', title: 'Privacy Policy', content: '<h2>Privacy Policy</h2><p>This privacy policy describes how Alaya Insider collects, uses, and protects your information.</p><p>This is a template. Please review and customize with legal counsel before launching.</p>' },
    { slug: 'terms', title: 'Terms of Service', content: '<h2>Terms of Service</h2><p>By using Alaya Insider, you agree to these terms.</p><p>This is a template. Please review and customize with legal counsel before launching.</p>' },
    { slug: 'cookie-policy', title: 'Cookie Policy', content: '<h2>Cookie Policy</h2><p>We use cookies to improve your experience on our site.</p><p>This is a template. Please review and customize with legal counsel before launching.</p>' },
  ];
  const stmt = db.prepare('INSERT INTO pages (id, slug, title, content) VALUES (?, ?, ?, ?)');
  for (const p of pages) stmt.run(uuid(), p.slug, p.title, p.content);
}
