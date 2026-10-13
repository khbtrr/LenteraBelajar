import { NextRequest, NextResponse } from 'next/server';
import { getServerSession as auth } from '@/lib/auth-utils';
import { writeFile, mkdir } from 'node:fs/promises';
import path from 'node:path';
import { registerUploadedFile } from '@/lib/files';
import { isAllowedFileExtension, validateFileMagicBytes } from '@/lib/file-security';

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

    const ext = path.extname(file.name).toLowerCase();
    if (!isAllowedFileExtension(ext)) {
      return NextResponse.json(
        { error: `Format file '${ext || 'tanpa ekstensi'}' tidak diizinkan demi keamanan.` },
        { status: 400 }
      );
    }

    const bytes = await file.arrayBuffer();
    const buffer = Buffer.from(bytes);

    // Validate file header / magic bytes against claimed extension
    const magicCheck = validateFileMagicBytes(buffer, ext);
    if (!magicCheck.valid) {
      return NextResponse.json(
        { error: magicCheck.error || 'Konten file tidak sesuai dengan format ekstensi.' },
        { status: 400 }
      );
    }

    const uploadDir = path.resolve(/*turbopackIgnore: true*/ process.cwd(), process.env.UPLOAD_DIR || './uploads');
    await mkdir(uploadDir, { recursive: true });

    // Use cryptographically secure UUID and sanitized basename
    const sanitizedBase = path.basename(file.name, ext).replace(/[^a-zA-Z0-9_-]/g, '_').slice(0, 50);
    const uniqueFileName = `${crypto.randomUUID()}_${sanitizedBase}${ext}`;
    const filePath = path.join(uploadDir, uniqueFileName);

    await writeFile(filePath, buffer);
    const resolvedMime = magicCheck.detectedMime || file.type || 'application/octet-stream';
    await registerUploadedFile(uniqueFileName, buffer, resolvedMime);

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
