import { Client } from 'pg';

const connectionString = process.env.TEST_DATABASE_URL;
const url = new URL(connectionString);
if (url.hostname !== '127.0.0.1' || url.port !== '55432' || url.pathname !== '/lentera_qa') throw new Error('Worker test requires isolated QA DB');
const db = new Client({ connectionString });
await db.connect();
try {
  const limiter = await import('../src/lib/shared-rate-limit.ts');
  const results = await Promise.all(Array.from({ length: 8 }, () => limiter.checkSharedRateLimit(process.argv[2], 10, 60000)));
  console.log(JSON.stringify(results));
  const { db } = await import('../src/lib/db.ts');
  await db.$disconnect();
} finally { await db.end(); }
