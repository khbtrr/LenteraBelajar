import { Client } from 'pg';
import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { readSnapshot } from '../src/lib/grading-policy.ts';
import { releaseTarget } from './release-report.mjs';

async function main() {
  if (!process.env.RELEASE_DATABASE_URL) throw new Error('RELEASE_DATABASE_URL must explicitly select the target');
  const target = releaseTarget(process.env.RELEASE_DATABASE_URL);
  const db = new Client({ connectionString: process.env.RELEASE_DATABASE_URL });
  await db.connect();
  try {
    await db.query('BEGIN ISOLATION LEVEL REPEATABLE READ READ ONLY');
    const columns = (await db.query('SELECT table_name, column_name, data_type, is_nullable FROM information_schema.columns WHERE table_schema=$1 ORDER BY table_name, ordinal_position', ['public'])).rows;
    const tables = [...new Set(columns.map((column) => column.table_name))];
    const has = (table, column) => columns.some((item) => item.table_name === table && item.column_name === column);
    const checks = {};
    const required = { User: ['sessionVersion'], Grade: ['resourceKey', 'includeInAverage'], QuizAttempt: ['isVoided'], XpLog: ['eventKey'], FileAsset: ['id', 'filename'], FileBinding: ['assetId'], RateLimitBucket: ['key'] };
    checks.missingReleaseSchema = Object.entries(required).flatMap(([table, names]) => names.filter((column) => !has(table, column)).map((column) => ({ table, column })));
    const indexes = (await db.query('SELECT indexname,indexdef FROM pg_indexes WHERE schemaname=$1', ['public'])).rows;
    const uniqueIndexes = ['QuizAttempt_one_active_per_student', 'QuizAnswer_attemptId_questionId_key', 'Grade_courseId_userId_resourceKey_key', 'CourseRequest_courseId_key', 'AcademicYear_one_active_per_school', 'XpLog_eventKey_key', 'FileAsset_filename_key', 'FileBinding_assetId_resourceType_resourceId_key'];
    checks.missingReleaseIndexes = uniqueIndexes.filter(name => !indexes.some(index => index.indexname === name && index.indexdef.includes('UNIQUE'))).map(name => ({ name }));
    if (tables.includes('RateLimitBucket')) checks.limiterTimestampType = columns.filter(column => column.table_name === 'RateLimitBucket' && column.column_name === 'expiresAt' && column.data_type !== 'timestamp with time zone');
    if (tables.includes('QuizAttempt')) {
      const active = `"submittedAt" IS NULL${has('QuizAttempt', 'isVoided') ? ' AND "isVoided"=false' : ''}`;
      checks.duplicateActiveAttempts = (await db.query(`SELECT "quizId", "userId", count(*)::int AS count FROM "QuizAttempt" WHERE ${active} GROUP BY "quizId", "userId" HAVING count(*)>1`)).rows;
      checks.missingActiveSnapshots = [];
      for (const row of (await db.query(`SELECT id,"questionSnapshot" FROM "QuizAttempt" WHERE ${active}`)).rows) {
        try { readSnapshot(row.questionSnapshot); }
        catch (error) { checks.missingActiveSnapshots.push({ id: row.id, reason: error.message }); }
      }
    }
    if (tables.includes('AcademicYear')) checks.multipleActiveYears = (await db.query('SELECT "schoolId", count(*)::int AS count FROM "AcademicYear" WHERE status=$1 GROUP BY "schoolId" HAVING count(*)>1', ['ACTIVE'])).rows;
    if (tables.includes('CourseRequest')) checks.duplicateRequestCourses = (await db.query('SELECT "courseId", count(*)::int AS count FROM "CourseRequest" WHERE "courseId" IS NOT NULL GROUP BY "courseId" HAVING count(*)>1')).rows;
    if (tables.includes('Grade')) checks.invalidGrades = (await db.query('SELECT "id", "type", "sourceId", "score", "maxScore" FROM "Grade" WHERE "maxScore"<=0 OR "score"<0 OR "score">"maxScore" OR "score" IN (\'NaN\'::float8,\'Infinity\'::float8,\'-Infinity\'::float8) OR "maxScore" IN (\'NaN\'::float8,\'Infinity\'::float8,\'-Infinity\'::float8)')).rows;
    if (tables.includes('LessonProgress')) checks.orphanProgress = (await db.query('SELECT p."id", p."contentId", p."courseId" FROM "LessonProgress" p LEFT JOIN "Content" c ON c."id"=p."contentId" LEFT JOIN "Course" k ON k."id"=p."courseId" WHERE c."id" IS NULL OR k."id" IS NULL')).rows;
    const blockers = Object.entries(checks).filter(([name, rows]) => rows.length && !(['missingReleaseSchema', 'missingReleaseIndexes', 'limiterTimestampType'].includes(name) && process.argv.includes('--before-migrate'))).map(([name]) => name);
    const report = { generatedAt: new Date().toISOString(), target, tables, columns, checks, blockers };
    await db.query('COMMIT');
    const output = path.resolve(process.env.RELEASE_REPORT_DIR || '.qa', 'release-preflight.json');
    await mkdir(path.dirname(output), { recursive: true });
    await writeFile(output, JSON.stringify(report, null, 2), { mode: 0o600 });
    console.log(JSON.stringify({ report: output, blockers, counts: Object.fromEntries(Object.entries(checks).map(([name, rows]) => [name, rows.length])) }));
    if (blockers.length) process.exitCode = 2;
  } finally { await db.end(); }
}
main().catch((error) => { console.error(error.message); process.exitCode = 1; });
