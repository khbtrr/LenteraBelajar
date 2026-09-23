'use client';

import { useState, useRef } from 'react';
import * as XLSX from 'xlsx';
import { CourseGradebookData, StudentGradeItem } from '@/lib/actions/grade';
import {
  parseEraporTemplate,
  matchTemplateStudents,
  fillAndExportErapor,
  getScoreForMapping,
  ParsedEraporTemplate,
  ColumnMapping,
  MatchedStudentResult,
} from '@/lib/erapor-autofill';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Label } from '@/components/ui/label';
import {
  Sparkles,
  Upload,
  FileSpreadsheet,
  CheckCircle2,
  AlertTriangle,
  ArrowRight,
  ArrowLeft,
  Download,
  HelpCircle,
  FileText,
  UserCheck,
  RefreshCw,
  Layers,
  Award,
} from 'lucide-react';
import { useDialog } from '@/context/DialogContext';

interface EraporAutofillModalProps {
  isOpen: boolean;
  onClose: () => void;
  gradebookData: CourseGradebookData;
}

export function EraporAutofillModal({
  isOpen,
  onClose,
  gradebookData,
}: EraporAutofillModalProps) {
  const { showAlert } = useDialog();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [step, setStep] = useState<1 | 2 | 3>(1);
  const [file, setFile] = useState<File | null>(null);
  const [rawBuffer, setRawBuffer] = useState<ArrayBuffer | null>(null);
  const [parsedData, setParsedData] = useState<ParsedEraporTemplate | null>(null);
  const [workbook, setWorkbook] = useState<XLSX.WorkBook | null>(null);

  const [mappings, setMappings] = useState<ColumnMapping[]>([]);
  const [matchedStudents, setMatchedStudents] = useState<MatchedStudentResult[]>([]);
  const [isExporting, setIsExporting] = useState(false);

  // Reset modal state
  const handleReset = () => {
    setStep(1);
    setFile(null);
    setRawBuffer(null);
    setParsedData(null);
    setWorkbook(null);
    setMappings([]);
    setMatchedStudents([]);
    setIsExporting(false);
  };

  const handleClose = () => {
    handleReset();
    onClose();
  };

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = e.target.files?.[0];
    if (!selectedFile) return;

    if (!selectedFile.name.endsWith('.xlsx') && !selectedFile.name.endsWith('.xls')) {
      await showAlert('Harap pilih file spreadsheet dengan format .xlsx atau .xls.', {
        type: 'warning',
      });
      return;
    }

    try {
      const buffer = await selectedFile.arrayBuffer();
      const { workbook: wb, parsedData: parsed } = parseEraporTemplate(buffer);

      setFile(selectedFile);
      setRawBuffer(buffer);
      setWorkbook(wb);
      setParsedData(parsed);

      // Initialize default mappings for grade columns
      const initialMappings: ColumnMapping[] = parsed.gradeColumns.map((col) => {
        return {
          colIndex: col.colIndex,
          colLetter: col.colLetter,
          headerText: col.headerText,
          sourceType: 'IGNORE',
          label: 'Lewati (Jangan Diisi)',
        };
      });

      // Auto-map initial guess
      const autoMapped = autoMapColumns(initialMappings, parsed.gradeColumns);
      setMappings(autoMapped);

      // Perform initial student matching
      const matches = matchTemplateStudents(
        parsed.templateStudents,
        gradebookData.students
      );
      setMatchedStudents(matches);
    } catch (err: any) {
      console.error(err);
      await showAlert(err?.message || 'Gagal membaca file template Excel.', {
        type: 'error',
      });
    }
  };

  // Switch Sheet if template has multiple sheets
  const handleSheetChange = (sheetName: string) => {
    if (!rawBuffer) return;
    try {
      const { workbook: wb, parsedData: parsed } = parseEraporTemplate(rawBuffer, sheetName);
      setWorkbook(wb);
      setParsedData(parsed);

      const initialMappings: ColumnMapping[] = parsed.gradeColumns.map((col) => ({
        colIndex: col.colIndex,
        colLetter: col.colLetter,
        headerText: col.headerText,
        sourceType: 'IGNORE',
        label: 'Lewati (Jangan Diisi)',
      }));

      const autoMapped = autoMapColumns(initialMappings, parsed.gradeColumns);
      setMappings(autoMapped);

      const matches = matchTemplateStudents(
        parsed.templateStudents,
        gradebookData.students
      );
      setMatchedStudents(matches);
    } catch (err: any) {
      showAlert(err?.message || 'Gagal mengganti sheet.', { type: 'error' });
    }
  };

  // Auto-Map Logic
  const autoMapColumns = (
    currentMappings: ColumnMapping[],
    gradeCols: ParsedEraporTemplate['gradeColumns']
  ): ColumnMapping[] => {
    return currentMappings.map((mapping) => {
      const norm = mapping.headerText.toLowerCase();

      // Check if matches "Nilai Akhir" / "NA" / "Rata"
      if (
        norm.includes('nilai akhir') ||
        norm.includes('na ') ||
        norm === 'na' ||
        norm.includes('akhir semester') ||
        norm.includes('rapor')
      ) {
        return {
          ...mapping,
          sourceType: 'FINAL_AVERAGE',
          label: 'Nilai Rata-rata Akhir Kursus',
        };
      }

      // Check if matches specific quiz (e.g. "Kuis 1", "UTS", "UAS", "SAS", "ASAS")
      for (const q of gradebookData.quizzes) {
        const qTitleNorm = q.title.toLowerCase();
        if (norm.includes(qTitleNorm) || (norm.includes('sas') && qTitleNorm.includes('uas'))) {
          return {
            ...mapping,
            sourceType: 'QUIZ',
            sourceId: q.id,
            label: `Kuis: ${q.title}`,
          };
        }
      }

      // Check if matches specific assignment
      for (const a of gradebookData.assignments) {
        const aTitleNorm = a.title.toLowerCase();
        if (norm.includes(aTitleNorm)) {
          return {
            ...mapping,
            sourceType: 'ASSIGNMENT',
            sourceId: a.id,
            label: `Tugas: ${a.title}`,
          };
        }
      }

      // Check if matches module
      if (gradebookData.modules) {
        for (const m of gradebookData.modules) {
          const mTitleNorm = m.title.toLowerCase();
          if (norm.includes(mTitleNorm)) {
            return {
              ...mapping,
              sourceType: 'MODULE',
              sourceId: m.id,
              label: `Rata-rata Modul: ${m.title}`,
            };
          }
        }
      }

      return mapping;
    });
  };

  const handleApplyAutoMap = () => {
    if (!parsedData) return;
    const newMappings = autoMapColumns(mappings, parsedData.gradeColumns);
    setMappings(newMappings);
  };

  const handleResetMappings = () => {
    setMappings((prev) =>
      prev.map((m) => ({
        ...m,
        sourceType: 'IGNORE',
        sourceId: undefined,
        label: 'Lewati (Jangan Diisi)',
      }))
    );
  };

  const handleMappingChange = (
    colIndex: number,
    value: string
  ) => {
    setMappings((prev) =>
      prev.map((m) => {
        if (m.colIndex !== colIndex) return m;

        if (value === 'IGNORE') {
          return { ...m, sourceType: 'IGNORE', sourceId: undefined, label: 'Lewati' };
        }
        if (value === 'FINAL_AVERAGE') {
          return {
            ...m,
            sourceType: 'FINAL_AVERAGE',
            sourceId: undefined,
            label: 'Nilai Rata-rata Akhir',
          };
        }
        if (value.startsWith('QUIZ:')) {
          const qId = value.replace('QUIZ:', '');
          const q = gradebookData.quizzes.find((item) => item.id === qId);
          return {
            ...m,
            sourceType: 'QUIZ',
            sourceId: qId,
            label: `Kuis: ${q?.title || qId}`,
          };
        }
        if (value.startsWith('ASSIGNMENT:')) {
          const aId = value.replace('ASSIGNMENT:', '');
          const a = gradebookData.assignments.find((item) => item.id === aId);
          return {
            ...m,
            sourceType: 'ASSIGNMENT',
            sourceId: aId,
            label: `Tugas: ${a?.title || aId}`,
          };
        }
        if (value.startsWith('MODULE:')) {
          const mId = value.replace('MODULE:', '');
          const mod = gradebookData.modules?.find((item) => item.id === mId);
          return {
            ...m,
            sourceType: 'MODULE',
            sourceId: mId,
            label: `Rata-rata Modul: ${mod?.title || mId}`,
          };
        }

        return m;
      })
    );
  };

  // Override matched student for a specific row
  const handleStudentOverride = (rowIndex: number, lmsStudentId: string) => {
    const student = gradebookData.students.find((s) => s.id === lmsStudentId);
    setMatchedStudents((prev) =>
      prev.map((item) => {
        if (item.rowIndex !== rowIndex) return item;
        if (!student) {
          return {
            ...item,
            lmsStudentId: null,
            lmsStudentName: null,
            lmsStudentNis: null,
            matchScore: 0,
            isManualOverride: true,
          };
        }
        return {
          ...item,
          lmsStudentId: student.id,
          lmsStudentName: student.name,
          lmsStudentNis: student.nis,
          matchScore: 1,
          isManualOverride: true,
        };
      })
    );
  };

  const handleExport = () => {
    if (!workbook || !parsedData) return;

    const activeMappings = mappings.filter((m) => m.sourceType !== 'IGNORE');
    if (activeMappings.length === 0) {
      showAlert('Pilih minimal satu kolom nilai yang akan diisi pada Langkah 2.', {
        type: 'warning',
      });
      return;
    }

    setIsExporting(true);
    try {
      const courseTitleSafe = gradebookData.course.title.replace(/[\/\\?%*:|"<>]/g, '_');
      const filename = `eRapor_${courseTitleSafe}_Terisi`;

      fillAndExportErapor(
        workbook,
        parsedData.activeSheetName,
        mappings,
        matchedStudents,
        gradebookData,
        filename
      );

      showAlert(
        'Berhasil! File Excel e-Rapor yang telah terisi nilai telah diunduh dan siap diimpor ke aplikasi e-Rapor.',
        { type: 'success' }
      );
      handleClose();
    } catch (err: any) {
      console.error(err);
      showAlert(err?.message || 'Gagal mengisi nilai ke file e-Rapor.', { type: 'error' });
    } finally {
      setIsExporting(false);
    }
  };

  const matchedCount = matchedStudents.filter((s) => s.lmsStudentId !== null).length;
  const totalTemplateStudents = matchedStudents.length;

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && handleClose()}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto p-6">
        <DialogHeader className="border-b pb-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-brand-500 text-white flex items-center justify-center shadow-xs">
              <Sparkles className="h-5 w-5 text-[#FF8928]" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <DialogTitle className="text-xl font-bold text-[#002446] dark:text-white">
                  Auto-Fill Template Resmi e-Rapor
                </DialogTitle>
                <Badge className="bg-accent-500 text-white text-[10px] uppercase font-bold">
                  Smart Exporter
                </Badge>
              </div>
              <p className="text-xs text-gray-500 mt-0.5">
                Isi nilai siswa ke template Excel resmi e-Rapor Kemdikbud tanpa merusak format & rumus asli.
              </p>
            </div>
          </div>

          {/* Stepper Wizard Bar */}
          <div className="grid grid-cols-3 gap-2 pt-4 mt-2">
            <div
              className={`p-2.5 rounded-lg border text-center transition-all ${
                step === 1
                  ? 'bg-blue-50 dark:bg-blue-950/40 border-blue-500 text-blue-900 dark:text-blue-300 font-bold shadow-xs'
                  : step > 1
                  ? 'bg-emerald-50 dark:bg-emerald-950/40 border-emerald-300 dark:border-emerald-700 text-emerald-800 dark:text-emerald-300'
                  : 'bg-gray-50 dark:bg-gray-800/50 border-gray-200 dark:border-gray-700 text-gray-400 dark:text-gray-500'
              }`}
            >
              <div className="text-[11px] uppercase tracking-wider">Langkah 1</div>
              <div className="text-xs font-semibold">Unggah Template</div>
            </div>

            <div
              className={`p-2.5 rounded-lg border text-center transition-all ${
                step === 2
                  ? 'bg-blue-50 dark:bg-blue-950/40 border-blue-500 text-blue-900 dark:text-blue-300 font-bold shadow-xs'
                  : step > 2
                  ? 'bg-emerald-50 dark:bg-emerald-950/40 border-emerald-300 dark:border-emerald-700 text-emerald-800 dark:text-emerald-300'
                  : 'bg-gray-50 dark:bg-gray-800/50 border-gray-200 dark:border-gray-700 text-gray-400 dark:text-gray-500'
              }`}
            >
              <div className="text-[11px] uppercase tracking-wider">Langkah 2</div>
              <div className="text-xs font-semibold">Pemetaan Kolom Nilai</div>
            </div>

            <div
              className={`p-2.5 rounded-lg border text-center transition-all ${
                step === 3
                  ? 'bg-blue-50 dark:bg-blue-950/40 border-blue-500 text-blue-900 dark:text-blue-300 font-bold shadow-xs'
                  : 'bg-gray-50 dark:bg-gray-800/50 border-gray-200 dark:border-gray-700 text-gray-400 dark:text-gray-500'
              }`}
            >
              <div className="text-[11px] uppercase tracking-wider">Langkah 3</div>
              <div className="text-xs font-semibold">Verifikasi & Unduh</div>
            </div>
          </div>
        </DialogHeader>

        {step === 1 && (
          <div className="py-4 space-y-5">
            <div
              onClick={() => fileInputRef.current?.click()}
              className="border-2 border-dashed border-[#002446]/30 dark:border-white/20 hover:border-[#002446] dark:hover:border-white/40 bg-blue-50/20 dark:bg-blue-950/20 hover:bg-blue-50/50 dark:hover:bg-blue-950/30 rounded-2xl p-8 text-center cursor-pointer transition-all space-y-3"
            >
              <input
                ref={fileInputRef}
                type="file"
                accept=".xlsx,.xls"
                onChange={handleFileChange}
                className="hidden"
              />
              <div className="w-14 h-14 bg-white dark:bg-gray-800 rounded-full shadow-md text-[#002446] dark:text-white mx-auto flex items-center justify-center">
                <FileSpreadsheet className="h-7 w-7 text-[#FF8928]" />
              </div>
              <div>
                <div className="font-bold text-sm text-[#002446] dark:text-white">
                  {file ? file.name : 'Klik atau Tarik File Template Excel e-Rapor ke Sini'}
                </div>
                <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                  Format file: <strong>.xlsx</strong> atau <strong>.xls</strong> (Template unduhan dari aplikasi e-Rapor resmi sekolah)
                </p>
              </div>
            </div>

            {parsedData && (
              <div className="p-4 bg-emerald-50/70 dark:bg-emerald-950/30 border border-emerald-300 dark:border-emerald-800 rounded-xl space-y-3 text-xs text-emerald-900 dark:text-emerald-200">
                <div className="flex items-center gap-2 font-bold text-emerald-800 dark:text-emerald-300 text-sm">
                  <CheckCircle2 className="h-5 w-5 text-emerald-600 dark:text-emerald-400" />
                  Template Berhasil Dibaca
                </div>
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                  <div className="p-2 bg-white dark:bg-gray-900 rounded-lg border border-emerald-200 dark:border-emerald-800/60">
                    <span className="text-gray-500 dark:text-gray-400 block">Pilihan Lembar (Sheet):</span>
                    {parsedData.sheetNames.length > 1 ? (
                      <select
                        value={parsedData.activeSheetName}
                        onChange={(e) => handleSheetChange(e.target.value)}
                        className="mt-1 font-bold text-[#002446] dark:text-white bg-transparent border-none focus:ring-0 p-0 text-xs w-full"
                      >
                        {parsedData.sheetNames.map((s) => (
                          <option key={s} value={s} className="dark:bg-gray-900">
                            {s}
                          </option>
                        ))}
                      </select>
                    ) : (
                      <strong className="text-[#002446] dark:text-white">{parsedData.activeSheetName}</strong>
                    )}
                  </div>

                  <div className="p-2 bg-white dark:bg-gray-900 rounded-lg border border-emerald-200 dark:border-emerald-800/60">
                    <span className="text-gray-500 dark:text-gray-400 block">Baris Siswa Terdeteksi:</span>
                    <strong className="text-lg text-[#002446] dark:text-white">
                      {parsedData.templateStudents.length} siswa
                    </strong>
                  </div>

                  <div className="p-2 bg-white dark:bg-gray-900 rounded-lg border border-emerald-200 dark:border-emerald-800/60">
                    <span className="text-gray-500 dark:text-gray-400 block">Kolom Nilai Terbaca:</span>
                    <strong className="text-lg text-[#002446] dark:text-white">
                      {parsedData.gradeColumns.length} kolom
                    </strong>
                  </div>
                </div>
              </div>
            )}

            {/* Quick Tips */}
            <div className="p-3.5 bg-gray-50 dark:bg-gray-800/50 rounded-xl border border-gray-200 dark:border-gray-800 text-xs text-gray-600 dark:text-gray-300 space-y-1.5">
              <div className="font-bold text-[#002446] dark:text-white flex items-center gap-1.5">
                <HelpCircle className="h-4 w-4 text-blue-600 dark:text-blue-400" />
                Petunjuk Template e-Rapor:
              </div>
              <ul className="list-disc pl-5 space-y-1 text-gray-500 dark:text-gray-400">
                <li>
                  Gunakan file template impor yang langsung diunduh dari aplikasi e-Rapor resmi (Kurikulum Merdeka atau K13).
                </li>
                <li>
                  Jangan mengubah susunan kolom identitas (Nomor, NIS/NISN, Nama Siswa) agar pencocokan berjalan 100% akurat.
                </li>
              </ul>
            </div>
          </div>
        )}

        {step === 2 && parsedData && (
          <div className="py-4 space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 bg-blue-50/50 dark:bg-blue-950/30 p-3 rounded-xl border border-blue-200 dark:border-blue-900/50 text-xs">
              <div>
                <span className="font-bold text-[#002446] dark:text-white block">
                  Petakan Kolom Nilai Excel dengan Data di LenteraBelajar
                </span>
                <span className="text-gray-500 dark:text-gray-400">
                  Tentukan kuis, tugas, atau rata-rata modul yang akan dimasukkan ke masing-masing kolom template.
                </span>
              </div>
              <div className="flex items-center gap-2 shrink-0">
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  onClick={handleApplyAutoMap}
                  className="text-xs bg-white dark:bg-gray-800 text-blue-700 dark:text-blue-300 border-blue-300 dark:border-blue-700 hover:bg-blue-50 dark:hover:bg-blue-950/50 font-semibold"
                >
                  <Sparkles className="h-3.5 w-3.5 mr-1 text-[#FF8928]" />
                  Auto-Map Cerdas
                </Button>
                <Button
                  type="button"
                  size="sm"
                  variant="ghost"
                  onClick={handleResetMappings}
                  className="text-xs text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200"
                >
                  Reset
                </Button>
              </div>
            </div>

            {/* Columns Table */}
            <div className="border border-gray-200 dark:border-gray-800 rounded-xl overflow-hidden bg-white dark:bg-gray-900 shadow-xs">
              <div className="overflow-x-auto">
                <table className="w-full min-w-[550px] text-left text-xs border-collapse">
                  <thead>
                    <tr className="bg-gray-50 dark:bg-gray-800/90 text-gray-600 dark:text-gray-300 border-b border-gray-200 dark:border-gray-800 uppercase font-semibold">
                      <th className="py-3 px-4 w-24 text-center">Kolom</th>
                      <th className="py-3 px-4">Nama Kolom di Template e-Rapor</th>
                      <th className="py-3 px-4 w-80">Sumber Nilai di LenteraBelajar</th>
                    </tr>
                  </thead>
                <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
                  {mappings.map((mapping) => {
                    const selectValue =
                      mapping.sourceType === 'IGNORE'
                        ? 'IGNORE'
                        : mapping.sourceType === 'FINAL_AVERAGE'
                        ? 'FINAL_AVERAGE'
                        : mapping.sourceType === 'QUIZ'
                        ? `QUIZ:${mapping.sourceId}`
                        : mapping.sourceType === 'ASSIGNMENT'
                        ? `ASSIGNMENT:${mapping.sourceId}`
                        : mapping.sourceType === 'MODULE'
                        ? `MODULE:${mapping.sourceId}`
                        : 'IGNORE';

                    const isMapped = mapping.sourceType !== 'IGNORE';

                    return (
                      <tr
                        key={mapping.colIndex}
                        className={`transition-colors ${isMapped ? 'bg-blue-50/20 dark:bg-blue-950/20' : 'hover:bg-gray-50/50 dark:hover:bg-gray-800/40'}`}
                      >
                        <td className="py-3 px-4 text-center font-mono font-bold text-[#002446] dark:text-brand-300">
                          {mapping.colLetter}
                        </td>
                        <td className="py-3 px-4">
                          <div className="font-semibold text-gray-900 dark:text-white">{mapping.headerText}</div>
                        </td>
                        <td className="py-3 px-4">
                          <select
                            value={selectValue}
                            onChange={(e) => handleMappingChange(mapping.colIndex, e.target.value)}
                            className={`w-full p-2 text-xs rounded-lg border transition-all ${
                              isMapped
                                ? 'border-brand-500 dark:border-brand-400 bg-white dark:bg-gray-800 font-semibold text-[#002446] dark:text-white'
                                : 'border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800/60 text-gray-500 dark:text-gray-400'
                            }`}
                          >
                            <option value="IGNORE">-- Lewati (Jangan Diisi) --</option>
                            <option value="FINAL_AVERAGE">⭐ Nilai Rata-rata Akhir Kursus</option>

                            {gradebookData.modules && gradebookData.modules.length > 0 && (
                              <optgroup label="📚 Rata-rata Modul Pembelajaran">
                                {gradebookData.modules.map((m) => (
                                  <option key={m.id} value={`MODULE:${m.id}`}>
                                    Modul: {m.title}
                                  </option>
                                ))}
                              </optgroup>
                            )}

                            {gradebookData.quizzes.length > 0 && (
                              <optgroup label="📝 Kuis & CBT Individual">
                                {gradebookData.quizzes.map((q) => (
                                  <option key={q.id} value={`QUIZ:${q.id}`}>
                                    Kuis: {q.title}
                                  </option>
                                ))}
                              </optgroup>
                            )}

                            {gradebookData.assignments.length > 0 && (
                              <optgroup label="📋 Tugas / Penugasan Individual">
                                {gradebookData.assignments.map((a) => (
                                  <option key={a.id} value={`ASSIGNMENT:${a.id}`}>
                                    Tugas: {a.title}
                                  </option>
                                ))}
                              </optgroup>
                            )}
                          </select>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
              </div>
            </div>
          </div>
        )}

        {step === 3 && (
          <div className="py-4 space-y-4">
            {/* Match Status Card */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="p-4 rounded-xl border bg-emerald-50/70 dark:bg-emerald-950/20 border-emerald-200 dark:border-emerald-800/40">
                <div className="text-xs font-semibold text-emerald-800 dark:text-emerald-300 uppercase tracking-wider">
                  Kecocokan Siswa
                </div>
                <div className="text-2xl font-black text-emerald-700 dark:text-emerald-400 mt-1 flex items-center gap-2">
                  <span>
                    {matchedCount} / {totalTemplateStudents} Siswa
                  </span>
                  <Badge className="bg-emerald-600 text-white text-xs">
                    {Math.round((matchedCount / (totalTemplateStudents || 1)) * 100)}%
                  </Badge>
                </div>
                <p className="text-[11px] text-emerald-700 dark:text-emerald-400/80 mt-1">
                  Sistem mencocokkan data secara otomatis melalui nomor NIS/NISN dan kesamaan nama.
                </p>
              </div>

              <div className="p-4 rounded-xl border bg-brand-50/70 dark:bg-brand-950/20 border-brand-200 dark:border-brand-800/40">
                <div className="text-xs font-semibold text-brand-800 dark:text-brand-300 uppercase tracking-wider">
                  Kolom yang Akan Diisi
                </div>
                <div className="text-2xl font-black text-[#002446] dark:text-white mt-1">
                  {mappings.filter((m) => m.sourceType !== 'IGNORE').length} Kolom Nilai
                </div>
                <p className="text-[11px] text-brand-700 dark:text-brand-300/80 mt-1">
                  Seluruh rumus atau formatting asli pada template e-Rapor akan tetap dipertahankan.
                </p>
              </div>
            </div>

            {/* Students Matching Table */}
            <div className="border border-gray-200 dark:border-gray-800 rounded-xl overflow-hidden bg-white dark:bg-gray-900 shadow-xs">
              <div className="p-3 bg-gray-50 dark:bg-gray-800/80 border-b border-gray-200 dark:border-gray-800 flex items-center justify-between text-xs">
                <span className="font-bold text-[#002446] dark:text-white">
                  Pratinjau Data Siswa & Pengisian Nilai ({matchedStudents.length})
                </span>
                <span className="text-gray-500 dark:text-gray-400">
                  Periksa nama siswa di bawah. Anda dapat mengubah pilihan siswa secara manual jika diperlukan.
                </span>
              </div>

              <div className="max-h-72 overflow-y-auto overflow-x-auto">
                <table className="w-full min-w-[600px] text-left text-xs border-collapse">
                  <thead className="sticky top-0 bg-gray-100/90 dark:bg-gray-800 backdrop-blur-xs text-gray-600 dark:text-gray-300 border-b border-gray-200 dark:border-gray-700">
                    <tr>
                      <th className="py-2.5 px-3 w-12 text-center">Baris</th>
                      <th className="py-2.5 px-3">Nama di Template Excel</th>
                      <th className="py-2.5 px-3 text-center">NIS</th>
                      <th className="py-2.5 px-3">Siswa di LenteraBelajar</th>
                      <th className="py-2.5 px-3 text-center w-28">Status</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
                    {matchedStudents.map((match) => {
                      const isMatched = match.lmsStudentId !== null;

                      return (
                        <tr
                          key={match.rowIndex}
                          className={`hover:bg-gray-50/80 dark:hover:bg-gray-800/50 ${!isMatched ? 'bg-rose-50/30 dark:bg-rose-950/20' : ''}`}
                        >
                          <td className="py-2.5 px-3 text-center font-mono text-gray-500 dark:text-gray-400">
                            #{match.rowNumber}
                          </td>
                          <td className="py-2.5 px-3 font-semibold text-gray-900 dark:text-white">
                            {match.templateName}
                          </td>
                          <td className="py-2.5 px-3 text-center font-mono text-gray-500 dark:text-gray-400">
                            {match.templateNis || '-'}
                          </td>
                          <td className="py-2 px-3">
                            <select
                              value={match.lmsStudentId || ''}
                              onChange={(e) =>
                                handleStudentOverride(match.rowIndex, e.target.value)
                              }
                              className={`w-full p-1.5 text-xs rounded border ${
                                isMatched
                                  ? 'border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 text-gray-800 dark:text-gray-100'
                                  : 'border-rose-300 dark:border-rose-800 bg-rose-50 dark:bg-rose-950/40 text-rose-800 dark:text-rose-300 font-bold'
                              }`}
                            >
                              <option value="">-- Tidak Terhubung / Kosongkan --</option>
                              {gradebookData.students.map((st) => (
                                <option key={st.id} value={st.id}>
                                  {st.name} {st.nis ? `(${st.nis})` : ''}
                                </option>
                              ))}
                            </select>
                          </td>
                          <td className="py-2.5 px-3 text-center">
                            {isMatched ? (
                              <span className="inline-flex items-center gap-1 text-emerald-700 dark:text-emerald-300 bg-emerald-50 dark:bg-emerald-950/50 px-2 py-0.5 rounded font-semibold text-[10px]">
                                <CheckCircle2 className="h-3 w-3" /> Cocok
                              </span>
                            ) : (
                              <span className="inline-flex items-center gap-1 text-rose-700 dark:text-rose-300 bg-rose-50 dark:bg-rose-950/50 px-2 py-0.5 rounded font-semibold text-[10px]">
                                <AlertTriangle className="h-3 w-3" /> Belum Cocok
                              </span>
                            )}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}

        <DialogFooter className="border-t border-gray-100 dark:border-gray-800 pt-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            {step > 1 && (
              <Button
                type="button"
                variant="outline"
                onClick={() => setStep((prev) => (prev - 1) as any)}
                className="text-xs"
              >
                <ArrowLeft className="h-4 w-4 mr-1" />
                Kembali
              </Button>
            )}
          </div>

          <div className="flex items-center gap-2">
            <Button type="button" variant="ghost" onClick={handleClose} className="text-xs">
              Batal
            </Button>

            {step === 1 && (
              <Button
                type="button"
                disabled={!parsedData}
                onClick={() => setStep(2)}
                className="bg-[#002446] hover:bg-[#001b33] text-white font-bold text-xs flex items-center gap-1.5"
              >
                <span>Lanjut: Petakan Kolom</span>
                <ArrowRight className="h-4 w-4" />
              </Button>
            )}

            {step === 2 && (
              <Button
                type="button"
                onClick={() => setStep(3)}
                className="bg-[#002446] hover:bg-[#001b33] text-white font-bold text-xs flex items-center gap-1.5"
              >
                <span>Lanjut: Pratinjau Siswa</span>
                <ArrowRight className="h-4 w-4" />
              </Button>
            )}

            {step === 3 && (
              <Button
                type="button"
                onClick={handleExport}
                disabled={isExporting}
                className="bg-[#FF8928] hover:bg-[#ff7b10] text-white font-bold text-xs px-5 flex items-center gap-2 shadow-md"
              >
                <Download className="h-4 w-4" />
                <span>{isExporting ? 'Memproses File...' : 'Isi Nilai & Unduh File (.xlsx)'}</span>
              </Button>
            )}
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
