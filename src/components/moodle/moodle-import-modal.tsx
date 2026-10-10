'use client';

import { useState, useRef } from 'react';
import { useRouter } from 'next/navigation';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import {
  UploadCloud,
  FileArchive,
  Layers,
  FileText,
  FileDown,
  HelpCircle,
  ClipboardList,
  CheckCircle2,
  AlertCircle,
  Loader2,
  ChevronRight,
  ChevronDown,
  ArrowRight,
  Database,
} from 'lucide-react';
import type { MoodleImportPreview } from '@/lib/utils/moodle-parser';

interface MoodleImportModalProps {
  isOpen: boolean;
  onClose: () => void;
  courseId?: string;
  courseTitle?: string;
  targetMode: 'EXISTING' | 'NEW';
  schoolId?: string;
  teachers?: { id: string; name: string; email: string }[];
  academicYears?: { id: string; name: string; status: string }[];
  categories?: { id: string; name: string }[];
  onSuccess?: (resultCourseId: string) => void;
}

export function MoodleImportModal({
  isOpen,
  onClose,
  courseId,
  courseTitle,
  targetMode,
  schoolId,
  teachers = [],
  academicYears = [],
  categories = [],
  onSuccess,
}: MoodleImportModalProps) {
  const router = useRouter();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [step, setStep] = useState<'UPLOAD' | 'PREVIEW' | 'IMPORTING' | 'DONE'>('UPLOAD');
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const [sessionId, setSessionId] = useState<string | null>(null);
  const [previewData, setPreviewData] = useState<MoodleImportPreview | null>(null);

  // New course fields if targetMode === 'NEW'
  const [newTitle, setNewTitle] = useState('');
  const [newTeacherId, setNewTeacherId] = useState(teachers[0]?.id || '');
  const [newAcademicYearId, setNewAcademicYearId] = useState(
    academicYears.find((y) => y.status === 'ACTIVE')?.id || academicYears[0]?.id || ''
  );
  const [newCategoryId, setNewCategoryId] = useState('');

  // Selection states
  const [selectedModules, setSelectedModules] = useState<Record<string, boolean>>({});
  const [selectedItems, setSelectedItems] = useState<Record<string, boolean>>({});
  const [expandedModules, setExpandedModules] = useState<Record<string, boolean>>({});
  const [importToQuestionBank, setImportToQuestionBank] = useState(true);

  // Stats after import
  const [importResultStats, setImportResultStats] = useState<any>(null);

  const handleReset = () => {
    setStep('UPLOAD');
    setSelectedFile(null);
    setIsUploading(false);
    setErrorMessage(null);
    setSessionId(null);
    setPreviewData(null);
    setSelectedModules({});
    setSelectedItems({});
    setExpandedModules({});
    setImportResultStats(null);
  };

  const handleClose = () => {
    if (step === 'IMPORTING') return;
    handleReset();
    onClose();
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      processSelectedFile(file);
    }
  };

  const handleDrop = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    const file = e.dataTransfer.files?.[0];
    if (file) {
      processSelectedFile(file);
    }
  };

  const processSelectedFile = async (file: File) => {
    const lowerName = file.name.toLowerCase();
    if (!lowerName.endsWith('.mbz') && !lowerName.endsWith('.tar.gz') && !lowerName.endsWith('.zip')) {
      setErrorMessage('Format berkas harus berupa .mbz, .tar.gz, atau .zip.');
      return;
    }

    if (file.size > 200 * 1024 * 1024) {
      setErrorMessage('Ukuran berkas melebihi batas 200 MB.');
      return;
    }

    setSelectedFile(file);
    setErrorMessage(null);
    setIsUploading(true);

    try {
      const formData = new FormData();
      formData.append('file', file);

      const res = await fetch('/api/moodle-import/preview', {
        method: 'POST',
        body: formData,
      });

      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.error || 'Gagal membaca isi berkas Moodle.');
      }

      setSessionId(data.sessionId);
      setPreviewData(data.preview);

      if (targetMode === 'NEW') {
        setNewTitle(data.preview.courseInfo.fullname || file.name.replace(/\.[^/.]+$/, ''));
      }

      // Initialize all modules and items as selected by default
      const modMap: Record<string, boolean> = {};
      const itemMap: Record<string, boolean> = {};
      const expMap: Record<string, boolean> = {};

      data.preview.modules.forEach((mod: any) => {
        modMap[mod.id] = true;
        expMap[mod.id] = true;
        mod.items.forEach((item: any) => {
          itemMap[item.id] = true;
        });
      });

      setSelectedModules(modMap);
      setSelectedItems(itemMap);
      setExpandedModules(expMap);
      setStep('PREVIEW');
    } catch (err: any) {
      setErrorMessage(err.message || 'Terjadi kesalahan saat memproses berkas.');
    } finally {
      setIsUploading(false);
    }
  };

  const toggleModule = (moduleId: string) => {
    const newModState = !selectedModules[moduleId];
    setSelectedModules((prev) => ({ ...prev, [moduleId]: newModState }));

    const mod = previewData?.modules.find((m) => m.id === moduleId);
    if (mod) {
      setSelectedItems((prev) => {
        const next = { ...prev };
        mod.items.forEach((item) => {
          next[item.id] = newModState;
        });
        return next;
      });
    }
  };

  const toggleItem = (moduleId: string, itemId: string) => {
    const newItemState = !selectedItems[itemId];
    setSelectedItems((prev) => {
      const next = { ...prev, [itemId]: newItemState };
      const mod = previewData?.modules.find((m) => m.id === moduleId);
      if (mod) {
        const anySelected = mod.items.some((it) => (it.id === itemId ? newItemState : next[it.id]));
        setSelectedModules((mPrev) => ({ ...mPrev, [moduleId]: anySelected }));
      }
      return next;
    });
  };

  const toggleAll = (select: boolean) => {
    if (!previewData) return;
    const modMap: Record<string, boolean> = {};
    const itemMap: Record<string, boolean> = {};

    previewData.modules.forEach((mod) => {
      modMap[mod.id] = select;
      mod.items.forEach((item) => {
        itemMap[item.id] = select;
      });
    });

    setSelectedModules(modMap);
    setSelectedItems(itemMap);
  };

  const toggleExpand = (moduleId: string) => {
    setExpandedModules((prev) => ({ ...prev, [moduleId]: !prev[moduleId] }));
  };

  const handleExecuteImport = async () => {
    if (!sessionId) return;
    setStep('IMPORTING');
    setErrorMessage(null);

    const activeSections = Object.entries(selectedModules)
      .filter(([, v]) => v)
      .map(([k]) => k);
    const activeItems = Object.entries(selectedItems)
      .filter(([, v]) => v)
      .map(([k]) => k);

    try {
      const payload: any = {
        sessionId,
        targetMode,
        courseId,
        selectedSections: activeSections,
        selectedItems: activeItems,
        importToQuestionBank,
      };

      if (targetMode === 'NEW') {
        payload.newCourse = {
          title: newTitle,
          schoolId,
          teacherId: newTeacherId,
          academicYearId: newAcademicYearId,
          categoryId: newCategoryId || null,
        };
      }

      const res = await fetch('/api/moodle-import/execute', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.error || 'Gagal mengeksekusi migrasi Moodle.');
      }

      setImportResultStats(data.stats);
      setStep('DONE');

      if (onSuccess && data.courseId) {
        onSuccess(data.courseId);
      }
    } catch (err: any) {
      setErrorMessage(err.message || 'Terjadi kesalahan saat memproses migrasi.');
      setStep('PREVIEW');
    }
  };

  const getItemTypeBadge = (type: string) => {
    switch (type) {
      case 'PAGE':
        return (
          <Badge variant="outline" className="text-blue-700 bg-blue-50 border-blue-200 text-xs">
            <FileText className="h-3 w-3 mr-1 inline" /> Teks
          </Badge>
        );
      case 'RESOURCE':
        return (
          <Badge variant="outline" className="text-amber-700 bg-amber-50 border-amber-200 text-xs">
            <FileDown className="h-3 w-3 mr-1 inline" /> Berkas
          </Badge>
        );
      case 'URL':
        return (
          <Badge variant="outline" className="text-purple-700 bg-purple-50 border-purple-200 text-xs">
            Tautan / Video
          </Badge>
        );
      case 'ASSIGN':
        return (
          <Badge variant="outline" className="text-orange-700 bg-orange-50 border-orange-200 text-xs">
            <ClipboardList className="h-3 w-3 mr-1 inline" /> Tugas
          </Badge>
        );
      case 'QUIZ':
        return (
          <Badge variant="outline" className="text-emerald-700 bg-emerald-50 border-emerald-200 text-xs">
            <HelpCircle className="h-3 w-3 mr-1 inline" /> Kuis
          </Badge>
        );
      default:
        return <Badge variant="outline">{type}</Badge>;
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={handleClose}>
      <DialogContent className="max-w-3xl max-h-[90vh] flex flex-col p-6 overflow-hidden">
        <DialogHeader className="border-b pb-4">
          <DialogTitle className="text-xl font-bold text-[#002446] flex items-center gap-2">
            <FileArchive className="h-5 w-5 text-[#FF8928]" />
            Migrasi Konten Moodle (.mbz)
          </DialogTitle>
          <DialogDescription className="text-xs text-slate-500">
            {targetMode === 'EXISTING'
              ? `Mengimpor materi, kuis, dan tugas ke dalam: ${courseTitle || 'Kursus Aktif'}`
              : 'Membuat kursus baru langsung dari data arsip backup Moodle.'}
          </DialogDescription>
        </DialogHeader>

        {errorMessage && (
          <div className="bg-red-50 border border-red-200 text-red-700 text-sm p-3 rounded-md flex items-start gap-2 mt-2">
            <AlertCircle className="h-5 w-5 shrink-0 mt-0.5 text-red-600" />
            <span>{errorMessage}</span>
          </div>
        )}

        {/* STEP 1: UPLOAD */}
        {step === 'UPLOAD' && (
          <div className="py-6 space-y-4 overflow-y-auto">
            <div
              onDragOver={(e) => e.preventDefault()}
              onDrop={handleDrop}
              onClick={() => fileInputRef.current?.click()}
              className="border-2 border-dashed border-slate-300 hover:border-[#002446] rounded-xl p-8 text-center cursor-pointer transition-colors bg-slate-50/50 hover:bg-slate-50"
            >
              <input
                ref={fileInputRef}
                type="file"
                accept=".mbz,.tar.gz,.zip"
                className="hidden"
                onChange={handleFileChange}
              />
              <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-blue-50 text-[#002446] mb-3">
                {isUploading ? (
                  <Loader2 className="h-7 w-7 animate-spin text-[#002446]" />
                ) : (
                  <UploadCloud className="h-7 w-7 text-[#002446]" />
                )}
              </div>
              <p className="text-sm font-semibold text-slate-800">
                {isUploading ? 'Menganalisis isi berkas backup...' : 'Klik atau seret file backup Moodle ke sini'}
              </p>
              <p className="text-xs text-slate-500 mt-1">
                Mendukung format berkas .mbz, .tar.gz, atau .zip (hingga 200 MB)
              </p>
            </div>

            <div className="bg-blue-50/70 border border-blue-100 rounded-lg p-3.5 text-xs text-slate-700 space-y-1">
              <p className="font-semibold text-[#002446]">Petunjuk Ekspor di Moodle:</p>
              <ol className="list-decimal list-inside space-y-0.5 text-slate-600">
                <li>Buka kursus Anda di Moodle, pilih menu Administrasi Kursus &gt; Cadangkan (Backup).</li>
                <li>Pilih aktivitas yang ingin dicadangkan (tanpa menyertakan data pengguna/nilai).</li>
                <li>Unduh berkas hasil cadangan (.mbz) lalu unggah di sini.</li>
              </ol>
            </div>
          </div>
        )}

        {/* STEP 2: PREVIEW & SELECTION */}
        {step === 'PREVIEW' && previewData && (
          <div className="py-4 space-y-4 overflow-y-auto flex-1 pr-1">
            {/* New Course Config (if applicable) */}
            {targetMode === 'NEW' && (
              <Card className="border border-slate-200 bg-slate-50/60 shadow-none">
                <CardContent className="p-3.5 space-y-3">
                  <p className="text-xs font-bold text-[#002446] uppercase tracking-wide">
                    Pengaturan Kursus Baru
                  </p>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-xs">
                    <div>
                      <label className="block font-medium text-slate-700 mb-1">Judul Kursus</label>
                      <input
                        type="text"
                        value={newTitle}
                        onChange={(e) => setNewTitle(e.target.value)}
                        className="w-full border border-slate-300 rounded px-2.5 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-[#002446]"
                      />
                    </div>
                    {teachers.length > 0 && (
                      <div>
                        <label className="block font-medium text-slate-700 mb-1">Guru Pengampu</label>
                        <select
                          value={newTeacherId}
                          onChange={(e) => setNewTeacherId(e.target.value)}
                          className="w-full border border-slate-300 rounded px-2.5 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-[#002446]"
                        >
                          {teachers.map((t) => (
                            <option key={t.id} value={t.id}>
                              {t.name} ({t.email})
                            </option>
                          ))}
                        </select>
                      </div>
                    )}
                    {academicYears.length > 0 && (
                      <div>
                        <label className="block font-medium text-slate-700 mb-1">Tahun Ajaran</label>
                        <select
                          value={newAcademicYearId}
                          onChange={(e) => setNewAcademicYearId(e.target.value)}
                          className="w-full border border-slate-300 rounded px-2.5 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-[#002446]"
                        >
                          {academicYears.map((ay) => (
                            <option key={ay.id} value={ay.id}>
                              {ay.name} {ay.status === 'ACTIVE' ? '(Aktif)' : ''}
                            </option>
                          ))}
                        </select>
                      </div>
                    )}
                    {categories.length > 0 && (
                      <div>
                        <label className="block font-medium text-slate-700 mb-1">Kategori</label>
                        <select
                          value={newCategoryId}
                          onChange={(e) => setNewCategoryId(e.target.value)}
                          className="w-full border border-slate-300 rounded px-2.5 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-[#002446]"
                        >
                          <option value="">(Tanpa Kategori)</option>
                          {categories.map((c) => (
                            <option key={c.id} value={c.id}>
                              {c.name}
                            </option>
                          ))}
                        </select>
                      </div>
                    )}
                  </div>
                </CardContent>
              </Card>
            )}

            {/* Overview Stats */}
            <div className="grid grid-cols-2 md:grid-cols-5 gap-2 text-center">
              <div className="bg-slate-50 border border-slate-200 rounded p-2">
                <p className="text-xs text-slate-500">Modul</p>
                <p className="text-lg font-bold text-[#002446]">{previewData.stats.totalModules}</p>
              </div>
              <div className="bg-slate-50 border border-slate-200 rounded p-2">
                <p className="text-xs text-slate-500">Materi Teks</p>
                <p className="text-lg font-bold text-blue-700">{previewData.stats.totalPages}</p>
              </div>
              <div className="bg-slate-50 border border-slate-200 rounded p-2">
                <p className="text-xs text-slate-500">Berkas Lampiran</p>
                <p className="text-lg font-bold text-amber-700">{previewData.stats.totalResources}</p>
              </div>
              <div className="bg-slate-50 border border-slate-200 rounded p-2">
                <p className="text-xs text-slate-500">Penugasan</p>
                <p className="text-lg font-bold text-orange-700">{previewData.stats.totalAssignments}</p>
              </div>
              <div className="bg-slate-50 border border-slate-200 rounded p-2">
                <p className="text-xs text-slate-500">Kuis & Butir Soal</p>
                <p className="text-lg font-bold text-emerald-700">
                  {previewData.stats.totalQuizzes} ({previewData.stats.totalQuestions} Soal)
                </p>
              </div>
            </div>

            {/* Select All Controls */}
            <div className="flex items-center justify-between text-xs pt-1 pb-1">
              <div className="flex items-center gap-2">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="h-7 text-xs"
                  onClick={() => toggleAll(true)}
                >
                  Pilih Semua
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="h-7 text-xs"
                  onClick={() => toggleAll(false)}
                >
                  Batal Pilih
                </Button>
              </div>

              {previewData.stats.totalBankQuestions > 0 && (
                <label className="flex items-center gap-1.5 cursor-pointer text-slate-700">
                  <input
                    type="checkbox"
                    checked={importToQuestionBank}
                    onChange={(e) => setImportToQuestionBank(e.target.checked)}
                    className="rounded border-slate-300 text-[#002446] focus:ring-[#002446]"
                  />
                  <span>Simpan butir soal ke Bank Soal</span>
                </label>
              )}
            </div>

            {/* Modules and Activities Tree */}
            <div className="space-y-2.5">
              {previewData.modules.map((mod) => {
                const isModSelected = selectedModules[mod.id] || false;
                const isExpanded = expandedModules[mod.id] || false;

                return (
                  <div
                    key={mod.id}
                    className="border border-slate-200 rounded-lg overflow-hidden bg-white"
                  >
                    <div className="bg-slate-50/80 px-3 py-2 flex items-center justify-between border-b">
                      <div className="flex items-center gap-2">
                        <input
                          type="checkbox"
                          checked={isModSelected}
                          onChange={() => toggleModule(mod.id)}
                          className="rounded border-slate-300 text-[#002446] focus:ring-[#002446]"
                        />
                        <button
                          type="button"
                          onClick={() => toggleExpand(mod.id)}
                          className="flex items-center gap-1 text-left font-semibold text-xs text-[#002446] hover:underline"
                        >
                          {isExpanded ? (
                            <ChevronDown className="h-3.5 w-3.5 text-slate-400" />
                          ) : (
                            <ChevronRight className="h-3.5 w-3.5 text-slate-400" />
                          )}
                          <span>{mod.title}</span>
                        </button>
                      </div>

                      <span className="text-xs text-slate-500">
                        {mod.items.length} aktivitas
                      </span>
                    </div>

                    {isExpanded && mod.items.length > 0 && (
                      <div className="divide-y divide-slate-100 px-3 py-1 bg-white">
                        {mod.items.map((item) => {
                          const isItemSelected = selectedItems[item.id] || false;
                          return (
                            <div
                              key={item.id}
                              className="py-2 flex items-center justify-between text-xs"
                            >
                              <div className="flex items-center gap-2">
                                <input
                                  type="checkbox"
                                  checked={isItemSelected}
                                  onChange={() => toggleItem(mod.id, item.id)}
                                  className="rounded border-slate-300 text-[#002446] focus:ring-[#002446]"
                                />
                                <span className="font-medium text-slate-800">{item.title}</span>
                                {item.fileName && (
                                  <span className="text-slate-400 text-[11px]">
                                    ({item.fileName})
                                  </span>
                                )}
                              </div>
                              <div className="flex items-center gap-2">
                                {item.questionCount !== undefined && (
                                  <span className="text-[11px] text-slate-500">
                                    {item.questionCount} butir
                                  </span>
                                )}
                                {getItemTypeBadge(item.type)}
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* STEP 3: IMPORTING STATE */}
        {step === 'IMPORTING' && (
          <div className="py-16 text-center space-y-4">
            <Loader2 className="h-12 w-12 animate-spin text-[#FF8928] mx-auto" />
            <div className="space-y-1">
              <h3 className="text-base font-bold text-[#002446]">Sedang Mengeksekusi Migrasi</h3>
              <p className="text-xs text-slate-500 max-w-md mx-auto">
                Mengekstrak materi, mengonversi kuis dan penugasan, serta mengoptimalkan gambar ke sistem.
              </p>
            </div>
          </div>
        )}

        {/* STEP 4: DONE STATE */}
        {step === 'DONE' && importResultStats && (
          <div className="py-10 text-center space-y-4">
            <div className="h-14 w-14 rounded-full bg-emerald-50 text-emerald-600 flex items-center justify-center mx-auto">
              <CheckCircle2 className="h-8 w-8" />
            </div>
            <div className="space-y-1">
              <h3 className="text-base font-bold text-[#002446]">Migrasi Berhasil Diselesaikan!</h3>
              <p className="text-xs text-slate-500">
                Seluruh konten terpilih telah berhasil dimasukkan ke LenteraBelajar dalam status draf.
              </p>
            </div>

            <div className="bg-slate-50 border border-slate-200 rounded-lg p-4 max-w-md mx-auto text-xs text-left space-y-1.5 text-slate-700">
              <p className="font-semibold text-[#002446] mb-1">Rincian Data yang Diimpor:</p>
              <div className="flex justify-between">
                <span>Modul Ditambahkan:</span>
                <span className="font-bold">{importResultStats.importedModules}</span>
              </div>
              <div className="flex justify-between">
                <span>Materi Teks &amp; Berkas:</span>
                <span className="font-bold">{importResultStats.importedContents}</span>
              </div>
              <div className="flex justify-between">
                <span>Penugasan (Draf):</span>
                <span className="font-bold">{importResultStats.importedAssignments}</span>
              </div>
              <div className="flex justify-between">
                <span>Kuis (Draf):</span>
                <span className="font-bold">{importResultStats.importedQuizzes}</span>
              </div>
              <div className="flex justify-between">
                <span>Butir Soal Masuk Kuis:</span>
                <span className="font-bold">{importResultStats.importedQuestions}</span>
              </div>
              {importResultStats.importedBankQuestions > 0 && (
                <div className="flex justify-between">
                  <span>Butir Soal Masuk Bank Soal:</span>
                  <span className="font-bold text-emerald-700">
                    {importResultStats.importedBankQuestions}
                  </span>
                </div>
              )}
            </div>
          </div>
        )}

        <DialogFooter className="border-t pt-3 flex items-center justify-between">
          {step === 'UPLOAD' && (
            <Button variant="outline" size="sm" onClick={handleClose}>
              Tutup
            </Button>
          )}

          {step === 'PREVIEW' && (
            <>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setStep('UPLOAD')}
              >
                Ganti Berkas
              </Button>
              <Button
                size="sm"
                onClick={handleExecuteImport}
                className="bg-[#002446] hover:bg-[#002446]/90 text-white"
              >
                Mulai Migrasi <ArrowRight className="h-4 w-4 ml-1 inline" />
              </Button>
            </>
          )}

          {step === 'DONE' && (
            <Button
              size="sm"
              onClick={() => {
                handleClose();
                router.refresh();
              }}
              className="bg-[#002446] hover:bg-[#002446]/90 text-white ml-auto"
            >
              Selesai &amp; Lihat Kursus
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
