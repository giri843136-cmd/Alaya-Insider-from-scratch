import Link from 'next/link';
import Breadcrumbs from '@/components/public/Breadcrumbs';

export const metadata = { title: 'About — Alaya Insider' };

export default function AboutPage() {
  return (
    <div className="max-w-narrow mx-auto px-4 sm:px-6 py-8">
      <Breadcrumbs items={[{ label: 'About' }]} />

      <h1 className="text-3xl font-semibold text-accent mb-6">About Alaya Insider</h1>

      <div className="article-content">
        <h2>What We Do</h2>
        <p>Alaya Insider is an independent editorial platform that curates and recommends products across home, fashion, beauty, electronics, and more. We research, compare, and present products that we believe offer genuine value.</p>

        <h2>How We Select Products</h2>
        <p>Our editorial team evaluates products based on quality, design, value, user reviews, and practical usefulness. We focus on finding products that genuinely improve daily life rather than chasing trends or deals.</p>
        <p>We look at real user feedback, consider long-term durability, assess value relative to price, and prioritize products from brands with good track records.</p>

        <h2>Our Editorial Philosophy</h2>
        <p>We believe in honest, practical recommendations. We highlight what we genuinely like about products, but also share limitations and what to be aware of before buying.</p>
        <p>Every product page includes a &ldquo;Why We Recommend It&rdquo; section that explains our reasoning, along with clear pros and cons.</p>

        <h2>How We Make Money</h2>
        <p>Alaya Insider is reader-supported. When you purchase products through our affiliate links, we may earn a commission at no additional cost to you. This helps us maintain the platform and continue providing recommendations.</p>
        <p>Affiliate relationships do not influence our editorial choices. We recommend products based on merit, not commission rates.</p>
        <p>Read our full <Link href="/affiliate-disclosure">Affiliate Disclosure</Link> for more details.</p>

        <h2>Our Commitment</h2>
        <p>We are committed to transparency, accuracy, and usefulness. If a product is no longer available or our recommendation changes, we update our content accordingly.</p>
        <p>We do not fabricate reviews, inflate ratings, or create false urgency. The information on our site reflects our genuine editorial judgment.</p>
      </div>
    </div>
  );
}
