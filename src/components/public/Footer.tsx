import Link from 'next/link';

export default function Footer() {
  return (
    <footer className="bg-accent text-white/70 mt-20">
      <div className="max-w-content mx-auto px-4 sm:px-6 py-14">
        <div className="grid grid-cols-2 md:grid-cols-5 gap-8 mb-12">
          <div className="col-span-2 md:col-span-1">
            <span className="text-white font-semibold text-sm tracking-wide">ALAYA INSIDER</span>
            <p className="text-xs text-white/40 mt-2 leading-relaxed">Everyday finds, better chosen. Curated products worth discovering.</p>
          </div>
          <div>
            <h4 className="text-xs font-semibold text-white/50 uppercase tracking-wider mb-3">Shop</h4>
            <ul className="space-y-2">
              <li><Link href="/products" className="text-xs hover:text-white transition-colors">All Products</Link></li>
              <li><Link href="/collections" className="text-xs hover:text-white transition-colors">Collections</Link></li>
              <li><Link href="/brands" className="text-xs hover:text-white transition-colors">Brands</Link></li>
              <li><Link href="/categories" className="text-xs hover:text-white transition-colors">Categories</Link></li>
            </ul>
          </div>
          <div>
            <h4 className="text-xs font-semibold text-white/50 uppercase tracking-wider mb-3">Discover</h4>
            <ul className="space-y-2">
              <li><Link href="/journal" className="text-xs hover:text-white transition-colors">Guides</Link></li>
              <li><Link href="/category/fashion" className="text-xs hover:text-white transition-colors">Fashion</Link></li>
              <li><Link href="/category/home" className="text-xs hover:text-white transition-colors">Home</Link></li>
              <li><Link href="/category/electronics" className="text-xs hover:text-white transition-colors">Electronics</Link></li>
            </ul>
          </div>
          <div>
            <h4 className="text-xs font-semibold text-white/50 uppercase tracking-wider mb-3">Company</h4>
            <ul className="space-y-2">
              <li><Link href="/about" className="text-xs hover:text-white transition-colors">About</Link></li>
              <li><Link href="/contact" className="text-xs hover:text-white transition-colors">Contact</Link></li>
              <li><Link href="/affiliate-disclosure" className="text-xs hover:text-white transition-colors">Affiliate Disclosure</Link></li>
            </ul>
          </div>
          <div>
            <h4 className="text-xs font-semibold text-white/50 uppercase tracking-wider mb-3">Legal</h4>
            <ul className="space-y-2">
              <li><Link href="/privacy-policy" className="text-xs hover:text-white transition-colors">Privacy</Link></li>
              <li><Link href="/terms" className="text-xs hover:text-white transition-colors">Terms</Link></li>
              <li><Link href="/cookie-policy" className="text-xs hover:text-white transition-colors">Cookies</Link></li>
            </ul>
          </div>
        </div>
        <div className="pt-6 border-t border-white/10 flex flex-col sm:flex-row justify-between items-center gap-3">
          <p className="text-[11px] text-white/30">© {new Date().getFullYear()} Alaya Insider. All rights reserved.</p>
          <p className="text-[11px] text-white/30">We may earn commissions from affiliate links. <Link href="/affiliate-disclosure" className="underline hover:text-white/50">Learn more</Link>.</p>
        </div>
      </div>
    </footer>
  );
}
