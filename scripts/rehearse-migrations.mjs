import { Client } from 'pg';
import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';

const base = new URL('postgresql://postgres:lentera-qa-only@127.0.0.1:55432/postgres');
const admin = new Client({ connectionString: base.toString() });
await admin.connect();
const report = [];
try {
  for (const mode of ['fresh', 'upgrade', 'legacy-docker']) {
    const name = `lentera_qa_${mode}_${Date.now()}`;
    await admin.query(`CREATE DATABASE "${name}"`);
    const target = new URL(base); target.pathname = `/${name}`;
    const client = new Client({ connectionString: target.toString() });
    await client.connect();
    if (mode !== 'fresh') {
      await client.query(await readFile('prisma/migrations/20261009000000_baseline/migration.sql', 'utf8'));
      await client.query('INSERT INTO "School" ("id","name","code","updatedAt") VALUES ($1,$2,$3,CURRENT_TIMESTAMP)', ['rehearsal-school', 'Legacy QA school', 'REHEARSAL']);
      if (mode === 'legacy-docker') {
        await client.query('DROP INDEX "QuizAnswer_questionId_idx"; DROP INDEX "QuizAnswer_attemptId_questionId_key"; ALTER TABLE "QuizAnswer" ADD CONSTRAINT "QuizAnswer_questionId_fkey" FOREIGN KEY ("questionId") REFERENCES "QuizQuestion"("id") ON DELETE CASCADE ON UPDATE CASCADE');
        const reportDir = `.qa/${name}`;
        const env = { ...process.env, RELEASE_DATABASE_URL: target.toString(), RELEASE_REPORT_DIR: reportDir, MAINTENANCE_CONFIRMED: 'yes', BACKUP_VERIFIED: 'yes' };
        execFileSync(process.execPath, ['scripts/baseline-release.mjs'], { env, stdio: 'pipe' });
        const hash = createHash('sha256').update(await readFile(`${reportDir}/baseline-review.json`)).digest('hex');
        let invalidHashRefused = false;
        try { execFileSync(process.execPath, ['scripts/baseline-release.mjs', '--apply', '--approved-hash', 'not-approved'], { env, stdio: 'pipe' }); } catch { invalidHashRefused = true; }
        if (!invalidHashRefused) throw new Error('Unapproved baseline report was applied');
        execFileSync(process.execPath, ['scripts/baseline-release.mjs', '--apply', '--approved-hash', hash], { env, stdio: 'pipe' });
      } else execFileSync(process.execPath, ['node_modules/prisma/build/index.js', 'migrate', 'resolve', '--applied', '20261009000000_baseline', '--config', 'prisma.config.release.ts'], { env: { ...process.env, RELEASE_DATABASE_URL: target.toString() }, stdio: 'pipe' });
    }
    execFileSync(process.execPath, ['node_modules/prisma/build/index.js', 'migrate', 'deploy', '--config', 'prisma.config.release.ts'], { env: { ...process.env, RELEASE_DATABASE_URL: target.toString() }, stdio: 'pipe' });
    const schoolCount = Number((await client.query('SELECT count(*) FROM "School"')).rows[0].count);
    const schema = (await client.query('SELECT column_name FROM information_schema.columns WHERE table_name=$1', ['User'])).rows;
    if (!schema.some((column) => column.column_name === 'sessionVersion') || schoolCount !== (mode === 'fresh' ? 0 : 1)) throw new Error('Migration rehearsal lost data or omitted session version');
    const reportDir = `.qa/${name}`;
    await mkdir(`${reportDir}/uploads`, { recursive: true });
    const env = { ...process.env, RELEASE_DATABASE_URL: target.toString(), RELEASE_REPORT_DIR: reportDir, RELEASE_UPLOAD_DIR: `${reportDir}/uploads` };
    execFileSync(process.execPath, ['--conditions=react-server', '--import', 'tsx', 'scripts/release-preflight.mjs'], { env, stdio: 'pipe' });
    execFileSync(process.execPath, ['--conditions=react-server', '--import', 'tsx', 'scripts/reconcile-release.ts', '--check'], { env, stdio: 'pipe' });
    execFileSync(process.execPath, ['node_modules/prisma/build/index.js', 'migrate', 'status', '--config', 'prisma.config.release.ts'], { env, stdio: 'pipe' });
    execFileSync(process.execPath, ['node_modules/prisma/build/index.js', 'migrate', 'diff', '--from-config-datasource', '--to-schema', 'prisma/schema.prisma', '--exit-code', '--config', 'prisma.config.release.ts'], { env, stdio: 'pipe' });
    if (mode === 'legacy-docker') {
      const env = { ...process.env, RELEASE_DATABASE_URL: target.toString(), RELEASE_REPORT_DIR: reportDir };
      let refused = false;
      try { execFileSync(process.execPath, ['scripts/baseline-release.mjs'], { env, stdio: 'pipe' }); } catch { refused = true; }
      if (!refused) throw new Error('Baseline resolve must refuse an existing migration history');
    }
    report.push({ mode, database: name, schoolCount, releaseGate: 'passed', passed: true });
    await client.end();
  }
  await mkdir('.qa', { recursive: true });
  await writeFile('.qa/migration-rehearsal.json', JSON.stringify(report, null, 2));
  console.log(JSON.stringify(report));
} finally { await admin.end(); }
