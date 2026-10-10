import { NextRequest, NextResponse } from 'next/server';
import { stat } from 'node:fs/promises';
import { createReadStream } from 'node:fs';
import { Readable } from 'node:stream';
import path from 'node:path';
import { getServerSession as auth } from '@/lib/auth-utils';
import { db } from '@/lib/db';
import { authorizeFileRead } from '@/lib/files';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ filename: string }> }
) {
  try {
    const { filename } = await params;
    // Sanitize filename to prevent directory traversal
    const safeFilename = path.basename(filename);

    if (safeFilename !== filename) return NextResponse.json({ error: 'File not found' }, { status: 404 });
    const { publicLogo: isPublicLogo } = await authorizeFileRead(safeFilename);
    const uploadDir = path.resolve(/*turbopackIgnore: true*/ process.cwd(), process.env.UPLOAD_DIR || './uploads');
    const filePath = path.join(/*turbopackIgnore: true*/ uploadDir, safeFilename);

    const fileStat = await stat(filePath);
    if (!fileStat.isFile()) {
      return NextResponse.json({ error: 'File not found' }, { status: 404 });
    }


    // Determine basic MIME type
    const ext = path.extname(safeFilename).toLowerCase();
    let contentType = 'application/octet-stream';
    if (ext === '.pdf') contentType = 'application/pdf';
    else if (ext === '.jpg' || ext === '.jpeg') contentType = 'image/jpeg';
    else if (ext === '.png') contentType = 'image/png';
    else if (ext === '.gif') contentType = 'image/gif';
    else if (ext === '.webp') contentType = 'image/webp';
    else if (ext === '.mp4') contentType = 'video/mp4';
    else if (ext === '.webm') contentType = 'video/webm';
    else if (ext === '.mp3') contentType = 'audio/mpeg';
    else if (ext === '.wav') contentType = 'audio/wav';
    else if (ext === '.ogg') contentType = 'audio/ogg';
    else if (ext === '.m4a') contentType = 'audio/mp4';
    else if (ext === '.doc') contentType = 'application/msword';
    else if (ext === '.docx')
      contentType = 'application/vnd.openxmlformats-officedocument.wordprocessingml.document';
    else if (ext === '.xls') contentType = 'application/vnd.ms-excel';
    else if (ext === '.xlsx')
      contentType = 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';
    else if (ext === '.ppt') contentType = 'application/vnd.ms-powerpoint';
    else if (ext === '.pptx')
      contentType = 'application/vnd.openxmlformats-officedocument.presentationml.presentation';
    else if (ext === '.zip') contentType = 'application/zip';

    const headers: Record<string, string> = {
      'Content-Type': contentType,
      'Content-Length': fileStat.size.toString(),
      'Accept-Ranges': 'bytes',
      'Cache-Control': isPublicLogo ? 'public, max-age=300' : 'private, no-store',
      'X-Content-Type-Options': 'nosniff',
      'Content-Disposition': `inline; filename="${safeFilename}"`,
    };

    if (!isPublicLogo) {
      headers['Content-Security-Policy'] = "default-src 'none'; sandbox";
    }

    const range = request.headers.get('range');
    let start = 0, end = fileStat.size - 1;
    if (range) {
      const match = /^bytes=(\d*)-(\d*)$/.exec(range);
      if (!match || (!match[1] && !match[2])) return new NextResponse(null, { status: 416, headers: { 'Content-Range': `bytes */${fileStat.size}` } });
      start = match[1] ? Number(match[1]) : Math.max(0, fileStat.size - Number(match[2]));
      end = match[1] && match[2] ? Math.min(Number(match[2]), fileStat.size - 1) : fileStat.size - 1;
      if (!Number.isSafeInteger(start) || !Number.isSafeInteger(end) || start < 0 || start > end || start >= fileStat.size) return new NextResponse(null, { status: 416, headers: { 'Content-Range': `bytes */${fileStat.size}` } });
      headers['Content-Range'] = `bytes ${start}-${end}/${fileStat.size}`;
      headers['Content-Length'] = String(end - start + 1);
    }
    if (fileStat.size === 0) return new NextResponse(null, { headers });
    const stream = createReadStream(filePath, { start, end });
    return new NextResponse(Readable.toWeb(stream) as ReadableStream, { headers, status: range ? 206 : 200 });
  } catch (error) {
    console.error('File serve error:', error);
    return NextResponse.json({ error: 'File not found' }, { status: 404 });
  }
}
