import { Client } from 'pg';
import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';

async function main() {
  if (!process.env.RELEASE_DATABASE_URL) throw new Error('RELEASE_DATABASE_URL must explicitly select the target');
  const db = new Client({ connectionString: process.env.RELEASE_DATABASE_URL });
  await db.connect();
  try {
    const tables = (await db.query('SELECT table_name FROM information_schema.tables WHERE table_schema=$1', ['public'])).rows.map((row) => row.table_name);
    const checks = {};
    if (tables.includes('QuizAttempt')) {
      checks.duplicateActiveAttempts = (await db.query('SELECT "quizId", "userId", count(*)::int AS count FROM "QuizAttempt" WHERE "submittedAt" IS NULL GROUP BY "quizId", "userId" HAVING count(*)>1')).rows;
      checks.missingActiveSnapshots = (await db.query('SELECT "id" FROM "QuizAttempt" WHERE "submittedAt" IS NULL AND ("questionSnapshot" IS NULL OR "questionSnapshot"=$1::jsonb)', ['[]'])).rows;
    }
    if (tables.includes('AcademicYear')) checks.multipleActiveYears = (await db.query('SELECT "schoolId", count(*)::int AS count FROM "AcademicYear" WHERE status=$1 GROUP BY "schoolId" HAVING count(*)>1', ['ACTIVE'])).rows;
    if (tables.includes('CourseRequest')) checks.duplicateRequestCourses = (await db.query('SELECT "courseId", count(*)::int AS count FROM "CourseRequest" WHERE "courseId" IS NOT NULL GROUP BY "courseId" HAVING count(*)>1')).rows;
    if (tables.includes('Grade')) checks.invalidGrades = (await db.query('SELECT "id", "type", "sourceId", "score", "maxScore" FROM "Grade" WHERE "maxScore"<=0 OR "score"<0 OR "score">"maxScore"')).rows;
    if (tables.includes('LessonProgress')) checks.orphanProgress = (await db.query('SELECT p."id", p."contentId", p."courseId" FROM "LessonProgress" p LEFT JOIN "Content" c ON c."id"=p."contentId" LEFT JOIN "Course" k ON k."id"=p."courseId" WHERE c."id" IS NULL OR k."id" IS NULL')).rows;
    const columns = (await db.query('SELECT table_name, column_name, data_type, is_nullable FROM information_schema.columns WHERE table_schema=$1 ORDER BY table_name, ordinal_position', ['public'])).rows;
    const blockers = Object.entries(checks).filter(([name, rows]) => ['duplicateActiveAttempts', 'multipleActiveYears', 'duplicateRequestCourses', 'missingActiveSnapshots'].includes(name) && rows.length).map(([name]) => name);
    const report = { generatedAt: new Date().toISOString(), target: { host: new URL(process.env.RELEASE_DATABASE_URL).hostname, database: new URL(process.env.RELEASE_DATABASE_URL).pathname }, tables, columns, checks, blockers };
    const output = path.resolve(process.env.RELEASE_REPORT_DIR || '.qa', 'release-preflight.json');
    await mkdir(path.dirname(output), { recursive: true });
    await writeFile(output, JSON.stringify(report, null, 2), { mode: 0o600 });
    console.log(JSON.stringify({ report: output, blockers, counts: Object.fromEntries(Object.entries(checks).map(([name, rows]) => [name, rows.length])) }));
    if (blockers.length) process.exitCode = 2;
  } finally { await db.end(); }
}
main().catch((error) => { console.error(error.message); process.exitCode = 1; });
