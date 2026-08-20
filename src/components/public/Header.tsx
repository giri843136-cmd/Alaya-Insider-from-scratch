'use client';
import Link from 'next/link';
import { useState, useEffect, useRef } from 'react';

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
    }, 300);
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
      <div className="bg-accent text-white">
        <div className="max-w-content mx-auto px-4 sm:px-6 flex items-center justify-between h-11">
          <Link href="/" className="text-sm font-semibold tracking-wide">ALAYA INSIDER</Link>
          <div className="hidden md:flex items-center flex-1 mx-8 max-w-lg">
            <div className="relative w-full">
              <input type="text" placeholder="Search products, brands, guides..."
                value={searchQuery} onChange={e => { handleSearch(e.target.value); setSearchOpen(true); }}
                onFocus={() => setSearchOpen(true)}
                className="w-full px-4 py-1.5 rounded-full bg-white/10 border border-white/20 text-sm text-white placeholder-white/50 focus:outline-none focus:bg-white/15 focus:border-white/30" />
              <svg className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-white/50" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
              </svg>
            </div>
          </div>
          <div className="flex items-center gap-4">
            <button onClick={() => { setSearchOpen(!searchOpen); setSearchQuery(''); setSearchResults(null); }}
              className="md:hidden p-1.5 text-white/70 hover:text-white" aria-label="Search">
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" /></svg>
            </button>
            <Link href="/about" className="hidden sm:block text-xs text-white/60 hover:text-white">About</Link>
            <Link href="/contact" className="hidden sm:block text-xs text-white/60 hover:text-white">Contact</Link>
          </div>
        </div>
      </div>

      {/* Navigation */}
      <div className="bg-white border-b border-gray-100 shadow-sm">
        <div className="max-w-content mx-auto px-4 sm:px-6 flex items-center justify-between h-11">
          <nav className="hidden md:flex items-center gap-6">
            {navLinks.map(l => (
              <Link key={l.href} href={l.href} className="text-[13px] text-gray-600 hover:text-accent transition-colors">{l.label}</Link>
            ))}
          </nav>
          <button onClick={() => setMobileOpen(!mobileOpen)} className="md:hidden p-1.5 text-gray-500" aria-label="Menu">
            {mobileOpen ? (
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M6 18L18 6M6 6l12 12" /></svg>
            ) : (
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4 6h16M4 12h16M4 18h16" /></svg>
            )}
          </button>
          <div className="flex items-center gap-4 md:hidden">
            <Link href="/" className="text-sm font-semibold text-accent">ALAYA</Link>
          </div>
        </div>
      </div>

      {/* Search dropdown */}
      {searchOpen && searchResults && (
        <div ref={searchRef} className="absolute left-0 right-0 top-[88px] bg-white border-b border-gray-200 shadow-lg z-50 md:left-auto md:right-auto md:mx-auto md:max-w-lg md:rounded-b-lg md:top-[44px] md:relative">
          <div className="max-w-content mx-auto p-4 max-h-80 overflow-y-auto">
            {searchResults.products?.length > 0 && (
              <div className="mb-3">
                <p className="text-xs font-medium text-gray-400 uppercase mb-2">Products</p>
                {searchResults.products.map((p: any) => (
                  <Link key={p.id} href={`/product/${p.slug}`} onClick={() => setSearchOpen(false)}
                    className="flex items-center gap-3 py-2 hover:bg-gray-50 rounded px-2">
                    <div className="w-8 h-8 bg-gray-100 rounded flex-shrink-0" />
                    <div><p className="text-sm text-gray-800 line-clamp-1">{p.name}</p><p className="text-xs text-gray-400">{p.brand_name} · ${p.current_price}</p></div>
                  </Link>
                ))}
              </div>
            )}
            {searchResults.articles?.length > 0 && (
              <div><p className="text-xs font-medium text-gray-400 uppercase mb-2">Guides</p>
                {searchResults.articles.map((a: any) => (
                  <Link key={a.id} href={`/journal/${a.slug}`} onClick={() => setSearchOpen(false)}
                    className="block py-2 hover:bg-gray-50 rounded px-2 text-sm text-gray-700">{a.title}</Link>
                ))}
              </div>
            )}
            {!searchResults.products?.length && !searchResults.articles?.length && <p className="text-sm text-gray-400 py-4 text-center">No results found</p>}
          </div>
        </div>
      )}

      {/* Mobile menu */}
      {mobileOpen && (
        <div className="md:hidden fixed inset-0 top-[88px] bg-white z-40 overflow-y-auto">
          <div className="px-4 py-3 border-b border-gray-100">
            <input type="text" placeholder="Search..." value={searchQuery}
              onChange={e => handleSearch(e.target.value)}
              className="w-full px-4 py-2.5 border border-gray-200 rounded-lg text-sm" />
          </div>
          <nav className="px-6 py-4 space-y-1">
            {navLinks.map(l => (
              <Link key={l.href} href={l.href} onClick={() => setMobileOpen(false)}
                className="block py-3 text-base text-gray-700 hover:text-accent border-b border-gray-50">{l.label}</Link>
            ))}
            <Link href="/about" onClick={() => setMobileOpen(false)} className="block py-3 text-base text-gray-500">About</Link>
            <Link href="/contact" onClick={() => setMobileOpen(false)} className="block py-3 text-base text-gray-500">Contact</Link>
          </nav>
        </div>
      )}
    </header>
  );
}
