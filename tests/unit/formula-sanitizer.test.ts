import { describe, it, expect } from 'vitest';
import { sanitizeSpreadsheetCell, sanitizeSpreadsheetData } from '@/lib/export';

describe('Spreadsheet CSV/Excel Formula Injection Sanitizer (VULN-11)', () => {
  it('escapes dangerous formula trigger characters (=, +, -, @)', () => {
    expect(sanitizeSpreadsheetCell('=1+1')).toBe("'=1+1");
    expect(sanitizeSpreadsheetCell('+12345')).toBe("'+12345");
    expect(sanitizeSpreadsheetCell('-SUM(A1:A10)')).toBe("'-SUM(A1:A10)");
    expect(sanitizeSpreadsheetCell('@cmd')).toBe("'@cmd");
  });

  it('escapes formula triggers preceded by leading whitespaces', () => {
    expect(sanitizeSpreadsheetCell('  =HYPERLINK("http://evil.com")')).toBe("'  =HYPERLINK(\"http://evil.com\")");
    expect(sanitizeSpreadsheetCell('\t=calc')).toBe("'\t=calc");
    expect(sanitizeSpreadsheetCell('\r=calc')).toBe("'\r=calc");
  });

  it('preserves legitimate non-formula strings without modifications', () => {
    expect(sanitizeSpreadsheetCell('Budi Santoso')).toBe('Budi Santoso');
    expect(sanitizeSpreadsheetCell('Matematika Kelas X')).toBe('Matematika Kelas X');
    expect(sanitizeSpreadsheetCell('siswa@sekolah.sch.id')).toBe('siswa@sekolah.sch.id');
  });

  it('preserves non-string primitive values (numbers, booleans, null, undefined)', () => {
    expect(sanitizeSpreadsheetCell(100)).toBe(100);
    expect(sanitizeSpreadsheetCell(-42)).toBe(-42); // Negative number (not string starting with -)
    expect(sanitizeSpreadsheetCell(true)).toBe(true);
    expect(sanitizeSpreadsheetCell(null)).toBe(null);
    expect(sanitizeSpreadsheetCell(undefined)).toBe(undefined);
  });

  it('sanitizes entire dataset rows cleanly', () => {
    const rawData = [
      { name: 'Alice', score: 95, note: '=DDE("cmd";"/C calc";"__dummy__")' },
      { name: '+Bob', score: 80, note: 'Bagus' },
    ];

    const sanitized = sanitizeSpreadsheetData(rawData);

    expect(sanitized[0].name).toBe('Alice');
    expect(sanitized[0].score).toBe(95);
    expect(sanitized[0].note).toBe("'=DDE(\"cmd\";\"/C calc\";\"__dummy__\")");

    expect(sanitized[1].name).toBe("'+Bob");
    expect(sanitized[1].score).toBe(80);
    expect(sanitized[1].note).toBe('Bagus');
  });
});
