'use client';
import { adminFetch } from '@/lib/admin-auth-context';

import { useState, useEffect } from 'react';
import Link from 'next/link';

export default function AdminDashboard() {
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    adminFetch('/api/analytics')
      .then(r => r.json())
      .then(d => { setData(d); setLoading(false); })
      .catch(() => setLoading(false));
  }, []);

  if (loading) {
    return (
      <div className="space-y-6">
        <h1 className="text-xl font-semibold text-gray-800">Dashboard</h1>
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          {Array.from({ length: 8 }).map((_, i) => (
            <div key={i} className="bg-white rounded-lg border border-gray-100 p-5">
              <div className="skeleton h-3 w-20 mb-3" />
              <div className="skeleton h-7 w-12" />
            </div>
          ))}
        </div>
      </div>
    );
  }

  const stats = data?.stats || {};

  return (
    <div className="space-y-8">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-semibold text-gray-800">Dashboard</h1>
        <Link href="/admin/products/new" className="px-4 py-2 bg-accent text-white text-sm rounded-md hover:bg-accent-light transition-colors">
          Add Product
        </Link>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {[
          { label: 'Total Products', value: stats.totalProducts },
          { label: 'Active Products', value: stats.activeProducts },
          { label: 'Total Articles', value: stats.totalArticles },
          { label: 'Subscribers', value: stats.subscribers },
          { label: 'Clicks Today', value: stats.clicksToday },
          { label: 'Clicks This Week', value: stats.clicksWeek },
          { label: 'Global Clicks', value: stats.globalClicks },
          { label: 'India Clicks', value: stats.indiaClicks },
        ].map((s, i) => (
          <div key={i} className="bg-white rounded-lg border border-gray-100 p-5">
            <p className="text-xs text-gray-400 uppercase tracking-wider mb-1">{s.label}</p>
            <p className="text-2xl font-semibold text-gray-800">{s.value ?? 0}</p>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Top Products */}
        <div className="bg-white rounded-lg border border-gray-100 p-5">
          <h2 className="text-sm font-semibold text-gray-700 mb-4">Top Products</h2>
          {data?.topProducts?.length ? (
            <div className="space-y-3">
              {data.topProducts.slice(0, 5).map((p: any, i: number) => (
                <div key={i} className="flex items-center justify-between text-sm">
                  <div>
                    <Link href={`/admin/products/${p.slug}`} className="text-gray-800 hover:text-accent">
                      {p.name}
                    </Link>
                    <p className="text-xs text-gray-400">{p.brand_name}</p>
                  </div>
                  <span className="text-xs text-gray-500 bg-gray-50 px-2 py-1 rounded">{p.click_count} clicks</span>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-sm text-gray-400">No data yet</p>
          )}
        </div>

        {/* Recent Activity */}
        <div className="bg-white rounded-lg border border-gray-100 p-5">
          <h2 className="text-sm font-semibold text-gray-700 mb-4">Recent Activity</h2>
          {data?.recentActivity?.length ? (
            <div className="space-y-3">
              {data.recentActivity.slice(0, 5).map((a: any, i: number) => (
                <div key={i} className="text-sm">
                  <p className="text-gray-700">{a.details || `${a.action} ${a.entity_type}`}</p>
                  <p className="text-xs text-gray-400">{a.username} · {new Date(a.created_at).toLocaleString()}</p>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-sm text-gray-400">No recent activity</p>
          )}
        </div>

        {/* Top Searches */}
        <div className="bg-white rounded-lg border border-gray-100 p-5">
          <h2 className="text-sm font-semibold text-gray-700 mb-4">Top Searches</h2>
          {data?.topSearches?.length ? (
            <div className="space-y-2">
              {data.topSearches.map((s: any, i: number) => (
                <div key={i} className="flex items-center justify-between text-sm">
                  <span className="text-gray-700">{s.query}</span>
                  <span className="text-xs text-gray-400">{s.count}</span>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-sm text-gray-400">No searches yet</p>
          )}
        </div>

        {/* Quick Actions */}
        <div className="bg-white rounded-lg border border-gray-100 p-5">
          <h2 className="text-sm font-semibold text-gray-700 mb-4">Quick Actions</h2>
          <div className="grid grid-cols-2 gap-2">
            {[
              { label: 'Add Product', href: '/admin/products/new' },
              { label: 'New Article', href: '/admin/articles/new' },
              { label: 'View Products', href: '/admin/products' },
              { label: 'Homepage', href: '/admin/homepage' },
              { label: 'Subscribers', href: '/admin/newsletter' },
              { label: 'Settings', href: '/admin/settings' },
            ].map(a => (
              <Link key={a.href} href={a.href}
                className="text-sm px-3 py-2 border border-gray-100 rounded-md text-gray-600 hover:border-accent hover:text-accent transition-colors text-center">
                {a.label}
              </Link>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
