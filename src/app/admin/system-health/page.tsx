'use client';
import { adminFetch } from '@/lib/admin-auth-context';
import { useState, useEffect } from 'react';

const statusColor = (s: string) => {
  if (s === 'healthy' || s === 'connected' || s === 'active' || s === 'running' || s === 'configured') return 'bg-green-500';
  if (s === 'error') return 'bg-red-500';
  if (s === 'not_configured') return 'bg-yellow-500';
  return 'bg-gray-400';
};
const statusLabel = (s: string) => {
  if (s === 'healthy' || s === 'connected' || s === 'active' || s === 'running' || s === 'configured') return s.charAt(0).toUpperCase() + s.slice(1);
  if (s === 'not_configured') return 'Not Configured';
  if (s === 'error') return 'Error';
  return s;
};

export default function AdminSystemHealth() {
  const [h, setH] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    adminFetch('/api/system-health').then(r => r.json()).then(d => { setH(d); setLoading(false); }).catch(() => setLoading(false));
  }, []);

  if (loading) return <p className="text-gray-400 text-sm">Checking system health...</p>;
  if (!h) return <p className="text-red-500 text-sm">Failed to load system health.</p>;

  const items = [
    { label: 'Database', status: h.database || 'unknown' },
    { label: 'Application', status: h.application || 'unknown' },
    { label: 'Authentication', status: h.auth || 'unknown' },
    { label: 'Email / SMTP', status: h.email || 'unknown' },
    { label: 'Analytics', status: h.analytics || 'unknown' },
    { label: 'Cache', status: h.cache || 'unknown' },
  ];

  return (
    <div>
      <h1 className="text-xl font-semibold text-gray-800 mb-6">System Health</h1>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 mb-8">
        {items.map((item, i) => (
          <div key={i} className="bg-white border border-gray-100 rounded-lg p-5">
            <div className="flex items-center gap-2 mb-2">
              <span className={`w-2.5 h-2.5 rounded-full ${statusColor(item.status)}`} />
              <h3 className="text-sm font-medium text-gray-700">{item.label}</h3>
            </div>
            <p className="text-xs text-gray-500">{statusLabel(item.status)}</p>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 mb-8">
        <div className="bg-white border border-gray-100 rounded-lg p-5">
          <h3 className="text-sm font-medium text-gray-700 mb-2">Storage</h3>
          <p className="text-lg font-semibold text-gray-800">{h.storage?.formatted || '0 MB'}</p>
        </div>
        <div className="bg-white border border-gray-100 rounded-lg p-5">
          <h3 className="text-sm font-medium text-gray-700 mb-2">Errors (7 days)</h3>
          <p className="text-lg font-semibold text-gray-800">{h.errorCount ?? 0}</p>
        </div>
        <div className="bg-white border border-gray-100 rounded-lg p-5">
          <h3 className="text-sm font-medium text-gray-700 mb-2">Uptime</h3>
          <p className="text-lg font-semibold text-gray-800">{h.uptime ? `${Math.floor(h.uptime / 60)} min` : '—'}</p>
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-8">
        <div className="bg-white border border-gray-100 rounded-lg p-5">
          <h3 className="text-sm font-medium text-gray-700 mb-2">Affiliate Links</h3>
          <p className="text-xs text-gray-500">Active links: {h.affiliateRedirects?.totalLinks ?? 0}</p>
          <p className="text-xs text-gray-500">Products with destinations: {h.affiliateRedirects?.productLinks ?? 0}</p>
        </div>
        <div className="bg-white border border-gray-100 rounded-lg p-5">
          <h3 className="text-sm font-medium text-gray-700 mb-2">Products</h3>
          <p className="text-xs text-gray-500">Total: {h.counts?.totalProducts ?? 0}</p>
          <p className="text-xs text-gray-500">Published: {h.counts?.publishedProducts ?? 0}</p>
        </div>
      </div>

      <div className="bg-white border border-gray-100 rounded-lg p-5">
        <h3 className="text-sm font-medium text-gray-700 mb-3">Environment</h3>
        <div className="space-y-1 text-xs text-gray-500">
          <p>Mode: <span className="text-gray-700">{h.environment}</span></p>
          <p>Site URL: <span className="text-gray-700">{h.siteUrl}</span></p>
        </div>
      </div>
    </div>
  );
}
