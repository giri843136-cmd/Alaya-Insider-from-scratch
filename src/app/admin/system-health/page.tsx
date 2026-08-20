'use client';
import { adminFetch } from '@/lib/admin-auth-context';
import { useState, useEffect } from 'react';

export default function AdminSystemHealth() {
  const [health, setHealth] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    adminFetch('/api/system-health').then(r => r.json()).then(d => { setHealth(d); setLoading(false); });
  }, []);

  if (loading) return <div className="text-gray-400 text-sm">Checking system health...</div>;

  return (
    <div>
      <h1 className="text-xl font-semibold text-gray-800 mb-6">System Health</h1>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        <div className="bg-white border border-gray-100 rounded-lg p-5">
          <div className="flex items-center gap-2 mb-2">
            <span className={`w-2 h-2 rounded-full ${health?.database === 'healthy' ? 'bg-green-500' : 'bg-red-500'}`} />
            <h3 className="text-sm font-medium text-gray-700">Database</h3>
          </div>
          <p className="text-xs text-gray-500 capitalize">{health?.database || 'Unknown'}</p>
        </div>
        <div className="bg-white border border-gray-100 rounded-lg p-5">
          <div className="flex items-center gap-2 mb-2">
            <span className="w-2 h-2 rounded-full bg-green-500" />
            <h3 className="text-sm font-medium text-gray-700">Application</h3>
          </div>
          <p className="text-xs text-gray-500">{health?.application || 'Running'}</p>
        </div>
        <div className="bg-white border border-gray-100 rounded-lg p-5">
          <h3 className="text-sm font-medium text-gray-700 mb-2">Storage</h3>
          <p className="text-xs text-gray-500">{health?.storage?.formatted || '0 MB'}</p>
        </div>
        <div className="bg-white border border-gray-100 rounded-lg p-5">
          <h3 className="text-sm font-medium text-gray-700 mb-2">Errors (7 days)</h3>
          <p className="text-2xl font-semibold text-gray-800">{health?.errorCount || 0}</p>
        </div>
        <div className="bg-white border border-gray-100 rounded-lg p-5">
          <h3 className="text-sm font-medium text-gray-700 mb-2">Uptime</h3>
          <p className="text-xs text-gray-500">{health?.uptime ? `${Math.floor(health.uptime / 60)} minutes` : 'Unknown'}</p>
        </div>
        <div className="bg-white border border-gray-100 rounded-lg p-5">
          <h3 className="text-sm font-medium text-gray-700 mb-2">Email</h3>
          <p className="text-xs text-gray-400">Not Configured</p>
          <p className="text-[10px] text-gray-400 mt-1">Set SMTP_HOST in environment</p>
        </div>
      </div>
    </div>
  );
}
