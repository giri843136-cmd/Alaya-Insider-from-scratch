'use client';
import { adminFetch } from '@/lib/admin-auth-context';
import { useState, useEffect } from 'react';
import Link from 'next/link';

export default function AdminComparisons() {
  const [comparisons, setComparisons] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    adminFetch('/api/comparisons').then(r => r.json()).then(d => { setComparisons(d.comparisons || []); setLoading(false); });
  }, []);

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-xl font-semibold text-gray-800">Comparisons</h1>
      </div>
      <div className="bg-white border border-gray-100 rounded-lg overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-gray-50 border-b border-gray-100">
            <tr>
              <th className="p-3 text-left text-xs font-medium text-gray-500">Title</th>
              <th className="p-3 text-left text-xs font-medium text-gray-500 hidden sm:table-cell">Products</th>
              <th className="p-3 text-left text-xs font-medium text-gray-500 hidden md:table-cell">Status</th>
              <th className="p-3 text-right text-xs font-medium text-gray-500">Actions</th>
            </tr>
          </thead>
          <tbody>
            {loading ? <tr><td colSpan={4} className="p-8 text-center text-gray-400">Loading...</td></tr> :
            comparisons.map(c => (
              <tr key={c.id} className="border-b border-gray-50 hover:bg-gray-50">
                <td className="p-3 font-medium text-gray-800">{c.title}</td>
                <td className="p-3 text-gray-500 hidden sm:table-cell">{c.product_ids?.length || 0}</td>
                <td className="p-3 hidden md:table-cell">
                  <span className={`text-xs px-2 py-0.5 rounded-full ${c.status === 'published' ? 'bg-green-50 text-green-700' : 'bg-yellow-50 text-yellow-700'}`}>{c.status}</span>
                </td>
                <td className="p-3 text-right">
                  <Link href={`/compare/${c.slug}`} target="_blank" className="text-xs text-gray-400 hover:text-accent">View</Link>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
