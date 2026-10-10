import { spawn } from 'node:child_process';
import { mkdir, writeFile } from 'node:fs/promises';

const url = 'postgresql://postgres:lentera-qa-only@127.0.0.1:55432/lentera_qa';
const key = `qa-workers:${Date.now()}`;
function runWorker() {
  return new Promise((resolve, reject) => {
    const child = spawn(process.execPath, ['--conditions=react-server', '--import', 'tsx', 'scripts/limiter-worker.mjs', key], {
      env: { ...process.env, TEST_DATABASE_URL: url, DATABASE_URL: url }, windowsHide: true,
    });
    let stdout = '', stderr = '';
    child.stdout.on('data', (data) => { stdout += data; }); child.stderr.on('data', (data) => { stderr += data; });
    child.on('exit', (code) => code ? reject(new Error(stderr)) : resolve(JSON.parse(stdout)));
  });
}
const results = (await Promise.all([runWorker(), runWorker()])).flat();
const allowed = results.filter((result) => result.success).length;
if (allowed !== 10) throw new Error(`Shared quota allowed ${allowed} requests instead of 10`);
await mkdir('.qa', { recursive: true });
await writeFile('.qa/limiter-workers.json', JSON.stringify({ processes: 2, requested: 16, allowed, rejected: 16 - allowed }));
console.log(`Two processes: ${allowed} allowed, ${16 - allowed} rejected`);
