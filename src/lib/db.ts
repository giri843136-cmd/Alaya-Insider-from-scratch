import Database from 'better-sqlite3';
import path from 'path';
import fs from 'fs';

const DB_PATH = process.env.DATABASE_PATH || './data/alaya.db';

let db: Database.Database;

export function getDb(): Database.Database {
  if (!db) {
    const dbPath = path.resolve(/* turbopackIgnore: true */ process.cwd(), DB_PATH);
    // Ensure the data directory exists
    const dir = path.dirname(dbPath);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
    db = new Database(dbPath);
    db.pragma('journal_mode = WAL');
    db.pragma('foreign_keys = ON');
    db.pragma('busy_timeout = 5000');
    // Memory tuning for constrained hosting (shared hosting / small VPS):
    // cap page cache at 8MB instead of SQLite's ~2GB default ceiling,
    // and disable mmap so the database doesn't inflate process RSS.
    db.pragma('cache_size = -8000');
    db.pragma('mmap_size = 0');
  }
  return db;
}

export default getDb;
