const secret = process.env.CBT_WORKER_SECRET;
const base = process.env.INTERNAL_APP_URL || 'http://127.0.0.1:3000';
if (!secret) throw new Error('CBT_WORKER_SECRET is required');
const parsed = new URL(base);
if (!['127.0.0.1', 'localhost'].includes(parsed.hostname)) throw new Error('The expiry worker must call the local application');
let stopping = false;
process.on('SIGTERM', () => { stopping = true; });
process.on('SIGINT', () => { stopping = true; });
async function run() {
  while (!stopping) {
    try {
      const response = await fetch(new URL('/api/internal/expire-quizzes', base), { method: 'POST', headers: { Authorization: `Bearer ${secret}` }, signal: AbortSignal.timeout(30000) });
      if (!response.ok) throw new Error(`Expiry worker HTTP ${response.status}`);
      const result = await response.json();
      if (result.needsReview) console.error(`Legacy attempts requiring review: ${result.needsReview}`);
    } catch (error) { console.error(error.message); }
    if (!stopping) await new Promise((resolve) => setTimeout(resolve, 15000));
  }
}
run().catch((error) => { console.error(error.message); process.exitCode = 1; });
