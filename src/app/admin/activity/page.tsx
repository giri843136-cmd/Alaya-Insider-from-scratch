'use client';
import { adminFetch } from '@/lib/admin-auth-context';
import { useState, useEffect } from 'react';

export default function AdminActivity() {
  const [logs, setLogs] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    adminFetch('/api/activity').then(r => r.json()).then(d => { setLogs(d.logs || []); setLoading(false); });
  }, []);

  return (
    <div>
      <h1 className="text-xl font-semibold text-gray-800 mb-6">Activity Log</h1>
      <div className="bg-white border border-gray-100 rounded-lg overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-gray-50 border-b border-gray-100">
            <tr>
              <th className="p-3 text-left text-xs font-medium text-gray-500">User</th>
              <th className="p-3 text-left text-xs font-medium text-gray-500">Action</th>
              <th className="p-3 text-left text-xs font-medium text-gray-500 hidden sm:table-cell">Details</th>
              <th className="p-3 text-left text-xs font-medium text-gray-500 hidden md:table-cell">Date</th>
            </tr>
          </thead>
          <tbody>
            {loading ? <tr><td colSpan={4} className="p-8 text-center text-gray-400">Loading...</td></tr> :
            logs.length === 0 ? <tr><td colSpan={4} className="p-8 text-center text-gray-400">No activity recorded yet</td></tr> :
            logs.map(l => (
              <tr key={l.id} className="border-b border-gray-50 hover:bg-gray-50">
                <td className="p-3 text-gray-700">{l.username || 'System'}</td>
                <td className="p-3"><span className="text-xs px-2 py-0.5 bg-gray-100 text-gray-600 rounded">{l.action}</span></td>
                <td className="p-3 text-gray-500 hidden sm:table-cell text-xs">{l.details}</td>
                <td className="p-3 text-gray-400 text-xs hidden md:table-cell">{new Date(l.created_at).toLocaleString()}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
