import Link from 'next/link';
import { ensureDbReady } from '@/lib/init';
import getDb from '@/lib/db';
import ProductCard from '@/components/public/ProductCard';
import NewsletterBox from '@/components/public/NewsletterBox';
import HeroCarousel from '@/components/public/HeroCarousel';
import CategoryShowcase from '@/components/public/CategoryShowcase';

export const dynamic = 'force-dynamic';

function getHomeData() {
  ensureDbReady();
  const db = getDb();
  const sections = db.prepare('SELECT * FROM homepage_sections ORDER BY sort_order').all() as any[];
  const sMap: Record<string, any> = {};
  sections.forEach(s => { sMap[s.section_key] = { ...s, content: JSON.parse(s.content || '{}') }; });

  // Fetch main featured categories with their subcategories
  const mainCats = db.prepare(`SELECT c.id, c.name, c.slug, c.description, c.image FROM categories c WHERE c.parent_id IS NULL AND c.is_featured = 1 ORDER BY c.sort_order LIMIT 6`).all() as any[];
  const allSubs = db.prepare(`SELECT id, name, slug, description, image, parent_id, sort_order FROM categories WHERE parent_id IS NOT NULL ORDER BY sort_order`).all() as any[];
  const subsByParent = new Map<string, any[]>();
  allSubs.forEach((s: any) => {
    const arr = subsByParent.get(s.parent_id) || [];
    arr.push(s);
    subsByParent.set(s.parent_id, arr);
  });
  const featuredCats = mainCats.map((c: any) => ({ ...c, children: subsByParent.get(c.id) || [] }));
  const trending = db.prepare(`SELECT p.*, b.name as brand_name, b.slug as brand_slug, c.name as category_name FROM products p LEFT JOIN brands b ON p.brand_id = b.id LEFT JOIN categories c ON p.category_id = c.id WHERE p.is_trending = 1 AND p.status = 'published' AND p.deleted_at IS NULL ORDER BY p.created_at DESC LIMIT 8`).all();
  const editorsPicks = db.prepare(`SELECT p.*, b.name as brand_name, b.slug as brand_slug, c.name as category_name FROM products p LEFT JOIN brands b ON p.brand_id = b.id LEFT JOIN categories c ON p.category_id = c.id WHERE p.is_editors_pick = 1 AND p.status = 'published' AND p.deleted_at IS NULL ORDER BY p.created_at DESC LIMIT 4`).all();
  const popular = db.prepare(`SELECT p.*, b.name as brand_name, b.slug as brand_slug, c.name as category_name FROM products p LEFT JOIN brands b ON p.brand_id = b.id LEFT JOIN categories c ON p.category_id = c.id WHERE p.status = 'published' AND p.deleted_at IS NULL ORDER BY p.click_count DESC LIMIT 4`).all();
  const articles = db.prepare(`SELECT a.*, ac.name as category_name, u.first_name || ' ' || u.last_name as author_name FROM articles a LEFT JOIN article_categories ac ON a.category_id = ac.id LEFT JOIN users u ON a.author_id = u.id WHERE a.status = 'published' AND a.deleted_at IS NULL ORDER BY a.published_at DESC LIMIT 3`).all();
  const collections = db.prepare(`SELECT c.*, (SELECT COUNT(*) FROM collection_products cp WHERE cp.collection_id = c.id) as product_count FROM collections c WHERE c.is_active = 1 ORDER BY c.sort_order LIMIT 3`).all();
  const disclosure = (db.prepare("SELECT value FROM site_settings WHERE key = 'affiliate_disclosure'").get() as any)?.value || '';

  // Hero slides
  const heroSlides = db.prepare(`SELECT * FROM hero_slides WHERE status = 'published'
    AND (start_date IS NULL OR start_date <= datetime('now'))
    AND (end_date IS NULL OR end_date >= datetime('now'))
    ORDER BY sort_order ASC`).all();
  const heroSettings: Record<string, string> = {};
  (db.prepare('SELECT * FROM hero_settings').all() as any[]).forEach((s: any) => { heroSettings[s.key] = s.value; });

  return { sMap, featuredCats, trending, editorsPicks, popular, articles, collections, disclosure, heroSlides, heroSettings };
}

export default function HomePage() {
  const { sMap, featuredCats, trending, editorsPicks, popular, articles, collections, disclosure, heroSlides, heroSettings } = getHomeData();

  return (
    <div>
      {/* Announcement */}
      {sMap['announcement']?.is_visible === 1 && (
        <div className="bg-ivory text-center py-2 px-4 border-b border-ivory-dark">
          <p className="text-xs text-warm">{sMap['announcement'].title}</p>
        </div>
      )}

      {/* Hero Carousel */}
      {(heroSlides as any[]).length > 0 && (
        <section className="max-w-content mx-auto">
          <HeroCarousel
            slides={heroSlides as any[]}
            autoplay={heroSettings.autoplay !== 'false'}
            interval={parseInt(heroSettings.interval || '5000')}
            transition={heroSettings.transition || 'fade'}
            transitionDuration={parseInt(heroSettings.transition_duration || '500')}
          />
        </section>
      )}

      {/* Categories — Premium visual merchandising showcase */}
      {sMap['featured_categories']?.is_visible === 1 && (featuredCats as any[]).length > 0 && (
        <section className="py-14 px-4">
          <div className="max-w-content mx-auto">
            <CategoryShowcase
              categories={featuredCats as any[]}
              sectionTitle={sMap['featured_categories'].title}
              sectionSubtitle={sMap['featured_categories'].content?.subtitle || 'Explore curated finds across the spaces, styles and essentials that matter most.'}
            />
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
