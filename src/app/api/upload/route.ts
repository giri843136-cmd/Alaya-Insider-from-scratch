import { NextRequest, NextResponse } from 'next/server';
import { ensureDbReady } from '@/lib/init';
import getDb from '@/lib/db';
import { getAuthUser } from '@/lib/auth';
import { v4 as uuid } from 'uuid';
import { rateLimit, getClientIP } from "@/lib/rate-limit";
import path from 'path';
import fs from 'fs';

export async function POST(req: NextRequest) {
  ensureDbReady();
  const user = await getAuthUser();
  const rl = rateLimit(`upload:${getClientIP(req)}`, 20, 60000);
  if (!rl.allowed) return NextResponse.json({ error: "Too many uploads. Please wait." }, { status: 429 });
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  try {
    const formData = await req.formData();
    const file = formData.get('file') as File;

    if (!file) {
      return NextResponse.json({ error: 'No file provided' }, { status: 400 });
    }

    const allowedTypes = ['image/jpeg', 'image/png', 'image/webp', 'image/gif', 'image/svg+xml', 'image/avif'];
    if (!allowedTypes.includes(file.type)) {
      return NextResponse.json({ error: 'File type not supported' }, { status: 400 });
    }

    const maxSize = parseInt(process.env.MAX_UPLOAD_SIZE || '5242880');
    if (file.size > maxSize) {
      return NextResponse.json({ error: 'File too large' }, { status: 400 });
    }

    const ext = path.extname(file.name) || '.jpg';
    const filename = `${uuid()}${ext}`;
    const uploadDir = path.resolve(process.cwd(), 'uploads/images');

    if (!fs.existsSync(uploadDir)) {
      fs.mkdirSync(uploadDir, { recursive: true });
    }

    const buffer = Buffer.from(await file.arrayBuffer());
    const filePath = path.join(uploadDir, filename);
    fs.writeFileSync(filePath, buffer);

    const url = `/api/uploads/${filename}`;

    const db = getDb();
    const id = uuid();
    db.prepare(`INSERT INTO media (id, filename, original_name, mime_type, file_size, url, uploaded_by) VALUES (?, ?, ?, ?, ?, ?, ?)`)
      .run(id, filename, file.name, file.type, file.size, url, user.id);

    return NextResponse.json({ id, url, filename }, { status: 201 });
  } catch (e: any) {
    console.error('Upload error:', e);
    return NextResponse.json({ error: 'Upload failed' }, { status: 500 });
  }
}
