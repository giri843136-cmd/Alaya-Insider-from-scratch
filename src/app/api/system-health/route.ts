import { NextResponse } from 'next/server';
import { ensureDbReady } from '@/lib/init';
import getDb from '@/lib/db';
import { getAuthUser } from '@/lib/auth';
import { isEmailConfigured, testSmtpConnection } from '@/lib/email';
import fs from 'fs';
import path from 'path';

export async function GET() {
  ensureDbReady();
  const user = await getAuthUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const db = getDb();

  // Database
  let dbStatus = 'healthy';
  try { db.prepare('SELECT 1').get(); } catch { dbStatus = 'error'; }

  // Storage
  const uploadsDir = path.resolve(process.cwd(), 'uploads');
  let storageUsed = 0;
  try {
    const imgDir = path.join(uploadsDir, 'images');
    if (fs.existsSync(imgDir)) {
      fs.readdirSync(imgDir).forEach(f => {
        try { storageUsed += fs.statSync(path.join(imgDir, f)).size; } catch {}
      });
    }
  } catch {}

  // Email
  const emailConfigured = isEmailConfigured();
  let emailStatus = 'not_configured';
  if (emailConfigured) {
    const smtp = await testSmtpConnection();
    emailStatus = smtp.connected ? 'connected' : 'error';
  }

  // Analytics
  const analyticsConfigured = !!process.env.NEXT_PUBLIC_ANALYTICS_ID;

  // Affiliate redirects
  const totalLinks = (db.prepare('SELECT COUNT(*) as cnt FROM affiliate_links WHERE is_active = 1').get() as any).cnt;
  const productLinks = (db.prepare("SELECT COUNT(*) as cnt FROM products WHERE (global_affiliate_url != '' OR india_affiliate_url != '') AND status = 'published' AND deleted_at IS NULL").get() as any).cnt;

  // Errors
  const errorCount = (db.prepare("SELECT COUNT(*) as cnt FROM activity_logs WHERE action LIKE '%error%' AND created_at >= datetime('now','-7 days')").get() as any).cnt;

  // Counts
  const totalProducts = (db.prepare("SELECT COUNT(*) as cnt FROM products WHERE deleted_at IS NULL").get() as any).cnt;
  const publishedProducts = (db.prepare("SELECT COUNT(*) as cnt FROM products WHERE status = 'published' AND deleted_at IS NULL").get() as any).cnt;

  return NextResponse.json({
    database: dbStatus,
    storage: { used: storageUsed, formatted: `${(storageUsed / 1024 / 1024).toFixed(2)} MB` },
    application: 'running',
    email: emailStatus,
    analytics: analyticsConfigured ? 'configured' : 'not_configured',
    affiliateRedirects: { totalLinks, productLinks },
    auth: 'active',
    cache: 'not_configured',
    environment: process.env.NODE_ENV || 'development',
    siteUrl: process.env.NEXT_PUBLIC_SITE_URL || 'not set',
    errorCount,
    uptime: process.uptime(),
    counts: { totalProducts, publishedProducts },
  });
}
