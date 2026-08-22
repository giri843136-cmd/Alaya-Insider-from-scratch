import { NextResponse } from 'next/server';
import { ensureDbReady } from '@/lib/init';
import getDb from '@/lib/db';
import { getAuthUser } from '@/lib/auth';

export async function GET() {
  ensureDbReady();
  const user = await getAuthUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const db = getDb();

  const totalProducts = (db.prepare("SELECT COUNT(*) as cnt FROM products WHERE deleted_at IS NULL").get() as any).cnt;
  const activeProducts = (db.prepare("SELECT COUNT(*) as cnt FROM products WHERE status = 'published' AND deleted_at IS NULL").get() as any).cnt;
  const totalArticles = (db.prepare("SELECT COUNT(*) as cnt FROM articles WHERE deleted_at IS NULL").get() as any).cnt;
  const publishedArticles = (db.prepare("SELECT COUNT(*) as cnt FROM articles WHERE status = 'published' AND deleted_at IS NULL").get() as any).cnt;
  const totalClicks = (db.prepare("SELECT COUNT(*) as cnt FROM affiliate_clicks").get() as any).cnt;
  const clicksToday = (db.prepare("SELECT COUNT(*) as cnt FROM affiliate_clicks WHERE date(clicked_at) = date('now')").get() as any).cnt;
  const clicksWeek = (db.prepare("SELECT COUNT(*) as cnt FROM affiliate_clicks WHERE clicked_at >= datetime('now', '-7 days')").get() as any).cnt;
  const clicksMonth = (db.prepare("SELECT COUNT(*) as cnt FROM affiliate_clicks WHERE clicked_at >= datetime('now', '-30 days')").get() as any).cnt;
  const subscribers = (db.prepare("SELECT COUNT(*) as cnt FROM newsletter_subscribers WHERE is_active = 1").get() as any).cnt;

  // Destination-specific clicks
  const globalClicks = (db.prepare("SELECT COUNT(*) as cnt FROM affiliate_clicks WHERE destination_type = 'global'").get() as any).cnt;
  const indiaClicks = (db.prepare("SELECT COUNT(*) as cnt FROM affiliate_clicks WHERE destination_type = 'india'").get() as any).cnt;

  const topProducts = db.prepare(`SELECT p.name, p.slug, p.click_count, p.global_click_count, p.india_click_count, p.current_price, b.name as brand_name
    FROM products p LEFT JOIN brands b ON p.brand_id = b.id WHERE p.deleted_at IS NULL ORDER BY p.click_count DESC LIMIT 10`).all();

  const topCategories = db.prepare(`SELECT c.name, c.slug, (SELECT COUNT(*) FROM products p WHERE p.category_id = c.id AND p.status = 'published') as product_count
    FROM categories c WHERE c.parent_id IS NULL ORDER BY product_count DESC LIMIT 5`).all();

  const recentActivity = db.prepare(`SELECT al.*, u.username FROM activity_logs al LEFT JOIN users u ON al.user_id = u.id ORDER BY al.created_at DESC LIMIT 10`).all();

  const clicksByDay = db.prepare(`SELECT date(clicked_at) as date, COUNT(*) as clicks,
    SUM(CASE WHEN destination_type = 'global' THEN 1 ELSE 0 END) as global_clicks,
    SUM(CASE WHEN destination_type = 'india' THEN 1 ELSE 0 END) as india_clicks
    FROM affiliate_clicks WHERE clicked_at >= datetime('now', '-30 days')
    GROUP BY date(clicked_at) ORDER BY date ASC`).all();

  const topSearches = db.prepare(`SELECT query, COUNT(*) as count FROM search_logs
    WHERE created_at >= datetime('now', '-30 days') GROUP BY query ORDER BY count DESC LIMIT 10`).all();

  return NextResponse.json({
    stats: { totalProducts, activeProducts, totalArticles, publishedArticles, totalClicks, clicksToday, clicksWeek, clicksMonth, subscribers, globalClicks, indiaClicks },
    topProducts, topCategories, recentActivity, clicksByDay, topSearches,
  });
}
