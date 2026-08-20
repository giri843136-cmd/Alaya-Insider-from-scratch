import Link from 'next/link';
import { ensureDbReady } from '@/lib/init';
import getDb from '@/lib/db';
import ProductCard from '@/components/public/ProductCard';
import NewsletterBox from '@/components/public/NewsletterBox';

export const dynamic = 'force-dynamic';

function getHomeData() {
  ensureDbReady();
  const db = getDb();
  const sections = db.prepare('SELECT * FROM homepage_sections ORDER BY sort_order').all() as any[];
  const sMap: Record<string, any> = {};
  sections.forEach(s => { sMap[s.section_key] = { ...s, content: JSON.parse(s.content || '{}') }; });

  const featuredCats = db.prepare(`SELECT c.*, (SELECT COUNT(*) FROM products p WHERE p.category_id = c.id AND p.status = 'published' AND p.deleted_at IS NULL) as product_count FROM categories c WHERE c.parent_id IS NULL AND c.is_featured = 1 ORDER BY c.sort_order LIMIT 6`).all();
  const trending = db.prepare(`SELECT p.*, b.name as brand_name, b.slug as brand_slug, c.name as category_name FROM products p LEFT JOIN brands b ON p.brand_id = b.id LEFT JOIN categories c ON p.category_id = c.id WHERE p.is_trending = 1 AND p.status = 'published' AND p.deleted_at IS NULL ORDER BY p.created_at DESC LIMIT 8`).all();
  const editorsPicks = db.prepare(`SELECT p.*, b.name as brand_name, b.slug as brand_slug, c.name as category_name FROM products p LEFT JOIN brands b ON p.brand_id = b.id LEFT JOIN categories c ON p.category_id = c.id WHERE p.is_editors_pick = 1 AND p.status = 'published' AND p.deleted_at IS NULL ORDER BY p.created_at DESC LIMIT 4`).all();
  const popular = db.prepare(`SELECT p.*, b.name as brand_name, b.slug as brand_slug, c.name as category_name FROM products p LEFT JOIN brands b ON p.brand_id = b.id LEFT JOIN categories c ON p.category_id = c.id WHERE p.status = 'published' AND p.deleted_at IS NULL ORDER BY p.click_count DESC LIMIT 4`).all();
  const articles = db.prepare(`SELECT a.*, ac.name as category_name, u.first_name || ' ' || u.last_name as author_name FROM articles a LEFT JOIN article_categories ac ON a.category_id = ac.id LEFT JOIN users u ON a.author_id = u.id WHERE a.status = 'published' AND a.deleted_at IS NULL ORDER BY a.published_at DESC LIMIT 3`).all();
  const collections = db.prepare(`SELECT c.*, (SELECT COUNT(*) FROM collection_products cp WHERE cp.collection_id = c.id) as product_count FROM collections c WHERE c.is_active = 1 ORDER BY c.sort_order LIMIT 3`).all();
  const disclosure = (db.prepare("SELECT value FROM site_settings WHERE key = 'affiliate_disclosure'").get() as any)?.value || '';

  return { sMap, featuredCats, trending, editorsPicks, popular, articles, collections, disclosure };
}

