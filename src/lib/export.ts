import * as XLSX from 'xlsx';

const FORMULA_PREFIXES = ['=', '+', '-', '@', '\t', '\r'];

export function sanitizeSpreadsheetCell(value: unknown): unknown {
  if (typeof value === 'string') {
    const trimmed = value.trimStart();
    if (FORMULA_PREFIXES.some((char) => trimmed.startsWith(char))) {
      return `'${value}`;
    }
    return value;
  }
  return value;
}

export function sanitizeSpreadsheetData<T extends Record<string, unknown>>(data: T[]): T[] {
  return data.map((row) => {
    const sanitizedRow: Record<string, unknown> = {};
    for (const [key, val] of Object.entries(row)) {
      sanitizedRow[key] = sanitizeSpreadsheetCell(val);
    }
    return sanitizedRow as T;
  });
}

export function exportToExcel<T extends Record<string, unknown>>(
  data: T[],
  filename: string,
  sheetName: string = 'Data'
) {
  const safeData = sanitizeSpreadsheetData(data);
  const worksheet = XLSX.utils.json_to_sheet(safeData);
  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, worksheet, sheetName);
  XLSX.writeFile(workbook, `${filename}.xlsx`);
}

export function exportToCsv<T extends Record<string, unknown>>(
  data: T[],
  filename: string
) {
  const safeData = sanitizeSpreadsheetData(data);
  const worksheet = XLSX.utils.json_to_sheet(safeData);
  const csvOutput = XLSX.utils.sheet_to_csv(worksheet);
  const blob = new Blob([csvOutput], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.setAttribute('download', `${filename}.csv`);
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
}
