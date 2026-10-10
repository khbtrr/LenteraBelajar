import { PrismaClient } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';
import { createHash } from 'node:crypto';
import { mkdir, readFile, readdir, stat, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { gradeAnswers, readSnapshot } from '../src/lib/grading-policy';

async function main() {
  const url = process.env.RELEASE_DATABASE_URL;
  if (!url) throw new Error('RELEASE_DATABASE_URL must explicitly select the reviewed target');
  const db = new PrismaClient({ adapter: new PrismaPg({ connectionString: url }) });
  const reportPath = path.resolve(process.env.RELEASE_REPORT_DIR ?? '.qa', 'reconciliation-review.json');
  try {
    if (process.argv.includes('--apply')) {
      const reportBytes = await readFile(reportPath);
      const expectedHash = process.argv[process.argv.indexOf('--approved-hash') + 1];
      const actualHash = createHash('sha256').update(reportBytes).digest('hex');
      if (!process.argv.includes('--approved-hash') || actualHash !== expectedHash) throw new Error('Review the report and supply its exact SHA256 before applying');
      const report = JSON.parse(reportBytes.toString('utf8'));
      const target = new URL(url);
      if (report.target.host !== target.hostname || report.target.database !== target.pathname) throw new Error('Reviewed target differs from apply target');
      process.env.DATABASE_URL = url;
      const { syncQuizGrade } = await import('../src/lib/grade-projection');
      await db.$transaction(async (tx) => {
        for (const operation of report.operations) {
          if (operation.kind === 'attempt') {
            const current = await tx.quizAttempt.findUniqueOrThrow({ where: { id: operation.id }, include: { answers: true } });
            const fingerprint = createHash('sha256').update(JSON.stringify({ score: current.score, isGraded: current.isGraded,
              questionSnapshot: current.questionSnapshot, answers: current.answers.map(({ questionId, answer }) => ({ questionId, answer })).sort((a, b) => a.questionId.localeCompare(b.questionId)) })).digest('hex');
            if (fingerprint !== operation.beforeHash) throw new Error(`Data changed since review: ${operation.id}`);
            await tx.quizAttempt.update({ where: { id: operation.id }, data: operation.after });
            await syncQuizGrade(tx, current.quizId, current.userId);
          } else if (operation.kind === 'file') {
            const fileBytes = await readFile(path.join(path.resolve(process.env.RELEASE_UPLOAD_DIR ?? 'uploads'), operation.filename));
            if (createHash('sha256').update(fileBytes).digest('hex') !== operation.sha256 || fileBytes.length !== operation.size) throw new Error('File changed since review');
            const asset = await tx.fileAsset.upsert({ where: { filename: operation.filename }, create: { filename: operation.filename,
              contentType: operation.contentType, size: operation.size, sha256: operation.sha256, state: 'ATTACHED' }, update: {} });
            for (const binding of operation.bindings) await tx.fileBinding.upsert({
              where: { assetId_resourceType_resourceId: { assetId: asset.id, ...binding } }, create: { assetId: asset.id, ...binding }, update: {},
            });
          } else throw new Error('Unsupported reviewed operation');
        }
      }, { timeout: 120000 });
      await writeFile(path.join(path.dirname(reportPath), 'reconciliation-applied.json'), JSON.stringify({ appliedAt: new Date().toISOString(), approvedHash: actualHash, operationCount: report.operations.length }));
      console.log(`Applied ${report.operations.length} reviewed operations and synchronized quiz grades`);
      return;
    }

    const operations: object[] = [], needsReview: object[] = [];
    for (const grade of await db.grade.findMany({ where: { resourceKey: null }, select: { id: true, type: true, sourceId: true } })) {
      needsReview.push({ kind: 'legacy-grade-identity', ...grade, reason: 'Review resource identity; never match a grade by title alone' });
    }
    const attempts = await db.quizAttempt.findMany({ where: { submittedAt: { not: null }, isVoided: false }, include: { answers: true } });
    for (const attempt of attempts) {
      try {
        const questions = readSnapshot(attempt.questionSnapshot);
        if (questions.some((question) => question.type === 'ESSAY')) continue;
        const answers = attempt.answers.map(({ questionId, answer }) => ({ questionId, answer: answer ?? '' }));
        const result = gradeAnswers(questions, answers);
        if (result.score !== attempt.score || result.isGraded !== attempt.isGraded) {
          const beforeHash = createHash('sha256').update(JSON.stringify({ score: attempt.score, isGraded: attempt.isGraded,
            questionSnapshot: attempt.questionSnapshot, answers: attempt.answers.map(({ questionId, answer }) => ({ questionId, answer })).sort((a, b) => a.questionId.localeCompare(b.questionId)) })).digest('hex');
          operations.push({ kind: 'attempt', id: attempt.id, before: { score: attempt.score, isGraded: attempt.isGraded }, beforeHash,
            after: { score: result.score, isGraded: result.isGraded }, reason: 'Snapshot-based objective result; reviewer must confirm answers represent the final submission' });
        }
      } catch { needsReview.push({ kind: 'legacy-snapshot', id: attempt.id, reason: 'Cannot reconstruct the historical question key' }); }
    }
    const references = new Map<string, { resourceType: string; resourceId: string; schoolId: string | null }[]>();
    const add = (type: string, id: string, schoolId: string | null, value: unknown) => {
      const serialized = typeof value === 'string' ? value : JSON.stringify(value);
      for (const match of serialized.matchAll(/\/api\/files\/([a-zA-Z0-9_.%-]+)/g)) {
        const filename = decodeURIComponent(match[1]);
        if (path.basename(filename) !== filename) continue;
        const current = references.get(filename) ?? [];
        if (!current.some((entry) => entry.resourceType === type && entry.resourceId === id)) current.push({ resourceType: type, resourceId: id, schoolId });
        references.set(filename, current);
      }
    };
    for (const row of await db.content.findMany({ include: { module: { include: { course: true } } } })) add('CONTENT', row.id, row.module.course.schoolId, [row.body, row.fileUrl]);
    for (const row of await db.assignment.findMany({ include: { module: { include: { course: true } } } })) add('ASSIGNMENT', row.id, row.module.course.schoolId, [row.description, row.fileUrl]);
    for (const row of await db.assignmentSubmission.findMany({ include: { assignment: { include: { module: { include: { course: true } } } } } })) add('SUBMISSION', row.id, row.assignment.module.course.schoolId, row.fileUrl);
    for (const row of await db.quizQuestion.findMany({ include: { quiz: { include: { module: { include: { course: true } } } } } })) add('QUIZ_QUESTION', row.id, row.quiz.module.course.schoolId, [row.text, row.options]);
    for (const row of await db.questionBank.findMany({ include: { course: true } })) add('BANK_QUESTION', row.id, row.course.schoolId, [row.text, row.options]);
    for (const row of await db.school.findMany()) add('LOGO', row.id, row.id, row.logo);
    for (const row of await db.user.findMany({ select: { id: true, avatar: true, schoolId: true } })) add('AVATAR', row.id, row.schoolId, row.avatar);
    const uploadDir = path.resolve(process.env.RELEASE_UPLOAD_DIR ?? 'uploads');
    const mime: Record<string, string> = { '.png': 'image/png', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.webp': 'image/webp', '.gif': 'image/gif' };
    for (const [filename, bindings] of references) {
      try {
        const filepath = path.join(uploadDir, filename), info = await stat(filepath);
        if (!info.isFile()) throw new Error('Not a file');
        if (new Set(bindings.map((binding) => binding.schoolId)).size > 1) { needsReview.push({ kind: 'ambiguous-file', filename, bindings }); continue; }
        if (await db.fileAsset.findUnique({ where: { filename } })) continue;
        operations.push({ kind: 'file', filename, size: info.size, sha256: createHash('sha256').update(await readFile(filepath)).digest('hex'),
          contentType: mime[path.extname(filename).toLowerCase()] ?? 'application/octet-stream', bindings: bindings.map(({ resourceType, resourceId }) => ({ resourceType, resourceId })) });
      } catch { needsReview.push({ kind: 'missing-file', filename }); }
    }
    const orphanFiles = (await readdir(uploadDir).catch(() => [])).filter((filename) => !references.has(filename));
    const target = new URL(url);
    await mkdir(path.dirname(reportPath), { recursive: true });
    const report = { createdAt: new Date().toISOString(), target: { host: target.hostname, database: target.pathname }, operations, needsReview, orphanFiles };
    const bytes = JSON.stringify(report, null, 2);
    await writeFile(reportPath, bytes, { mode: 0o600 });
    console.log(JSON.stringify({ report: reportPath, sha256: createHash('sha256').update(bytes).digest('hex'), proposed: operations.length, needsReview: needsReview.length, orphanFiles: orphanFiles.length }));
  } finally { await db.$disconnect(); }
}
main().catch((error) => { console.error(error.message); process.exitCode = 1; });
