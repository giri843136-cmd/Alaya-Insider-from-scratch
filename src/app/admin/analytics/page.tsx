'use client';
import { adminFetch } from '@/lib/admin-auth-context';
import { useState, useEffect } from 'react';

export default function AdminAnalytics() {
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    adminFetch('/api/analytics').then(r => r.json()).then(d => { setData(d); setLoading(false); });
  }, []);

  if (loading) return <div className="text-gray-400 text-sm">Loading analytics...</div>;

  const stats = data?.stats || {};

  return (
    <div>
      <h1 className="text-xl font-semibold text-gray-800 mb-6">Analytics</h1>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        {[
          { label: 'Total Clicks', value: stats.totalClicks },
          { label: 'Clicks Today', value: stats.clicksToday },
          { label: 'This Week', value: stats.clicksWeek },
          { label: 'This Month', value: stats.clicksMonth },
        ].map((s, i) => (
          <div key={i} className="bg-white rounded-lg border border-gray-100 p-5">
            <p className="text-xs text-gray-400 uppercase tracking-wider mb-1">{s.label}</p>
            <p className="text-2xl font-semibold text-gray-800">{s.value ?? 0}</p>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Clicks by Day */}
        <div className="bg-white rounded-lg border border-gray-100 p-5">
          <h2 className="text-sm font-semibold text-gray-700 mb-4">Clicks (Last 30 Days)</h2>
          {data?.clicksByDay?.length ? (
            <div className="space-y-1">
              {data.clicksByDay.slice(-14).map((d: any) => (
                <div key={d.date} className="flex items-center gap-3 text-sm">
                  <span className="w-24 text-gray-400 text-xs">{d.date}</span>
                  <div className="flex-1 bg-gray-100 rounded-full h-4 overflow-hidden">
                    <div className="bg-accent h-full rounded-full" style={{ width: `${Math.min(100, (d.clicks / Math.max(...data.clicksByDay.map((x: any) => x.clicks))) * 100)}%` }} />
                  </div>
                  <span className="text-xs text-gray-500 w-8 text-right">{d.clicks}</span>
                </div>
              ))}
            </div>
          ) : <p className="text-sm text-gray-400">No click data yet</p>}
        </div>

        {/* Top Products */}
        <div className="bg-white rounded-lg border border-gray-100 p-5">
          <h2 className="text-sm font-semibold text-gray-700 mb-4">Top Products by Clicks</h2>
          {data?.topProducts?.length ? (
            <div className="space-y-3">
              {data.topProducts.slice(0, 10).map((p: any, i: number) => (
                <div key={i} className="flex items-center justify-between text-sm">
                  <span className="text-gray-700">{p.name}</span>
                  <span className="text-xs text-gray-400">{p.click_count}</span>
                </div>
              ))}
            </div>
          ) : <p className="text-sm text-gray-400">No data yet</p>}
        </div>

        {/* Top Searches */}
        <div className="bg-white rounded-lg border border-gray-100 p-5">
          <h2 className="text-sm font-semibold text-gray-700 mb-4">Top Search Terms</h2>
          {data?.topSearches?.length ? (
            <div className="space-y-2">
              {data.topSearches.map((s: any, i: number) => (
                <div key={i} className="flex items-center justify-between text-sm">
                  <span className="text-gray-700">&ldquo;{s.query}&rdquo;</span>
                  <span className="text-xs text-gray-400">{s.count} searches</span>
                </div>
              ))}
            </div>
          ) : <p className="text-sm text-gray-400">No searches yet</p>}
        </div>

        {/* Top Categories */}
        <div className="bg-white rounded-lg border border-gray-100 p-5">
          <h2 className="text-sm font-semibold text-gray-700 mb-4">Top Categories</h2>
          {data?.topCategories?.length ? (
            <div className="space-y-2">
              {data.topCategories.map((c: any, i: number) => (
                <div key={i} className="flex items-center justify-between text-sm">
                  <span className="text-gray-700">{c.name}</span>
                  <span className="text-xs text-gray-400">{c.product_count} products</span>
                </div>
              ))}
            </div>
          ) : <p className="text-sm text-gray-400">No data yet</p>}
        </div>
      </div>
    </div>
  );
}
