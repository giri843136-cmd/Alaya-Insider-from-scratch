import { NextRequest, NextResponse } from 'next/server';
import { ensureDbReady } from '@/lib/init';
import getDb from '@/lib/db';
import { getAuthUser } from '@/lib/auth';

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  ensureDbReady();
  const authUser = await getAuthUser();
  if (!authUser || !authUser.permissions.all) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { id } = await params;
  const db = getDb();

  // Prevent deleting yourself
  if (id === authUser.id) {
    return NextResponse.json({ error: 'Cannot delete your own account' }, { status: 400 });
  }

  // Prevent deleting the last super_admin
  const targetUser = db.prepare('SELECT role_id FROM users WHERE id = ?').get(id) as any;
  if (!targetUser) {
    return NextResponse.json({ error: 'User not found' }, { status: 404 });
  }

  const superAdminRole = db.prepare("SELECT id FROM roles WHERE name = 'super_admin'").get() as any;
  if (superAdminRole && targetUser.role_id === superAdminRole.id) {
    const count = db.prepare('SELECT COUNT(*) as cnt FROM users WHERE role_id = ?').get(superAdminRole.id) as any;
    if (count.cnt <= 1) {
      return NextResponse.json({ error: 'Cannot delete the last super admin' }, { status: 400 });
    }
  }

  db.prepare('DELETE FROM users WHERE id = ?').run(id);
  return NextResponse.json({ success: true });
}
