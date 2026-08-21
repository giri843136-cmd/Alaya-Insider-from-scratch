import { MetadataRoute } from 'next';
import { ensureDbReady } from '@/lib/init';
import getDb from '@/lib/db';

export const dynamic = 'force-dynamic';

export default function sitemap(): MetadataRoute.Sitemap {
  ensureDbReady();
  const db = getDb();
  const baseUrl = process.env.NEXT_PUBLIC_SITE_URL || 'https://alayainsider.com';

  const entries: MetadataRoute.Sitemap = [
    { url: baseUrl, changeFrequency: 'daily', priority: 1 },
    { url: `${baseUrl}/products`, changeFrequency: 'daily', priority: 0.9 },
    { url: `${baseUrl}/categories`, changeFrequency: 'weekly', priority: 0.8 },
    { url: `${baseUrl}/journal`, changeFrequency: 'daily', priority: 0.8 },
    { url: `${baseUrl}/collections`, changeFrequency: 'weekly', priority: 0.7 },
    { url: `${baseUrl}/brands`, changeFrequency: 'weekly', priority: 0.7 },
    { url: `${baseUrl}/about`, changeFrequency: 'monthly', priority: 0.5 },
    { url: `${baseUrl}/contact`, changeFrequency: 'monthly', priority: 0.4 },
    { url: `${baseUrl}/affiliate-disclosure`, changeFrequency: 'monthly', priority: 0.3 },
    { url: `${baseUrl}/privacy-policy`, changeFrequency: 'monthly', priority: 0.3 },
    { url: `${baseUrl}/terms`, changeFrequency: 'monthly', priority: 0.3 },
  ];

  // Products
  const products = db.prepare("SELECT slug, updated_at FROM products WHERE status = 'published' AND deleted_at IS NULL").all() as any[];
  products.forEach(p => {
    entries.push({
      url: `${baseUrl}/product/${p.slug}`,
      lastModified: p.updated_at,
      changeFrequency: 'weekly',
      priority: 0.8,
    });
  });

  // Categories
  const categories = db.prepare('SELECT slug, updated_at FROM categories').all() as any[];
  categories.forEach(c => {
    entries.push({
      url: `${baseUrl}/category/${c.slug}`,
      lastModified: c.updated_at,
      changeFrequency: 'weekly',
      priority: 0.7,
    });
  });

  // Articles
  const articles = db.prepare("SELECT slug, updated_at FROM articles WHERE status = 'published' AND deleted_at IS NULL").all() as any[];
  articles.forEach(a => {
    entries.push({
      url: `${baseUrl}/journal/${a.slug}`,
      lastModified: a.updated_at,
      changeFrequency: 'weekly',
      priority: 0.7,
    });
  });

  // Collections
  const collections = db.prepare('SELECT slug, updated_at FROM collections WHERE is_active = 1').all() as any[];
  collections.forEach(c => {
    entries.push({
      url: `${baseUrl}/collections/${c.slug}`,
      changeFrequency: 'weekly',
      priority: 0.6,
    });
  });

  return entries;
}
