import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { Client } from 'pg';
import { createHash } from 'node:crypto';

const exec = promisify(execFile);
const prefix = `release-${Date.now()}`;
const reportDir = path.resolve('.qa', prefix);
const uploads = path.join(reportDir, 'uploads');
const db = new Client({ connectionString: process.env.DATABASE_URL });
const target = process.env.DATABASE_URL!;
async function run(script: string, args: string[] = []) {
  try { const result = await exec(process.execPath, ['--conditions=react-server', '--import', 'tsx', script, ...args], { env: { ...process.env, RELEASE_DATABASE_URL: target, RELEASE_REPORT_DIR: reportDir, RELEASE_UPLOAD_DIR: uploads } }); return { code: 0, ...result }; }
  catch (error) { const result = error as { code: number; stdout: string; stderr: string }; return result; }
}
beforeAll(async () => {
  await db.connect(); await mkdir(uploads, { recursive: true });
  await db.query('INSERT INTO "School" (id,name,code,"updatedAt") VALUES ($1,$1,$1,now())', [prefix]);
  await db.query('INSERT INTO "User" (id,email,name,"passwordHash",role,"schoolId","updatedAt") VALUES ($1,$1,$1,\'test-only\',\'STUDENT\',$2,now())', [prefix, prefix]);
  await db.query('INSERT INTO "AcademicYear" (id,name,"schoolId","startDate","endDate","updatedAt",status) VALUES ($1,$1,$1,now(),now(),now(),\'PLANNED\')', [prefix]);
  await db.query('INSERT INTO "Course" (id,title,"schoolId","teacherId","academicYearId","updatedAt") VALUES ($1,$1,$1,$1,$1,now())', [prefix]);
  await db.query('INSERT INTO "Module" (id,title,"courseId","updatedAt") VALUES ($1,$1,$1,now())', [prefix]);
  for (const kind of ['null', 'invalid', 'voided']) {
    const id = `${prefix}-${kind}`;
    await db.query('INSERT INTO "Quiz" (id,title,"moduleId","updatedAt") VALUES ($1,$1,$2,now())', [id, prefix]);
    const snapshot = kind === 'invalid' ? [{ id: 'q', type: 'MULTIPLE_CHOICE', points: 1, options: [] }] : null;
    await db.query('INSERT INTO "QuizAttempt" (id,"quizId","userId","questionSnapshot","isVoided") VALUES ($1,$1,$2,$3::jsonb,$4)', [id, prefix, JSON.stringify(snapshot), kind === 'voided']);
  }
});
afterAll(async () => {
  await db.query('DELETE FROM "QuizAttempt" WHERE "userId"=$1', [prefix]);
  await db.query('DELETE FROM "Grade" WHERE "courseId"=$1', [prefix]);
  await db.query('DELETE FROM "Course" WHERE id=$1', [prefix]);
  await db.query('DELETE FROM "User" WHERE id=$1', [prefix]);
  await db.query('DELETE FROM "AcademicYear" WHERE id=$1', [prefix]);
  await db.query('DELETE FROM "Cohort" WHERE "schoolId"=$1', [prefix]);
  await db.query('DELETE FROM "School" WHERE id=$1', [prefix]);
  await db.end();
});
describe('release tools against PostgreSQL', () => {
  it('blocks JSON null and malformed keys while excluding voided attempts', async () => {
    const result = await run('scripts/release-preflight.mjs');
    expect(result.code).toBe(2);
    const report = JSON.parse(await readFile(path.join(reportDir, 'release-preflight.json'), 'utf8'));
    const ids = report.checks.missingActiveSnapshots.map((row: { id: string }) => row.id);
    expect(ids).toContain(`${prefix}-null`); expect(ids).toContain(`${prefix}-invalid`);
    expect(ids).not.toContain(`${prefix}-voided`);
    expect(report.blockers).toContain('missingActiveSnapshots');
  });
  it('does not silently approve missing historical sources or an active snapshot', async () => {
    await db.query('INSERT INTO "Grade" (id,"courseId","userId",label,score,type,"sourceId","updatedAt") VALUES ($1,$2,$2,\'historical\',75,\'QUIZ\',\'missing\',now())', [`${prefix}-grade`, prefix]);
    await writeFile(path.join(uploads, 'orphan.txt'), 'Retain this file');
    const result = await run('scripts/reconcile-release.ts', ['--check']);
    expect(result.code).toBe(2);
    const report = JSON.parse(await readFile(path.join(reportDir, 'reconciliation-review.json'), 'utf8'));
    expect(report.needsReview).toContainEqual(expect.objectContaining({ id: `${prefix}-grade`, kind: 'legacy-grade-identity' }));
    expect(report.needsReview).toContainEqual(expect.objectContaining({ id: `${prefix}-null`, active: true, kind: 'legacy-snapshot' }));
    expect(report.orphanFiles).toContain('orphan.txt');
    expect((await readFile(path.join(uploads, 'orphan.txt'), 'utf8'))).toBe('Retain this file');
  });
  it('blocks nonfinite scales rather than reporting a valid grade', async () => {
    const id = `${prefix}-invalid-scale`;
    await db.query('INSERT INTO "Grade" (id,"courseId","userId",label,score,"maxScore",type,"updatedAt") VALUES ($1,$2,$2,\'invalid scale\',50,\'NaN\'::float8,\'MANUAL\',now())', [id, prefix]);
    const result = await run('scripts/release-preflight.mjs');
    expect(result.code).toBe(2);
    const report = JSON.parse(await readFile(path.join(reportDir, 'release-preflight.json'), 'utf8'));
    expect(report.checks.invalidGrades).toContainEqual(expect.objectContaining({ id }));
    expect(report.blockers).toContain('invalidGrades');
  });
  it('refuses an approved report aimed at a different port', async () => {
    const filename = path.join(reportDir, 'reconciliation-review.json');
    const report = JSON.parse(await readFile(filename, 'utf8'));
    report.target.port = '55433';
    const bytes = JSON.stringify(report);
    await writeFile(filename, bytes);
    const hash = createHash('sha256').update(bytes).digest('hex');
    const result = await run('scripts/reconcile-release.ts', ['--apply', '--approved-hash', hash]);
    expect(result.code).toBe(1); expect(result.stderr).toContain('target differs');
    expect((await db.query('SELECT score FROM "Grade" WHERE id=$1', [`${prefix}-grade`])).rows[0].score).toBe(75);
  });
  it('proposes an exact assignment identity, preserves its score, and rejects changed evidence', async () => {
    const assignmentId = `${prefix}-assignment`;
    const gradeId = `${prefix}-linked-grade`;
    await db.query('INSERT INTO "Assignment" (id,title,"moduleId","updatedAt") VALUES ($1,$1,$2,now())', [assignmentId, prefix]);
    await db.query('INSERT INTO "Grade" (id,"courseId","userId",label,score,type,"sourceId","updatedAt") VALUES ($1,$2,$2,\'verified resource\',88,\'ASSIGNMENT\',$3,now())', [gradeId, prefix, assignmentId]);
    await run('scripts/reconcile-release.ts');
    const filename = path.join(reportDir, 'reconciliation-review.json');
    const bytes = await readFile(filename);
    const report = JSON.parse(bytes.toString('utf8'));
    const operation = report.operations.find((item: { id: string }) => item.id === gradeId);
    expect(operation.resourceKey).toBe(`ASSIGNMENT:${assignmentId}`);
    report.operations = [operation];
    const selected = JSON.stringify(report);
    await writeFile(filename, selected);
    const hash = createHash('sha256').update(selected).digest('hex');
    const apply = await run('scripts/reconcile-release.ts', ['--apply', '--approved-hash', hash]);
    expect(apply.code, apply.stderr).toBe(0);
    const grade = (await db.query('SELECT score,"resourceKey" FROM "Grade" WHERE id=$1', [gradeId])).rows[0];
    expect(grade.score).toBe(88); expect(grade.resourceKey).toBe(`ASSIGNMENT:${assignmentId}`);
    await db.query('UPDATE "Grade" SET "resourceKey"=NULL,score=89 WHERE id=$1', [gradeId]);
    const changed = await run('scripts/reconcile-release.ts', ['--apply', '--approved-hash', hash]);
    expect(changed.code).toBe(1); expect(changed.stderr).toContain('Grade changed since review');
    expect((await db.query('SELECT score FROM "Grade" WHERE id=$1', [gradeId])).rows[0].score).toBe(89);
  });
  it('restores an existing registry binding and refuses a changed resource reference', async () => {
    const filename = `${prefix}-legacy.txt`;
    const contentId = `${prefix}-content`;
    await writeFile(path.join(uploads, filename), 'legacy content');
    const sha256 = createHash('sha256').update('legacy content').digest('hex');
    await db.query('INSERT INTO "Content" (id,title,type,"moduleId","fileUrl","updatedAt") VALUES ($1,$1,\'FILE\',$2,$3,now())', [contentId, prefix, `/api/files/${filename}`]);
    await db.query('INSERT INTO "FileAsset" (id,filename,"schoolId","contentType",size,sha256,state) VALUES ($1,$2,$3,\'text/plain\',14,$4,\'ATTACHED\')', [contentId, filename, prefix, sha256]);
    await run('scripts/reconcile-release.ts');
    const reportPath = path.join(reportDir, 'reconciliation-review.json');
    const report = JSON.parse(await readFile(reportPath, 'utf8'));
    const operation = report.operations.find((item: { filename: string }) => item.filename === filename);
    expect(operation.bindings).toContainEqual({ resourceType: 'CONTENT', resourceId: contentId });
    report.operations = [operation];
    const selected = JSON.stringify(report);
    await writeFile(reportPath, selected);
    const hash = createHash('sha256').update(selected).digest('hex');
    await db.query('UPDATE "Content" SET "fileUrl"=NULL WHERE id=$1', [contentId]);
    const stale = await run('scripts/reconcile-release.ts', ['--apply', '--approved-hash', hash]);
    expect(stale.code).toBe(1); expect(stale.stderr).toContain('reference changed');
    expect((await db.query('SELECT count(*)::int AS count FROM "FileBinding" WHERE "assetId"=$1', [contentId])).rows[0].count).toBe(0);
    await db.query('UPDATE "Content" SET "fileUrl"=$1 WHERE id=$2', [`/api/files/${filename}`, contentId]);
    const apply = await run('scripts/reconcile-release.ts', ['--apply', '--approved-hash', hash]);
    expect(apply.code, apply.stderr).toBe(0);
    expect((await db.query('SELECT count(*)::int AS count FROM "FileBinding" WHERE "assetId"=$1', [contentId])).rows[0].count).toBe(1);
    await db.query('DELETE FROM "FileAsset" WHERE id=$1', [contentId]);
  });
  it('includes files referenced only by historical attempt snapshots', async () => {
    const filename = `${prefix}-snapshot.png`;
    await writeFile(path.join(uploads, filename), 'test bytes');
    await db.query('UPDATE "QuizAttempt" SET "questionSnapshot"=$1::jsonb WHERE id=$2', [JSON.stringify([{ id: 'q', text: `<img src="/api/files/${filename}">`, type: 'ESSAY', points: 1 }]), `${prefix}-null`]);
    await run('scripts/reconcile-release.ts');
    const report = JSON.parse(await readFile(path.join(reportDir, 'reconciliation-review.json'), 'utf8'));
    const operation = report.operations.find((item: { filename: string }) => item.filename === filename);
    expect(operation.bindings).toContainEqual({ resourceType: 'ATTEMPT', resourceId: `${prefix}-null` });
    expect(report.orphanFiles).not.toContain(filename);
  });
  it('requires review for graded work outside cohort without broadening access', async () => {
    const id = `${prefix}-scope`;
    await db.query('INSERT INTO "Cohort" (id,name,"schoolId","updatedAt") VALUES ($1,$1,$2,now())', [id, prefix]);
    await db.query('INSERT INTO "Enrollment" (id,"courseId","userId",method) VALUES ($1,$1,$1,\'MANUAL\')', [prefix]);
    await db.query('INSERT INTO "Assignment" (id,title,"moduleId","isPublished","updatedAt") VALUES ($1,$1,$2,true,now())', [id, prefix]);
    await db.query('INSERT INTO "AssignmentCohortAccess" (id,"assignmentId","cohortId") VALUES ($1,$1,$1)', [id]);
    await db.query('INSERT INTO "AssignmentSubmission" (id,"assignmentId","userId","fileUrl","fileName","fileSize",score,"gradedAt") VALUES ($1,$1,$2,\'\',\'demo.txt\',0,100,now())', [id, prefix]);
    const result = await run('scripts/reconcile-release.ts', ['--check']);
    expect(result.code).toBe(2);
    const report = JSON.parse(await readFile(path.join(reportDir, 'reconciliation-review.json'), 'utf8'));
    expect(report.needsReview).toContainEqual(expect.objectContaining({ kind: 'graded-outside-cohort', id }));
    expect((await db.query('SELECT score FROM "AssignmentSubmission" WHERE id=$1', [id])).rows[0].score).toBe(100);
    expect((await db.query('SELECT count(*)::int AS count FROM "CohortMember" WHERE "userId"=$1', [prefix])).rows[0].count).toBe(0);
  });
});
