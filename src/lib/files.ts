import 'server-only';
import { createHash } from 'node:crypto';
import path from 'node:path';
import { db } from '@/lib/db';
import { requireAuth } from '@/lib/auth-utils';
import { assertCourseAccess, assertItemAccess, assertBankResource } from '@/lib/access';

export type FilePurpose = 'CONTENT' | 'ASSIGNMENT' | 'SUBMISSION' | 'QUIZ_QUESTION' | 'BANK_QUESTION' | 'ATTEMPT' | 'LOGO' | 'AVATAR';

export function fileNamesIn(value: unknown): string[] {
  const serialized = typeof value === 'string' ? value : JSON.stringify(value ?? '');
  const names = [...serialized.matchAll(/\/api\/files\/([a-zA-Z0-9_.%-]+)/g)].map((match) => decodeURIComponent(match[1]));
  if (names.some((name) => path.basename(name) !== name || name === '.' || name === '..')) throw new Error('Nama file tidak valid');
  return [...new Set(names)];
}

export async function registerUploadedFile(filename: string, buffer: Buffer, contentType: string) {
  const session = await requireAuth();
  if (path.basename(filename) !== filename) throw new Error('Nama file tidak valid');
  return db.fileAsset.create({ data: {
    filename, uploaderId: session.user.id, schoolId: session.user.schoolId,
    size: buffer.length, contentType, sha256: createHash('sha256').update(buffer).digest('hex'),
  } });
}

async function assertBindingAccess(resourceType: string, resourceId: string, mode: 'read' | 'manage') {
  const session = await requireAuth();
  switch (resourceType) {
    case 'CONTENT': return assertItemAccess('CONTENT', resourceId, mode);
    case 'ASSIGNMENT': return assertItemAccess('ASSIGNMENT', resourceId, mode);
    case 'BANK_QUESTION': return assertBankResource('question', resourceId, mode);
    case 'QUIZ_QUESTION': {
      const question = await db.quizQuestion.findUniqueOrThrow({ where: { id: resourceId }, select: { quizId: true } });
      return assertItemAccess('QUIZ', question.quizId, mode);
    }
    case 'ATTEMPT': {
      const attempt = await db.quizAttempt.findUniqueOrThrow({ where: { id: resourceId }, select: { quizId: true, userId: true, isVoided: true } });
      if (mode === 'manage' || attempt.isVoided) throw new Error('Akses ditolak');
      const access = await assertItemAccess('QUIZ', attempt.quizId);
      if (session.user.role === 'STUDENT' && session.user.id !== attempt.userId) throw new Error('Akses ditolak');
      return access;
    }
    case 'SUBMISSION': {
      const submission = await db.assignmentSubmission.findUniqueOrThrow({ where: { id: resourceId }, select: { userId: true, assignmentId: true } });
      if (session.user.id === submission.userId) return assertItemAccess('ASSIGNMENT', submission.assignmentId);
      if (mode === 'manage') throw new Error('Akses ditolak: Hanya pemilik dapat melampirkan submission');
      const target = await db.assignment.findUniqueOrThrow({ where: { id: submission.assignmentId }, include: { module: true } });
      return assertCourseAccess(target.module.courseId, 'roster');
    }
    case 'LOGO':
      if (mode === 'manage' && session.user.role !== 'SUPER_ADMIN' && (session.user.role !== 'ADMIN' || session.user.schoolId !== resourceId)) throw new Error('Akses ditolak');
      if (mode === 'read' && session.user.schoolId !== resourceId && session.user.role !== 'SUPER_ADMIN') throw new Error('Akses ditolak');
      return;
    case 'AVATAR':
      if (mode === 'manage' && session.user.id !== resourceId) throw new Error('Akses ditolak');
      if (mode === 'read' && session.user.id !== resourceId && session.user.role !== 'SUPER_ADMIN') {
        const target = await db.user.findUniqueOrThrow({ where: { id: resourceId }, select: { schoolId: true } });
        if (target.schoolId !== session.user.schoolId) throw new Error('Akses ditolak');
      }
      return;
    default: throw new Error('Binding file tidak dikenal');
  }
}

