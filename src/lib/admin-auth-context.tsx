'use client';

import { createContext, useContext } from 'react';

interface AuthUser {
  id: string; email: string; username: string; first_name: string; last_name: string; role_name: string;
  permissions: Record<string, boolean>;
}

export const AuthContext = createContext<{ user: AuthUser | null; logout: () => void }>({ user: null, logout: () => {} });
export const useAuth = () => useContext(AuthContext);

// Helper to make authenticated fetch calls from admin pages.
// Reads token from localStorage and attaches it as Authorization header.
// Does NOT auto-logout on 401 — transient dev server errors should not
// wipe the session. Only the layout's initial mount check can force logout.
export async function adminFetch(url: string, options: RequestInit = {}): Promise<Response> {
  const token = typeof window !== 'undefined' ? localStorage.getItem('auth_token') : null;
  const headers: Record<string, string> = {
    ...(options.headers as Record<string, string> || {}),
  };
  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }
  // Only set Content-Type for non-FormData bodies
  if (options.body && !(options.body instanceof FormData)) {
    headers['Content-Type'] = headers['Content-Type'] || 'application/json';
  }
  return fetch(url, { ...options, headers });
}
