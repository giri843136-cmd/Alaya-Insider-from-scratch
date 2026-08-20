import jwt from 'jsonwebtoken';
import bcryptjs from 'bcryptjs';
import { cookies, headers } from 'next/headers';
import getDb from './db';

const AUTH_SECRET = process.env.AUTH_SECRET || 'dev-secret-change-in-production-min-32-chars-long';
const JWT_EXPIRY = process.env.JWT_EXPIRY || '7d';

export interface AuthUser {
  id: string;
  email: string;
  username: string;
  first_name: string;
  last_name: string;
  role_id: string;
  role_name: string;
  permissions: Record<string, boolean>;
}

export function generateToken(user: AuthUser): string {
  return jwt.sign(
    { id: user.id, email: user.email, role: user.role_name },
    AUTH_SECRET,
    { expiresIn: JWT_EXPIRY as any }
  );
}

export function verifyToken(token: string): any {
  try {
    return jwt.verify(token, AUTH_SECRET);
  } catch {
    return null;
  }
}

export async function getAuthUser(): Promise<AuthUser | null> {
  try {
    // 1. Try Authorization header first (works in cross-origin / proxy envs)
    const hdrs = await headers();
    const authHeader = hdrs.get('authorization');
    let token: string | undefined;

    if (authHeader?.startsWith('Bearer ')) {
      token = authHeader.slice(7);
    }

    // 2. Fall back to cookie
    if (!token) {
      const cookieStore = await cookies();
      token = cookieStore.get('auth_token')?.value;
    }

    if (!token) return null;

    const decoded = verifyToken(token);
    if (!decoded) return null;

    const db = getDb();
    const user = db.prepare(`
      SELECT u.*, r.name as role_name, r.permissions as role_permissions
      FROM users u
      JOIN roles r ON u.role_id = r.id
      WHERE u.id = ? AND u.is_active = 1
    `).get(decoded.id) as any;

    if (!user) return null;

    return {
      id: user.id,
      email: user.email,
      username: user.username,
      first_name: user.first_name,
      last_name: user.last_name,
      role_id: user.role_id,
      role_name: user.role_name,
      permissions: JSON.parse(user.role_permissions || '{}'),
    };
  } catch {
    return null;
  }
}

export function hashPassword(password: string): string {
  return bcryptjs.hashSync(password, 10);
}

export function verifyPassword(password: string, hash: string): boolean {
  return bcryptjs.compareSync(password, hash);
}

export function hasPermission(user: AuthUser, permission: string): boolean {
  if (user.permissions.all) return true;
  return !!user.permissions[permission];
}
