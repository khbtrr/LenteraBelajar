import { describe, it, expect } from 'vitest';
import { sanitizeSpreadsheetCell, sanitizeSpreadsheetData, sanitizeSpreadsheetMatrix } from '@/lib/export';

describe('Spreadsheet CSV/Excel Formula Injection Sanitizer (VULN-11 & Finding #7)', () => {
  it('escapes dangerous formula trigger characters (=, +, -, @)', () => {
    expect(sanitizeSpreadsheetCell('=1+1')).toBe("'=1+1");
    expect(sanitizeSpreadsheetCell('+12345')).toBe("'+12345");
    expect(sanitizeSpreadsheetCell('-SUM(A1:A10)')).toBe("'-SUM(A1:A10)");
    expect(sanitizeSpreadsheetCell('@cmd')).toBe("'@cmd");
  });

  it('escapes formula triggers preceded by leading whitespaces', () => {
    expect(sanitizeSpreadsheetCell('  =HYPERLINK("http://evil.com")')).toBe("'  =HYPERLINK(\"http://evil.com\")");
    expect(sanitizeSpreadsheetCell('\t=calc')).toBe("'\t=calc");
    expect(sanitizeSpreadsheetCell('\r=calc')).toBe("'\r'=calc");
  });

  it('escapes formula triggers in subsequent lines after embedded carriage returns or newlines', () => {
    expect(sanitizeSpreadsheetCell('Siswa\r=1+1')).toBe("Siswa\r'=1+1");
    expect(sanitizeSpreadsheetCell('Siswa\r\n=1+1')).toBe("Siswa\r\n'=1+1");
    expect(sanitizeSpreadsheetCell('Catatan\n- Poin 1')).toBe("Catatan\n'- Poin 1");
    expect(sanitizeSpreadsheetCell('Line 1\nLine 2')).toBe('Line 1\nLine 2');
  });

  it('preserves legitimate non-formula strings without modifications', () => {
    expect(sanitizeSpreadsheetCell('Budi Santoso')).toBe('Budi Santoso');
    expect(sanitizeSpreadsheetCell('Matematika Kelas X')).toBe('Matematika Kelas X');
    expect(sanitizeSpreadsheetCell('siswa@sekolah.sch.id')).toBe('siswa@sekolah.sch.id');
  });

  it('preserves non-string primitive values (numbers, booleans, null, undefined)', () => {
    expect(sanitizeSpreadsheetCell(100)).toBe(100);
    expect(sanitizeSpreadsheetCell(-42)).toBe(-42);
    expect(sanitizeSpreadsheetCell(true)).toBe(true);
    expect(sanitizeSpreadsheetCell(null)).toBe(null);
    expect(sanitizeSpreadsheetCell(undefined)).toBe(undefined);
  });

  it('sanitizes entire dataset rows cleanly', () => {
    const rawData = [
      { name: 'Alice', score: 95, note: '=DDE("cmd";"/C calc";"__dummy__")' },
      { name: '+Bob', score: 80, note: 'Bagus' },
      { name: 'Charlie\r=1+1', score: 70, note: 'Catatan' },
    ];

    const sanitized = sanitizeSpreadsheetData(rawData);

    expect(sanitized[0].name).toBe('Alice');
    expect(sanitized[0].score).toBe(95);
    expect(sanitized[0].note).toBe("'=DDE(\"cmd\";\"/C calc\";\"__dummy__\")");

    expect(sanitized[1].name).toBe("'+Bob");
    expect(sanitized[1].score).toBe(80);
    expect(sanitized[1].note).toBe('Bagus');

    expect(sanitized[2].name).toBe("Charlie\r'=1+1");
    expect(sanitized[2].score).toBe(70);
    expect(sanitized[2].note).toBe('Catatan');
  });

  it('sanitizes 2D matrices cleanly for aoa_to_sheet', () => {
    const rawMatrix = [
      ['No', 'Nama Siswa', 'Catatan'],
      [1, '=1+1', 'Normal'],
      [2, 'Budi\r=cmd', '-Diskon'],
    ];

    const sanitized = sanitizeSpreadsheetMatrix(rawMatrix);

    expect(sanitized[0]).toEqual(['No', 'Nama Siswa', 'Catatan']);
    expect(sanitized[1]).toEqual([1, "'=1+1", 'Normal']);
    expect(sanitized[2]).toEqual([2, "Budi\r'=cmd", "'-Diskon"]);
  });
});
