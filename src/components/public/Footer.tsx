import Link from 'next/link';

export default function Footer() {
  return (
    <footer className="bg-accent text-white/60 mt-24">
      <div className="max-w-content mx-auto px-4 sm:px-6 py-16">
        <div className="grid grid-cols-2 md:grid-cols-5 gap-10 mb-14">
          <div className="col-span-2 md:col-span-1 pr-4">
            <span className="text-white font-semibold text-[13px] tracking-[0.06em]">ALAYA INSIDER</span>
            <p className="text-[12px] text-white/30 mt-3 leading-relaxed max-w-[200px]">Curated products worth discovering. Honest recommendations for everyday life.</p>
          </div>
          {[
            { title: 'Shop', links: [
              { href: '/products', label: 'All Products' },
              { href: '/collections', label: 'Collections' },
              { href: '/brands', label: 'Brands' },
              { href: '/categories', label: 'Categories' },
            ]},
            { title: 'Discover', links: [
              { href: '/journal', label: 'Guides' },
              { href: '/category/fashion', label: 'Fashion' },
              { href: '/category/home', label: 'Home' },
              { href: '/category/electronics', label: 'Electronics' },
            ]},
            { title: 'Company', links: [
              { href: '/about', label: 'About' },
              { href: '/contact', label: 'Contact' },
              { href: '/affiliate-disclosure', label: 'Affiliate Disclosure' },
            ]},
            { title: 'Legal', links: [
              { href: '/privacy-policy', label: 'Privacy' },
              { href: '/terms', label: 'Terms' },
              { href: '/cookie-policy', label: 'Cookies' },
            ]},
          ].map(col => (
            <div key={col.title}>
              <h4 className="text-[10px] font-semibold text-white/40 uppercase tracking-[0.12em] mb-4">{col.title}</h4>
              <ul className="space-y-2.5">
                {col.links.map(l => (
                  <li key={l.href}><Link href={l.href} className="text-[12px] text-white/50 hover:text-white transition-colors">{l.label}</Link></li>
                ))}
              </ul>
            </div>
          ))}
        </div>
        <div className="pt-8 border-t border-white/[0.06] flex flex-col sm:flex-row justify-between items-center gap-4">
          <p className="text-[11px] text-white/25">© {new Date().getFullYear()} Alaya Insider</p>
          <p className="text-[11px] text-white/25">We may earn commissions from affiliate links. <Link href="/affiliate-disclosure" className="underline hover:text-white/40">Learn more</Link></p>
        </div>
      </div>
    </footer>
  );
}
