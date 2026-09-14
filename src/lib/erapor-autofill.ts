import * as XLSX from 'xlsx';
import { CourseGradebookData, StudentGradeItem } from './actions/grade';

export interface EraporColumnInfo {
  colIndex: number;
  colLetter: string;
  headerText: string;
  isIdentityCol: boolean;
}

export interface TemplateStudentRow {
  rowIndex: number;
  rowNumber: number; // 1-indexed for display
  rawNis: string;
  rawName: string;
}

export interface MatchedStudentResult {
  rowIndex: number;
  rowNumber: number;
  templateNis: string;
  templateName: string;
  lmsStudentId: string | null;
  lmsStudentName: string | null;
  lmsStudentNis: string | null;
  matchScore: number; // 0 to 1
  isManualOverride?: boolean;
}

export interface ColumnMapping {
  colIndex: number;
  colLetter: string;
  headerText: string;
  sourceType: 'QUIZ' | 'ASSIGNMENT' | 'MODULE' | 'FINAL_AVERAGE' | 'IGNORE';
  sourceId?: string; // quizId, assignmentId, or moduleId
  label?: string;
}

export interface ParsedEraporTemplate {
  sheetNames: string[];
  activeSheetName: string;
  headerRowIndex: number;
  columns: EraporColumnInfo[];
  gradeColumns: EraporColumnInfo[];
  nameColIndex: number;
  nisColIndex: number;
  templateStudents: TemplateStudentRow[];
}

/**
 * Normalizes text for robust comparison (lowercasing, trimming, removing punctuation).
 */
