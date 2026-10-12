import { PrismaClient, type Prisma, type Grade } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';
import { createHash } from 'node:crypto';
import { mkdir, readFile, readdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { gradeAnswers, readSnapshot } from '../src/lib/grading-policy';
import { loadCourseGrades } from '../src/lib/course-grades';
import { approvedReport, fingerprint, readUpload, releaseTarget } from './release-report.mjs';

type ReleaseClient = PrismaClient | Prisma.TransactionClient;
async function resolveGradeIdentity(client: ReleaseClient, grade: Grade) {
  if (!grade.sourceId || !['QUIZ', 'ASSIGNMENT'].includes(grade.type)) return null;
  let resourceKey: string | null = null;
  if (grade.type === 'ASSIGNMENT') {
    const assignment = await client.assignment.findUnique({ where: { id: grade.sourceId }, include: { module: true } });
    if (assignment?.module.courseId === grade.courseId) resourceKey = `ASSIGNMENT:${assignment.id}`;
  } else {
    const attempt = await client.quizAttempt.findUnique({ where: { id: grade.sourceId }, include: { quiz: { include: { module: true } } } });
    const quiz = attempt?.quiz ?? await client.quiz.findUnique({ where: { id: grade.sourceId }, include: { module: true } });
    if (quiz?.module.courseId === grade.courseId && (!attempt || attempt.userId === grade.userId)) resourceKey = `QUIZ:${quiz.isRemedial && quiz.parentQuizId ? quiz.parentQuizId : quiz.id}`;
  }
  if (resourceKey && await client.grade.findFirst({ where: { courseId: grade.courseId, userId: grade.userId, resourceKey, id: { not: grade.id } } })) return null;
  return resourceKey;
}

async function bindingReference(client: ReleaseClient, type: string, id: string) {
  switch (type) {
    case 'CONTENT': { const row = await client.content.findUniqueOrThrow({ where: { id }, include: { module: { include: { course: true } } } }); return { schoolId: row.module.course.schoolId, value: [row.body, row.fileUrl] }; }
    case 'ASSIGNMENT': { const row = await client.assignment.findUniqueOrThrow({ where: { id }, include: { module: { include: { course: true } } } }); return { schoolId: row.module.course.schoolId, value: [row.description, row.fileUrl] }; }
    case 'SUBMISSION': { const row = await client.assignmentSubmission.findUniqueOrThrow({ where: { id }, include: { assignment: { include: { module: { include: { course: true } } } } } }); return { schoolId: row.assignment.module.course.schoolId, value: row.fileUrl }; }
    case 'QUIZ_QUESTION': { const row = await client.quizQuestion.findUniqueOrThrow({ where: { id }, include: { quiz: { include: { module: { include: { course: true } } } } } }); return { schoolId: row.quiz.module.course.schoolId, value: [row.text, row.options] }; }
    case 'BANK_QUESTION': { const row = await client.questionBank.findUniqueOrThrow({ where: { id }, include: { course: true } }); return { schoolId: row.course.schoolId, value: [row.text, row.options] }; }
    case 'ATTEMPT': { const row = await client.quizAttempt.findUniqueOrThrow({ where: { id }, include: { quiz: { include: { module: { include: { course: true } } } } } }); return { schoolId: row.quiz.module.course.schoolId, value: row.questionSnapshot }; }
    case 'LOGO': { const row = await client.school.findUniqueOrThrow({ where: { id } }); return { schoolId: row.id, value: row.logo }; }
    case 'AVATAR': { const row = await client.user.findUniqueOrThrow({ where: { id } }); return { schoolId: row.schoolId, value: row.avatar }; }
    default: throw new Error('Unsupported file binding');
  }
}

async function main() {
  const url = process.env.RELEASE_DATABASE_URL;
  if (!url) throw new Error('RELEASE_DATABASE_URL must explicitly select the reviewed target');
  if (!process.env.RELEASE_UPLOAD_DIR) throw new Error('RELEASE_UPLOAD_DIR must explicitly select the reviewed uploads');
  const target = releaseTarget(url);
  const db = new PrismaClient({ adapter: new PrismaPg({ connectionString: url }) });
  const reportPath = path.resolve(process.env.RELEASE_REPORT_DIR ?? '.qa', 'reconciliation-review.json');
  try {
    if (process.argv.includes('--apply')) {
      const reportBytes = await readFile(reportPath);
      const expectedHash = process.argv[process.argv.indexOf('--approved-hash') + 1];
      const actualHash = createHash('sha256').update(reportBytes).digest('hex');
      const report = approvedReport(reportBytes, process.argv.includes('--approved-hash') ? expectedHash : undefined, target);
      process.env.DATABASE_URL = url;
      const { syncQuizGrade } = await import('../src/lib/grade-projection');
      await db.$transaction(async (tx) => {
        for (const operation of report.operations) {
          if (operation.kind === 'attempt') {
            const current = await tx.quizAttempt.findUniqueOrThrow({ where: { id: operation.id }, include: { answers: true } });
            if (!current.submittedAt || current.isVoided || current.quizId !== operation.quizId || current.userId !== operation.userId) throw new Error('Attempt identity/state changed since review');
            const fingerprint = createHash('sha256').update(JSON.stringify({ score: current.score, isGraded: current.isGraded,
              questionSnapshot: current.questionSnapshot, answers: current.answers.map(({ questionId, answer }) => ({ questionId, answer })).sort((a, b) => a.questionId.localeCompare(b.questionId)) })).digest('hex');
            if (fingerprint !== operation.beforeHash) throw new Error(`Data changed since review: ${operation.id}`);
            const questions = readSnapshot(current.questionSnapshot);
            if (current.answers.some(answer => !questions.some(question => question.id === answer.questionId))) throw new Error('Historical answers are outside snapshot');
            if (questions.some(question => question.type === 'ESSAY')) throw new Error('Essay corrections require teacher review');
            const result = gradeAnswers(questions, current.answers.map(({ questionId, answer }) => ({ questionId, answer: answer ?? '' })));
            if (result.score !== operation.after.score || result.isGraded !== operation.after.isGraded) throw new Error('Proposed score differs from snapshot calculation');
            for (const answer of result.answers) await tx.quizAnswer.updateMany({ where: { attemptId: current.id, questionId: answer.questionId }, data: { score: answer.score } });
            await tx.quizAttempt.update({ where: { id: operation.id }, data: { score: result.score, isGraded: result.isGraded } });
            await syncQuizGrade(tx, current.quizId, current.userId);
          } else if (operation.kind === 'grade-identity') {
            const grade = await tx.grade.findUniqueOrThrow({ where: { id: operation.id } });
            if (fingerprint(grade) !== operation.beforeHash) throw new Error('Grade changed since review');
            const expected = await resolveGradeIdentity(tx, grade);
            if (!expected || expected !== operation.resourceKey) throw new Error('Grade resource identity changed since review');
            await tx.grade.update({ where: { id: grade.id }, data: { resourceKey: expected } });
          } else if (operation.kind === 'file') {
            const fileBytes = await readUpload(path.resolve(process.env.RELEASE_UPLOAD_DIR ?? 'uploads'), operation.filename);
            if (createHash('sha256').update(fileBytes).digest('hex') !== operation.sha256 || fileBytes.length !== operation.size) throw new Error('File changed since review');
            for (const binding of operation.bindings) {
              const current = await bindingReference(tx, binding.resourceType, binding.resourceId);
              const names = [...JSON.stringify(current.value ?? '').matchAll(/\/api\/files\/([a-zA-Z0-9_.%-]+)/g)].map(match => decodeURIComponent(match[1]));
              if (current.schoolId !== operation.schoolId || !names.includes(operation.filename)) throw new Error('File resource/school/reference changed since review');
            }
            const existing = await tx.fileAsset.findUnique({ where: { filename: operation.filename } });
            if (existing && (existing.state === 'QUARANTINED' || existing.sha256 !== operation.sha256 || existing.size !== operation.size)) throw new Error('File registry changed since review');
            const asset = await tx.fileAsset.upsert({ where: { filename: operation.filename }, create: { filename: operation.filename,
              schoolId: operation.schoolId, contentType: operation.contentType, size: operation.size, sha256: operation.sha256, state: 'ATTACHED' }, update: { state: 'ATTACHED' } });
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
    for (const grade of await db.grade.findMany({ where: { resourceKey: null, type: { in: ['QUIZ', 'ASSIGNMENT'] } } })) {
      const resourceKey = await resolveGradeIdentity(db, grade);
      if (resourceKey) operations.push({ kind: 'grade-identity', id: grade.id, resourceKey, before: { courseId: grade.courseId, userId: grade.userId, sourceId: grade.sourceId, score: grade.score, maxScore: grade.maxScore }, beforeHash: fingerprint(grade), reason: 'Exact source/course/user identity; score is preserved' });
      else needsReview.push({ kind: 'legacy-grade-identity', id: grade.id, type: grade.type, sourceId: grade.sourceId, reason: 'Source missing, ambiguous or conflicting; retain excluded historical grade' });
    }
    const identities = operations.filter((operation): operation is { kind: string; id: string; resourceKey: string; beforeHash: string; reason: string } => 'resourceKey' in operation);
    for (const operation of identities) {
      const grade = await db.grade.findUniqueOrThrow({ where: { id: operation.id } });
      const conflicts = [];
      for (const other of await db.grade.findMany({ where: { courseId: grade.courseId, userId: grade.userId, id: { not: grade.id } } })) {
        if (await resolveGradeIdentity(db, other) === operation.resourceKey) conflicts.push(other.id);
      }
      if (conflicts.length) {
        operations.splice(operations.indexOf(operation), 1);
        needsReview.push({ kind: 'duplicate-grade-identity', id: grade.id, conflictingIds: conflicts });
      }
    }
    const attempts = await db.quizAttempt.findMany({ where: { isVoided: false }, include: { answers: true } });
    for (const attempt of attempts) {
      try {
        const questions = readSnapshot(attempt.questionSnapshot);
        if (attempt.answers.some(answer => !questions.some(question => question.id === answer.questionId))) { needsReview.push({ kind: 'answers-outside-snapshot', id: attempt.id }); continue; }
        if (!attempt.submittedAt) continue;
        if (questions.some((question) => question.type === 'ESSAY')) {
          if (attempt.isGraded && questions.some(question => {
            const answer = attempt.answers.find(answer => answer.questionId === question.id);
            return !answer || answer.score === null || !Number.isFinite(answer.score) || answer.score < 0 || answer.score > question.points;
          })) needsReview.push({ kind: 'essay-grading-state', id: attempt.id, reason: 'Teacher must verify historical essay grading' });
          continue;
        }
        const answers = attempt.answers.map(({ questionId, answer }) => ({ questionId, answer: answer ?? '' }));
        const result = gradeAnswers(questions, answers);
        if (result.score !== attempt.score || result.isGraded !== attempt.isGraded) {
          const beforeHash = createHash('sha256').update(JSON.stringify({ score: attempt.score, isGraded: attempt.isGraded,
            questionSnapshot: attempt.questionSnapshot, answers: attempt.answers.map(({ questionId, answer }) => ({ questionId, answer })).sort((a, b) => a.questionId.localeCompare(b.questionId)) })).digest('hex');
          operations.push({ kind: 'attempt', id: attempt.id, quizId: attempt.quizId, userId: attempt.userId, before: { score: attempt.score, isGraded: attempt.isGraded }, beforeHash,
            after: { score: result.score, isGraded: result.isGraded }, reason: 'Snapshot-based objective result; reviewer must confirm answers represent the final submission' });
        }
      } catch { needsReview.push({ kind: 'legacy-snapshot', id: attempt.id, active: !attempt.submittedAt, reason: 'Cannot reconstruct the historical question key; no automatic grading' }); }
    }
    const references = new Map<string, { resourceType: string; resourceId: string; schoolId: string | null }[]>();
    const add = (type: string, id: string, schoolId: string | null, value: unknown) => {
      const serialized = typeof value === 'string' ? value : JSON.stringify(value ?? '');
      for (const match of serialized.matchAll(/\/api\/files\/([a-zA-Z0-9_.%-]+)/g)) {
        let filename: string;
        try { filename = decodeURIComponent(match[1]); }
        catch { needsReview.push({ kind: 'invalid-file-reference', resourceType: type, resourceId: id }); continue; }
        if (path.basename(filename) !== filename || /[/\\\x00]/.test(filename) || ['.', '..'].includes(filename)) {
          needsReview.push({ kind: 'invalid-file-reference', resourceType: type, resourceId: id }); continue;
        }
        const current = references.get(filename) ?? [];
        if (!current.some((entry) => entry.resourceType === type && entry.resourceId === id)) current.push({ resourceType: type, resourceId: id, schoolId });
        references.set(filename, current);
      }
    };
    for (const row of await db.content.findMany({ include: { module: { include: { course: true } } } })) add('CONTENT', row.id, row.module.course.schoolId, [row.body, row.fileUrl]);
    for (const row of await db.assignment.findMany({ include: { module: { include: { course: true } } } })) add('ASSIGNMENT', row.id, row.module.course.schoolId, [row.description, row.fileUrl]);
    for (const row of await db.assignmentSubmission.findMany({ include: { assignment: { include: { module: { include: { course: true } } } } } })) {
      add('SUBMISSION', row.id, row.assignment.module.course.schoolId, row.fileUrl);
      if (row.score !== null && row.gradedAt && row.assignment.isPublished) {
        const projection = await loadCourseGrades(row.assignment.module.courseId, [row.userId], db);
        if (projection.scores.get(row.userId)?.assignment[row.assignmentId] === null) needsReview.push({ kind: 'graded-outside-cohort', id: row.id, userId: row.userId, assignmentId: row.assignmentId, reason: 'Reviewed membership/override decision required; grade retained' });
      } else if (row.score !== null && !row.gradedAt) needsReview.push({ kind: 'missing-grading-state', id: row.id });
    }
    for (const row of await db.quizAttempt.findMany({ include: { quiz: { include: { module: true } } } })) add('ATTEMPT', row.id, (await db.course.findUniqueOrThrow({ where: { id: row.quiz.module.courseId }, select: { schoolId: true } })).schoolId, row.questionSnapshot);
    for (const row of await db.quizQuestion.findMany({ include: { quiz: { include: { module: { include: { course: true } } } } } })) add('QUIZ_QUESTION', row.id, row.quiz.module.course.schoolId, [row.text, row.options]);
    for (const row of await db.questionBank.findMany({ include: { course: true } })) add('BANK_QUESTION', row.id, row.course.schoolId, [row.text, row.options]);
    for (const row of await db.school.findMany()) add('LOGO', row.id, row.id, row.logo);
    for (const row of await db.user.findMany({ select: { id: true, avatar: true, schoolId: true } })) add('AVATAR', row.id, row.schoolId, row.avatar);
    const uploadDir = path.resolve(process.env.RELEASE_UPLOAD_DIR ?? 'uploads');
    const mime: Record<string, string> = { '.pdf': 'application/pdf', '.txt': 'text/plain', '.mp4': 'video/mp4', '.mp3': 'audio/mpeg', '.png': 'image/png', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.webp': 'image/webp', '.gif': 'image/gif' };
    for (const [filename, bindings] of references) {
      try {
        const bytes = await readUpload(uploadDir, filename);
        const info = { size: bytes.length };
        if (new Set(bindings.map((binding) => binding.schoolId)).size > 1) { needsReview.push({ kind: 'ambiguous-file', filename, bindings }); continue; }
        const asset = await db.fileAsset.findUnique({ where: { filename }, include: { bindings: true } });
        const sha256 = createHash('sha256').update(bytes).digest('hex');
        if (asset && (asset.state === 'QUARANTINED' || asset.size !== info.size || asset.sha256 !== sha256)) { needsReview.push({ kind: 'file-integrity', filename }); continue; }
        if (asset && bindings.every(binding => asset.bindings.some(current => current.resourceType === binding.resourceType && current.resourceId === binding.resourceId))) continue;
        operations.push({ kind: 'file', filename, schoolId: bindings[0].schoolId, size: info.size, sha256,
          contentType: mime[path.extname(filename).toLowerCase()] ?? 'application/octet-stream', bindings: bindings.map(({ resourceType, resourceId }) => ({ resourceType, resourceId })) });
      } catch { needsReview.push({ kind: 'missing-file', filename }); }
    }
    const orphanFiles = (await readdir(uploadDir)).filter((filename) => !references.has(filename));
    await mkdir(path.dirname(reportPath), { recursive: true });
    const report = { createdAt: new Date().toISOString(), target, operations, needsReview, orphanFiles, orphanPolicy: 'Retain unregistered; never publish/delete automatically' };
    const bytes = JSON.stringify(report, null, 2);
    await writeFile(reportPath, bytes, { mode: 0o600 });
    console.log(JSON.stringify({ report: reportPath, sha256: createHash('sha256').update(bytes).digest('hex'), proposed: operations.length, needsReview: needsReview.length, orphanFiles: orphanFiles.length }));
    if (process.argv.includes('--check') && (operations.length || needsReview.length)) process.exitCode = 2;
  } finally { await db.$disconnect(); }
}
main().catch((error) => { console.error(error.message); process.exitCode = 1; });
