'use client';
import { adminFetch } from '@/lib/admin-auth-context';
import { useState, useEffect } from 'react';

export default function AdminUsers() {
  const [users, setUsers] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [adding, setAdding] = useState(false);
  const [newUser, setNewUser] = useState({ email: '', username: '', password: '', first_name: '', last_name: '', role: 'editor' });
  const [toast, setToast] = useState('');

  useEffect(() => {
    adminFetch('/api/users').then(r => r.json()).then(d => { setUsers(d.users || []); setLoading(false); });
  }, []);

  const showToast = (msg: string) => { setToast(msg); setTimeout(() => setToast(''), 3000); };

  const handleDelete = async (userId: string) => {
    if (!confirm('Are you sure you want to delete this user?')) return;
    const res = await adminFetch(`/api/users/${userId}`, { method: 'DELETE' });
    if (res.ok) {
      showToast('User deleted');
      setUsers(users.filter(u => u.id !== userId));
    } else {
      const data = await res.json();
      showToast(data.error || 'Failed to delete');
    }
  };

  const handleAdd = async () => {
    const res = await adminFetch('/api/users', {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(newUser),
    });
    if (res.ok) {
      showToast('User created');
      setAdding(false);
      const d = await adminFetch('/api/users').then(r => r.json());
      setUsers(d.users || []);
    } else {
      const data = await res.json();
      showToast(data.error || 'Failed');
    }
  };

  return (
    <div>
      {toast && <div className="fixed top-4 right-4 z-50 bg-accent text-white px-4 py-2.5 rounded-md text-sm shadow-lg toast-enter">{toast}</div>}
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-xl font-semibold text-gray-800">Users</h1>
        <button onClick={() => setAdding(true)} className="px-4 py-2 bg-accent text-white text-sm rounded-md">Add User</button>
      </div>

      {adding && (
        <div className="fixed inset-0 bg-black/30 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-lg p-6 w-full max-w-md">
            <h2 className="text-lg font-semibold mb-4">Add User</h2>
            <div className="space-y-3">
              <input type="text" placeholder="First Name" value={newUser.first_name} onChange={e => setNewUser(u => ({...u, first_name: e.target.value}))}
                className="w-full px-3 py-2 border border-gray-200 rounded-md text-sm" />
              <input type="text" placeholder="Last Name" value={newUser.last_name} onChange={e => setNewUser(u => ({...u, last_name: e.target.value}))}
                className="w-full px-3 py-2 border border-gray-200 rounded-md text-sm" />
              <input type="email" placeholder="Email" value={newUser.email} onChange={e => setNewUser(u => ({...u, email: e.target.value}))}
                className="w-full px-3 py-2 border border-gray-200 rounded-md text-sm" />
              <input type="text" placeholder="Username" value={newUser.username} onChange={e => setNewUser(u => ({...u, username: e.target.value}))}
                className="w-full px-3 py-2 border border-gray-200 rounded-md text-sm" />
              <input type="password" placeholder="Password" value={newUser.password} onChange={e => setNewUser(u => ({...u, password: e.target.value}))}
                className="w-full px-3 py-2 border border-gray-200 rounded-md text-sm" />
              <select value={newUser.role} onChange={e => setNewUser(u => ({...u, role: e.target.value}))}
                className="w-full px-3 py-2 border border-gray-200 rounded-md text-sm bg-white">
                <option value="super_admin">Super Admin</option>
                <option value="admin">Admin</option>
                <option value="editor">Editor</option>
                <option value="content_manager">Content Manager</option>
                <option value="analyst">Analyst</option>
              </select>
            </div>
            <div className="flex justify-end gap-2 mt-6">
              <button onClick={() => setAdding(false)} className="px-4 py-2 text-sm text-gray-500">Cancel</button>
              <button onClick={handleAdd} className="px-4 py-2 bg-accent text-white text-sm rounded-md">Create</button>
            </div>
          </div>
        </div>
      )}

      <div className="bg-white border border-gray-100 rounded-lg overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-gray-50 border-b border-gray-100">
            <tr>
              <th className="p-3 text-left text-xs font-medium text-gray-500">User</th>
              <th className="p-3 text-left text-xs font-medium text-gray-500 hidden sm:table-cell">Email</th>
              <th className="p-3 text-left text-xs font-medium text-gray-500 hidden md:table-cell">Role</th>
              <th className="p-3 text-left text-xs font-medium text-gray-500 hidden lg:table-cell">Last Login</th>
              <th className="p-3 text-left text-xs font-medium text-gray-500">Actions</th>
            </tr>
          </thead>
          <tbody>
            {loading ? <tr><td colSpan={4} className="p-8 text-center text-gray-400">Loading...</td></tr> :
            users.map(u => (
              <tr key={u.id} className="border-b border-gray-50 hover:bg-gray-50">
                <td className="p-3 font-medium text-gray-800">{u.first_name} {u.last_name} <span className="text-gray-400 font-normal">@{u.username}</span></td>
                <td className="p-3 text-gray-500 hidden sm:table-cell">{u.email}</td>
                <td className="p-3 hidden md:table-cell">
                  <span className="text-xs px-2 py-0.5 bg-gray-100 text-gray-600 rounded-full">{u.role_name}</span>
                </td>
                <td className="p-3 text-gray-400 text-xs hidden lg:table-cell">{u.last_login ? new Date(u.last_login).toLocaleString() : 'Never'}</td>
                <td className="p-3">
                  {u.role_name !== 'super_admin' && (
                    <button onClick={() => handleDelete(u.id)} className="text-red-500 hover:text-red-700 text-xs">Delete</button>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