export default function HomePage() {
  const { sMap, featuredCats, trending, editorsPicks, popular, articles, collections, disclosure } = getHomeData();
  const hero = sMap['hero'];
  const hc = hero?.content || {};
  const destSec = sMap['destinations'];
  const dc = destSec?.content || {};

  return (
    <div>
      {/* Announcement */}
      {sMap['announcement']?.is_visible === 1 && (
        <div className="bg-ivory text-center py-2 px-4 border-b border-ivory-dark">
          <p className="text-xs text-warm">{sMap['announcement'].title}</p>
        </div>
      )}

      {/* Hero */}
      {hero?.is_visible === 1 && (
        <section className="bg-ivory">
          <div className="max-w-content mx-auto px-4 sm:px-6 py-16 sm:py-24">
            <div className="max-w-2xl">
              <h1 className="text-3xl sm:text-5xl font-semibold text-accent leading-tight mb-4">{hero.title}</h1>
              <p className="text-gray-500 text-base sm:text-lg mb-8 max-w-xl leading-relaxed">{hc.subtitle}</p>
              <div className="flex flex-col sm:flex-row gap-3">
                <Link href={hc.primary_cta_link || '/products'}
                  className="px-8 py-3 bg-accent text-white text-sm font-medium rounded-lg hover:bg-accent-light transition-colors text-center">
                  {hc.primary_cta || 'Explore the Collection'}
                </Link>
                <Link href={hc.secondary_cta_link || '/journal'}
                  className="px-8 py-3 border border-gray-300 text-gray-600 text-sm font-medium rounded-lg hover:border-accent hover:text-accent transition-colors text-center">
                  {hc.secondary_cta || 'Read Our Guides'}
                </Link>
              </div>
            </div>
          </div>
        </section>
      )}

      {/* Categories */}
      {sMap['featured_categories']?.is_visible === 1 && (featuredCats as any[]).length > 0 && (
        <section className="py-14 px-4">
          <div className="max-w-content mx-auto">
            <h2 className="text-xl font-semibold text-accent mb-6">{sMap['featured_categories'].title}</h2>
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-6 gap-3">
              {(featuredCats as any[]).map(c => (
                <Link key={c.id} href={`/category/${c.slug}`}
                  className="group bg-ivory rounded-lg p-5 text-center hover:shadow-md transition-all border border-transparent hover:border-gray-200">
                  <h3 className="text-sm font-medium text-accent group-hover:text-plum transition-colors">{c.name}</h3>
                  <p className="text-[11px] text-gray-400 mt-1">{c.product_count} items</p>
                </Link>
              ))}
            </div>
          </div>
        </section>
      )}

      {/* Trending */}
      {sMap['trending']?.is_visible === 1 && (trending as any[]).length > 0 && (
        <section className="py-14 px-4 bg-white">
          <div className="max-w-content mx-auto">
            <div className="flex items-end justify-between mb-6">
              <div>
                <h2 className="text-xl font-semibold text-accent">{sMap['trending'].title}</h2>
                <p className="text-sm text-gray-400 mt-1">{sMap['trending'].content?.subtitle}</p>
              </div>
              <Link href="/products?sort=popular" className="text-sm text-warm hover:text-accent transition-colors hidden sm:block">View all →</Link>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
              {(trending as any[]).slice(0, 4).map(p => <ProductCard key={p.id} product={p} />)}
            </div>
          </div>
        </section>
      )}

      {/* Editor's Picks */}
      {sMap['editors_picks']?.is_visible === 1 && (editorsPicks as any[]).length > 0 && (
        <section className="py-14 px-4 bg-ivory">
          <div className="max-w-content mx-auto">
            <div className="flex items-end justify-between mb-6">
              <div>
                <h2 className="text-xl font-semibold text-accent">{sMap['editors_picks']?.title || "Editor's Picks"}</h2>
                <p className="text-sm text-gray-400 mt-1">{sMap['editors_picks']?.content?.subtitle}</p>
              </div>
              <Link href="/products?editors_pick=true" className="text-sm text-warm hover:text-accent transition-colors hidden sm:block">View all →</Link>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
              {(editorsPicks as any[]).map(p => <ProductCard key={p.id} product={p} />)}
            </div>
          </div>
        </section>
      )}

      {/* Collections */}
      {sMap['collections']?.is_visible === 1 && (collections as any[]).length > 0 && (
        <section className="py-14 px-4">
          <div className="max-w-content mx-auto">
            <h2 className="text-xl font-semibold text-accent mb-2">{sMap['collections'].title}</h2>
            <p className="text-sm text-gray-400 mb-6">{sMap['collections'].content?.subtitle}</p>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-5">
              {(collections as any[]).map(c => (
                <Link key={c.id} href={`/collections/${c.slug}`}
                  className="group bg-ivory rounded-lg p-6 border border-transparent hover:border-gray-200 hover:shadow-md transition-all">
                  <h3 className="text-base font-semibold text-accent group-hover:text-plum">{c.name}</h3>
                  <p className="text-sm text-gray-500 mt-2 line-clamp-2">{c.description}</p>
                  <span className="text-xs text-warm mt-3 inline-block">{c.product_count} products →</span>
                </Link>
              ))}
            </div>
          </div>
        </section>
      )}

      {/* Guides */}
      {sMap['guides']?.is_visible === 1 && (articles as any[]).length > 0 && (
        <section className="py-14 px-4 bg-ivory">
          <div className="max-w-content mx-auto">
            <div className="flex items-end justify-between mb-6">
              <div>
                <h2 className="text-xl font-semibold text-accent">{sMap['guides'].title}</h2>
                <p className="text-sm text-gray-400 mt-1">{sMap['guides'].content?.subtitle}</p>
              </div>
              <Link href="/journal" className="text-sm text-warm hover:text-accent transition-colors hidden sm:block">All guides →</Link>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-6">
              {(articles as any[]).map(a => (
                <Link key={a.id} href={`/journal/${a.slug}`} className="group block bg-white rounded-lg overflow-hidden border border-gray-100 hover:shadow-md transition-all">
                  <div className="aspect-[16/9] bg-gray-100">{a.featured_image && <img src={a.featured_image} alt={a.title} className="w-full h-full object-cover" loading="lazy" />}</div>
                  <div className="p-4">
                    {a.category_name && <p className="text-[11px] font-medium text-warm uppercase tracking-wider mb-1">{a.category_name}</p>}
                    <h3 className="text-sm font-medium text-gray-800 group-hover:text-accent line-clamp-2 mb-1">{a.title}</h3>
                    <p className="text-xs text-gray-400">{a.reading_time} min read</p>
                  </div>
                </Link>
              ))}
            </div>
          </div>
        </section>
      )}

      {/* Shopping Destinations */}
      {destSec?.is_visible === 1 && (
        <section className="py-14 px-4">
          <div className="max-w-content mx-auto">
            <div className="text-center mb-8">
              <h2 className="text-xl font-semibold text-accent">{destSec.title}</h2>
              <p className="text-sm text-gray-500 mt-1">{dc.subtitle}</p>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-5 max-w-2xl mx-auto">
              <div className="rounded-xl border border-accent/15 bg-accent/[0.02] p-6">
                <div className="w-9 h-9 rounded-full bg-accent/5 flex items-center justify-center mb-3">
                  <svg className="w-5 h-5 text-accent/50" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M3.055 11H5a2 2 0 012 2v1a2 2 0 002 2 2 2 0 012 2v2.945M8 3.935V5.5A2.5 2.5 0 0010.5 8h.5a2 2 0 012 2 2 2 0 104 0 2 2 0 012-2h1.064M15 20.488V18a2 2 0 012-2h3.064M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                </div>
                <span className="text-[10px] font-semibold text-accent/40 uppercase tracking-wider">Global</span>
                <h3 className="text-base font-semibold text-accent mt-1">{dc.global_heading || 'Shop Worldwide'}</h3>
                <p className="text-xs text-gray-500 mt-1">{dc.global_desc || 'One smart link. Your regional Amazon destination.'}</p>
                <Link href="/products" className="mt-4 inline-block px-5 py-2 bg-accent text-white text-sm rounded-lg hover:bg-accent-light transition-colors">
                  {dc.global_cta || 'Explore Global Options'}
                </Link>
              </div>
              <div className="rounded-xl border border-gray-200 p-6">
                <div className="w-9 h-9 rounded-full bg-sage/10 flex items-center justify-center mb-3">
                  <svg className="w-5 h-5 text-sage" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" /></svg>
                </div>
                <span className="text-[10px] font-semibold text-sage uppercase tracking-wider">India</span>
                <h3 className="text-base font-semibold text-accent mt-1">{dc.india_heading || 'Shop in India'}</h3>
                <p className="text-xs text-gray-500 mt-1">{dc.india_desc || 'Local availability and pricing for India.'}</p>
                <Link href="/products" className="mt-4 inline-block px-5 py-2 border border-accent text-accent text-sm rounded-lg hover:bg-accent hover:text-white transition-colors">
                  {dc.india_cta || 'Explore India'}
                </Link>
              </div>
            </div>
          </div>
        </section>
      )}

      {/* Newsletter */}
      {sMap['newsletter']?.is_visible === 1 && (
        <section className="py-14 px-4 bg-accent">
          <div className="max-w-content mx-auto">
            <NewsletterBox title={sMap['newsletter'].title} subtitle={sMap['newsletter'].content?.subtitle}
              ctaText={sMap['newsletter'].content?.cta_text || 'Join Free'} source="homepage" dark />
          </div>
        </section>
      )}

      {/* Disclosure */}
      {disclosure && (
        <div className="py-5 px-4 text-center">
          <p className="text-[11px] text-gray-400 max-w-2xl mx-auto">{disclosure} <Link href="/affiliate-disclosure" className="underline">Learn more</Link>.</p>
        </div>
      )}
    </div>
  );
}
