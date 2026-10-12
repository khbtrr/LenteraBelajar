import { Client } from 'pg';
import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { approvedReport, fingerprint, releaseTarget } from './release-report.mjs';

const knownAlignment = new Set([
  'ALTER TABLE "QuizAnswer" DROP CONSTRAINT "QuizAnswer_questionId_fkey"',
  'CREATE INDEX "QuizAnswer_questionId_idx" ON "QuizAnswer"("questionId")',
  'CREATE UNIQUE INDEX "QuizAnswer_attemptId_questionId_key" ON "QuizAnswer"("attemptId", "questionId")',
]);
async function main() {
  const url = process.env.RELEASE_DATABASE_URL;
  if (!url) throw new Error('RELEASE_DATABASE_URL must explicitly select the target');
  const target = releaseTarget(url);
  const reportPath = path.resolve(process.env.RELEASE_REPORT_DIR ?? '.qa', 'baseline-review.json');
  const db = new Client({ connectionString: url });
  await db.connect();
  const prisma = (args) => execFileSync(process.execPath, ['node_modules/prisma/build/index.js', ...args, '--config', 'prisma.config.release.ts'], { env: process.env, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] });
  try {
    const history = (await db.query("SELECT to_regclass('public._prisma_migrations') AS present")).rows[0].present;
    if (history && (await db.query('SELECT count(*)::int AS count FROM "_prisma_migrations"')).rows[0].count) throw new Error('Existing migration history: use migrate status/deploy, not baseline resolve');
    const sql = prisma(['migrate', 'diff', '--from-config-datasource', '--to-schema', 'prisma/baseline.prisma', '--script']);
    const statements = sql.replace(/^--.*$/gm, '').split(';').map(value => value.trim()).filter(Boolean);
    const blockers = statements.filter(statement => !knownAlignment.has(statement));
    const duplicateAnswers = (await db.query('SELECT "attemptId", "questionId", count(*)::int AS count FROM "QuizAnswer" GROUP BY "attemptId", "questionId" HAVING count(*)>1')).rows;
    const answerFingerprint = (await db.query('SELECT md5(coalesce(string_agg(to_jsonb(t)::text,E\'\\n\' ORDER BY to_jsonb(t)::text),\'\')) AS hash FROM "QuizAnswer" t')).rows[0].hash;
    const baselineHash = createHash('sha256').update(await readFile('prisma/baseline.prisma')).digest('hex');
    const report = { target, sql, statements, blockers, duplicateAnswers, answerFingerprint, baselineHash };
    if (process.argv.includes('--apply')) {
      if (process.env.MAINTENANCE_CONFIRMED !== 'yes' || process.env.BACKUP_VERIFIED !== 'yes') throw new Error('Baseline apply requires confirmed maintenance and verified backup');
      const saved = approvedReport(await readFile(reportPath), process.argv[process.argv.indexOf('--approved-hash') + 1], target);
      if (fingerprint(saved) !== fingerprint(report)) throw new Error('Schema/data changed since baseline review');
      if (blockers.length || duplicateAnswers.length) throw new Error('Unsupported schema drift or duplicate answers; baseline blocked');
      await db.query('BEGIN');
      try { for (const statement of statements) await db.query(statement); await db.query('COMMIT'); }
      catch (error) { await db.query('ROLLBACK'); throw error; }
      const remaining = prisma(['migrate', 'diff', '--from-config-datasource', '--to-schema', 'prisma/baseline.prisma', '--script']);
      if (remaining.replace(/^--.*$/gm, '').trim()) throw new Error('Baseline still differs; migration resolve refused');
      prisma(['migrate', 'resolve', '--applied', '20261009000000_baseline']);
      await writeFile(path.join(path.dirname(reportPath), 'baseline-applied.json'), JSON.stringify({ appliedAt: new Date().toISOString(), target, statements, baselineHash }));
      console.log('Reviewed alignment applied and matching baseline recorded; no data rows deleted');
    } else {
      await mkdir(path.dirname(reportPath), { recursive: true });
      const bytes = JSON.stringify(report, null, 2);
      await writeFile(reportPath, bytes, { mode: 0o600 });
      console.log(JSON.stringify({ report: reportPath, sha256: createHash('sha256').update(bytes).digest('hex'), proposed: statements.length, blockers: blockers.length, duplicateAnswers: duplicateAnswers.length }));
      if (blockers.length || duplicateAnswers.length) process.exitCode = 2;
    }
  } finally { await db.end(); }
}
main().catch(error => { console.error(error.message); process.exitCode = 1; });
