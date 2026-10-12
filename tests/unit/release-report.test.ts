import { describe, expect, it } from 'vitest';
import { createHash } from 'node:crypto';
import { approvedReport, readUpload, releaseTarget } from '../../scripts/release-report.mjs';

describe('release report boundaries', () => {
  it('rejects a reviewed report for another PostgreSQL port or schema', () => {
    const target = releaseTarget('postgresql://reviewer:private@localhost:5432/demo');
    const bytes = Buffer.from(JSON.stringify({ target }));
    const hash = createHash('sha256').update(bytes).digest('hex');
    expect(() => approvedReport(bytes, hash, releaseTarget('postgresql://reviewer:private@localhost:55432/demo'))).toThrow(/target differs/);
    expect(() => releaseTarget('postgresql://reviewer:private@localhost/demo?schema=other')).toThrow(/public schema/);
    expect(JSON.stringify(target)).not.toContain('private');
  });
  it('rejects an edited proposal even on the same database', () => {
    const target = releaseTarget('postgresql://reviewer:private@localhost/demo');
    const bytes = Buffer.from(JSON.stringify({ target, operations: [] }));
    const hash = createHash('sha256').update(bytes).digest('hex');
    expect(() => approvedReport(Buffer.from(JSON.stringify({ target, operations: ['changed'] })), hash, target)).toThrow(/exact SHA256/);
  });
  it.each(['../secret', '..\\secret', '.', '..', '/etc/passwd', 'a\0b'])('rejects unsafe upload paths (%s)', async (filename) => {
    await expect(readUpload('.', filename)).rejects.toThrow(/filename/);
  });
});
