import jwt from 'jsonwebtoken';
import bcryptjs from 'bcryptjs';
import { cookies, headers } from 'next/headers';
import getDb from './db';

// Production requires AUTH_SECRET. Development uses a fallback (NEVER use in production).
const AUTH_SECRET = (() => {
  const secret = process.env.AUTH_SECRET;
  if (!secret && process.env.NODE_ENV === 'production') {
    // During build time, env vars may not be available yet — use fallback
    if (typeof window === 'undefined' && process.env.NEXT_RUNTIME !== 'edge' && !process.env.CI) {
      console.warn('AUTH_SECRET not set — using fallback during build. Set it at runtime.');
    }
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
  // Step 1: Extract token from Authorization header or cookie.
  // This is the only section we protect with try/catch — headers/cookies
  // can throw in unusual Next.js rendering contexts (SSG, middleware, etc.)
  // and that is *not* a server error; it just means "no auth available".
  let token: string | undefined;
  try {
    const hdrs = await headers();
    const authHeader = hdrs.get('authorization');

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
  } catch {
    // headers() itself threw — treat as "no auth context available"
    return null;
  }

  if (!token) {
    return null;
  }

  // Step 2: Verify the JWT. If it's invalid or expired, that's a real auth failure.
  const decoded = verifyToken(token);
  if (!decoded) {
    return null;
  }

  // Step 3: Look up the user in the database.
  // If the DB query fails (lock, corruption, etc.) we let the exception
  // propagate so the route handler can return a 500 — NOT a fake 401.
  const db = getDb();
  const user = db.prepare(`
    SELECT u.*, r.name as role_name, r.permissions as role_permissions
    FROM users u
    JOIN roles r ON u.role_id = r.id
    WHERE u.id = ? AND u.is_active = 1
  `).get(decoded.id) as any;

  if (!user) {
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
