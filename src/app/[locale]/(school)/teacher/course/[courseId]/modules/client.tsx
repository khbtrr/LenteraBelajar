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
  Database,
  CheckSquare,
  Square,
  ChevronDown,
  ChevronRight,
  FolderOpen,
} from 'lucide-react';
import { createModule, deleteModule, createContent, deleteContent } from '@/lib/actions/module';
import { createQuiz, deleteQuiz, addQuizQuestion, updateQuizQuestion, getQuizWithQuestions } from '@/lib/actions/quiz';
import { getQuestionBankByCategory } from '@/lib/actions/question-bank';
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
  const [shuffleOptions, setShuffleOptions] = useState(false);
  const [questionsPerPage, setQuestionsPerPage] = useState('0');
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
  const [qPoints, setQPoints] = useState(10);
  const [mcOptions, setMcOptions] = useState<{ id: string; text: string; isCorrect: boolean }[]>([
    { id: 'A', text: '', isCorrect: true },
    { id: 'B', text: '', isCorrect: false },
    { id: 'C', text: '', isCorrect: false },
    { id: 'D', text: '', isCorrect: false },
  ]);

  // Bank Soal Selection States inside Quiz Creation
  const [quizInputMode, setQuizInputMode] = useState<'manual' | 'bank'>('manual');
  const [bankData, setBankData] = useState<{ categories: any[]; uncategorized: any[] } | null>(null);
  const [bankLoading, setBankLoading] = useState(false);
  const [expandedCategories, setExpandedCategories] = useState<Record<string, boolean>>({ uncategorized: true });

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
      { id: 'C', text: '', isCorrect: false },
      { id: 'D', text: '', isCorrect: false },
    ]);
  };

  const handleFetchBankData = async () => {
    if (bankData || bankLoading) return;
    setBankLoading(true);
    try {
      const data = await getQuestionBankByCategory(course.id);
      setBankData(data);
    } catch (err) {
      console.error('Failed to fetch bank data:', err);
      alert('Gagal memuat data bank soal');
    } finally {
      setBankLoading(false);
    }
  };

  const handleToggleBankQuestion = (bankQ: any) => {
    // Check if already in draft questions (match by text or unique property)
    const existingIndex = questions.findIndex(
      (q) => q.text === bankQ.text && q.type === bankQ.type
    );

    if (existingIndex > -1) {
      // Remove from draft
      setQuestions((prev) => prev.filter((_, i) => i !== existingIndex));
    } else {
      // Add to draft
      const options =
        bankQ.type === QuestionType.MULTIPLE_CHOICE && Array.isArray(bankQ.options)
          ? bankQ.options.map((opt: any, idx: number) => ({
              id: opt.id || String.fromCharCode(65 + idx),
              text: opt.text || '',
              isCorrect: Boolean(opt.isCorrect),
            }))
          : [];

      setQuestions((prev) => [
        ...prev,
        {
          type: bankQ.type as QuestionType,
          text: bankQ.text,
          points: Number(bankQ.points) || 10,
          options,
        },
      ]);
    }
  };

  const handleSelectAllCategory = (catQuestions: any[], shouldSelectAll: boolean) => {
    if (shouldSelectAll) {
      // Add all questions not yet in draft
      const newToAdd: any[] = [];
      for (const bq of catQuestions) {
        if (!questions.some((q) => q.text === bq.text && q.type === bq.type)) {
          const options =
            bq.type === QuestionType.MULTIPLE_CHOICE && Array.isArray(bq.options)
              ? bq.options.map((opt: any, idx: number) => ({
                  id: opt.id || String.fromCharCode(65 + idx),
                  text: opt.text || '',
                  isCorrect: Boolean(opt.isCorrect),
                }))
              : [];
          newToAdd.push({
            type: bq.type as QuestionType,
            text: bq.text,
            points: Number(bq.points) || 10,
            options,
          });
        }
      }
      setQuestions((prev) => [...prev, ...newToAdd]);
    } else {
      // Remove all questions of this category from draft
      setQuestions((prev) =>
        prev.filter((q) => !catQuestions.some((bq) => bq.text === q.text && bq.type === q.type))
      );
    }
  };

  const handleSelectAllGlobal = (shouldSelectAll: boolean) => {
    if (!bankData) return;
    const allBankQuestions = [
      ...bankData.categories.flatMap((c: any) => c.questions || []),
      ...(bankData.uncategorized || []),
    ];

    if (shouldSelectAll) {
      const newToAdd: any[] = [];
      for (const bq of allBankQuestions) {
        if (!questions.some((q) => q.text === bq.text && q.type === bq.type)) {
          const options =
            bq.type === QuestionType.MULTIPLE_CHOICE && Array.isArray(bq.options)
              ? bq.options.map((opt: any, idx: number) => ({
                  id: opt.id || String.fromCharCode(65 + idx),
                  text: opt.text || '',
                  isCorrect: Boolean(opt.isCorrect),
                }))
              : [];
          newToAdd.push({
            type: bq.type as QuestionType,
            text: bq.text,
            points: Number(bq.points) || 10,
            options,
          });
        }
      }
      setQuestions((prev) => [...prev, ...newToAdd]);
    } else {
      // Deselect all bank questions from draft
      setQuestions((prev) =>
        prev.filter((q) => !allBankQuestions.some((bq) => bq.text === q.text && bq.type === q.type))
      );
    }
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
        shuffleOptions,
        questionsPerPage: Number(questionsPerPage) || 0,
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

              {/* Acak Soal & Acak Opsi */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="flex items-center gap-2 p-3 bg-amber-50 rounded-lg border border-amber-200">
                  <input
                    type="checkbox"
                    id="qzShuffle"
                    checked={shuffleQuestions}
                    onChange={(e) => setShuffleQuestions(e.target.checked)}
                    className="rounded border-gray-300 text-[#FF8928] focus:ring-[#002446]"
                  />
                  <Label htmlFor="qzShuffle" className="text-xs font-medium cursor-pointer text-amber-900">
                    Acak Urutan Soal (Shuffle Questions)
                  </Label>
                </div>

                <div className="flex items-center gap-2 p-3 bg-blue-50 rounded-lg border border-blue-200">
                  <input
                    type="checkbox"
                    id="qzShuffleOptions"
                    checked={shuffleOptions}
                    onChange={(e) => setShuffleOptions(e.target.checked)}
                    className="rounded border-gray-300 text-[#002446] focus:ring-[#002446]"
                  />
                  <Label htmlFor="qzShuffleOptions" className="text-xs font-medium cursor-pointer text-blue-950">
                    Acak Pilihan Jawaban PG (Shuffle Options)
                  </Label>
                </div>
              </div>

              {/* Tampilan per Halaman, Max Attempts & KKM */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div className="space-y-2">
                  <Label htmlFor="qzPerPage">Tampilan Soal per Halaman</Label>
                  <select
                    id="qzPerPage"
                    value={questionsPerPage}
                    onChange={(e) => setQuestionsPerPage(e.target.value)}
                    className="w-full h-10 rounded-md border border-gray-300 px-3 text-sm focus:outline-none focus:ring-2 focus:ring-[#002446]"
                  >
                    <option value="0">Semua Soal dalam 1 Halaman</option>
                    <option value="1">1 Soal per Halaman (Fokus CBT)</option>
                  </select>
                  <p className="text-[11px] text-gray-500">Mode 1 soal menampilkan navigasi ala Moodle/CBT.</p>
                </div>
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
                  <p className="text-[11px] text-gray-500">Nilai <strong>terbaik</strong> yang diambil.</p>
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

              {/* Mode Selector Tabs: Manual vs Bank Soal */}
              <div className="flex border-b border-gray-200">
                <button
                  type="button"
                  onClick={() => setQuizInputMode('manual')}
                  className={`flex items-center gap-2 px-4 py-2.5 text-xs font-bold border-b-2 transition-colors ${
                    quizInputMode === 'manual'
                      ? 'border-[#002446] text-[#002446] bg-blue-50/50'
                      : 'border-transparent text-gray-500 hover:text-gray-700'
                  }`}
                >
                  <Plus className="w-3.5 h-3.5 text-[#FF8928]" />
                  Input Soal Manual
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setQuizInputMode('bank');
                    handleFetchBankData();
                  }}
                  className={`flex items-center gap-2 px-4 py-2.5 text-xs font-bold border-b-2 transition-colors ${
                    quizInputMode === 'bank'
                      ? 'border-[#002446] text-[#002446] bg-blue-50/50'
                      : 'border-transparent text-gray-500 hover:text-gray-700'
                  }`}
                >
                  <Database className="w-3.5 h-3.5 text-[#FF8928]" />
                  Ambil dari Bank Soal
                </button>
              </div>

              {quizInputMode === 'manual' ? (
                /* Mode 1: Input Manual */
                <div className="border rounded-lg p-4 bg-gray-50 space-y-3">
                  <div className="flex items-center justify-between">
                    <h4 className="font-bold text-sm text-[#002446]">
                      Tambah Soal Manual ke Kuis (Total Draft: {questions.length} Soal)
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

                  <div className="grid grid-cols-1 sm:grid-cols-4 gap-3">
                    <div className="sm:col-span-3 space-y-1.5">
                      <Label className="text-xs font-semibold text-gray-700">Pertanyaan Soal</Label>
                      <Input
                        placeholder="Tuliskan butir soal di sini..."
                        value={qText}
                        onChange={(e) => setQText(e.target.value)}
                      />
                    </div>
                    <div className="space-y-1.5">
                      <Label className="text-xs font-semibold text-gray-700">Bobot Poin</Label>
                      <Input
                        type="number"
                        min={1}
                        max={100}
                        value={qPoints}
                        onChange={(e) => setQPoints(Math.max(1, Number(e.target.value) || 1))}
                        className="font-bold text-[#002446]"
                      />
                      <p className="text-[10px] text-gray-500">Default: 10 poin</p>
                    </div>
                  </div>

                  {qType === QuestionType.MULTIPLE_CHOICE && (
                    <div className="space-y-3 pt-2 border-t border-gray-200">
                      <div>
                        <Label className="text-xs font-bold text-[#002446]">
                          Pilihan Jawaban & Tentukan Kunci Jawaban:
                        </Label>
                        <p className="text-[11px] text-gray-500 mt-0.5">
                          Klik radio button di samping huruf untuk memilih jawaban benar. Anda dapat menambah atau mengurangi pilihan (minimal 2).
                        </p>
                      </div>

                      <div className="space-y-2">
                        {mcOptions.map((opt) => (
                          <div
                            key={opt.id}
                            className={`flex items-center gap-2 p-2 rounded-lg border transition-all ${
                              opt.isCorrect
                                ? 'bg-emerald-50/70 border-emerald-300 shadow-xs'
                                : 'bg-white border-gray-200 hover:border-gray-300'
                            }`}
                          >
                            <label className="flex items-center gap-2 cursor-pointer select-none">
                              <input
                                type="radio"
                                name="correctKey"
                                checked={opt.isCorrect}
                                onChange={() => {
                                  setMcOptions((prev) =>
                                    prev.map((o) => ({ ...o, isCorrect: o.id === opt.id }))
                                  );
                                }}
                                className="w-4 h-4 text-emerald-600 focus:ring-emerald-500 cursor-pointer"
                              />
                              <span
                                className={`flex items-center justify-center w-7 h-7 rounded-full text-xs font-bold transition-colors ${
                                  opt.isCorrect
                                    ? 'bg-emerald-600 text-white shadow-xs'
                                    : 'bg-gray-100 text-gray-700'
                                }`}
                              >
                                {opt.id}
                              </span>
                            </label>

                            <Input
                              placeholder={`Masukkan teks untuk Pilihan ${opt.id}...`}
                              value={opt.text}
                              onChange={(e) => {
                                setMcOptions((prev) =>
                                  prev.map((o) => (o.id === opt.id ? { ...o, text: e.target.value } : o))
                                );
                              }}
                              className={`flex-1 bg-white text-sm ${
                                opt.isCorrect ? 'border-emerald-300 focus-visible:ring-emerald-500' : ''
                              }`}
                            />

                            {opt.isCorrect && (
                              <span className="text-[11px] font-semibold text-emerald-700 bg-emerald-100/80 px-2 py-1 rounded hidden sm:inline whitespace-nowrap">
                                ✓ Kunci Benar
                              </span>
                            )}

                            {mcOptions.length > 2 && (
                              <Button
                                type="button"
                                variant="ghost"
                                size="sm"
                                onClick={() => {
                                  setMcOptions((prev) => {
                                    const filtered = prev.filter((o) => o.id !== opt.id);
                                    const hadCorrect = filtered.some((o) => o.isCorrect);
                                    return filtered.map((o, idx) => ({
                                      ...o,
                                      id: String.fromCharCode(65 + idx),
                                      isCorrect: hadCorrect ? o.isCorrect : idx === 0,
                                    }));
                                  });
                                }}
                                className="h-8 w-8 p-0 text-gray-400 hover:text-red-600 hover:bg-red-50"
                                title={`Hapus Pilihan ${opt.id}`}
                              >
                                <Trash2 className="h-4 w-4" />
                              </Button>
                            )}
                          </div>
                        ))}

                        <Button
                          type="button"
                          variant="outline"
                          onClick={() => {
                            const nextLetter = String.fromCharCode(65 + mcOptions.length);
                            setMcOptions((prev) => [
                              ...prev,
                              { id: nextLetter, text: '', isCorrect: false },
                            ]);
                          }}
                          className="w-full mt-2 border-dashed border-2 border-blue-200 bg-blue-50/30 text-[#002446] hover:bg-blue-50 hover:border-[#002446] flex items-center justify-center gap-2 py-2.5 font-semibold text-xs transition-colors"
                        >
                          <Plus className="h-4 w-4 text-[#FF8928]" />
                          Tambah Pilihan Jawaban ({String.fromCharCode(65 + mcOptions.length)})
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
              ) : (
                /* Mode 2: Ambil dari Bank Soal */
                <div className="border rounded-lg p-4 bg-slate-50/70 space-y-3">
                  <div className="flex items-center justify-between">
                    <div>
                      <h4 className="font-bold text-sm text-[#002446] flex items-center gap-1.5">
                        <Database className="w-4 h-4 text-[#FF8928]" />
                        Pilih Butir Soal dari Bank Soal
                      </h4>
                      <p className="text-[11px] text-gray-500 mt-0.5">
                        Centang soal yang ingin dimasukkan ke dalam kuis ini. Soal otomatis ditambahkan ke daftar kuis.
                      </p>
                    </div>
                    <Link
                      href={`/teacher/course/${course.id}/question-bank`}
                      target="_blank"
                      className="text-xs text-[#FF8928] hover:underline flex items-center gap-1"
                    >
                      Buka Kelola Bank Soal ↗
                    </Link>
                  </div>

                  {bankLoading ? (
                    <div className="text-center py-8 text-xs text-gray-500">
                      Memuat daftar soal dari Bank Soal...
                    </div>
                  ) : !bankData || (bankData.categories.length === 0 && bankData.uncategorized.length === 0) ? (
                    <div className="text-center py-8 bg-white rounded-lg border border-dashed text-gray-500 text-xs space-y-2">
                      <p>Bank Soal kursus ini masih kosong.</p>
                      <Link href={`/teacher/course/${course.id}/question-bank`}>
                        <Button type="button" size="sm" variant="outline" className="text-xs">
                          Tambah atau Impor Soal ke Bank Soal
                        </Button>
                      </Link>
                    </div>
                  ) : (
                    <div className="space-y-3 max-h-[380px] overflow-y-auto pr-1">
                      {/* Global Batch Select Controls */}
                      <div className="flex items-center justify-between p-2.5 bg-blue-50/70 border border-blue-200 rounded-lg text-xs">
                        <span className="font-bold text-[#002446]">
                          Total Tersedia:{' '}
                          {bankData.categories.reduce((acc: number, c: any) => acc + (c.questions?.length || 0), 0) +
                            (bankData.uncategorized?.length || 0)}{' '}
                          Soal Bank
                        </span>
                        <div className="flex items-center gap-2">
                          <button
                            type="button"
                            onClick={() => handleSelectAllGlobal(true)}
                            className="text-[11px] font-semibold text-[#002446] hover:underline flex items-center gap-1 bg-white px-2 py-1 rounded border border-blue-200"
                          >
                            <CheckSquare className="w-3.5 h-3.5 text-emerald-600" />
                            Pilih Semua Soal
                          </button>
                          <button
                            type="button"
                            onClick={() => handleSelectAllGlobal(false)}
                            className="text-[11px] font-semibold text-red-600 hover:underline flex items-center gap-1 bg-white px-2 py-1 rounded border border-red-200"
                          >
                            <Square className="w-3.5 h-3.5 text-red-500" />
                            Batal Pilih Semua
                          </button>
                        </div>
                      </div>

                      {/* Categories list */}
                      {bankData.categories.map((cat: any) => {
                        const isExpanded = expandedCategories[cat.id] ?? false;
                        const catQuestions = cat.questions || [];
                        const selectedInCat = catQuestions.filter((q: any) =>
                          questions.some((draftQ) => draftQ.text === q.text && draftQ.type === q.type)
                        ).length;
                        const isAllCatSelected = catQuestions.length > 0 && selectedInCat === catQuestions.length;

                        return (
                          <div key={cat.id} className="border rounded-lg bg-white overflow-hidden shadow-2xs">
                            <div className="p-3 bg-gray-50/80 hover:bg-gray-100/80 flex items-center justify-between transition-colors border-b">
                              <div
                                onClick={() =>
                                  setExpandedCategories((prev) => ({
                                    ...prev,
                                    [cat.id]: !prev[cat.id],
                                  }))
                                }
                                className="flex items-center gap-2 cursor-pointer select-none flex-1"
                              >
                                {isExpanded ? (
                                  <ChevronDown className="w-4 h-4 text-gray-500" />
                                ) : (
                                  <ChevronRight className="w-4 h-4 text-gray-500" />
                                )}
                                <FolderOpen className="w-4 h-4 text-[#FF8928]" />
                                <span className="font-semibold text-xs text-[#002446]">{cat.name}</span>
                                <Badge variant="outline" className="text-[10px] text-gray-500">
                                  {catQuestions.length} Soal
                                </Badge>
                                {selectedInCat > 0 && (
                                  <Badge className="bg-emerald-100 text-emerald-800 border-emerald-300 text-[10px]">
                                    {selectedInCat} terpilih
                                  </Badge>
                                )}
                              </div>

                              {catQuestions.length > 0 && (
                                <button
                                  type="button"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    handleSelectAllCategory(catQuestions, !isAllCatSelected);
                                  }}
                                  className={`text-[10px] font-semibold px-2 py-0.5 rounded border transition-colors ${
                                    isAllCatSelected
                                      ? 'bg-red-50 text-red-700 border-red-200 hover:bg-red-100'
                                      : 'bg-emerald-50 text-emerald-700 border-emerald-200 hover:bg-emerald-100'
                                  }`}
                                >
                                  {isAllCatSelected ? 'Batal Pilih Kategori' : 'Pilih Semua Kategori'}
                                </button>
                              )}
                            </div>

                            {isExpanded && (
                              <div className="divide-y p-1">
                                {catQuestions.length === 0 ? (
                                  <div className="p-3 text-center text-xs text-gray-400">
                                    Tidak ada butir soal dalam kategori ini.
                                  </div>
                                ) : (
                                  catQuestions.map((bankQ: any) => {
                                    const isChecked = questions.some(
                                      (q) => q.text === bankQ.text && q.type === bankQ.type
                                    );

                                    return (
                                      <div
                                        key={bankQ.id}
                                        onClick={() => handleToggleBankQuestion(bankQ)}
                                        className={`p-2.5 text-xs flex items-start gap-2.5 rounded cursor-pointer transition-colors ${
                                          isChecked
                                            ? 'bg-blue-50/70 border-l-4 border-l-[#002446]'
                                            : 'hover:bg-gray-50'
                                        }`}
                                      >
                                        <div className="pt-0.5">
                                          {isChecked ? (
                                            <CheckSquare className="w-4 h-4 text-[#002446]" />
                                          ) : (
                                            <Square className="w-4 h-4 text-gray-400" />
                                          )}
                                        </div>
                                        <div className="flex-1 space-y-1">
                                          <div className="flex items-center gap-1.5">
                                            <Badge variant="outline" className="text-[9px]">
                                              {bankQ.type === QuestionType.MULTIPLE_CHOICE ? 'PG' : 'Essay'}
                                            </Badge>
                                            <Badge variant="secondary" className="text-[9px]">
                                              {bankQ.points} Poin
                                            </Badge>
                                          </div>
                                          <div
                                            className="text-gray-800 line-clamp-2 [&_img]:max-h-16 [&_img]:rounded [&_img]:my-1"
                                            dangerouslySetInnerHTML={{ __html: bankQ.text }}
                                          />
                                        </div>
                                      </div>
                                    );
                                  })
                                )}
                              </div>
                            )}
                          </div>
                        );
                      })}

                      {/* Uncategorized Questions */}
                      {bankData.uncategorized && bankData.uncategorized.length > 0 && (
                        <div className="border rounded-lg bg-white overflow-hidden shadow-2xs">
                            <div className="p-3 bg-gray-50/80 hover:bg-gray-100/80 flex items-center justify-between transition-colors border-b">
                              <div
                                onClick={() =>
                                  setExpandedCategories((prev) => ({
                                    ...prev,
                                    uncategorized: !prev.uncategorized,
                                  }))
                                }
                                className="flex items-center gap-2 cursor-pointer select-none flex-1"
                              >
                                {expandedCategories.uncategorized ? (
                                  <ChevronDown className="w-4 h-4 text-gray-500" />
                                ) : (
                                  <ChevronRight className="w-4 h-4 text-gray-500" />
                                )}
                                <FolderOpen className="w-4 h-4 text-gray-400" />
                                <span className="font-semibold text-xs text-gray-700">Belum Berkategori</span>
                                <Badge variant="outline" className="text-[10px] text-gray-500">
                                  {bankData.uncategorized.length} Soal
                                </Badge>
                                {bankData.uncategorized.filter((q: any) =>
                                  questions.some((draftQ) => draftQ.text === q.text && draftQ.type === q.type)
                                ).length > 0 && (
                                  <Badge className="bg-emerald-100 text-emerald-800 border-emerald-300 text-[10px]">
                                    {
                                      bankData.uncategorized.filter((q: any) =>
                                        questions.some((draftQ) => draftQ.text === q.text && draftQ.type === q.type)
                                      ).length
                                    }{' '}
                                    terpilih
                                  </Badge>
                                )}
                              </div>

                              {bankData.uncategorized.length > 0 && (
                                <button
                                  type="button"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    const isAllUncatSelected =
                                      bankData.uncategorized.length > 0 &&
                                      bankData.uncategorized.filter((q: any) =>
                                        questions.some((draftQ) => draftQ.text === q.text && draftQ.type === q.type)
                                      ).length === bankData.uncategorized.length;
                                    handleSelectAllCategory(bankData.uncategorized, !isAllUncatSelected);
                                  }}
                                  className="text-[10px] font-semibold px-2 py-0.5 rounded border bg-emerald-50 text-emerald-700 border-emerald-200 hover:bg-emerald-100 transition-colors"
                                >
                                  Pilih Semua
                                </button>
                              )}
                            </div>

                          {expandedCategories.uncategorized && (
                            <div className="divide-y p-1">
                              {bankData.uncategorized.map((bankQ: any) => {
                                const isChecked = questions.some(
                                  (q) => q.text === bankQ.text && q.type === bankQ.type
                                );

                                return (
                                  <div
                                    key={bankQ.id}
                                    onClick={() => handleToggleBankQuestion(bankQ)}
                                    className={`p-2.5 text-xs flex items-start gap-2.5 rounded cursor-pointer transition-colors ${
                                      isChecked
                                        ? 'bg-blue-50/70 border-l-4 border-l-[#002446]'
                                        : 'hover:bg-gray-50'
                                    }`}
                                  >
                                    <div className="pt-0.5">
                                      {isChecked ? (
                                        <CheckSquare className="w-4 h-4 text-[#002446]" />
                                      ) : (
                                        <Square className="w-4 h-4 text-gray-400" />
                                      )}
                                    </div>
                                    <div className="flex-1 space-y-1">
                                      <div className="flex items-center gap-1.5">
                                        <Badge variant="outline" className="text-[9px]">
                                          {bankQ.type === QuestionType.MULTIPLE_CHOICE ? 'PG' : 'Essay'}
                                        </Badge>
                                        <Badge variant="secondary" className="text-[9px]">
                                          {bankQ.points} Poin
                                        </Badge>
                                      </div>
                                      <div
                                        className="text-gray-800 line-clamp-2 [&_img]:max-h-16 [&_img]:rounded [&_img]:my-1"
                                        dangerouslySetInnerHTML={{ __html: bankQ.text }}
                                      />
                                    </div>
                                  </div>
                                );
                              })}
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  )}
                </div>
              )}

              {/* Daftar Soal yang Telah Dimasukkan */}
              {questions.length > 0 && (
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <Label className="text-xs font-bold text-gray-700">
                      Daftar Soal Tersimpan di Kuis Ini ({questions.length} Soal):
                    </Label>
                    <div className="flex items-center gap-2">
                      <span className="text-xs text-gray-500">Total Akumulasi:</span>
                      <Badge
                        className={`text-xs font-bold ${
                          questions.reduce((sum, q) => sum + (q.points || 0), 0) === 100
                            ? 'bg-emerald-100 text-emerald-800 border-emerald-300'
                            : 'bg-blue-100 text-[#002446] border-blue-300'
                        }`}
                      >
                        {questions.reduce((sum, q) => sum + (q.points || 0), 0)} Poin
                        {questions.reduce((sum, q) => sum + (q.points || 0), 0) === 100 && ' ✓ Ideal untuk KKM'}
                      </Badge>
                    </div>
                  </div>
                  <div className="divide-y border rounded-lg bg-white">
                    {questions.map((q, idx) => (
                      <div key={idx} className="p-3 text-xs flex items-center justify-between">
                        <div>
                          <span className="font-bold mr-2 text-[#002446]">#{idx + 1}</span>
                          <Badge variant="outline" className="mr-1.5 text-[10px]">
                            {q.type === 'MULTIPLE_CHOICE' ? 'Pilihan Ganda' : 'Essay'}
                          </Badge>
                          <Badge variant="secondary" className="mr-2 text-[10px] bg-slate-100 text-slate-700 font-semibold">
                            {q.points} Poin
                          </Badge>
                          <div
                            className="inline text-gray-800 [&_img]:inline-block [&_img]:max-h-8 [&_img]:rounded [&_img]:align-middle [&_img]:mr-1"
                            dangerouslySetInnerHTML={{ __html: q.text }}
                          />
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
                  <div className="space-y-3 pt-2 border-t border-gray-200">
                    <div>
                      <Label className="text-xs font-bold text-[#002446]">
                        Pilihan Jawaban & Tentukan Kunci Jawaban:
                      </Label>
                      <p className="text-[11px] text-gray-500 mt-0.5">
                        Pilih radio button untuk menentukan kunci jawaban yang benar.
                      </p>
                    </div>

                    <div className="space-y-2">
                      {editQuestionModal.options.map((opt: any) => (
                        <div
                          key={opt.id}
                          className={`flex items-center gap-2 p-2 rounded-lg border transition-all ${
                            opt.isCorrect
                              ? 'bg-emerald-50/70 border-emerald-300 shadow-xs'
                              : 'bg-white border-gray-200 hover:border-gray-300'
                          }`}
                        >
                          <label className="flex items-center gap-2 cursor-pointer select-none">
                            <input
                              type="radio"
                              name="editCorrectKey"
                              checked={opt.isCorrect}
                              onChange={() => {
                                setEditQuestionModal({
                                  ...editQuestionModal,
                                  options: editQuestionModal.options.map((o: any) => ({
                                    ...o,
                                    isCorrect: o.id === opt.id,
                                  })),
                                });
                              }}
                              className="w-4 h-4 text-emerald-600 focus:ring-emerald-500 cursor-pointer"
                            />
                            <span
                              className={`flex items-center justify-center w-7 h-7 rounded-full text-xs font-bold transition-colors ${
                                opt.isCorrect
                                  ? 'bg-emerald-600 text-white shadow-xs'
                                  : 'bg-gray-100 text-gray-700'
                              }`}
                            >
                              {opt.id}
                            </span>
                          </label>

                          <Input
                            value={opt.text}
                            onChange={(e) => {
                              setEditQuestionModal({
                                ...editQuestionModal,
                                options: editQuestionModal.options.map((o: any) =>
                                  o.id === opt.id ? { ...o, text: e.target.value } : o
                                ),
                              });
                            }}
                            className={`flex-1 bg-white text-sm ${
                              opt.isCorrect ? 'border-emerald-300 focus-visible:ring-emerald-500' : ''
                            }`}
                          />

                          {opt.isCorrect && (
                            <span className="text-[11px] font-semibold text-emerald-700 bg-emerald-100/80 px-2 py-1 rounded hidden sm:inline whitespace-nowrap">
                              ✓ Kunci Benar
                            </span>
                          )}

                          {editQuestionModal.options.length > 2 && (
                            <Button
                              type="button"
                              variant="ghost"
                              size="sm"
                              onClick={() => {
                                const filtered = editQuestionModal.options.filter(
                                  (o: any) => o.id !== opt.id
                                );
                                const hadCorrect = filtered.some((o: any) => o.isCorrect);
                                setEditQuestionModal({
                                  ...editQuestionModal,
                                  options: filtered.map((o: any, idx: number) => ({
                                    ...o,
                                    id: String.fromCharCode(65 + idx),
                                    isCorrect: hadCorrect ? o.isCorrect : idx === 0,
                                  })),
                                });
                              }}
                              className="h-8 w-8 p-0 text-gray-400 hover:text-red-600 hover:bg-red-50"
                              title={`Hapus Pilihan ${opt.id}`}
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          )}
                        </div>
                      ))}

                      <Button
                        type="button"
                        variant="outline"
                        onClick={() => {
                          const nextLetter = String.fromCharCode(65 + editQuestionModal.options.length);
                          setEditQuestionModal({
                            ...editQuestionModal,
                            options: [
                              ...editQuestionModal.options,
                              { id: nextLetter, text: '', isCorrect: false },
                            ],
                          });
                        }}
                        className="w-full mt-2 border-dashed border-2 border-blue-200 bg-blue-50/30 text-[#002446] hover:bg-blue-50 hover:border-[#002446] flex items-center justify-center gap-2 py-2.5 font-semibold text-xs transition-colors"
                      >
                        <Plus className="h-4 w-4 text-[#FF8928]" />
                        Tambah Pilihan Jawaban ({String.fromCharCode(65 + editQuestionModal.options.length)})
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
