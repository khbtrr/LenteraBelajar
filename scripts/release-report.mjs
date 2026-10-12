import { createHash } from 'node:crypto';
import { lstat, realpath, readFile } from 'node:fs/promises';
import path from 'node:path';

export function releaseTarget(value) {
  const url = new URL(value);
  if (!['postgres:', 'postgresql:'].includes(url.protocol)) throw new Error('PostgreSQL target required');
  if (url.searchParams.get('schema') && url.searchParams.get('schema') !== 'public') throw new Error('Release tools support only public schema');
  return { host: url.hostname, port: url.port || '5432', database: url.pathname, schema: 'public', user: decodeURIComponent(url.username) };
}

export function fingerprint(value) {
  return createHash('sha256').update(JSON.stringify(value)).digest('hex');
}

export function approvedReport(bytes, hash, target) {
  if (!hash || createHash('sha256').update(bytes).digest('hex') !== hash) throw new Error('Review the report and supply its exact SHA256 before applying');
  const report = JSON.parse(bytes.toString('utf8'));
  if (fingerprint(report.target) !== fingerprint(target)) throw new Error('Reviewed target differs from apply target');
  return report;
}

export async function readUpload(root, filename) {
  if (!filename || filename === '.' || filename === '..' || /[/\\\x00]/.test(filename) || path.basename(filename) !== filename) throw new Error('Invalid upload filename');
  const directory = await realpath(root);
  const filepath = path.join(directory, filename);
  const info = await lstat(filepath);
  if (!info.isFile() || info.isSymbolicLink()) throw new Error('Upload must be a regular file');
  const resolved = await realpath(filepath);
  if (path.dirname(resolved) !== directory) throw new Error('Upload is outside selected directory');
  return readFile(resolved);
}
