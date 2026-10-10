import { Client } from 'pg';
import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { execFileSync } from 'node:child_process';

const base = new URL('postgresql://postgres:lentera-qa-only@127.0.0.1:55432/postgres');
const admin = new Client({ connectionString: base.toString() });
await admin.connect();
const report = [];
try {
  for (const mode of ['fresh', 'upgrade']) {
    const name = `lentera_qa_${mode}_${Date.now()}`;
    await admin.query(`CREATE DATABASE "${name}"`);
    const target = new URL(base); target.pathname = `/${name}`;
    const client = new Client({ connectionString: target.toString() });
    await client.connect();
    if (mode === 'upgrade') {
      await client.query(await readFile('prisma/migrations/20261009000000_baseline/migration.sql', 'utf8'));
      await client.query('INSERT INTO "School" ("id","name","code","updatedAt") VALUES ($1,$2,$3,CURRENT_TIMESTAMP)', ['rehearsal-school', 'Legacy QA school', 'REHEARSAL']);
      execFileSync(process.execPath, ['node_modules/prisma/build/index.js', 'migrate', 'resolve', '--applied', '20261009000000_baseline', '--config', 'prisma.config.release.ts'], { env: { ...process.env, RELEASE_DATABASE_URL: target.toString() }, stdio: 'pipe' });
    }
    execFileSync(process.execPath, ['node_modules/prisma/build/index.js', 'migrate', 'deploy', '--config', 'prisma.config.release.ts'], { env: { ...process.env, RELEASE_DATABASE_URL: target.toString() }, stdio: 'pipe' });
    const schoolCount = Number((await client.query('SELECT count(*) FROM "School"')).rows[0].count);
    const schema = (await client.query('SELECT column_name FROM information_schema.columns WHERE table_name=$1', ['User'])).rows;
    if (!schema.some((column) => column.column_name === 'sessionVersion') || schoolCount !== (mode === 'upgrade' ? 1 : 0)) throw new Error('Migration rehearsal lost data or omitted session version');
    report.push({ mode, database: name, schoolCount, passed: true });
    await client.end();
  }
  await mkdir('.qa', { recursive: true });
  await writeFile('.qa/migration-rehearsal.json', JSON.stringify(report, null, 2));
  console.log(JSON.stringify(report));
} finally { await admin.end(); }
