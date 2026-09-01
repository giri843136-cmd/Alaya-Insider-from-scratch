import AdminShell from '@/components/admin/AdminShell';

// Force ALL admin pages to be dynamic (never prerendered at build time).
// This prevents the Hostinger CDN from caching stale admin HTML with wrong JS chunk references.
export const dynamic = 'force-dynamic';

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  return <AdminShell>{children}</AdminShell>;
}
