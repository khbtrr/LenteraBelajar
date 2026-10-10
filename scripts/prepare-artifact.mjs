import { cp, mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { execFileSync } from 'node:child_process';

const root = path.resolve('.next/standalone');
await cp('public', path.join(root, 'public'), { recursive: true, force: true });
await cp('.next/static', path.join(root, '.next/static'), { recursive: true, force: true });
await mkdir(path.join(root, 'scripts'), { recursive: true });
await cp('scripts/cbt-worker.cjs', path.join(root, 'scripts/cbt-worker.cjs'), { force: true });
await cp('ecosystem.config.js', path.join(root, 'ecosystem.config.js'), { force: true });
const revision = execFileSync('git', ['rev-parse', 'HEAD'], { encoding: 'utf8' }).trim();
const dirty = Boolean(execFileSync('git', ['status', '--porcelain'], { encoding: 'utf8' }).trim());
await writeFile(path.join(root, '.release-manifest.json'), JSON.stringify({ revision, dirty, builtAt: new Date().toISOString() }, null, 2));
console.log(`Standalone artifact prepared (${dirty ? 'working tree candidate' : revision})`);
