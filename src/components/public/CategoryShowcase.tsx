import Link from 'next/link';
import styles from './CategoryShowcase.module.css';

interface Subcategory {
  id: string;
  name: string;
  slug: string;
  description: string;
  image: string;
}

interface Category {
  id: string;
  name: string;
  slug: string;
  description: string;
  image: string;
  children: Subcategory[];
}

interface Props {
  categories: Category[];
  sectionTitle?: string;
  sectionSubtitle?: string;
}

/* 
 * Layout variants for visual variety.
 * Each main category gets a different composition
 * to prevent the page from looking repetitive.
 */
const LAYOUTS = [
  'hero-left',      // Fashion: large image left, subs right
  'hero-right',     // Home: subs left, large image right
  'hero-top',       // Beauty: hero image spanning top, subs below
  'hero-left',      // Electronics: large image left, subs right (reversed palette)
  'hero-wide',      // Travel: wide hero image, horizontal sub row
  'hero-right',     // Lifestyle: subs left, hero right
] as const;

function SubcategoryTile({ sub, parentSlug }: { sub: Subcategory; parentSlug: string }) {
  return (
    <Link
      href={`/category/${parentSlug}/${sub.slug}`}
      className={styles.subTile}
    >
      <div className={styles.subTileImage}>
        {sub.image ? (
          <img src={sub.image} alt={sub.name} loading="lazy" />
        ) : (
          <div className={styles.subTilePlaceholder}>
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1} strokeLinecap="round" strokeLinejoin="round">
              <rect x="3" y="3" width="18" height="18" rx="2" />
              <circle cx="8.5" cy="8.5" r="1.5" />
              <path d="M21 15l-5-5L5 21" />
            </svg>
          </div>
        )}
      </div>
      <div className={styles.subTileLabel}>
        <span className={styles.subTileName}>{sub.name}</span>
        <svg className={styles.subTileArrow} width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
          <path d="M5 12h14M12 5l7 7-7 7" />
        </svg>
      </div>
    </Link>
  );
}

function CategoryHeroImage({ category }: { category: Category }) {
  return (
    <Link href={`/category/${category.slug}`} className={styles.heroImage}>
      {category.image ? (
        <img src={category.image} alt={category.name} loading="lazy" />
      ) : (
        <div className={styles.heroImagePlaceholder}>
          <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={0.8} strokeLinecap="round" strokeLinejoin="round">
            <rect x="3" y="3" width="18" height="18" rx="2" />
            <circle cx="8.5" cy="8.5" r="1.5" />
            <path d="M21 15l-5-5L5 21" />
          </svg>
          <span>{category.name}</span>
        </div>
      )}
    </Link>
  );
}

function CategoryBlock({ category, layoutIndex }: { category: Category; layoutIndex: number }) {
  const layout = LAYOUTS[layoutIndex % LAYOUTS.length];
  const subs = category.children.slice(0, 7); // max 7 visible subcategories

  return (
    <section className={styles.categoryBlock}>
      {/* Header */}
      <div className={styles.categoryHeader}>
        <div>
          <h3 className={styles.categoryName}>{category.name}</h3>
          {category.description && (
            <p className={styles.categoryDesc}>{category.description}</p>
          )}
        </div>
        <Link href={`/category/${category.slug}`} className={styles.categoryExplore}>
          Explore {category.name}
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
            <path d="M5 12h14M12 5l7 7-7 7" />
          </svg>
        </Link>
      </div>

      {/* Content — layout-specific composition */}
      <div className={`${styles.categoryContent} ${styles[`layout_${layout.replace('-', '_')}`] || ''}`}>
        {(layout === 'hero-left' || layout === 'hero-right') && (
          <>
            <div className={styles.heroColumn}>
              <CategoryHeroImage category={category} />
            </div>
            <div className={styles.subsGrid}>
              {subs.map(sub => (
                <SubcategoryTile key={sub.id} sub={sub} parentSlug={category.slug} />
              ))}
            </div>
          </>
        )}

        {layout === 'hero-top' && (
          <>
            <div className={styles.heroWide}>
              <CategoryHeroImage category={category} />
            </div>
            <div className={styles.subsRow}>
              {subs.map(sub => (
                <SubcategoryTile key={sub.id} sub={sub} parentSlug={category.slug} />
              ))}
            </div>
          </>
        )}

        {layout === 'hero-wide' && (
          <>
            <div className={styles.heroWide}>
              <CategoryHeroImage category={category} />
            </div>
            <div className={styles.subsRowScroll}>
              {subs.map(sub => (
                <SubcategoryTile key={sub.id} sub={sub} parentSlug={category.slug} />
              ))}
            </div>
          </>
        )}
      </div>
    </section>
  );
}

export default function CategoryShowcase({ categories, sectionTitle, sectionSubtitle }: Props) {
  if (!categories || categories.length === 0) return null;

  return (
    <div className={styles.showcase}>
      {(sectionTitle || sectionSubtitle) && (
        <div className={styles.sectionHeader}>
          {sectionTitle && <h2 className={styles.sectionTitle}>{sectionTitle}</h2>}
          {sectionSubtitle && <p className={styles.sectionSubtitle}>{sectionSubtitle}</p>}
        </div>
      )}
      <div className={styles.categoryList}>
        {categories.map((cat, i) => (
          <CategoryBlock key={cat.id} category={cat} layoutIndex={i} />
        ))}
      </div>
    </div>
  );
}
