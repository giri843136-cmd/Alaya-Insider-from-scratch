'use client';

import { useState, useEffect, useRef } from 'react';
import { usePathname } from 'next/navigation';
import Link from 'next/link';

import { AuthContext, storeAuthToken, getAuthToken, clearAuthToken } from '@/lib/admin-auth-context';

interface AuthUser {
  id: string; email: string; username: string; first_name: string; last_name: string; role_name: string;
  permissions: Record<string, boolean>;
}

const navItems = [
  { href: '/admin', icon: '◻', label: 'Dashboard' },
  { href: '/admin/products', icon: '☐', label: 'Products' },
  { href: '/admin/categories', icon: '≡', label: 'Categories' },
  { href: '/admin/brands', icon: '◎', label: 'Brands' },
  { href: '/admin/collections', icon: '❖', label: 'Collections' },
  { href: '/admin/articles', icon: '✎', label: 'Articles' },
  { href: '/admin/comparisons', icon: '⇄', label: 'Comparisons' },
  { href: '/admin/media', icon: '▣', label: 'Media' },
  { href: '/admin/affiliate-links', icon: '↗', label: 'Affiliate Links' },
  { href: '/admin/newsletter', icon: '✉', label: 'Newsletter' },
  { href: '/admin/analytics', icon: '▤', label: 'Analytics' },
  { href: '/admin/hero', icon: '▶', label: 'Hero Carousel' },
  { href: '/admin/homepage', icon: '⌂', label: 'Homepage' },
  { href: '/admin/users', icon: '◉', label: 'Users' },
  { href: '/admin/activity', icon: '↻', label: 'Activity Log' },
  { href: '/admin/settings', icon: '⚙', label: 'Settings' },
  { href: '/admin/system-health', icon: '♥', label: 'System Health' },
];

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  const [view, setView] = useState<'checking' | 'login' | 'ready'>('checking');
  const [user, setUser] = useState<AuthUser | null>(null);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const pathname = usePathname();

  // Check auth once on mount — trust stored token (localStorage or memory)
  useEffect(() => {
    const token = getAuthToken();

    // No token → show login
    if (!token) {
      setView('login');
      return;
    }

    // Token exists → trust it and show dashboard immediately.
    // Try to fetch user info for the top bar, but don't logout on failure.
    setView('ready');

    fetch('/api/auth/me', {
      headers: { 'Authorization': `Bearer ${token}` },
    })
      .then(r => r.ok ? r.json() : null)
      .then(data => {
        if (data?.user) {
          setUser(data.user);
        }
      })
      .catch(() => {
        // Transient error — don't logout, user info just won't show
      });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const onLoginSuccess = (authUser: AuthUser) => {
    setUser(authUser);
    setView('ready');
    if (pathname === '/admin/login') {
      window.history.pushState({}, '', '/admin');
    }
  };

  const logout = async () => {
    const token = getAuthToken();
    try {
      await fetch('/api/auth/logout', {
        method: 'POST',
        headers: token ? { 'Authorization': `Bearer ${token}` } : {},
      });
    } catch {}
    clearAuthToken();
    setUser(null);
    setView('login');
    window.history.pushState({}, '', '/admin/login');
  };

  if (view === 'checking') {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <p className="text-gray-400 text-sm">Loading...</p>
      </div>
    );
  }

  if (view === 'login') {
    return (
      <AuthContext.Provider value={{ user, logout }}>
        <LoginForm onSuccess={onLoginSuccess} />
      </AuthContext.Provider>
    );
  }

  return (
    <AuthContext.Provider value={{ user, logout }}>
      <div className="min-h-screen bg-gray-50 flex">
        {sidebarOpen && (
          <div className="fixed inset-0 bg-black/20 z-40 lg:hidden" onClick={() => setSidebarOpen(false)} />
        )}

        <aside className={`fixed lg:static inset-y-0 left-0 z-50 w-56 bg-white border-r border-gray-100 flex flex-col transition-transform duration-200
          ${sidebarOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'}`}>
          <div className="h-14 flex items-center px-5 border-b border-gray-100">
            <Link href="/admin" className="text-sm font-semibold text-accent">Alaya Admin</Link>
          </div>
          <nav className="flex-1 overflow-y-auto py-3 px-3">
            {navItems.map(item => {
              const isActive = pathname === item.href || (item.href !== '/admin' && pathname.startsWith(item.href));
              return (
                <Link key={item.href} href={item.href}
                  onClick={() => setSidebarOpen(false)}
                  className={`flex items-center gap-2.5 px-3 py-2 rounded-md text-sm mb-0.5 transition-colors
                    ${isActive ? 'bg-accent text-white' : 'text-gray-600 hover:bg-gray-50 hover:text-accent'}`}>
                  <span className="text-xs w-4 text-center">{item.icon}</span>
                  {item.label}
                </Link>
              );
            })}
          </nav>
          <div className="p-3 border-t border-gray-100">
            <Link href="/" target="_blank" className="block px-3 py-2 text-xs text-gray-400 hover:text-accent">
              View Site →
            </Link>
          </div>
        </aside>

        <div className="flex-1 flex flex-col min-w-0">
          <header className="h-14 bg-white border-b border-gray-100 flex items-center justify-between px-4 sm:px-6 flex-shrink-0">
            <button onClick={() => setSidebarOpen(!sidebarOpen)} className="lg:hidden text-gray-500 p-1">
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4 6h16M4 12h16M4 18h16" />
              </svg>
            </button>
            <div className="text-sm text-gray-400 hidden lg:block">
              {pathname.split('/').slice(1).map((s, i) => (
                <span key={i}>{i > 0 ? ' / ' : ''}<span className="capitalize">{s.replace(/-/g, ' ')}</span></span>
              ))}
            </div>
            <div className="flex items-center gap-4">
              <span className="text-sm text-gray-500">
                {user ? `${user.first_name} ${user.last_name}` : 'Admin'}
              </span>
              <button onClick={logout} className="text-xs text-gray-400 hover:text-red-500 transition-colors">
                Logout
              </button>
            </div>
          </header>

          <main className="flex-1 overflow-y-auto p-4 sm:p-6">
            {children}
          </main>
        </div>
      </div>
    </AuthContext.Provider>
  );
}

