import { spawn } from 'node:child_process';

const child = spawn(process.execPath, ['.next/standalone/server.js'], {
  stdio: 'inherit', windowsHide: true,
  env: { ...process.env, PORT: '3005', HOSTNAME: '127.0.0.1' },
});
process.on('SIGTERM', () => child.kill('SIGTERM'));
process.on('SIGINT', () => child.kill('SIGINT'));
child.on('exit', (code) => { process.exitCode = code ?? 1; });
