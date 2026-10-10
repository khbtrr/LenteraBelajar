import { PrismaClient } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';
import { Pool } from 'pg';
import { hash } from 'bcryptjs';
import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';

async function main() {
  const url = process.env.TEST_DATABASE_URL ?? 'postgresql://postgres:lentera-qa-only@127.0.0.1:55432/lentera_qa';
  const parsed = new URL(url);
  if (parsed.hostname !== '127.0.0.1' || parsed.port !== '55432' || parsed.pathname !== '/lentera_qa') throw new Error('QA fixtures require the isolated database');
  const db = new PrismaClient({ adapter: new PrismaPg(new Pool({ connectionString: url })) });
  const passwordHash = await hash('QaLentera2026!', 12);
  try {
    for (const suffix of ['a', 'b']) await db.school.upsert({ where: { id: `qa-e2e-${suffix}` }, create: { id: `qa-e2e-${suffix}`, code: `QA-E2E-${suffix}`, name: `Sekolah QA ${suffix.toUpperCase()}` }, update: { isActive: true } });
    const roles = ['SUPER_ADMIN', 'ADMIN', 'SUPERVISOR', 'TEACHER', 'STUDENT'] as const;
    for (const role of roles) {
      const id = `qa-e2e-${role.toLowerCase()}`;
      const data = { role, schoolId: 'qa-e2e-a', email: `${role.toLowerCase()}@e2e.test`, name: `QA ${role}`, passwordHash,
        isActive: true, mustChangePassword: false, sessionVersion: 0, locale: 'id' };
      await db.user.upsert({ where: { id }, create: { id, ...data }, update: data });
    }
    await db.academicYear.upsert({ where: { id: 'qa-e2e-year' }, create: { id: 'qa-e2e-year', schoolId: 'qa-e2e-a', name: 'QA 2026/2027', startDate: new Date('2026-07-01'), endDate: new Date('2027-06-30') }, update: {} });
    await db.course.upsert({ where: { id: 'qa-e2e-course' }, create: { id: 'qa-e2e-course', schoolId: 'qa-e2e-a', teacherId: 'qa-e2e-teacher', academicYearId: 'qa-e2e-year', title: 'Pelajaran QA', status: 'ACTIVE' }, update: {} });
    await db.enrollment.upsert({ where: { courseId_userId: { courseId: 'qa-e2e-course', userId: 'qa-e2e-student' } }, create: { courseId: 'qa-e2e-course', userId: 'qa-e2e-student', method: 'MANUAL' }, update: {} });
    await db.module.upsert({ where: { id: 'qa-e2e-module' }, create: { id: 'qa-e2e-module', courseId: 'qa-e2e-course', title: 'Bab QA' }, update: {} });
    await db.content.upsert({ where: { id: 'qa-e2e-lesson' }, create: { id: 'qa-e2e-lesson', moduleId: 'qa-e2e-module', title: 'Materi QA', type: 'TEXT', body: '<p>Materi QA untuk uji aksesibilitas.</p><svg onload="window.QAXSS=1"></svg>' }, update: {} });
    const uploadDir = path.resolve('.qa/uploads');
    await mkdir(uploadDir, { recursive: true });
    await writeFile(path.join(uploadDir, 'qa-e2e-private.txt'), 'File privat QA');
    const asset = await db.fileAsset.upsert({ where: { filename: 'qa-e2e-private.txt' }, create: { filename: 'qa-e2e-private.txt', uploaderId: 'qa-e2e-teacher', schoolId: 'qa-e2e-a', contentType: 'text/plain', size: 14, state: 'ATTACHED' }, update: {} });
    await db.fileBinding.upsert({ where: { assetId_resourceType_resourceId: { assetId: asset.id, resourceType: 'CONTENT', resourceId: 'qa-e2e-lesson' } }, create: { assetId: asset.id, resourceType: 'CONTENT', resourceId: 'qa-e2e-lesson' }, update: {} });
    await db.quiz.upsert({ where: { id: 'qa-e2e-practice' }, create: { id: 'qa-e2e-practice', moduleId: 'qa-e2e-module', title: 'Latihan QA', isPublished: true, duration: 60, maxAttempts: null, questionsPerPage: 1 }, update: {} });
    await db.quizQuestion.upsert({ where: { id: 'qa-e2e-question' }, create: { id: 'qa-e2e-question', quizId: 'qa-e2e-practice', text: 'Pertanyaan QA', type: 'MULTIPLE_CHOICE', points: 1, options: [{ id: 'correct', text: 'Jawaban benar QA', isCorrect: true }, { id: 'wrong', text: 'Jawaban salah QA', isCorrect: false }] }, update: {} });
    await db.rateLimitBucket.deleteMany({ where: { key: { startsWith: 'login:' } } });
    console.log('QA fixtures prepared in the isolated database');
  } finally { await db.$disconnect(); }
}
main().catch((error) => { console.error(error.message); process.exitCode = 1; });
