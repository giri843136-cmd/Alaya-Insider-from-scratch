'use client';

import { createContext, useContext } from 'react';

interface AuthUser {
  id: string; email: string; username: string; first_name: string; last_name: string; role_name: string;
  permissions: Record<string, boolean>;
}

export const AuthContext = createContext<{ user: AuthUser | null; logout: () => void }>({ user: null, logout: () => {} });
export const useAuth = () => useContext(AuthContext);

// In-memory token fallback for environments where localStorage is restricted
// (e.g., cross-origin iframes in Arena/e2b preview).
let memoryToken: string | null = null;

/** Store the auth token — tries localStorage first, falls back to memory. */
export function storeAuthToken(token: string) {
  memoryToken = token;
  try {
    if (typeof window !== 'undefined') {
      localStorage.setItem('auth_token', token);
    }
  } catch {
    // localStorage blocked (cross-origin iframe, incognito overflow, etc.)
    // Token is still in memoryToken — will work for this page session.
  }
}

/** Read the auth token — checks localStorage then memory fallback. */
export function getAuthToken(): string | null {
  try {
    if (typeof window !== 'undefined') {
      const stored = localStorage.getItem('auth_token');
      if (stored) {
        memoryToken = stored; // sync memory
        return stored;
      }
    }
  } catch {
    // localStorage blocked
  }
  return memoryToken;
}

/** Clear the auth token from all storage. */
export function clearAuthToken() {
  memoryToken = null;
  try {
    if (typeof window !== 'undefined') {
      localStorage.removeItem('auth_token');
    }
  } catch {
    // localStorage blocked
  }
}

// Helper to make authenticated fetch calls from admin pages.
// Reads token via getAuthToken (localStorage + memory fallback).
// Does NOT auto-logout on 401 — transient dev server errors should not
// wipe the session. Only the layout's initial mount check can force logout.
export async function adminFetch(url: string, options: RequestInit = {}): Promise<Response> {
  const token = getAuthToken();
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