function LoginForm({ onSuccess }: { onSuccess: (user: AuthUser) => void }) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    try {
      const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password }),
      });
      const data = await res.json();

      if (res.ok && data.token && data.user) {
        storeAuthToken(data.token);
        onSuccess(data.user);
      } else {
        setError(data.error || 'Login failed');
        setLoading(false);
      }
    } catch {
      setError('Unable to connect. Please try again.');
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center px-4">
      <div className="w-full max-w-sm">
        <div className="text-center mb-8">
          <h1 className="text-xl font-semibold text-accent">Alaya Insider</h1>
          <p className="text-sm text-gray-400 mt-1">Admin Panel</p>
        </div>

        <form onSubmit={handleSubmit} className="bg-white border border-gray-100 rounded-lg p-6 shadow-sm">
          <div className="mb-4">
            <label className="text-sm font-medium text-gray-700 mb-1 block">Email or Username</label>
            <input type="text" value={email} onChange={e => setEmail(e.target.value)} required
              autoComplete="username"
              className="w-full px-3 py-2.5 border border-gray-200 rounded-md text-sm focus:outline-none focus:border-accent"
              placeholder="admin@alayainsider.com" />
          </div>
          <div className="mb-5">
            <label className="text-sm font-medium text-gray-700 mb-1 block">Password</label>
            <div className="relative">
              <input
                type={showPassword ? 'text' : 'password'}
                value={password}
                onChange={e => setPassword(e.target.value)}
                required
                autoComplete="current-password"
                className="w-full px-3 py-2.5 border border-gray-200 rounded-md text-sm focus:outline-none focus:border-accent pr-16"
                placeholder="••••••••"
              />
              <button
                type="button"
                onClick={() => setShowPassword(v => !v)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-gray-400 hover:text-gray-600 select-none"
              >
                {showPassword ? 'Hide' : 'Show'}
              </button>
            </div>
          </div>

          {error && <p className="text-red-600 text-sm mb-4">{error}</p>}

          <button type="submit" disabled={loading}
            className="w-full py-2.5 bg-accent text-white text-sm font-medium rounded-md hover:bg-accent-light transition-colors disabled:opacity-50">
            {loading ? 'Signing in...' : 'Sign In'}
          </button>
        </form>
      </div>
    </div>
  );
}
