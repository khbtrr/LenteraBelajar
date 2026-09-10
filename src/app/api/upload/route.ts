import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { writeFile, mkdir } from 'node:fs/promises';
import path from 'node:path';

export async function POST(request: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const formData = await request.formData();
    const file = formData.get('file') as File | null;

    if (!file) {
      return NextResponse.json({ error: 'No file uploaded' }, { status: 400 });
    }

    // Limit file size (default 50MB)
    const maxMb = Number(process.env.MAX_FILE_SIZE_MB || 50);
    if (file.size > maxMb * 1024 * 1024) {
      return NextResponse.json(
        { error: `Ukuran file melebihi batas maksimal (${maxMb}MB)` },
        { status: 400 }
      );
    }

    const uploadDir = path.resolve(process.cwd(), process.env.UPLOAD_DIR || './uploads');
    await mkdir(uploadDir, { recursive: true });

    // Sanitize filename and make unique
    const sanitizedOriginalName = file.name.replace(/[^a-zA-Z0-9._-]/g, '_');
    const uniqueFileName = `${Date.now()}_${sanitizedOriginalName}`;
    const filePath = path.join(uploadDir, uniqueFileName);

    const bytes = await file.arrayBuffer();
    const buffer = Buffer.from(bytes);
    await writeFile(filePath, buffer);

    const fileUrl = `/api/files/${uniqueFileName}`;

    return NextResponse.json({
      url: fileUrl,
      fileName: file.name,
      fileSize: file.size,
      mimeType: file.type,
    });
  } catch (error) {
    console.error('File upload error:', error);
    return NextResponse.json({ error: 'Gagal mengunggah file' }, { status: 500 });
  }
}
