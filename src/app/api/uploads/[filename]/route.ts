import { NextRequest, NextResponse } from 'next/server';
import path from 'path';
import fs from 'fs';

export async function GET(req: NextRequest, { params }: { params: Promise<{ filename: string }> }) {
  const { filename } = await params;

  // Security: reject path traversal attempts
  const sanitized = path.basename(filename);
  if (sanitized !== filename || filename.includes('..') || filename.includes('/') || filename.includes('\\')) {
    return NextResponse.json({ error: 'Invalid filename' }, { status: 400 });
  }

  // TASK 31 step 1 — realpath containment.
  //
  // The previous check compared the UNRESOLVED join against the unresolved
  // uploads dir, which missed two escape routes:
  //   1. sibling-prefix: <dir>/uploads/images-privateEvil starts with
  //      <dir>/uploads/images as a STRING;
  //   2. symlink following: a symlink planted INSIDE uploads/images pointing
  //      at ../../data/alaya.db (or anywhere else) existsSync/readFileSync
  //      happily FOLLOW it — the string prefix never changes.
  // Resolve the uploads dir ONCE, then require the CANDIDATE's fully
  // resolved path (symlinks and all) to sit inside it plus a path separator.
  // The separator kills the sibling-prefix weakness; realpathSync kills the
  // symlink-following weakness.
  let uploadsReal: string;
  try {
    uploadsReal = fs.realpathSync(path.resolve(process.cwd(), 'uploads/images'));
  } catch {
    // No (real) uploads dir: nothing can legitimately be served.
    return new NextResponse(null, { status: 404 });
  }

  const filePath = path.join(uploadsReal, sanitized);

  if (!fs.existsSync(filePath)) {
    return NextResponse.json({ error: 'File not found' }, { status: 404 });
  }

  let real: string;
  try {
    real = fs.realpathSync(filePath);
  } catch {
    return new NextResponse(null, { status: 404 });
  }
  if (!real.startsWith(uploadsReal + path.sep)) {
    // Containment violation (e.g. a symlink resolving into ../../data):
    // 404 with an EMPTY body — zero bytes of the target are read, zero
    // bytes are served (asserted in uploads-route.containment.test.ts).
    return new NextResponse(null, { status: 404 });
  }

  const buffer = fs.readFileSync(real);
  const ext = path.extname(sanitized).toLowerCase();
  const mimeTypes: Record<string, string> = {
    '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.png': 'image/png',
    '.webp': 'image/webp', '.gif': 'image/gif', '.svg': 'image/svg+xml', '.avif': 'image/avif',
  };

  return new NextResponse(buffer, {
    headers: {
      'Content-Type': mimeTypes[ext] || 'application/octet-stream',
      'Cache-Control': 'public, max-age=31536000, immutable',
      'X-Content-Type-Options': 'nosniff',
    },
  });
}
