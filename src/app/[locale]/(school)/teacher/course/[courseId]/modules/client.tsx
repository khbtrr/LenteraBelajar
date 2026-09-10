'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  BookOpen,
  Plus,
  Trash2,
  FileText,
  FileDown,
  Video,
  HelpCircle,
  ClipboardList,
  Clock,
  Shuffle,
  Calendar,
  Layers,
  CheckCircle,
} from 'lucide-react';
import { createModule, deleteModule, createContent, deleteContent } from '@/lib/actions/module';
import { createQuiz, deleteQuiz, addQuizQuestion, updateQuizQuestion, getQuizWithQuestions } from '@/lib/actions/quiz';
import { createAssignment, deleteAssignment } from '@/lib/actions/assignment';
import { RichTextEditor } from '@/components/editor/rich-text-editor';
import { ContentType, QuestionType } from '@prisma/client';
import { Link } from '@/i18n/navigation';

export function TeacherCourseModulesClient({
  course,
  initialModules,
}: {
  course: any;
  initialModules: any[];
}) {
  const [modules, setModules] = useState<any[]>(initialModules);
  const [loading, setLoading] = useState(false);

  // Modals state
  const [isModuleModalOpen, setIsModuleModalOpen] = useState(false);
  const [moduleTitle, setModuleTitle] = useState('');

  // Active module for adding items
  const [activeModuleId, setActiveModuleId] = useState<string | null>(null);

  // Content Modal State
  const [isContentModalOpen, setIsContentModalOpen] = useState(false);
  const [contentTitle, setContentTitle] = useState('');
  const [contentType, setContentType] = useState<ContentType>(ContentType.TEXT);
  const [contentBody, setContentBody] = useState('');
  const [contentFile, setContentFile] = useState<File | null>(null);
  const [videoUrl, setVideoUrl] = useState('');

  // Quiz Modal State
  const [isQuizModalOpen, setIsQuizModalOpen] = useState(false);
  const [quizTitle, setQuizTitle] = useState('');
  const [quizDesc, setQuizDesc] = useState('');
  const [quizDuration, setQuizDuration] = useState('30');
  const [quizDeadline, setQuizDeadline] = useState('');
  const [shuffleQuestions, setShuffleQuestions] = useState(true);
  const [quizMaxAttempts, setQuizMaxAttempts] = useState('1');
  const [quizPassingGrade, setQuizPassingGrade] = useState('');

  // Question builder inside quiz creation
  const [questions, setQuestions] = useState<
    {
      type: QuestionType;
      text: string;
      points: number;
      options: { id: string; text: string; isCorrect: boolean }[];
    }[]
  >([]);

  // Current new question form
  const [qType, setQType] = useState<QuestionType>(QuestionType.MULTIPLE_CHOICE);
  const [qText, setQText] = useState('');
  const [qPoints, setQPoints] = useState(5);
  const [mcOptions, setMcOptions] = useState<{ id: string; text: string; isCorrect: boolean }[]>([
    { id: 'A', text: '', isCorrect: true },
    { id: 'B', text: '', isCorrect: false },
  ]);

  // Edit Question Modal State
  const [editingQuiz, setEditingQuiz] = useState<any>(null);
  const [editQuestionModal, setEditQuestionModal] = useState<{ id?: string; questionId?: string; type: QuestionType; text: string; points: number; options: any[] } | null>(null);

  // Assignment Modal State
  const [isAssignModalOpen, setIsAssignModalOpen] = useState(false);
  const [assignTitle, setAssignTitle] = useState('');
  const [assignDesc, setAssignDesc] = useState('');
  const [assignDeadline, setAssignDeadline] = useState('');
  const [assignMaxScore, setAssignMaxScore] = useState(100);
  const [assignAllowedTypes, setAssignAllowedTypes] = useState('pdf,docx,zip');

  // 1. Module handlers
  const handleCreateModule = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!moduleTitle.trim()) return;
    setLoading(true);
    try {
      const created = await createModule(course.id, moduleTitle);
      setModules((prev) => [
        ...prev,
        { ...created, contents: [], quizzes: [], assignments: [] },
      ]);
      setModuleTitle('');
      setIsModuleModalOpen(false);
    } catch (err) {
      console.error(err);
      alert('Gagal membuat modul');
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteModule = async (id: string) => {
    if (!confirm('Hapus modul ini beserta seluruh materi, kuis, dan tugas di dalamnya?')) return;
    setLoading(true);
    try {
      await deleteModule(id);
      setModules((prev) => prev.filter((m) => m.id !== id));
    } catch (err) {
      console.error(err);
      alert('Gagal menghapus modul');
    } finally {
      setLoading(false);
    }
  };

  // 2. Content handlers
  const handleCreateContent = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeModuleId || !contentTitle.trim()) return;
    setLoading(true);
    try {
      let fileUrl: string | undefined = undefined;
      let fileName: string | undefined = undefined;
      let fileSize: number | undefined = undefined;

      if (contentType === ContentType.FILE) {
        if (!contentFile) {
          alert('Silakan pilih berkas dokumen terlebih dahulu');
          setLoading(false);
          return;
        }
        const formData = new FormData();
        formData.append('file', contentFile);
        const res = await fetch('/api/upload', {
          method: 'POST',
          body: formData,
        });
        if (!res.ok) {
          const errData = await res.json().catch(() => ({}));
          throw new Error(errData.error || 'Upload berkas gagal');
        }
        const uploadRes = await res.json();
        fileUrl = uploadRes.url;
        fileName = uploadRes.fileName;
        fileSize = uploadRes.fileSize;
      } else if (contentType === ContentType.VIDEO) {
        fileUrl = videoUrl;
      }

      const created = await createContent({
        moduleId: activeModuleId,
        title: contentTitle,
        type: contentType,
        body: contentType === ContentType.TEXT ? contentBody : undefined,
        fileUrl,
        fileName,
        fileSize,
      });

      setModules((prev) =>
        prev.map((m) =>
          m.id === activeModuleId
            ? { ...m, contents: [...m.contents, created] }
            : m
        )
      );

      setIsContentModalOpen(false);
      setContentTitle('');
      setContentBody('');
      setContentFile(null);
      setVideoUrl('');
    } catch (err: any) {
      console.error(err);
      alert(err?.message || 'Gagal menyimpan konten materi');
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteContent = async (moduleId: string, contentId: string) => {
    if (!confirm('Hapus materi ini?')) return;
    try {
      await deleteContent(contentId);
      setModules((prev) =>
        prev.map((m) =>
          m.id === moduleId
            ? { ...m, contents: m.contents.filter((c: any) => c.id !== contentId) }
            : m
        )
      );
    } catch (err) {
      console.error(err);
    }
  };

  // 3. Quiz handlers
  const handleAddQuestionToQuizDraft = () => {
    if (!qText.trim()) return;

    if (qType === QuestionType.MULTIPLE_CHOICE) {
      const validOptions = mcOptions.filter((o) => o.text.trim());
      if (validOptions.length < 2) {
        alert('Minimal sediakan 2 Pilihan Jawaban');
        return;
      }
      const hasCorrect = validOptions.some((o) => o.isCorrect);
      if (!hasCorrect) {
        alert('Pilih setidaknya 1 jawaban yang benar');
        return;
      }
      
      setQuestions((prev) => [
        ...prev,
        { type: QuestionType.MULTIPLE_CHOICE, text: qText, points: Number(qPoints), options: validOptions },
      ]);
    } else {
      setQuestions((prev) => [
        ...prev,
        { type: QuestionType.ESSAY, text: qText, points: Number(qPoints), options: [] },
      ]);
    }

    setQText('');
    setMcOptions([
      { id: 'A', text: '', isCorrect: true },
      { id: 'B', text: '', isCorrect: false },
    ]);
  };

  const handleSaveQuiz = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeModuleId || !quizTitle.trim()) return;
    setLoading(true);
    try {
      const createdQuiz = await createQuiz({
        moduleId: activeModuleId,
        title: quizTitle,
        description: quizDesc,
        duration: quizDuration ? Number(quizDuration) : undefined,
        deadline: quizDeadline || undefined,
        shuffleQuestions,
        maxAttempts: quizMaxAttempts === 'unlimited' ? null : Number(quizMaxAttempts),
        passingGrade: quizPassingGrade ? Number(quizPassingGrade) : null,
      });

      // Add all drafted questions
      for (const q of questions) {
        await addQuizQuestion(createdQuiz.id, {
          type: q.type,
          text: q.text,
          points: q.points,
          options: q.options.length > 0 ? q.options : undefined,
        });
      }

      setModules((prev) =>
        prev.map((m) =>
          m.id === activeModuleId
            ? {
                ...m,
                quizzes: [
                  ...m.quizzes,
                  {
                    ...createdQuiz,
                    _count: { questions: questions.length, attempts: 0 },
                  },
                ],
              }
            : m
        )
      );

      setIsQuizModalOpen(false);
      setQuizTitle('');
      setQuizDesc('');
      setQuestions([]);
      setQuizMaxAttempts('1');
      setQuizPassingGrade('');
    } catch (err) {
      console.error(err);
      alert('Gagal membuat kuis');
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteQuiz = async (moduleId: string, quizId: string) => {
    if (!confirm('Hapus kuis ini?')) return;
    try {
      await deleteQuiz(quizId);
      setModules((prev) =>
        prev.map((m) =>
          m.id === moduleId
            ? { ...m, quizzes: m.quizzes.filter((q: any) => q.id !== quizId) }
            : m
        )
      );
    } catch (err) {
      console.error(err);
    }
  };

  // 4. Assignment handlers
  const handleSaveAssignment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeModuleId || !assignTitle.trim()) return;
    setLoading(true);
    try {
      const created = await createAssignment({
        moduleId: activeModuleId,
        title: assignTitle,
        description: assignDesc,
        deadline: assignDeadline || undefined,
        maxScore: Number(assignMaxScore),
        allowedTypes: assignAllowedTypes,
      });

      setModules((prev) =>
        prev.map((m) =>
          m.id === activeModuleId
            ? {
                ...m,
                assignments: [
                  ...m.assignments,
                  { ...created, _count: { submissions: 0 } },
                ],
              }
            : m
        )
      );

      setIsAssignModalOpen(false);
      setAssignTitle('');
      setAssignDesc('');
      setAssignDeadline('');
    } catch (err) {
      console.error(err);
      alert('Gagal membuat penugasan');
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteAssignment = async (moduleId: string, assignId: string) => {
    if (!confirm('Hapus penugasan ini?')) return;
    try {
      await deleteAssignment(assignId);
      setModules((prev) =>
        prev.map((m) =>
          m.id === moduleId
            ? { ...m, assignments: m.assignments.filter((a: any) => a.id !== assignId) }
            : m
        )
      );
    } catch (err) {
      console.error(err);
    }
  };

  const handleEditQuizClick = async (quizId: string) => {
    setLoading(true);
    try {
      const data = await getQuizWithQuestions(quizId);
      setEditingQuiz(data);
    } catch (err) {
      console.error(err);
      alert('Gagal memuat kuis');
    } finally {
      setLoading(false);
    }
  };

  const handleSaveEditedQuestion = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editQuestionModal || !editingQuiz) return;
    
    setLoading(true);
    try {
      let opts = undefined;
      if (editQuestionModal.type === QuestionType.MULTIPLE_CHOICE) {
         const validOptions = editQuestionModal.options.filter((o) => o.text.trim());
         if (validOptions.length < 2) {
           alert('Minimal 2 Pilihan Jawaban');
           setLoading(false);
           return;
         }
         opts = validOptions;
      }
      
      const questionId = editQuestionModal.id || editQuestionModal.questionId;
      if (!questionId) {
        alert('ID soal tidak valid');
        setLoading(false);
        return;
      }

      await updateQuizQuestion(questionId, {
        text: editQuestionModal.text,
        points: editQuestionModal.points,
        options: opts
      });
      
      alert('Berhasil menyimpan soal');
      setEditQuestionModal(null);
      const data = await getQuizWithQuestions(editingQuiz.id);
      setEditingQuiz(data);
    } catch (err) {
      console.error(err);
      alert('Gagal menyimpan soal');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="text-sm text-gray-600">
          Total <strong>{modules.length}</strong> bab modul pembelajaran
        </div>

        <div className="flex items-center gap-2">
          <Link href={`/teacher/course/${course.id}/question-bank`}>
            <Button variant="outline" className="border-emerald-300 text-emerald-700 hover:bg-emerald-100">
              Bank Soal
            </Button>
          </Link>
          <Button
            onClick={() => setIsModuleModalOpen(true)}
            className="bg-[#002446] hover:bg-[#002446]/90 text-white flex items-center gap-2"
          >
            <Plus className="h-4 w-4" /> Tambah Bab Modul
          </Button>
        </div>
      </div>

      {modules.length === 0 ? (
        <Card className="text-center py-16 border-dashed">
          <CardContent className="space-y-3">
            <Layers className="h-12 w-12 mx-auto text-gray-300" />
            <h3 className="text-lg font-bold text-[#002446]">Belum Ada Modul</h3>
            <p className="text-sm text-gray-500 max-w-md mx-auto">
              Mulai dengan menambahkan bab modul materi (misal: Bab 1 — Pengantar & Konsep Dasar).
            </p>
            <Button
              onClick={() => setIsModuleModalOpen(true)}
              className="bg-[#FF8928] hover:bg-[#FF8928]/90 text-white"
            >
              Buat Bab Pertama
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-6">
          {modules.map((mod, index) => (
            <Card key={mod.id} className="border border-gray-200 overflow-hidden shadow-sm">
              <CardHeader className="bg-gray-50/80 border-b py-3 px-5 flex flex-row items-center justify-between">
                <div className="flex items-center gap-3">
                  <span className="flex items-center justify-center h-7 w-7 rounded-full bg-[#002446] text-white text-xs font-bold">
                    {index + 1}
                  </span>
                  <CardTitle className="text-lg font-bold text-[#002446]">
                    {mod.title}
                  </CardTitle>
                </div>

                <div className="flex items-center gap-2">
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => {
                      setActiveModuleId(mod.id);
                      setIsContentModalOpen(true);
                    }}
                    className="h-8 text-xs border-blue-300 text-blue-700 hover:bg-blue-50 flex items-center gap-1"
                  >
                    <Plus className="h-3.5 w-3.5" /> Materi
                  </Button>

                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => {
                      setActiveModuleId(mod.id);
                      setIsQuizModalOpen(true);
                    }}
                    className="h-8 text-xs border-amber-300 text-amber-700 hover:bg-amber-50 flex items-center gap-1"
                  >
                    <HelpCircle className="h-3.5 w-3.5" /> Kuis
                  </Button>

                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => {
                      setActiveModuleId(mod.id);
                      setIsAssignModalOpen(true);
                    }}
                    className="h-8 text-xs border-purple-300 text-purple-700 hover:bg-purple-50 flex items-center gap-1"
                  >
                    <ClipboardList className="h-3.5 w-3.5" /> Tugas
                  </Button>

                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => handleDeleteModule(mod.id)}
                    className="h-8 w-8 p-0 text-red-500 hover:text-red-700 hover:bg-red-50 ml-2"
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              </CardHeader>

              <CardContent className="p-5 space-y-4">
                {/* 1. Materi Pembelajaran */}
                <div className="space-y-2">
                  <h4 className="text-xs font-bold text-gray-500 uppercase tracking-wider flex items-center gap-1.5">
                    <FileText className="h-4 w-4 text-blue-600" />
                    Materi ({mod.contents.length})
                  </h4>

                  {mod.contents.length === 0 ? (
                    <p className="text-xs text-gray-400 italic pl-5">Belum ada materi di bab ini.</p>
                  ) : (
                    <div className="space-y-2 pl-2">
                      {mod.contents.map((c: any) => (
                        <div
                          key={c.id}
                          className="flex items-center justify-between p-3 rounded-md bg-white border border-gray-100 hover:border-blue-200 transition-colors"
                        >
                          <div className="flex items-center gap-3">
                            {c.type === 'TEXT' ? (
                              <FileText className="h-5 w-5 text-blue-600" />
                            ) : c.type === 'FILE' ? (
                              <FileDown className="h-5 w-5 text-emerald-600" />
                            ) : (
                              <Video className="h-5 w-5 text-red-600" />
                            )}
                            <div>
                              <div className="font-semibold text-sm text-gray-800">
                                {c.title}
                              </div>
                              <div className="text-[11px] text-gray-500 flex items-center gap-2">
                                <Badge variant="outline" className="text-[10px] py-0">
                                  {c.type}
                                </Badge>
                                {c.fileName && <span>{c.fileName}</span>}
                              </div>
                            </div>
                          </div>

                          <div className="flex items-center gap-2">
                            {c.fileUrl && (
                              <a
                                href={c.fileUrl}
                                target="_blank"
                                rel="noreferrer"
                                className="text-xs text-blue-600 hover:underline px-2 py-1"
                              >
                                Unduh / Lihat
                              </a>
                            )}
                            <Button
                              size="sm"
                              variant="ghost"
                              onClick={() => handleDeleteContent(mod.id, c.id)}
                              className="h-7 w-7 p-0 text-gray-400 hover:text-red-600"
                            >
                              <Trash2 className="h-3.5 w-3.5" />
                            </Button>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                {/* 2. Kuis */}
                <div className="space-y-2 pt-2 border-t">
                  <h4 className="text-xs font-bold text-gray-500 uppercase tracking-wider flex items-center gap-1.5">
                    <HelpCircle className="h-4 w-4 text-[#FF8928]" />
                    Kuis ({mod.quizzes.length})
                  </h4>

                  {mod.quizzes.length === 0 ? (
                    <p className="text-xs text-gray-400 italic pl-5">Belum ada kuis di bab ini.</p>
                  ) : (
                    <div className="space-y-2 pl-2">
                      {mod.quizzes.map((q: any) => (
                        <div
                          key={q.id}
                          className="flex items-center justify-between p-3 rounded-md bg-amber-50/40 border border-amber-200/70"
                        >
                          <div>
                            <div className="font-semibold text-sm text-[#002446]">{q.title}</div>
                            <div className="text-xs text-gray-600 flex items-center gap-3 mt-1">
                              <span>{q._count.questions} Soal</span>
                              {q.duration && (
                                <span className="flex items-center gap-1">
                                  <Clock className="h-3 w-3 text-[#FF8928]" /> {q.duration} Menit
                                </span>
                              )}
                              {q.shuffleQuestions && (
                                <span className="flex items-center gap-1 text-emerald-700">
                                  <Shuffle className="h-3 w-3" /> Acak Soal
                                </span>
                              )}
                              {q.deadline && (
                                <span className="flex items-center gap-1 text-gray-500">
                                  <Calendar className="h-3 w-3" /> Batas:{' '}
                                  {new Date(q.deadline).toLocaleDateString('id-ID')}
                                </span>
                              )}
                            </div>
                          </div>

                          <div className="flex items-center gap-1">
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => handleEditQuizClick(q.id)}
                              className="h-7 text-xs border-amber-300 text-amber-700 hover:bg-amber-100"
                            >
                              Edit Kuis
                            </Button>
                            <Link href={`/teacher/course/${course.id}/quiz-attempts/${q.id}`}>
                              <Button
                                size="sm"
                                variant="outline"
                                className="h-7 text-xs border-blue-300 text-blue-700 hover:bg-blue-100"
                              >
                                Riwayat & Koreksi
                              </Button>
                            </Link>
                            <Button
                              size="sm"
                              variant="ghost"
                              onClick={() => handleDeleteQuiz(mod.id, q.id)}
                              className="h-7 w-7 p-0 text-gray-400 hover:text-red-600"
                            >
                              <Trash2 className="h-3.5 w-3.5" />
                            </Button>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                {/* 3. Penugasan */}
                <div className="space-y-2 pt-2 border-t">
                  <h4 className="text-xs font-bold text-gray-500 uppercase tracking-wider flex items-center gap-1.5">
                    <ClipboardList className="h-4 w-4 text-purple-600" />
                    Penugasan ({mod.assignments.length})
                  </h4>

                  {mod.assignments.length === 0 ? (
                    <p className="text-xs text-gray-400 italic pl-5">Belum ada tugas di bab ini.</p>
                  ) : (
                    <div className="space-y-2 pl-2">
                      {mod.assignments.map((a: any) => (
                        <div
                          key={a.id}
                          className="flex items-center justify-between p-3 rounded-md bg-purple-50/40 border border-purple-200/70"
                        >
                          <div>
                            <div className="font-semibold text-sm text-[#002446]">{a.title}</div>
                            <div className="text-xs text-gray-600 flex items-center gap-3 mt-1">
                              <span>Skor Max: {a.maxScore}</span>
                              <span>Terkumpul: {a._count.submissions} Siswa</span>
                              {a.deadline && (
                                <span className="flex items-center gap-1 text-purple-700 font-medium">
                                  <Calendar className="h-3 w-3" /> Deadline:{' '}
                                  {new Date(a.deadline).toLocaleDateString('id-ID')}
                                </span>
                              )}
                            </div>
                          </div>

                          <div className="flex items-center gap-1">
                            <Link href={`/teacher/course/${course.id}/submissions/${a.id}`}>
                              <Button
                                size="sm"
                                variant="outline"
                                className="h-7 text-xs border-purple-300 text-purple-700 hover:bg-purple-100"
                              >
                                Periksa Pengumpulan
                              </Button>
                            </Link>
                            <Button
                              size="sm"
                              variant="ghost"
                              onClick={() => handleDeleteAssignment(mod.id, a.id)}
                              className="h-7 w-7 p-0 text-gray-400 hover:text-red-600"
                            >
                              <Trash2 className="h-3.5 w-3.5" />
                            </Button>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Modal 1: Tambah Bab Modul */}
      <Dialog open={isModuleModalOpen} onOpenChange={setIsModuleModalOpen}>
        <DialogContent className="sm:max-w-md">
          <form onSubmit={handleCreateModule}>
            <DialogHeader>
              <DialogTitle className="text-xl font-bold text-[#002446]">
                Tambah Bab Modul Baru
              </DialogTitle>
            </DialogHeader>
            <div className="py-4">
              <Label htmlFor="mTitle">Judul Bab Modul</Label>
              <Input
                id="mTitle"
                placeholder="misal: Bab 1 — Konsep dan Pengantar Dasar"
                value={moduleTitle}
                onChange={(e) => setModuleTitle(e.target.value)}
                required
                className="mt-2"
              />
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setIsModuleModalOpen(false)}>
                Batal
              </Button>
              <Button type="submit" disabled={loading} className="bg-[#002446] text-white">
                {loading ? 'Menyimpan...' : 'Simpan Modul'}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Modal 2: Tambah Konten Materi */}
      <Dialog open={isContentModalOpen} onOpenChange={setIsContentModalOpen}>
        <DialogContent className="sm:max-w-3xl max-h-[90vh] flex flex-col">
          <form onSubmit={handleCreateContent} className="flex flex-col flex-1 overflow-hidden">
            <DialogHeader>
              <DialogTitle className="text-xl font-bold text-[#002446]">
                Tambah Konten Materi Pembelajaran
              </DialogTitle>
            </DialogHeader>

            <div className="space-y-4 py-4 flex-1 overflow-y-auto pr-1">
              <div className="space-y-2">
                <Label htmlFor="cntTitle">Judul Materi</Label>
                <Input
                  id="cntTitle"
                  placeholder="misal: Artikel Rangkuman Materi Bab 1"
                  value={contentTitle}
                  onChange={(e) => setContentTitle(e.target.value)}
                  required
                />
              </div>

              <div className="space-y-2">
                <Label>Format Konten</Label>
                <div className="flex gap-2">
                  <Button
                    type="button"
                    size="sm"
                    variant={contentType === ContentType.TEXT ? 'default' : 'outline'}
                    onClick={() => setContentType(ContentType.TEXT)}
                    className={contentType === ContentType.TEXT ? 'bg-[#002446] text-white' : ''}
                  >
                    <FileText className="h-4 w-4 mr-1.5" /> Rich Text (TipTap)
                  </Button>
                  <Button
                    type="button"
                    size="sm"
                    variant={contentType === ContentType.FILE ? 'default' : 'outline'}
                    onClick={() => setContentType(ContentType.FILE)}
                    className={contentType === ContentType.FILE ? 'bg-[#002446] text-white' : ''}
                  >
                    <FileDown className="h-4 w-4 mr-1.5" /> Berkas Dokumen (PDF/DOCX)
                  </Button>
                  <Button
                    type="button"
                    size="sm"
                    variant={contentType === ContentType.VIDEO ? 'default' : 'outline'}
                    onClick={() => setContentType(ContentType.VIDEO)}
                    className={contentType === ContentType.VIDEO ? 'bg-[#002446] text-white' : ''}
                  >
                    <Video className="h-4 w-4 mr-1.5" /> Video
                  </Button>
                </div>
              </div>

              {contentType === ContentType.TEXT && (
                <div className="space-y-2">
                  <Label>Isi Teks Materi (WYSIWYG Editor)</Label>
                  <RichTextEditor content={contentBody} onChange={setContentBody} />
                </div>
              )}

              {contentType === ContentType.FILE && (
                <div className="space-y-2 p-4 border rounded-lg bg-gray-50">
                  <Label htmlFor="docFile">Pilih Berkas Materi (PDF, DOCX, PPTX)</Label>
                  <Input
                    id="docFile"
                    type="file"
                    accept=".pdf,.docx,.doc,.pptx,.ppt,.xlsx,.xls"
                    onChange={(e) => setContentFile(e.target.files?.[0] || null)}
                    required
                    className="bg-white mt-1"
                  />
                  <p className="text-xs text-gray-500">Berkas tersimpan aman di server lokal LMS.</p>
                </div>
              )}

              {contentType === ContentType.VIDEO && (
                <div className="space-y-2">
                  <Label htmlFor="vUrl">URL Video (YouTube / Link Video)</Label>
                  <Input
                    id="vUrl"
                    placeholder="https://www.youtube.com/watch?v=... atau link video"
                    value={videoUrl}
                    onChange={(e) => setVideoUrl(e.target.value)}
                    required
                  />
                </div>
              )}
            </div>

            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setIsContentModalOpen(false)}>
                Batal
              </Button>
              <Button type="submit" disabled={loading} className="bg-[#002446] text-white">
                {loading ? 'Mengunggah...' : 'Simpan Materi'}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Modal 3: Buat Kuis & Soal */}
      <Dialog open={isQuizModalOpen} onOpenChange={setIsQuizModalOpen}>
        <DialogContent className="sm:max-w-3xl max-h-[90vh] flex flex-col">
          <form onSubmit={handleSaveQuiz} className="flex flex-col flex-1 overflow-hidden">
            <DialogHeader>
              <DialogTitle className="text-xl font-bold text-[#002446] flex items-center gap-2">
                <HelpCircle className="h-5 w-5 text-[#FF8928]" /> Buat Kuis Baru
              </DialogTitle>
            </DialogHeader>

            <div className="space-y-4 py-3 flex-1 overflow-y-auto pr-1">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="space-y-2 sm:col-span-2">
                  <Label htmlFor="qzTitle">Judul Kuis</Label>
                  <Input
                    id="qzTitle"
                    placeholder="misal: Kuis 1 — Pemahaman Konsep"
                    value={quizTitle}
                    onChange={(e) => setQuizTitle(e.target.value)}
                    required
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="qzDuration">Durasi Waktu Pengerjaan (Menit)</Label>
                  <Input
                    id="qzDuration"
                    type="number"
                    placeholder="30"
                    value={quizDuration}
                    onChange={(e) => setQuizDuration(e.target.value)}
                  />
                  <p className="text-[11px] text-gray-500">
                    Siswa akan melihat <strong>timer hitung mundur (countdown)</strong>.
                  </p>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="qzDeadline">Batas Waktu Pengumpulan (Deadline)</Label>
                  <Input
                    id="qzDeadline"
                    type="datetime-local"
                    value={quizDeadline}
                    onChange={(e) => setQuizDeadline(e.target.value)}
                  />
                </div>
              </div>

              <div className="flex items-center gap-2 p-3 bg-amber-50 rounded-lg border border-amber-200">
                <input
                  type="checkbox"
                  id="qzShuffle"
                  checked={shuffleQuestions}
                  onChange={(e) => setShuffleQuestions(e.target.checked)}
                  className="rounded border-gray-300 text-[#FF8928] focus:ring-[#002446]"
                />
                <Label htmlFor="qzShuffle" className="text-xs font-medium cursor-pointer text-amber-900">
                  Acak Urutan Soal untuk Setiap Siswa (Mencegah Mencontek)
                </Label>
              </div>

              {/* Max Attempts & KKM */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="space-y-2">
                  <Label htmlFor="qzMaxAttempts">Kesempatan Mengerjakan</Label>
                  <select
                    id="qzMaxAttempts"
                    value={quizMaxAttempts}
                    onChange={(e) => setQuizMaxAttempts(e.target.value)}
                    className="w-full h-10 rounded-md border border-gray-300 px-3 text-sm focus:outline-none focus:ring-2 focus:ring-[#002446]"
                  >
                    {[1,2,3,4,5,6,7,8,9,10].map(n => (
                      <option key={n} value={String(n)}>{n} kali</option>
                    ))}
                    <option value="unlimited">Unlimited (Tanpa Batas)</option>
                  </select>
                  <p className="text-[11px] text-gray-500">Nilai <strong>terbaik</strong> dari semua percobaan yang diambil.</p>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="qzPassingGrade">Nilai Minimal Lulus (KKM)</Label>
                  <Input
                    id="qzPassingGrade"
                    type="number"
                    min={0}
                    max={100}
                    placeholder="Kosongkan jika tidak ada"
                    value={quizPassingGrade}
                    onChange={(e) => setQuizPassingGrade(e.target.value)}
                  />
                  <p className="text-[11px] text-gray-500">Opsional. Nilai 0-100.</p>
                </div>
              </div>

              {/* Input Bank Soal */}
              <div className="border rounded-lg p-4 bg-gray-50 space-y-3">
                <div className="flex items-center justify-between">
                  <h4 className="font-bold text-sm text-[#002446]">
                    Tambah Soal ke Kuis (Total Draft: {questions.length} Soal)
                  </h4>
                  <div className="flex gap-2">
                    <Button
                      type="button"
                      size="sm"
                      variant={qType === QuestionType.MULTIPLE_CHOICE ? 'default' : 'outline'}
                      onClick={() => setQType(QuestionType.MULTIPLE_CHOICE)}
                      className={
                        qType === QuestionType.MULTIPLE_CHOICE ? 'bg-[#002446] text-white' : ''
                      }
                    >
                      Pilihan Ganda (Auto-Grade)
                    </Button>
                    <Button
                      type="button"
                      size="sm"
                      variant={qType === QuestionType.ESSAY ? 'default' : 'outline'}
                      onClick={() => setQType(QuestionType.ESSAY)}
                      className={qType === QuestionType.ESSAY ? 'bg-[#002446] text-white' : ''}
                    >
                      Essay / Uraian
                    </Button>
                  </div>
                </div>

                <div className="space-y-2">
                  <Label>Pertanyaan Soal</Label>
                  <Input
                    placeholder="Tuliskan butir soal di sini..."
                    value={qText}
                    onChange={(e) => setQText(e.target.value)}
                  />
                </div>

                {qType === QuestionType.MULTIPLE_CHOICE && (
                  <div className="space-y-2 pt-2">
                    <Label className="text-xs font-semibold text-gray-600">
                      Pilihan Jawaban & Tentukan Kunci Jawaban:
                    </Label>
                    <div className="space-y-2">
                      {mcOptions.map((opt, index) => (
                        <div key={opt.id} className="flex items-center gap-2">
                          <input
                            type="radio"
                            name="correctKey"
                            checked={opt.isCorrect}
                            onChange={() => {
                              setMcOptions(prev => prev.map(o => ({ ...o, isCorrect: o.id === opt.id })));
                            }}
                            className="mt-1"
                          />
                          <span className="text-sm font-bold w-6">{opt.id}.</span>
                          <Input
                            placeholder={`Pilihan ${opt.id}`}
                            value={opt.text}
                            onChange={(e) => {
                              setMcOptions(prev => prev.map(o => o.id === opt.id ? { ...o, text: e.target.value } : o));
                            }}
                          />
                          {mcOptions.length > 2 && (
                            <Button
                              type="button"
                              variant="ghost"
                              onClick={() => {
                                setMcOptions(prev => prev.filter(o => o.id !== opt.id));
                              }}
                              className="h-8 w-8 p-0 text-red-500"
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          )}
                        </div>
                      ))}
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={() => {
                          const nextChar = String.fromCharCode(mcOptions[mcOptions.length - 1].id.charCodeAt(0) + 1);
                          setMcOptions(prev => [...prev, { id: nextChar, text: '', isCorrect: false }]);
                        }}
                        className="text-xs mt-2"
                      >
                        + Tambah Opsi
                      </Button>
                    </div>
                  </div>
                )}

                <div className="flex justify-end pt-2">
                  <Button
                    type="button"
                    onClick={handleAddQuestionToQuizDraft}
                    className="bg-[#FF8928] hover:bg-[#FF8928]/90 text-white text-xs"
                  >
                    + Masukkan Soal ke Kuis
                  </Button>
                </div>
              </div>

              {/* Daftar Soal yang Telah Dimasukkan */}
              {questions.length > 0 && (
                <div className="space-y-2">
                  <Label className="text-xs font-bold text-gray-700">
                    Daftar Soal Tersimpan di Kuis Ini:
                  </Label>
                  <div className="divide-y border rounded-lg bg-white">
                    {questions.map((q, idx) => (
                      <div key={idx} className="p-3 text-xs flex items-center justify-between">
                        <div>
                          <span className="font-bold mr-2 text-[#002446]">#{idx + 1}</span>
                          <Badge variant="outline" className="mr-2 text-[10px]">
                            {q.type === 'MULTIPLE_CHOICE' ? 'Pilihan Ganda' : 'Essay'}
                          </Badge>
                          <span className="text-gray-800">{q.text}</span>
                        </div>
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => setQuestions((prev) => prev.filter((_, i) => i !== idx))}
                          className="h-6 w-6 p-0 text-red-500"
                        >
                          <Trash2 className="h-3 w-3" />
                        </Button>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>

            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setIsQuizModalOpen(false)}>
                Batal
              </Button>
              <Button type="submit" disabled={loading} className="bg-[#002446] text-white">
                {loading ? 'Menyimpan...' : 'Simpan Kuis & Soal'}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Modal 4: Buat Penugasan */}
      <Dialog open={isAssignModalOpen} onOpenChange={setIsAssignModalOpen}>
        <DialogContent className="sm:max-w-lg">
          <form onSubmit={handleSaveAssignment}>
            <DialogHeader>
              <DialogTitle className="text-xl font-bold text-[#002446] flex items-center gap-2">
                <ClipboardList className="h-5 w-5 text-purple-600" /> Buat Penugasan Siswa
              </DialogTitle>
            </DialogHeader>

            <div className="space-y-4 py-4">
              <div className="space-y-2">
                <Label htmlFor="asTitle">Judul Tugas</Label>
                <Input
                  id="asTitle"
                  placeholder="misal: Tugas Praktikum / Analisis Kasus Bab 1"
                  value={assignTitle}
                  onChange={(e) => setAssignTitle(e.target.value)}
                  required
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="asDesc">Instruksi & Kriteria Penugasan</Label>
                <textarea
                  id="asDesc"
                  rows={4}
                  placeholder="Tuliskan petunjuk lengkap pengumpulan tugas, format berkas yang diminta, dan rubrik penilaian..."
                  value={assignDesc}
                  onChange={(e) => setAssignDesc(e.target.value)}
                  className="w-full p-3 rounded-md border border-gray-300 text-sm focus:outline-none focus:ring-2 focus:ring-[#002446]"
                  required
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="asDeadline">Batas Waktu Pengumpulan</Label>
                  <Input
                    id="asDeadline"
                    type="datetime-local"
                    value={assignDeadline}
                    onChange={(e) => setAssignDeadline(e.target.value)}
                    required
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="asScore">Nilai Maksimal</Label>
                  <Input
                    id="asScore"
                    type="number"
                    value={assignMaxScore}
                    onChange={(e) => setAssignMaxScore(Number(e.target.value))}
                    required
                  />
                </div>
              </div>
            </div>

            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setIsAssignModalOpen(false)}>
                Batal
              </Button>
              <Button type="submit" disabled={loading} className="bg-[#002446] text-white">
                {loading ? 'Menyimpan...' : 'Simpan Tugas'}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Modal Edit Kuis & Soal */}
      <Dialog open={!!editingQuiz} onOpenChange={(open) => {
        if (!open) {
          setEditingQuiz(null);
          setEditQuestionModal(null);
        }
      }}>
        <DialogContent className="sm:max-w-3xl max-h-[90vh] flex flex-col">
          <DialogHeader>
            <DialogTitle className="text-xl font-bold text-[#002446]">
              Edit Kuis: {editingQuiz?.title}
            </DialogTitle>
          </DialogHeader>

          {editingQuiz?._count?.attempts > 0 && (
            <div className="bg-amber-100 text-amber-800 p-3 rounded-md text-sm font-semibold">
              ⚠️ Peringatan: Sudah ada {editingQuiz._count.attempts} siswa yang mengerjakan kuis ini. Perubahan pada soal bisa memengaruhi perhitungan nilai.
            </div>
          )}

          <div className="py-4 flex-1 overflow-y-auto space-y-4">
            <h4 className="font-bold text-sm">Daftar Soal</h4>
            <div className="divide-y border rounded-lg bg-white">
              {editingQuiz?.questions?.map((q: any, idx: number) => (
                <div key={q.id} className="p-3 text-sm flex items-center justify-between">
                  <div>
                    <span className="font-bold mr-2 text-[#002446]">#{idx + 1}</span>
                    <Badge variant="outline" className="mr-2 text-[10px]">
                      {q.type === 'MULTIPLE_CHOICE' ? 'PG' : 'Essay'}
                    </Badge>
                    <span className="text-gray-800">{q.text.substring(0, 50)}{q.text.length > 50 ? '...' : ''}</span>
                  </div>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => setEditQuestionModal({
                      id: q.id,
                      questionId: q.id,
                      type: q.type,
                      text: q.text,
                      points: q.points,
                      options: q.options || []
                    })}
                    className="h-7 text-xs border-blue-300 text-blue-700 hover:bg-blue-100"
                  >
                    Edit Soal
                  </Button>
                </div>
              ))}
              {editingQuiz?.questions?.length === 0 && (
                <div className="p-4 text-center text-gray-500 text-sm">Belum ada soal.</div>
              )}
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setEditingQuiz(null)}>
              Tutup
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Modal Edit Soal */}
      <Dialog open={!!editQuestionModal} onOpenChange={(open) => !open && setEditQuestionModal(null)}>
        <DialogContent className="sm:max-w-xl max-h-[90vh] flex flex-col">
          <form onSubmit={handleSaveEditedQuestion} className="flex flex-col flex-1 overflow-hidden">
            <DialogHeader>
              <DialogTitle className="text-lg font-bold text-[#002446]">
                Edit Soal
              </DialogTitle>
            </DialogHeader>

            {editQuestionModal && (
              <div className="space-y-4 py-4 flex-1 overflow-y-auto pr-1">
                <div className="space-y-2">
                  <Label>Pertanyaan</Label>
                  <Input
                    value={editQuestionModal.text}
                    onChange={(e) => setEditQuestionModal({ ...editQuestionModal, text: e.target.value })}
                    required
                  />
                </div>
                
                <div className="space-y-2">
                  <Label>Poin</Label>
                  <Input
                    type="number"
                    value={editQuestionModal.points}
                    onChange={(e) => setEditQuestionModal({ ...editQuestionModal, points: Number(e.target.value) })}
                    required
                  />
                </div>

                {editQuestionModal.type === QuestionType.MULTIPLE_CHOICE && (
                  <div className="space-y-2 pt-2">
                    <Label className="text-sm font-semibold">Pilihan Jawaban</Label>
                    <div className="space-y-2">
                      {editQuestionModal.options.map((opt: any) => (
                        <div key={opt.id} className="flex items-center gap-2">
                          <input
                            type="radio"
                            name="editCorrectKey"
                            checked={opt.isCorrect}
                            onChange={() => {
                              setEditQuestionModal({
                                ...editQuestionModal,
                                options: editQuestionModal.options.map((o: any) => ({ ...o, isCorrect: o.id === opt.id }))
                              });
                            }}
                            className="mt-1"
                          />
                          <span className="text-sm font-bold w-6">{opt.id}.</span>
                          <Input
                            value={opt.text}
                            onChange={(e) => {
                              setEditQuestionModal({
                                ...editQuestionModal,
                                options: editQuestionModal.options.map((o: any) => o.id === opt.id ? { ...o, text: e.target.value } : o)
                              });
                            }}
                          />
                          {editQuestionModal.options.length > 2 && (
                            <Button
                              type="button"
                              variant="ghost"
                              onClick={() => {
                                setEditQuestionModal({
                                  ...editQuestionModal,
                                  options: editQuestionModal.options.filter((o: any) => o.id !== opt.id)
                                });
                              }}
                              className="h-8 w-8 p-0 text-red-500"
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          )}
                        </div>
                      ))}
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={() => {
                          const nextChar = String.fromCharCode(editQuestionModal.options[editQuestionModal.options.length - 1].id.charCodeAt(0) + 1);
                          setEditQuestionModal({
                            ...editQuestionModal,
                            options: [...editQuestionModal.options, { id: nextChar, text: '', isCorrect: false }]
                          });
                        }}
                        className="text-xs mt-2"
                      >
                        + Tambah Opsi
                      </Button>
                    </div>
                  </div>
                )}
              </div>
            )}

            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setEditQuestionModal(null)}>
                Batal
              </Button>
              <Button type="submit" disabled={loading} className="bg-[#002446] text-white">
                {loading ? 'Menyimpan...' : 'Simpan Perubahan'}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
