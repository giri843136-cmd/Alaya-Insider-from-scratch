'use client';
import { adminFetch } from '@/lib/admin-auth-context';
import { useState, useEffect } from 'react';

export default function AdminAffiliateLinks() {
  const [links, setLinks] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    adminFetch('/api/affiliate-links').then(r => r.json()).then(d => { setLinks(d.links || []); setLoading(false); });
  }, []);

  return (
    <div>
      <h1 className="text-xl font-semibold text-gray-800 mb-6">Affiliate Links</h1>
      <div className="bg-white border border-gray-100 rounded-lg overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 border-b border-gray-100">
              <tr>
                <th className="p-3 text-left text-xs font-medium text-gray-500">Product</th>
                <th className="p-3 text-left text-xs font-medium text-gray-500 hidden sm:table-cell">Slug</th>
                <th className="p-3 text-left text-xs font-medium text-gray-500 hidden md:table-cell">Network</th>
                <th className="p-3 text-left text-xs font-medium text-gray-500">Clicks</th>
                <th className="p-3 text-left text-xs font-medium text-gray-500 hidden lg:table-cell">Status</th>
              </tr>
            </thead>
            <tbody>
              {loading ? <tr><td colSpan={5} className="p-8 text-center text-gray-400">Loading...</td></tr> :
              links.map(l => (
                <tr key={l.id} className="border-b border-gray-50 hover:bg-gray-50">
                  <td className="p-3 font-medium text-gray-800">{l.product_name || l.slug}</td>
                  <td className="p-3 text-gray-500 hidden sm:table-cell">/go/{l.slug}</td>
                  <td className="p-3 text-gray-500 hidden md:table-cell">{l.affiliate_network || '—'}</td>
                  <td className="p-3 text-gray-700">{l.click_count}</td>
                  <td className="p-3 hidden lg:table-cell">
                    <span className={`text-xs px-2 py-0.5 rounded-full ${l.is_active ? 'bg-green-50 text-green-700' : 'bg-gray-100 text-gray-500'}`}>
                      {l.is_active ? 'Active' : 'Inactive'}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