export async function assertFileReferences(values: unknown) {
  const filenames = fileNamesIn(values);
  if (!filenames.length) return [];
  const session = await requireAuth();
  const assets = await db.fileAsset.findMany({ where: { filename: { in: filenames } }, include: { bindings: true } });
  if (assets.length !== filenames.length) throw new Error('File belum terdaftar; diperlukan rekonsiliasi aset lama');
  for (const asset of assets) {
    let allowed = asset.uploaderId === session.user.id;
    if (!allowed) for (const binding of asset.bindings) {
      try { await assertBindingAccess(binding.resourceType, binding.resourceId, 'manage'); allowed = true; break; } catch {}
    }
    if (!allowed || asset.state === 'QUARANTINED') throw new Error('Akses ditolak: File bukan milik resource berwenang');
  }
  return assets;
}

export async function bindFileReferences(resourceType: FilePurpose, resourceId: string, values: unknown) {
  const assets = await assertFileReferences(values);
  await assertBindingAccess(resourceType, resourceId, 'manage');
  if ((resourceType === 'LOGO' || resourceType === 'AVATAR') && assets.some((asset) => !asset.contentType.startsWith('image/') || asset.contentType === 'image/svg+xml')) throw new Error('Logo dan avatar harus berupa gambar raster');
  await db.$transaction([db.fileBinding.deleteMany({ where: { resourceType, resourceId, assetId: { notIn: assets.map((asset) => asset.id) } } }), ...assets.flatMap((asset) => [
    db.fileBinding.upsert({ where: { assetId_resourceType_resourceId: { assetId: asset.id, resourceType, resourceId } }, create: { assetId: asset.id, resourceType, resourceId }, update: {} }),
    db.fileAsset.update({ where: { id: asset.id }, data: { state: 'ATTACHED' } }),
  ])]);
}

export async function authorizeFileRead(filename: string) {
  const asset = await db.fileAsset.findUnique({ where: { filename }, include: { bindings: true } });
  if (!asset || asset.state === 'QUARANTINED') throw new Error('File tidak ditemukan atau belum direkonsiliasi');
  const logo = asset.bindings.find((binding) => binding.resourceType === 'LOGO');
  if (logo && asset.contentType.startsWith('image/') && await db.school.findFirst({ where: { id: logo.resourceId, logo: `/api/files/${filename}`, isActive: true } })) return { asset, publicLogo: true };
  const session = await requireAuth();
  if (asset.state === 'STAGED' && asset.uploaderId === session.user.id && Date.now() - asset.createdAt.getTime() < 24 * 60 * 60 * 1000) return { asset, publicLogo: false };
  for (const binding of asset.bindings) {
    try { await assertBindingAccess(binding.resourceType, binding.resourceId, 'read'); return { asset, publicLogo: false }; } catch {}
  }
  throw new Error('Akses ditolak: File tidak tersedia untuk akun Anda');
}

export async function bindRecentCourseAssets(courseId: string, since: Date) {
  await assertCourseAccess(courseId, 'manage');
  const [contents, assignments, questions, bank] = await Promise.all([
    db.content.findMany({ where: { module: { courseId }, createdAt: { gte: since } } }),
    db.assignment.findMany({ where: { module: { courseId }, createdAt: { gte: since } } }),
    db.quizQuestion.findMany({ where: { quiz: { module: { courseId }, createdAt: { gte: since } } } }),
    db.questionBank.findMany({ where: { courseId, createdAt: { gte: since } } }),
  ]);
  for (const content of contents) await bindFileReferences('CONTENT', content.id, content);
  for (const assignment of assignments) await bindFileReferences('ASSIGNMENT', assignment.id, assignment);
  for (const question of questions) await bindFileReferences('QUIZ_QUESTION', question.id, question);
  for (const question of bank) await bindFileReferences('BANK_QUESTION', question.id, question);
}
