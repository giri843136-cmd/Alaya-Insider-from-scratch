'use client';

import { Suspense, useState, useEffect } from 'react';
import { useSearchParams } from 'next/navigation';
import Link from 'next/link';
import Breadcrumbs from '@/components/public/Breadcrumbs';
import ProductCard from '@/components/public/ProductCard';

function SearchContent() {
  const searchParams = useSearchParams();
  const initialQ = searchParams.get('q') || '';
  const [query, setQuery] = useState(initialQ);
  const [results, setResults] = useState<any>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (query.length >= 2) {
      setLoading(true);
      fetch(`/api/search?q=${encodeURIComponent(query)}`)
        .then(r => r.json())
        .then(d => { setResults(d); setLoading(false); })
        .catch(() => setLoading(false));
    }
  }, [query]);

  return (
    <div className="max-w-content mx-auto px-4 sm:px-6 py-8">
      <Breadcrumbs items={[{ label: 'Search' }]} />
      <h1 className="text-2xl font-semibold text-accent mb-6">Search</h1>

      <input type="text" value={query} onChange={e => setQuery(e.target.value)}
        placeholder="Search products, guides, categories..." autoFocus
        className="w-full max-w-lg px-4 py-3 border border-gray-200 rounded-md text-base focus:outline-none focus:border-accent mb-8" />

      {loading && <p className="text-gray-500">Searching...</p>}

      {results && !loading && (
        <div>
          {results.products?.length > 0 && (
            <div className="mb-12">
              <h2 className="text-lg font-semibold text-accent mb-4">Products</h2>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
                {results.products.map((p: any) => (
                  <ProductCard key={p.id} product={p} />
                ))}
              </div>
            </div>
          )}
          {results.articles?.length > 0 && (
            <div className="mb-12">
              <h2 className="text-lg font-semibold text-accent mb-4">Articles</h2>
              {results.articles.map((a: any) => (
                <Link key={a.id} href={`/journal/${a.slug}`} className="block py-3 border-b border-gray-100 hover:bg-gray-50 px-2 rounded">
                  <h3 className="text-sm font-medium text-gray-800">{a.title}</h3>
                  {a.excerpt && <p className="text-sm text-gray-500 mt-1 line-clamp-1">{a.excerpt}</p>}
                </Link>
              ))}
            </div>
          )}
          {results.categories?.length > 0 && (
            <div className="mb-12">
              <h2 className="text-lg font-semibold text-accent mb-4">Categories</h2>
              <div className="flex flex-wrap gap-2">
                {results.categories.map((c: any) => (
                  <Link key={c.id} href={`/category/${c.slug}`}
                    className="px-4 py-2 border border-gray-100 rounded-md text-sm text-gray-600 hover:border-accent hover:text-accent">
                    {c.name}
                  </Link>
                ))}
              </div>
            </div>
          )}
          {!results.products?.length && !results.articles?.length && !results.categories?.length && query.length >= 2 && (
            <div className="text-center py-12">
              <p className="text-gray-500 mb-2">No results found for &ldquo;{query}&rdquo;</p>
              <p className="text-sm text-gray-400">Try different keywords or browse our categories</p>
              <Link href="/categories" className="text-sm text-accent underline mt-4 inline-block">Browse Categories</Link>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

export default function SearchPage() {
  return (
    <Suspense fallback={<div className="max-w-content mx-auto px-4 py-8"><p className="text-gray-400">Loading search...</p></div>}>
      <SearchContent />
    </Suspense>
  );
}
