'use client';
import Link from 'next/link';
import { useState, useEffect, useRef } from 'react';
import { formatLiveAmount } from '@/lib/price-format';

const priceText = (p: any) => (p.live_price != null && p.live_price > 0 ? formatLiveAmount(p.live_price, p.live_currency) : 'Check price on Amazon');

export default function Header() {
  const [mobileOpen, setMobileOpen] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<any>(null);
  const searchRef = useRef<HTMLDivElement>(null);
  const searchTimeout = useRef<any>(null);

  useEffect(() => {
    const h = (e: MouseEvent) => { if (searchRef.current && !searchRef.current.contains(e.target as Node)) setSearchOpen(false); };
    document.addEventListener('mousedown', h); return () => document.removeEventListener('mousedown', h);
  }, []);
  useEffect(() => { document.body.style.overflow = mobileOpen ? 'hidden' : ''; }, [mobileOpen]);

  const handleSearch = (q: string) => {
    setSearchQuery(q);
    if (searchTimeout.current) clearTimeout(searchTimeout.current);
    if (q.length < 2) { setSearchResults(null); return; }
    searchTimeout.current = setTimeout(async () => {
      try { const r = await fetch(`/api/search?q=${encodeURIComponent(q)}`); setSearchResults(await r.json()); } catch {}
    }, 250);
  };

  const navLinks = [
    { href: '/products', label: 'Shop All' },
    { href: '/category/fashion', label: 'Fashion' },
    { href: '/category/home', label: 'Home' },
    { href: '/category/beauty', label: 'Beauty' },
    { href: '/category/electronics', label: 'Electronics' },
    { href: '/category/travel', label: 'Travel' },
    { href: '/journal', label: 'Guides' },
    { href: '/collections', label: 'Collections' },
  ];

  return (
    <header className="sticky top-0 z-50">
      {/* Utility Bar */}
      <div className="bg-accent">
        <div className="max-w-content mx-auto px-4 sm:px-6 flex items-center justify-between h-12">
          <Link href="/" className="text-[13px] font-semibold tracking-[0.08em] text-white hover:text-white/90">
            ALAYA INSIDER
          </Link>
          <div className="hidden md:flex items-center flex-1 mx-10 max-w-md">
            <div className="relative w-full" ref={searchRef}>
              <input type="text" placeholder="Search products, brands, guides..."
                value={searchQuery} onChange={e => { handleSearch(e.target.value); setSearchOpen(true); }}
                onFocus={() => setSearchOpen(true)}
                className="w-full pl-4 pr-10 py-[7px] rounded-full bg-white/[0.08] border border-white/[0.12] text-[13px] text-white placeholder-white/40 focus:outline-none focus:bg-white/[0.12] focus:border-white/25 transition-colors" />
              <svg className="absolute right-3.5 top-1/2 -translate-y-1/2 w-[15px] h-[15px] text-white/40" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
              </svg>

              {/* Search results dropdown */}
              {searchOpen && searchResults && (
                <div className="absolute top-full mt-2 left-0 right-0 bg-white rounded-lg shadow-lg border border-gray-100 overflow-hidden z-50">
                  <div className="max-h-80 overflow-y-auto p-3">
                    {searchResults.products?.length > 0 && (
                      <div className="mb-3">
                        <p className="text-[10px] font-semibold text-gray-400 uppercase tracking-wider mb-2 px-2">Products</p>
                        {searchResults.products.map((p: any) => (
                          <Link key={p.id} href={`/product/${p.slug}`} onClick={() => setSearchOpen(false)}
                            className="flex items-center gap-3 py-2 px-2 hover:bg-gray-50 rounded-md">
                            <div className="w-9 h-9 bg-ivory rounded flex-shrink-0" />
                            <div><p className="text-[13px] text-gray-800 line-clamp-1">{p.name}</p><p className="text-[11px] text-gray-400">{p.brand_name} · {priceText(p)}</p></div>
                          </Link>
                        ))}
                      </div>
                    )}
                    {searchResults.articles?.length > 0 && (
                      <div><p className="text-[10px] font-semibold text-gray-400 uppercase tracking-wider mb-2 px-2">Guides</p>
                        {searchResults.articles.map((a: any) => (
                          <Link key={a.id} href={`/journal/${a.slug}`} onClick={() => setSearchOpen(false)}
                            className="block py-2 px-2 hover:bg-gray-50 rounded-md text-[13px] text-gray-700">{a.title}</Link>
                        ))}
                      </div>
                    )}
                    {!searchResults.products?.length && !searchResults.articles?.length && (
                      <p className="text-[13px] text-gray-400 py-6 text-center">No results found</p>
                    )}
                  </div>
                </div>
              )}
            </div>
          </div>
          <div className="flex items-center gap-5">
            <button onClick={() => { setSearchOpen(!searchOpen); setSearchQuery(''); setSearchResults(null); }}
              className="md:hidden p-1.5 text-white/60 hover:text-white" aria-label="Search">
              <svg className="w-[18px] h-[18px]" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" /></svg>
            </button>
            <Link href="/about" className="hidden sm:block text-[11px] text-white/50 hover:text-white/80 transition-colors">About</Link>
            <Link href="/contact" className="hidden sm:block text-[11px] text-white/50 hover:text-white/80 transition-colors">Contact</Link>
          </div>
        </div>
      </div>

      {/* Navigation */}
      <nav className="bg-white border-b border-gray-100">
        <div className="max-w-content mx-auto px-4 sm:px-6 flex items-center justify-between h-11">
          <div className="hidden md:flex items-center gap-7">
            {navLinks.map(l => (
              <Link key={l.href} href={l.href} className="text-[13px] text-gray-500 hover:text-accent transition-colors font-medium">{l.label}</Link>
            ))}
          </div>
          <button onClick={() => setMobileOpen(!mobileOpen)} className="md:hidden p-1.5 -ml-1 text-gray-500 hover:text-accent" aria-label="Menu">
            {mobileOpen ? (
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M6 18L18 6M6 6l12 12" /></svg>
            ) : (
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4 6h16M4 12h16M4 18h16" /></svg>
            )}
          </button>
          <div className="md:hidden" />
        </div>
      </nav>

      {/* Mobile menu */}
      {mobileOpen && (
        <div className="md:hidden fixed inset-0 top-[92px] bg-white z-40 overflow-y-auto">
          <div className="px-4 py-3 border-b border-gray-100">
            <input type="text" placeholder="Search..." value={searchQuery}
              onChange={e => handleSearch(e.target.value)}
              className="w-full px-4 py-2.5 border border-gray-200 rounded-lg text-sm focus:outline-none focus:border-accent" />
          </div>
          <nav className="px-5 py-4">
            {navLinks.map(l => (
              <Link key={l.href} href={l.href} onClick={() => setMobileOpen(false)}
                className="block py-3.5 text-[15px] text-gray-700 hover:text-accent border-b border-gray-50 font-medium">{l.label}</Link>
            ))}
            <Link href="/about" onClick={() => setMobileOpen(false)} className="block py-3.5 text-[15px] text-gray-400">About</Link>
            <Link href="/contact" onClick={() => setMobileOpen(false)} className="block py-3.5 text-[15px] text-gray-400">Contact</Link>
          </nav>
        </div>
      )}
    </header>
  );
}
