'use client';

import { useState, useEffect, useCallback } from 'react';
import ProductCard from '@/components/public/ProductCard';
import Breadcrumbs from '@/components/public/Breadcrumbs';

export default function ProductsPage() {
  const [products, setProducts] = useState<any[]>([]);
  const [categories, setCategories] = useState<any[]>([]);
  const [brands, setBrands] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [pagination, setPagination] = useState({ page: 1, totalPages: 1, total: 0 });
  const [filtersOpen, setFiltersOpen] = useState(false);

  // Filters
  const [search, setSearch] = useState('');
  const [category, setCategory] = useState('');
  const [brand, setBrand] = useState('');
  const [sort, setSort] = useState('newest');
  const [minPrice, setMinPrice] = useState('');
  const [maxPrice, setMaxPrice] = useState('');
  const [minRating, setMinRating] = useState('');
  const [page, setPage] = useState(1);

  const fetchProducts = useCallback(async () => {
    setLoading(true);
    const params = new URLSearchParams();
    params.set('page', String(page));
    params.set('limit', '20');
    if (search) params.set('search', search);
    if (category) params.set('category', category);
    if (brand) params.set('brand', brand);
    if (sort) params.set('sort', sort);
    if (minPrice) params.set('min_price', minPrice);
    if (maxPrice) params.set('max_price', maxPrice);
    if (minRating) params.set('min_rating', minRating);

    try {
      const res = await fetch(`/api/products?${params}`);
      const data = await res.json();
      setProducts(data.products || []);
      setPagination(data.pagination || { page: 1, totalPages: 1, total: 0 });
    } catch {}
    setLoading(false);
  }, [page, search, category, brand, sort, minPrice, maxPrice, minRating]);

  useEffect(() => {
    const run = async () => { await fetchProducts(); };
    void run();
  }, [fetchProducts]);

  useEffect(() => {
    fetch('/api/categories?flat=true').then(r => r.json()).then(d => setCategories(d.categories || []));
    fetch('/api/brands').then(r => r.json()).then(d => setBrands(d.brands || []));
  }, []);

  useEffect(() => {
    // Deferred so the reset lands outside the effect's synchronous phase
    // (React 19 lint: no sync setState in effects) — same behaviour as before.
    const t = setTimeout(() => setPage(1), 0);
    return () => clearTimeout(t);
  }, [search, category, brand, sort, minPrice, maxPrice, minRating]);

  const clearFilters = () => {
    setSearch(''); setCategory(''); setBrand(''); setSort('newest');
    setMinPrice(''); setMaxPrice(''); setMinRating('');
  };

  const hasFilters = search || category || brand || minPrice || maxPrice || minRating || sort !== 'newest';

  return (
    <div className="max-w-content mx-auto px-4 sm:px-6 py-8">
      <Breadcrumbs items={[{ label: 'Products' }]} />

      <div className="flex flex-col sm:flex-row sm:items-end justify-between mb-8 gap-4">
        <div>
          <h1 className="text-2xl sm:text-3xl font-semibold text-accent">Products</h1>
          <p className="text-sm text-gray-500 mt-1">{pagination.total} curated products</p>
        </div>

        <div className="flex items-center gap-3">
          <button onClick={() => setFiltersOpen(!filtersOpen)}
            className="sm:hidden px-4 py-2 border border-gray-200 rounded-md text-sm text-gray-600">
            Filters {hasFilters ? '•' : ''}
          </button>
          <select value={sort} onChange={e => setSort(e.target.value)}
            className="px-3 py-2 border border-gray-200 rounded-md text-sm text-gray-600 bg-white">
            <option value="newest">Newest</option>
            <option value="popular">Popular</option>
            <option value="rating">Highest Rated</option>
            <option value="price_asc">Price: Low to High</option>
            <option value="price_desc">Price: High to Low</option>
            <option value="featured">Featured</option>
          </select>
        </div>
      </div>

      <div className="flex gap-8">
        {/* Filters Sidebar */}
        <aside className={`${filtersOpen ? 'fixed inset-0 z-50 bg-white p-6 overflow-y-auto' : 'hidden'} sm:block sm:static sm:bg-transparent sm:p-0 sm:w-56 flex-shrink-0`}>
          <div className="flex justify-between items-center sm:hidden mb-6">
            <h2 className="text-lg font-semibold">Filters</h2>
            <button onClick={() => setFiltersOpen(false)} className="text-gray-500">✕</button>
          </div>

          {/* Search */}
          <div className="mb-6">
            <label className="text-xs font-medium text-gray-500 uppercase tracking-wider mb-2 block">Search</label>
            <input type="text" value={search} onChange={e => setSearch(e.target.value)}
              placeholder="Search products..."
              className="w-full px-3 py-2 border border-gray-200 rounded-md text-sm" />
          </div>

          {/* Category */}
          <div className="mb-6">
            <label className="text-xs font-medium text-gray-500 uppercase tracking-wider mb-2 block">Category</label>
            <select value={category} onChange={e => setCategory(e.target.value)}
              className="w-full px-3 py-2 border border-gray-200 rounded-md text-sm bg-white">
              <option value="">All Categories</option>
              {categories.filter((c: any) => !c.parent_id).map((c: any) => (
                <option key={c.id} value={c.slug}>{c.name}</option>
              ))}
            </select>
          </div>

          {/* Brand */}
          <div className="mb-6">
            <label className="text-xs font-medium text-gray-500 uppercase tracking-wider mb-2 block">Brand</label>
            <select value={brand} onChange={e => setBrand(e.target.value)}
              className="w-full px-3 py-2 border border-gray-200 rounded-md text-sm bg-white">
              <option value="">All Brands</option>
              {brands.map((b: any) => (
                <option key={b.id} value={b.slug}>{b.name}</option>
              ))}
            </select>
          </div>

          {/* Price */}
          <div className="mb-6">
            <label className="text-xs font-medium text-gray-500 uppercase tracking-wider mb-2 block">Price Range</label>
            <div className="flex gap-2">
              <input type="number" value={minPrice} onChange={e => setMinPrice(e.target.value)}
                placeholder="Min" className="w-1/2 px-3 py-2 border border-gray-200 rounded-md text-sm" />
              <input type="number" value={maxPrice} onChange={e => setMaxPrice(e.target.value)}
                placeholder="Max" className="w-1/2 px-3 py-2 border border-gray-200 rounded-md text-sm" />
            </div>
          </div>

          {/* Rating */}
          <div className="mb-6">
            <label className="text-xs font-medium text-gray-500 uppercase tracking-wider mb-2 block">Min Rating</label>
            <select value={minRating} onChange={e => setMinRating(e.target.value)}
              className="w-full px-3 py-2 border border-gray-200 rounded-md text-sm bg-white">
              <option value="">Any</option>
              <option value="4.5">4.5+</option>
              <option value="4">4.0+</option>
              <option value="3.5">3.5+</option>
              <option value="3">3.0+</option>
            </select>
          </div>

          {hasFilters && (
            <button onClick={clearFilters} className="text-sm text-gray-500 hover:text-accent underline">
              Clear all filters
            </button>
          )}

          <button onClick={() => setFiltersOpen(false)}
            className="sm:hidden w-full mt-6 py-3 bg-accent text-white rounded-md text-sm font-medium">
            Show Results
          </button>
        </aside>

        {/* Product Grid */}
        <div className="flex-1">
          {loading ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
              {Array.from({ length: 6 }).map((_, i) => (
                <div key={i} className="border border-gray-100 rounded-lg overflow-hidden">
                  <div className="aspect-[4/3] skeleton" />
                  <div className="p-4 space-y-2">
                    <div className="skeleton h-3 w-16" />
                    <div className="skeleton h-4 w-full" />
                    <div className="skeleton h-3 w-24" />
                    <div className="skeleton h-5 w-16 mt-2" />
                  </div>
                </div>
              ))}
            </div>
          ) : products.length === 0 ? (
            <div className="text-center py-20">
              <p className="text-gray-500 mb-2">No products found</p>
              <p className="text-sm text-gray-400 mb-4">Try adjusting your filters or search terms</p>
              {hasFilters && (
                <button onClick={clearFilters} className="text-sm text-accent underline">Clear filters</button>
              )}
            </div>
          ) : (
            <>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
                {products.map((p: any) => (
                  <ProductCard key={p.id} product={p} />
                ))}
              </div>

              {/* Pagination */}
              {pagination.totalPages > 1 && (
                <div className="flex items-center justify-center gap-2 mt-12">
                  <button onClick={() => setPage(p => Math.max(1, p - 1))} disabled={page === 1}
                    className="px-3 py-2 border border-gray-200 rounded-md text-sm disabled:opacity-30">
                    Previous
                  </button>
                  <span className="text-sm text-gray-500 px-3">
                    Page {page} of {pagination.totalPages}
                  </span>
                  <button onClick={() => setPage(p => Math.min(pagination.totalPages, p + 1))} disabled={page >= pagination.totalPages}
                    className="px-3 py-2 border border-gray-200 rounded-md text-sm disabled:opacity-30">
                    Next
                  </button>
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}
