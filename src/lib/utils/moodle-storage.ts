import { writeFile, mkdir, readdir, stat, unlink, readFile } from 'node:fs/promises';
import path from 'node:path';
import sharp from 'sharp';
import crypto from 'node:crypto';
import { registerUploadedFile } from '@/lib/files';
import { requireAuth } from '@/lib/auth-utils';
import { db } from '@/lib/db';

function validateStagingId(id: string) {
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id)) throw new Error('ID impor tidak valid');
}

export function getUploadDirectory(): string {
  return path.resolve(/*turbopackIgnore: true*/ process.cwd(), process.env.UPLOAD_DIR || './uploads');
}

export function getStagingDirectory(): string {
  return path.join(getUploadDirectory(), 'moodle_staging');
}

export async function ensureDirectories(): Promise<void> {
  const uploadDir = getUploadDirectory();
  const stagingDir = getStagingDirectory();
  await mkdir(uploadDir, { recursive: true });
  await mkdir(stagingDir, { recursive: true });
}

export async function saveImageFile(
  buffer: Buffer,
  originalFilename: string
): Promise<string> {
  await ensureDirectories();
  const uploadDir = getUploadDirectory();

  let processedBuffer: Buffer = buffer;
  let ext = 'webp';

  try {
    processedBuffer = await sharp(buffer)
      .resize({ width: 1400, withoutEnlargement: true })
      .webp({ quality: 82 })
      .toBuffer();
  } catch {
    const rawExt = path.extname(originalFilename).toLowerCase().replace('.', '');
    ext = ['png', 'jpg', 'jpeg', 'gif', 'webp', 'svg'].includes(rawExt) ? rawExt : 'png';
    processedBuffer = buffer;
  }

  const randomStr = crypto.randomUUID().slice(0, 12);
  const cleanBase = path.basename(originalFilename, path.extname(originalFilename))
    .replace(/[^a-zA-Z0-9_-]/g, '_')
    .slice(0, 40);
  const fileName = `moodle_img_${Date.now()}_${randomStr}_${cleanBase}.${ext}`;
  const filePath = path.join(uploadDir, fileName);

  await writeFile(filePath, processedBuffer);
  await registerUploadedFile(fileName, processedBuffer, ext === 'svg' ? 'application/octet-stream' : `image/${ext === 'jpg' ? 'jpeg' : ext}`);
  return `/api/files/${fileName}`;
}

export async function saveDocumentFile(
  buffer: Buffer,
  originalFilename: string
): Promise<{ fileUrl: string; fileName: string; fileSize: number }> {
  await ensureDirectories();
  const uploadDir = getUploadDirectory();

  const ext = path.extname(originalFilename).toLowerCase();
  const sanitizedBase = path.basename(originalFilename, ext)
    .replace(/[^a-zA-Z0-9_-]/g, '_')
    .slice(0, 50);
  const uniqueName = `${crypto.randomUUID()}_${sanitizedBase}${ext}`;
  const filePath = path.join(uploadDir, uniqueName);

  await writeFile(filePath, buffer);
  await registerUploadedFile(uniqueName, buffer, 'application/octet-stream');

  return {
    fileUrl: `/api/files/${uniqueName}`,
    fileName: originalFilename,
    fileSize: buffer.length,
  };
}

export async function saveStagingArchive(
  sessionId: string,
  buffer: Buffer
): Promise<string> {
  validateStagingId(sessionId);
  await ensureDirectories();
  const stagingDir = getStagingDirectory();
  const archivePath = path.join(stagingDir, `${sessionId}.mbz`);
  await writeFile(archivePath, buffer);
  await registerUploadedFile(`moodle-stage-${sessionId}.mbz`, buffer, 'application/octet-stream');

  // Evict archives older than 2 hours to avoid disk accumulation
  cleanupStagingDirectory().catch((err) => {
    console.warn('Gagal membersihkan direktori staging Moodle:', err);
  });

  return archivePath;
}

export async function readStagingArchive(sessionId: string): Promise<Buffer> {
  validateStagingId(sessionId);
  const session = await requireAuth();
  if (!await db.fileAsset.findFirst({ where: { filename: `moodle-stage-${sessionId}.mbz`, uploaderId: session.user.id, createdAt: { gt: new Date(Date.now() - 2 * 60 * 60 * 1000) } } })) {
    throw new Error('Akses ditolak: Arsip impor tidak tersedia untuk akun ini');
  }
  const stagingDir = getStagingDirectory();
  const archivePath = path.join(stagingDir, `${sessionId}.mbz`);
  return readFile(archivePath);
}

export async function deleteStagingArchive(sessionId: string): Promise<void> {
  try {
    validateStagingId(sessionId);
    const session = await requireAuth();
    if (!await db.fileAsset.findFirst({ where: { filename: `moodle-stage-${sessionId}.mbz`, uploaderId: session.user.id } })) throw new Error('Akses ditolak');
    const stagingDir = getStagingDirectory();
    const archivePath = path.join(stagingDir, `${sessionId}.mbz`);
    await unlink(archivePath);
  } catch {
    // Ignore if already deleted
  }
}

async function cleanupStagingDirectory(): Promise<void> {
  const stagingDir = getStagingDirectory();
  const files = await readdir(stagingDir);
  const twoHoursAgo = Date.now() - 2 * 60 * 60 * 1000;

  for (const file of files) {
    if (!file.endsWith('.mbz')) continue;
    const fullPath = path.join(stagingDir, file);
    try {
      const fileStat = await stat(fullPath);
      if (fileStat.mtimeMs < twoHoursAgo) {
        await unlink(fullPath);
      }
    } catch {
      // Ignore cleanup error for in-use file
    }
  }
}
