import * as XLSX from 'xlsx';

const FORMULA_PREFIXES = ['=', '+', '-', '@', '\t', '\r'];

export function sanitizeSpreadsheetCell(value: unknown): unknown {
  if (typeof value !== 'string') return value;

  const trimmed = value.trimStart();
  const hasLeadingFormula = FORMULA_PREFIXES.some((char) => trimmed.startsWith(char));

  const parts = value.split(/(\r\n|\n|\r)/);
  let hasSanitizedSegment = false;

  const sanitizedParts = parts.map((part, idx) => {
    // Even indices are text content between line breaks
    if (idx % 2 === 0 && part.length > 0) {
      const lineTrimmed = part.trimStart();
      if (['=', '+', '-', '@', '\t'].some((char) => lineTrimmed.startsWith(char))) {
        hasSanitizedSegment = true;
        return part.startsWith("'") ? part : `'${part}`;
      }
    }
    return part;
  });

  if (hasSanitizedSegment) {
    const joined = sanitizedParts.join('');
    if (hasLeadingFormula && !joined.startsWith("'")) {
      return `'${joined}`;
    }
    return joined;
  }

  if (hasLeadingFormula) {
    return value.startsWith("'") ? value : `'${value}`;
  }

  return value;
}

export function sanitizeSpreadsheetMatrix<T = unknown>(matrix: T[][]): T[][] {
  return matrix.map((row) => row.map((cell) => sanitizeSpreadsheetCell(cell) as T));
}

export function sanitizeSpreadsheetData<T extends Record<string, unknown>>(data: T[]): T[] {
  return data.map((row) => {
    const sanitizedRow: Record<string, unknown> = {};
    for (const [key, value] of Object.entries(row)) {
      sanitizedRow[key] = sanitizeSpreadsheetCell(value);
    }
    return sanitizedRow as T;
  });
}

export function exportToCsv<T extends Record<string, unknown>>(data: T[], filename: string) {
  const sanitized = sanitizeSpreadsheetData(data);
  const worksheet = XLSX.utils.json_to_sheet(sanitized);
  const csv = XLSX.utils.sheet_to_csv(worksheet);
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
  const link = document.createElement('a');
  link.href = URL.createObjectURL(blob);
  link.download = filename.endsWith('.csv') ? filename : `${filename}.csv`;
  link.click();
}

export function exportToExcel<T extends Record<string, unknown>>(
  data: T[],
  filename: string,
  sheetName = 'Sheet1'
) {
  const sanitized = sanitizeSpreadsheetData(data);
  const worksheet = XLSX.utils.json_to_sheet(sanitized);
  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, worksheet, sheetName);
  XLSX.writeFile(workbook, filename.endsWith('.xlsx') ? filename : `${filename}.xlsx`);
}
