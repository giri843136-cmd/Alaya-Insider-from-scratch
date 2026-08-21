import jwt from 'jsonwebtoken';
import bcryptjs from 'bcryptjs';
import { cookies, headers } from 'next/headers';
import getDb from './db';

// Production requires AUTH_SECRET. Development uses a fallback (NEVER use in production).
const AUTH_SECRET = (() => {
  const secret = process.env.AUTH_SECRET;
  if (!secret && process.env.NODE_ENV === 'production') {
    console.error('FATAL: AUTH_SECRET is required in production. Set it in your .env file.');
    console.error('Generate one with: openssl rand -base64 48');
    process.exit(1);
  }
  if (secret && secret.length < 32 && process.env.NODE_ENV === 'production') {
    console.error('FATAL: AUTH_SECRET must be at least 32 characters in production.');
    process.exit(1);
  }
  return secret || 'dev-only-insecure-secret-do-not-use-in-production';
})();

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
    const hdrs = await headers();
    const authHeader = hdrs.get('authorization');
    let token: string | undefined;

    if (authHeader?.startsWith('Bearer ')) {
      token = authHeader.slice(7);
    }

    if (!token) {
      try {
        const cookieStore = await cookies();
        token = cookieStore.get('auth_token')?.value;
      } catch {
        // cookies() can throw in certain Next.js contexts — that's OK
      }
    }

    if (!token) {
      console.log('AUTH_DEBUG: no_token_found auth_header_present=' + !!authHeader);
      return null;
    }

    const decoded = verifyToken(token);
    if (!decoded) {
      console.log('AUTH_DEBUG: token_verify_failed token_length=' + token.length);
      return null;
    }

    const db = getDb();
    const user = db.prepare(`
      SELECT u.*, r.name as role_name, r.permissions as role_permissions
      FROM users u
      JOIN roles r ON u.role_id = r.id
      WHERE u.id = ? AND u.is_active = 1
    `).get(decoded.id) as any;

    if (!user) {
      console.log('AUTH_DEBUG: user_not_found id=' + decoded.id);
      return null;
    }

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
  } catch (e) {
    console.error('AUTH_DEBUG: getAuthUser exception', e instanceof Error ? e.message : e);
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
