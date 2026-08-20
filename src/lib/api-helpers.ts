import { NextRequest, NextResponse } from 'next/server';
import { getAuthUser, AuthUser } from './auth';
import { ensureDbReady } from './init';

export function jsonResponse(data: any, status = 200) {
  return NextResponse.json(data, { status });
}

export function errorResponse(message: string, status = 400) {
  return NextResponse.json({ error: message }, { status });
}

export async function withAuth(
  handler: (req: NextRequest, user: AuthUser) => Promise<NextResponse>
) {
  return async (req: NextRequest) => {
    ensureDbReady();
    const user = await getAuthUser();
    if (!user) {
      return errorResponse('Unauthorized', 401);
    }
    return handler(req, user);
  };
}

export function getPagination(req: NextRequest) {
  const url = new URL(req.url);
  const page = Math.max(1, parseInt(url.searchParams.get('page') || '1'));
  const limit = Math.min(100, Math.max(1, parseInt(url.searchParams.get('limit') || '20')));
  const offset = (page - 1) * limit;
  return { page, limit, offset };
}

export function getSearchParam(req: NextRequest, key: string): string {
  return new URL(req.url).searchParams.get(key) || '';
}
