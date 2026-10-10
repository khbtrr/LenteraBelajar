import { describe, expect, it } from 'vitest';
import AdmZip from 'adm-zip';
import { gzipSync } from 'node:zlib';
import { unpackArchiveToMemory } from '@/lib/utils/moodle-parser';

describe('Moodle archive extraction budgets', () => {
  it('rejects a highly compressed oversized ZIP entry before unbounded expansion', async () => {
    const archive = new AdmZip();
    archive.addFile('oversized.bin', Buffer.alloc(2 * 1024 * 1024));
    await expect(unpackArchiveToMemory(archive.toBuffer())).rejects.toThrow(/Batas ukuran/);
  });
  it('bounds gzip output before the entire tar archive is buffered', async () => {
    const compressed = gzipSync(Buffer.alloc(2 * 1024 * 1024));
    await expect(unpackArchiveToMemory(compressed)).rejects.toThrow();
  });
});