export function normalizeText(str: string): string {
  if (!str) return '';
  return str
    .toLowerCase()
    .replace(/[.,\/#!$%\^&\*;:{}=\-_`~()]/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * Calculates string similarity using Sorensen-Dice coefficient on character bigrams.
 */
export function calculateSimilarity(s1: string, s2: string): number {
  const norm1 = normalizeText(s1);
  const norm2 = normalizeText(s2);

  if (norm1 === norm2) return 1;
  if (!norm1 || !norm2) return 0;
  if (norm1.includes(norm2) || norm2.includes(norm1)) return 0.9;

  const getBigrams = (str: string) => {
    const bigrams = new Set<string>();
    for (let i = 0; i < str.length - 1; i++) {
      bigrams.add(str.slice(i, i + 2));
    }
    return bigrams;
  };

  const b1 = getBigrams(norm1);
  const b2 = getBigrams(norm2);

  let intersection = 0;
  b1.forEach((bg) => {
    if (b2.has(bg)) intersection++;
  });

  return (2 * intersection) / (b1.size + b2.size);
}

/**
 * Parses an uploaded e-Rapor template buffer to detect headers, student rows, and columns.
 */
export function parseEraporTemplate(
  buffer: ArrayBuffer,
  selectedSheetName?: string
): { workbook: XLSX.WorkBook; parsedData: ParsedEraporTemplate } {
  const workbook = XLSX.read(buffer, {
    type: 'array',
    cellStyles: true,
    cellFormula: true,
    cellDates: true,
  });

  const sheetNames = workbook.SheetNames;
  if (sheetNames.length === 0) {
    throw new Error('File Excel tidak memiliki sheet yang valid.');
  }

  const activeSheetName =
    selectedSheetName && sheetNames.includes(selectedSheetName)
      ? selectedSheetName
      : sheetNames[0];

  const sheet = workbook.Sheets[activeSheetName];
  if (!sheet || !sheet['!ref']) {
    throw new Error(`Sheet "${activeSheetName}" kosong atau tidak memiliki data.`);
  }

  const range = XLSX.utils.decode_range(sheet['!ref']);

  // Find header row: scan first 15 rows for keywords: "nama", "nis", "nisn", "no"
  let headerRowIndex = -1;
  let nameCol = -1;
  let nisCol = -1;

  for (let r = range.s.r; r <= Math.min(range.e.r, range.s.r + 15); r++) {
    let hasName = false;
    let hasId = false;

    for (let c = range.s.c; c <= range.e.c; c++) {
      const cell = sheet[XLSX.utils.encode_cell({ r, c })];
      const val = normalizeText(cell?.v?.toString() || '');

      if (val.includes('nama') || val.includes('peserta didik') || val.includes('siswa')) {
        hasName = true;
        nameCol = c;
      }
      if (val.includes('nis') || val.includes('nisn') || val.includes('nipd') || val === 'no' || val === 'nomor') {
        hasId = true;
        if (val.includes('nis')) {
          nisCol = c;
        }
      }
    }

    if (hasName && hasId) {
      headerRowIndex = r;
      break;
    }
  }

  // Fallback if header not found through strict keywords: pick first row with multiple non-empty cells
  if (headerRowIndex === -1) {
    headerRowIndex = range.s.r;
  }

  // Extract columns
  const columns: EraporColumnInfo[] = [];
  const gradeColumns: EraporColumnInfo[] = [];

  for (let c = range.s.c; c <= range.e.c; c++) {
    const mainCell = sheet[XLSX.utils.encode_cell({ r: headerRowIndex, c })];
    let headerText = mainCell?.v?.toString()?.trim() || '';

    // Check sub-header on the next row (common in e-Rapor merged headers)
    if (headerRowIndex + 1 <= range.e.r) {
      const subCell = sheet[XLSX.utils.encode_cell({ r: headerRowIndex + 1, c })];
      const subText = subCell?.v?.toString()?.trim() || '';
      if (subText && subText !== headerText) {
        headerText = headerText ? `${headerText} - ${subText}` : subText;
      }
    }

    const colLetter = XLSX.utils.encode_col(c);
    const norm = normalizeText(headerText);

    const isIdentityCol =
      norm === 'no' ||
      norm === 'nomor' ||
      norm.includes('nis') ||
      norm.includes('nisn') ||
      norm.includes('nipd') ||
      norm.includes('nama') ||
      norm.includes('gender') ||
      norm.includes('jenis kelamin') ||
      norm === 'jk' ||
      norm === 'lp';

    if (nameCol === -1 && (norm.includes('nama') || norm.includes('peserta didik'))) {
      nameCol = c;
    }
    if (nisCol === -1 && (norm.includes('nis') || norm.includes('nisn'))) {
      nisCol = c;
    }

    const colInfo: EraporColumnInfo = {
      colIndex: c,
      colLetter,
      headerText: headerText || `Kolom ${colLetter}`,
      isIdentityCol,
    };

    columns.push(colInfo);

    // If it's not identity and has some text or is a data column, mark as potential grade column
    if (!isIdentityCol && headerText) {
      gradeColumns.push(colInfo);
    }
  }

  // Identify Student Rows
  const templateStudents: TemplateStudentRow[] = [];
  const startRow = headerRowIndex + 1;

  for (let r = startRow; r <= range.e.r; r++) {
    // Read name cell
    const nameCell = nameCol !== -1 ? sheet[XLSX.utils.encode_cell({ r, c: nameCol })] : null;
    const rawName = nameCell?.v?.toString()?.trim() || '';

    // Read nis cell
    const nisCell = nisCol !== -1 ? sheet[XLSX.utils.encode_cell({ r, c: nisCol })] : null;
    const rawNis = nisCell?.v?.toString()?.trim() || '';

    // Skip footer rows (e.g. "Rata-rata", "Jumlah", "Mengetahui", empty lines)
    const normName = normalizeText(rawName);
    if (
      !rawName ||
      normName.includes('rata-rata') ||
      normName.includes('jumlah') ||
      normName.includes('mengetahui') ||
      normName.includes('kepala sekolah') ||
      normName.includes('guru mata pelajaran') ||
      normName.includes('wali kelas')
    ) {
      continue;
    }

    templateStudents.push({
      rowIndex: r,
      rowNumber: r + 1,
      rawNis,
      rawName,
    });
  }

  return {
    workbook,
    parsedData: {
      sheetNames,
      activeSheetName,
      headerRowIndex,
      columns,
      gradeColumns,
      nameColIndex: nameCol,
      nisColIndex: nisCol,
      templateStudents,
    },
  };
}

/**
 * Smart Multi-Key Matching: Matches template rows to LMS students by NIS, then by Name similarity.
 */
export function matchTemplateStudents(
  templateStudents: TemplateStudentRow[],
  lmsStudents: StudentGradeItem[]
): MatchedStudentResult[] {
  const matchedLmsIds = new Set<string>();

  return templateStudents.map((tStudent) => {
    let bestMatch: StudentGradeItem | null = null;
    let bestScore = 0;

    // 1. Try exact NIS match
    if (tStudent.rawNis) {
      const cleanTemplateNis = tStudent.rawNis.replace(/\D/g, '');
      if (cleanTemplateNis) {
        const foundByNis = lmsStudents.find((s) => {
          if (!s.nis) return false;
          const cleanLmsNis = s.nis.replace(/\D/g, '');
          return cleanLmsNis === cleanTemplateNis;
        });

        if (foundByNis) {
          bestMatch = foundByNis;
          bestScore = 1.0;
        }
      }
    }

    // 2. If no NIS match, try fuzzy name matching
    if (!bestMatch) {
      for (const s of lmsStudents) {
        const score = calculateSimilarity(tStudent.rawName, s.name);
        if (score > bestScore) {
          bestScore = score;
          bestMatch = s;
        }
      }
    }

    const isConfident = bestScore >= 0.75;
    if (isConfident && bestMatch) {
      matchedLmsIds.add(bestMatch.id);
    }

    return {
      rowIndex: tStudent.rowIndex,
      rowNumber: tStudent.rowNumber,
      templateNis: tStudent.rawNis,
      templateName: tStudent.rawName,
      lmsStudentId: isConfident && bestMatch ? bestMatch.id : null,
      lmsStudentName: isConfident && bestMatch ? bestMatch.name : null,
      lmsStudentNis: isConfident && bestMatch ? bestMatch.nis : null,
      matchScore: Math.round(bestScore * 100) / 100,
      isManualOverride: false,
    };
  });
}

/**
 * Calculates score for a student based on column mapping.
 */
export function getScoreForMapping(
  student: StudentGradeItem,
  mapping: ColumnMapping,
  gradebookData: CourseGradebookData
): number | null {
  if (mapping.sourceType === 'IGNORE') return null;

  if (mapping.sourceType === 'FINAL_AVERAGE') {
    return student.average;
  }

  if (mapping.sourceType === 'QUIZ' && mapping.sourceId) {
    const score = student.quizScores[mapping.sourceId];
    return score !== undefined ? score : null;
  }

  if (mapping.sourceType === 'ASSIGNMENT' && mapping.sourceId) {
    const score = student.assignmentScores[mapping.sourceId];
    return score !== undefined ? score : null;
  }

  if (mapping.sourceType === 'MODULE' && mapping.sourceId && gradebookData.modules) {
    const mod = gradebookData.modules.find((m) => m.id === mapping.sourceId);
    if (!mod) return null;

    const scores: number[] = [];
    mod.quizzes.forEach((q) => {
      const s = student.quizScores[q.id];
      if (s !== null && s !== undefined) scores.push(s);
    });
    mod.assignments.forEach((a) => {
      const s = student.assignmentScores[a.id];
      if (s !== null && s !== undefined) scores.push(s);
    });

    if (scores.length === 0) return null;
    return Math.round((scores.reduce((a, b) => a + b, 0) / scores.length) * 10) / 10;
  }

  return null;
}

/**
 * Injects scores into the workbook at the mapped column cells and returns a Blob for downloading.
 */
export function fillAndExportErapor(
  workbook: XLSX.WorkBook,
  sheetName: string,
  mappings: ColumnMapping[],
  matchedStudents: MatchedStudentResult[],
  gradebookData: CourseGradebookData,
  outputFilename: string
): void {
  const sheet = workbook.Sheets[sheetName];
  if (!sheet) throw new Error(`Sheet ${sheetName} tidak ditemukan.`);

  const studentMap = new Map<string, StudentGradeItem>();
  gradebookData.students.forEach((s) => studentMap.set(s.id, s));

  // Active mappings (not ignored)
  const activeMappings = mappings.filter((m) => m.sourceType !== 'IGNORE');

  for (const match of matchedStudents) {
    if (!match.lmsStudentId) continue;
    const lmsStudent = studentMap.get(match.lmsStudentId);
    if (!lmsStudent) continue;

    for (const mapping of activeMappings) {
      const score = getScoreForMapping(lmsStudent, mapping, gradebookData);
      if (score !== null) {
        const cellAddress = XLSX.utils.encode_cell({
          r: match.rowIndex,
          c: mapping.colIndex,
        });

        // Set number value to cell while preserving existing formatting
        sheet[cellAddress] = {
          t: 'n',
          v: Math.round(score),
        };
      }
    }
  }

  // Write out file and trigger browser download
  XLSX.writeFile(workbook, `${outputFilename}.xlsx`);
}
