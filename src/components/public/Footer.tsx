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
        <div className="pt-8 border-t border-white/[0.06]">
          <div className="flex flex-col sm:flex-row justify-between items-center gap-4">
            <p className="text-[11px] text-white/25">© {new Date().getFullYear()} Alaya Insider</p>
            <div className="flex items-center gap-5">
              <a href="https://instagram.com/alayainsider" target="_blank" rel="noopener noreferrer" className="text-white/30 hover:text-white transition-colors" aria-label="Instagram">
                <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24"><path d="M12 2.163c3.204 0 3.584.012 4.85.07 3.252.148 4.771 1.691 4.919 4.919.058 1.265.069 1.645.069 4.849 0 3.205-.012 3.584-.069 4.849-.149 3.225-1.664 4.771-4.919 4.919-1.266.058-1.644.07-4.85.07-3.204 0-3.584-.012-4.849-.07-3.26-.149-4.771-1.699-4.919-4.92-.058-1.265-.07-1.644-.07-4.849 0-3.204.013-3.583.07-4.849.149-3.227 1.664-4.771 4.919-4.919 1.266-.057 1.645-.069 4.849-.069zm0-2.163c-3.259 0-3.667.014-4.947.072-4.358.2-6.78 2.618-6.98 6.98-.059 1.281-.073 1.689-.073 4.948 0 3.259.014 3.668.072 4.948.2 4.358 2.618 6.78 6.98 6.98 1.281.058 1.689.072 4.948.072 3.259 0 3.668-.014 4.948-.072 4.354-.2 6.782-2.618 6.979-6.98.059-1.28.073-1.689.073-4.948 0-3.259-.014-3.667-.072-4.947-.196-4.354-2.617-6.78-6.979-6.98-1.281-.059-1.69-.073-4.949-.073zm0 5.838c-3.403 0-6.162 2.759-6.162 6.162s2.759 6.163 6.162 6.163 6.162-2.759 6.162-6.163c0-3.403-2.759-6.162-6.162-6.162zm0 10.162c-2.209 0-4-1.79-4-4 0-2.209 1.791-4 4-4s4 1.791 4 4c0 2.21-1.791 4-4 4zm6.406-11.845c-.796 0-1.441.645-1.441 1.44s.645 1.44 1.441 1.44c.795 0 1.439-.645 1.439-1.44s-.644-1.44-1.439-1.44z"/></svg>
              </a>
              <a href="https://pinterest.com/alayainsider" target="_blank" rel="noopener noreferrer" className="text-white/30 hover:text-white transition-colors" aria-label="Pinterest">
                <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24"><path d="M12.017 0C5.396 0 .029 5.367.029 11.987c0 5.079 3.158 9.417 7.618 11.162-.105-.949-.199-2.403.041-3.439.219-.937 1.406-5.957 1.406-5.957s-.359-.72-.359-1.781c0-1.668.967-2.914 2.171-2.914 1.023 0 1.518.769 1.518 1.69 0 1.029-.655 2.568-.994 3.995-.283 1.194.599 2.169 1.777 2.169 2.133 0 3.772-2.249 3.772-5.495 0-2.873-2.064-4.882-5.012-4.882-3.414 0-5.418 2.561-5.418 5.207 0 1.031.397 2.138.893 2.738a.36.36 0 01.083.345l-.333 1.36c-.053.22-.174.267-.402.161-1.499-.698-2.436-2.889-2.436-4.649 0-3.785 2.75-7.262 7.929-7.262 4.163 0 7.398 2.967 7.398 6.931 0 4.136-2.607 7.464-6.227 7.464-1.216 0-2.359-.631-2.75-1.378l-.748 2.853c-.271 1.043-1.002 2.35-1.492 3.146C9.57 23.812 10.763 24 12.017 24c6.624 0 11.99-5.367 11.99-11.988C24.007 5.367 18.641 0 12.017 0z"/></svg>
              </a>
              <a href="https://twitter.com/alayainsider" target="_blank" rel="noopener noreferrer" className="text-white/30 hover:text-white transition-colors" aria-label="Twitter">
                <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24"><path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z"/></svg>
              </a>
            </div>
            <p className="text-[11px] text-white/25">We may earn commissions from affiliate links. <Link href="/affiliate-disclosure" className="underline hover:text-white/40">Learn more</Link></p>
          </div>
        </div>
      </div>
    </footer>
  );
}
