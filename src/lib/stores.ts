/**
 * Store definitions shared by server and client code. This module must stay
 * dependency-free (no DB, no next/headers) because client components import
 * the formatting helpers that read these constants — pulling better-sqlite3
 * into the browser bundle would break the build.
 */

export type Store = 'in' | 'us';
export const DEFAULT_STORE: Store = 'in';

export interface StoreConfig {
  label: string;
  marketplace: string;
  defaultTag: string;
  tagSuffix: string; // '-21' | '-20'
  version: string;
  tokenEndpoint: string;
  currency: string;
  timeZone: string; // label shown in "as of" stamps
  envPrefix: string; // CREATORS_ | CREATORS_US_
}

export const STORES: Record<Store, StoreConfig> = {
  in: {
    label: 'India 🇮🇳',
    marketplace: 'www.amazon.in',
    defaultTag: 'alayainsider-21',
    tagSuffix: '-21',
    version: '3.2',
    tokenEndpoint: 'https://api.amazon.co.uk/auth/o2/token',
    currency: 'INR',
    timeZone: 'IST',
    envPrefix: 'CREATORS_',
  },
  us: {
    label: 'United States 🇺🇸',
    marketplace: 'www.amazon.com',
    defaultTag: 'alayainsider-20',
    tagSuffix: '-20',
    version: '3.1',
    tokenEndpoint: 'https://api.amazon.com/auth/o2/token',
    currency: 'USD',
    timeZone: 'UTC',
    envPrefix: 'CREATORS_US_',
  },
};

export const storeConfig = (store: Store): StoreConfig => STORES[store];