import { initializeDatabase, seedRoles, seedAdmin, seedHomepageSections, seedSettings, seedArticleCategories, seedPages, seedHeroSlides } from './schema';
import { seedDemoData } from './seed-demo';
import { populateCategoryContent } from './populate-category-content';
import { populateProductContent } from './populate-product-content';

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
    seedHeroSlides();
    seedDemoData();
    populateCategoryContent();
    populateProductContent();
    initialized = true;
  } catch (e) {
    console.error('Database initialization error:', e);
    throw e;
  }
}
