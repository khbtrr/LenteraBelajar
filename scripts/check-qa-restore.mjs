import { Client } from 'pg';
import { writeFile } from 'node:fs/promises';

const db = new Client({ connectionString: 'postgresql://postgres:lentera-qa-only@127.0.0.1:55432/lentera_qa_restored_20261010' });
await db.connect();
try {
  const result = await db.query('SELECT count(*)::int AS count FROM "School" WHERE "id"=$1', ['rehearsal-school']);
  if (result.rows[0].count !== 1) throw new Error('QA backup restore did not preserve the legacy school');
  await writeFile('.qa/restore-drill/database.json', JSON.stringify({ preservedSchools: 1, passed: true }));
  console.log('QA database restore preserved the legacy record');
} finally { await db.end(); }
