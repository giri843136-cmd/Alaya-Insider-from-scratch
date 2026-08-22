'use client';
import { adminFetch } from '@/lib/admin-auth-context';
import { useState, useEffect } from 'react';

export default function AdminNewsletter() {
  const [subs, setSubs] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    adminFetch('/api/newsletter').then(r => r.json()).then(d => { setSubs(d.subscribers || []); setLoading(false); });
  }, []);

  const handleExport = async () => {
    const res = await adminFetch('/api/newsletter/export');
    const blob = await res.blob();
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'subscribers.csv';
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-xl font-semibold text-gray-800">Newsletter Subscribers</h1>
          <p className="text-sm text-gray-400">{subs.length} subscribers</p>
        </div>
        <button onClick={handleExport} className="px-4 py-2 border border-gray-200 text-gray-600 text-sm rounded-md hover:border-accent">
          Export CSV
        </button>
      </div>
      <div className="bg-white border border-gray-100 rounded-lg overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-gray-50 border-b border-gray-100">
            <tr>
              <th className="p-3 text-left text-xs font-medium text-gray-500">Email</th>
              <th className="p-3 text-left text-xs font-medium text-gray-500 hidden sm:table-cell">Name</th>
              <th className="p-3 text-left text-xs font-medium text-gray-500 hidden md:table-cell">Source</th>
              <th className="p-3 text-left text-xs font-medium text-gray-500 hidden lg:table-cell">Date</th>
              <th className="p-3 text-left text-xs font-medium text-gray-500">Status</th>
            </tr>
          </thead>
          <tbody>
            {loading ? <tr><td colSpan={5} className="p-8 text-center text-gray-400">Loading...</td></tr> :
            subs.length === 0 ? <tr><td colSpan={5} className="p-8 text-center text-gray-400">No subscribers yet</td></tr> :
            subs.map(s => (
              <tr key={s.id} className="border-b border-gray-50 hover:bg-gray-50">
                <td className="p-3 text-gray-800">{s.email}</td>
                <td className="p-3 text-gray-500 hidden sm:table-cell">{s.first_name || '—'}</td>
                <td className="p-3 text-gray-500 hidden md:table-cell">{s.source}</td>
                <td className="p-3 text-gray-400 hidden lg:table-cell">{new Date(s.subscribed_at).toLocaleDateString()}</td>
                <td className="p-3">
                  <span className={`text-xs px-2 py-0.5 rounded-full ${s.is_active ? 'bg-green-50 text-green-700' : 'bg-gray-100 text-gray-500'}`}>
                    {s.is_active ? 'Active' : 'Unsubscribed'}
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
