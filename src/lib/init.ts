import { initializeDatabase, seedRoles, seedAdmin, seedHomepageSections, seedSettings, seedArticleCategories, seedPages } from './schema';
import { seedDemoData } from './seed-demo';

let initialized = false;

export function ensureDbReady() {
  if (initialized) return;
  try {
    initializeDatabase();
    seedRoles();
    seedAdmin();
    seedHomepageSections();
    seedSettings();
    seedArticleCategories();
    seedPages();
    seedDemoData();
    initialized = true;
  } catch (e) {
    console.error('Database initialization error:', e);
    throw e;
  }
}
