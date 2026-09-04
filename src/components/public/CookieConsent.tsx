'use client';

import { useSyncExternalStore } from 'react';

// The cookie-consent value lives in localStorage, which is external to React.
// useSyncExternalStore is the sanctioned way to subscribe to it without
// setting state synchronously inside an effect (React 19 lint) and without
// hydration mismatches (the server snapshot is always null).
const listeners = new Set<() => void>();
// In-memory fallback so the banner still dismisses for the session when
// localStorage is blocked (incognito restrictions etc.).
let memoryConsent: string | null = null;

function subscribe(callback: () => void): () => void {
  listeners.add(callback);
  window.addEventListener('storage', callback);
  return () => {
    listeners.delete(callback);
    window.removeEventListener('storage', callback);
  };
}

function getConsent(): string | null {
  if (memoryConsent) return memoryConsent;
  try {
    return window.localStorage.getItem('cookie-consent');
  } catch {
    return memoryConsent;
  }
}

function notify() {
  for (const cb of listeners) cb();
}

export default function CookieConsent() {
  // visible = no stored consent yet. Any stored value ('accepted') hides it,
  // matching the original behaviour.
  const visible = useSyncExternalStore(
    subscribe,
    () => getConsent() === null,
    () => true, // server snapshot: never stored a consent yet → banner visible
  );

  const accept = () => {
    try {
      window.localStorage.setItem('cookie-consent', 'accepted');
    } catch { /* storage blocked — fall back to the in-memory flag below */ }
    memoryConsent = 'accepted';
    notify();
  };

  if (!visible) return null;

  return (
    <div className="fixed bottom-0 left-0 right-0 z-50 bg-white border-t border-gray-200 shadow-lg">
      <div className="max-w-content mx-auto px-4 sm:px-6 py-4 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div className="flex-1">
          <p className="text-sm text-gray-600">
            We use cookies to improve your experience and analyze site traffic. By clicking &quot;Accept&quot;, you agree to our use of cookies.
            {' '}
            <a href="/cookie-policy" className="underline text-accent hover:text-accent-light">Learn more</a>
          </p>
        </div>
        <div className="flex items-center gap-3">
          <a href="/privacy-policy" className="text-sm text-gray-500 hover:text-accent transition-colors">
            Privacy Policy
          </a>
          <button
            onClick={accept}
            className="px-5 py-2 bg-accent text-white text-sm font-medium rounded-md hover:bg-accent-light transition-colors"
          >
            Accept
          </button>
        </div>
      </div>
    </div>
  );
}
