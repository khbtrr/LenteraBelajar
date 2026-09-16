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
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
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
  CheckCircle2,
  Database,
  CheckSquare,
  Square,
  ChevronDown,
  ChevronRight,
  FolderOpen,
  AlertTriangle,
  AlertCircle,
  Paperclip,
  Upload,
  X,
  Edit,
  Shield,
  Headphones,
  KeyRound,
  RefreshCw,
} from 'lucide-react';
import { QuestionTextRenderer } from '@/components/quiz/question-text-renderer';
import { createModule, deleteModule, createContent, deleteContent } from '@/lib/actions/module';

function extractMediaFromText(text: string) {
  if (!text) return { type: 'NONE' as const, url: '', maxPlay: null, cleanText: '' };

  const audioPlaceholder = text.match(/<div class="quiz-media-audio[^"]*"\s+data-src="([^"]+)"(?:\s+data-max-play="(\d+)")?[^>]*><\/div>/i);
  const audioTag = text.match(/\[(?:Audio|Suara):\s*([^,\]]+)(?:,\s*(?:maxPlay|putar):\s*(\d+))?\]/i);

  if (audioPlaceholder) {
    return {
      type: 'AUDIO' as const,
      url: audioPlaceholder[1],
      maxPlay: audioPlaceholder[2] ? parseInt(audioPlaceholder[2], 10) : null,
      cleanText: text.replace(audioPlaceholder[0], '').trim(),
    };
  }
  if (audioTag) {
    return {
      type: 'AUDIO' as const,
      url: audioTag[1].trim(),
      maxPlay: audioTag[2] ? parseInt(audioTag[2], 10) : null,
      cleanText: text.replace(audioTag[0], '').trim(),
    };
  }

  const videoPlaceholder = text.match(/<div class="quiz-media-video[^"]*"\s+data-src="([^"]+)"[^>]*><\/div>/i);
  const videoTag = text.match(/\[(?:Video|YouTube|Tonton):\s*([^\]]+)\]/i);

  if (videoPlaceholder) {
    return {
      type: 'VIDEO' as const,
      url: videoPlaceholder[1],
      maxPlay: null,
      cleanText: text.replace(videoPlaceholder[0], '').trim(),
    };
  }
  if (videoTag) {
    return {
      type: 'VIDEO' as const,
      url: videoTag[1].trim(),
      maxPlay: null,
      cleanText: text.replace(videoTag[0], '').trim(),
    };
  }

  return {
    type: 'NONE' as const,
    url: '',
    maxPlay: null,
    cleanText: text,
  };
}
import { createQuiz, deleteQuiz, addQuizQuestion, updateQuizQuestion, getQuizWithQuestions } from '@/lib/actions/quiz';
import { getQuestionBankByCategory } from '@/lib/actions/question-bank';
import { createAssignment, updateAssignment, deleteAssignment } from '@/lib/actions/assignment';
import { RichTextEditor } from '@/components/editor/rich-text-editor';
import { ContentType, QuestionType } from '@prisma/client';
import { Link } from '@/i18n/navigation';

const ASSIGNMENT_FILE_CATEGORIES = [
  { id: 'pdf', label: 'Dokumen PDF (.pdf)', exts: ['pdf'] },
  { id: 'image', label: 'Gambar (.jpg, .png, .jpeg, .webp)', exts: ['jpg', 'jpeg', 'png', 'webp'] },
  { id: 'office', label: 'Dokumen Office (.docx, .xlsx, .pptx)', exts: ['docx', 'xlsx', 'pptx'] },
  { id: 'archive', label: 'Berkas Arsip (.zip, .rar)', exts: ['zip', 'rar'] },
];

function buildAllowedTypesString(categories: string[], custom: string): string {
  const exts = new Set<string>();
  for (const catId of categories) {
    const found = ASSIGNMENT_FILE_CATEGORIES.find((c) => c.id === catId);
    if (found) {
      found.exts.forEach((e) => exts.add(e.toLowerCase().trim()));
    }
  }
  if (custom) {
    custom
      .split(',')
      .map((s) => s.trim().replace(/^\./, '').toLowerCase())
      .filter(Boolean)
      .forEach((e) => exts.add(e));
  }
  return Array.from(exts).join(',');
}

function parseAllowedTypes(allowedString?: string | null): { categories: string[]; custom: string } {
  if (!allowedString) {
    return { categories: ['pdf', 'office', 'archive'], custom: '' };
  }
  const allExts = allowedString
    .split(',')
    .map((s) => s.trim().replace(/^\./, '').toLowerCase())
    .filter(Boolean);
  const categories: string[] = [];
  const matchedExts = new Set<string>();

  for (const cat of ASSIGNMENT_FILE_CATEGORIES) {
    const hasAny = cat.exts.some((e) => allExts.includes(e));
    if (hasAny) {
      categories.push(cat.id);
      cat.exts.forEach((e) => matchedExts.add(e));
    }
  }

  const customExts = allExts.filter((e) => !matchedExts.has(e)).join(', ');
  return { categories, custom: customExts };
}

function formatDatetimeLocal(date?: Date | string | null) {
  if (!date) return '';
  const d = new Date(date);
  if (isNaN(d.getTime())) return '';
  const pad = (n: number) => n.toString().padStart(2, '0');
  const year = d.getFullYear();
  const month = pad(d.getMonth() + 1);
  const day = pad(d.getDate());
  const hours = pad(d.getHours());
  const minutes = pad(d.getMinutes());
  return `${year}-${month}-${day}T${hours}:${minutes}`;
}

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
  const [requireToken, setRequireToken] = useState(false);
  const [quizToken, setQuizToken] = useState('');
  const [enableLockdown, setEnableLockdown] = useState(false);
  const [maxTabSwitches, setMaxTabSwitches] = useState('3');

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

  // Media states for new draft question
  const [qMediaType, setQMediaType] = useState<'NONE' | 'AUDIO' | 'VIDEO'>('NONE');
  const [qMediaSource, setQMediaSource] = useState<'UPLOAD' | 'URL'>('UPLOAD');
  const [qMediaUrl, setQMediaUrl] = useState('');
  const [qMediaMaxPlay, setQMediaMaxPlay] = useState<string>('unlimited');
  const [qIsUploading, setQIsUploading] = useState(false);

  // Bank Soal Selection States inside Quiz Creation
  const [quizInputMode, setQuizInputMode] = useState<'manual' | 'bank'>('manual');
  const [bankData, setBankData] = useState<{ categories: any[]; uncategorized: any[] } | null>(null);
  const [bankLoading, setBankLoading] = useState(false);
  const [expandedCategories, setExpandedCategories] = useState<Record<string, boolean>>({ uncategorized: true });

  // Edit Question Modal State
  const [editingQuiz, setEditingQuiz] = useState<any>(null);
  const [editQuestionModal, setEditQuestionModal] = useState<{ id?: string; questionId?: string; type: QuestionType; text: string; points: number; options: any[] } | null>(null);
  const [editQMediaType, setEditQMediaType] = useState<'NONE' | 'AUDIO' | 'VIDEO'>('NONE');
  const [editQMediaSource, setEditQMediaSource] = useState<'UPLOAD' | 'URL'>('UPLOAD');
  const [editQMediaUrl, setEditQMediaUrl] = useState('');
  const [editQMediaMaxPlay, setEditQMediaMaxPlay] = useState<string>('unlimited');
  const [editQIsUploading, setEditQIsUploading] = useState(false);

  // Delete Quiz Confirmation Modal State
  const [quizToDelete, setQuizToDelete] = useState<{
    moduleId: string;
    quizId: string;
    title: string;
    attemptsCount?: number;
  } | null>(null);
  const [deleteQuizLoading, setDeleteQuizLoading] = useState(false);
  const [deleteQuizError, setDeleteQuizError] = useState<string | null>(null);

  // Delete Module Confirmation Modal State
  const [moduleToDelete, setModuleToDelete] = useState<{
    id: string;
    title: string;
    contentsCount: number;
    quizzesCount: number;
    assignmentsCount: number;
  } | null>(null);
  const [deleteModuleLoading, setDeleteModuleLoading] = useState(false);

  // Delete Content Confirmation Modal State
  const [contentToDelete, setContentToDelete] = useState<{
    moduleId: string;
    id: string;
    title: string;
    type: string;
  } | null>(null);
  const [deleteContentLoading, setDeleteContentLoading] = useState(false);

  // Delete Assignment Confirmation Modal State
  const [assignmentToDelete, setAssignmentToDelete] = useState<{
    moduleId: string;
    id: string;
    title: string;
    submissionsCount: number;
  } | null>(null);
  const [deleteAssignmentLoading, setDeleteAssignmentLoading] = useState(false);

  // General Notice Modal State
  const [noticeModal, setNoticeModal] = useState<{
    title: string;
    message: string;
    type?: 'error' | 'warning' | 'info' | 'success';
  } | null>(null);

  // Assignment Modal State (Create)
  const [isAssignModalOpen, setIsAssignModalOpen] = useState(false);
  const [assignTitle, setAssignTitle] = useState('');
  const [assignDesc, setAssignDesc] = useState('');
  const [assignDeadline, setAssignDeadline] = useState('');
  const [assignMaxScore, setAssignMaxScore] = useState(100);
  const [assignCategories, setAssignCategories] = useState<string[]>(['pdf', 'office', 'archive']);
  const [assignCustomExts, setAssignCustomExts] = useState('');
  const [assignFile, setAssignFile] = useState<File | null>(null);

  // Assignment Modal State (Edit)
  const [editingAssignment, setEditingAssignment] = useState<any | null>(null);
  const [editAssignTitle, setEditAssignTitle] = useState('');
  const [editAssignDesc, setEditAssignDesc] = useState('');
  const [editAssignDeadline, setEditAssignDeadline] = useState('');
  const [editAssignMaxScore, setEditAssignMaxScore] = useState(100);
  const [editAssignCategories, setEditAssignCategories] = useState<string[]>([]);
  const [editAssignCustomExts, setEditAssignCustomExts] = useState('');
  const [editAssignExistingFile, setEditAssignExistingFile] = useState<{ url: string; name: string; size?: number } | null>(null);
  const [editAssignNewFile, setEditAssignNewFile] = useState<File | null>(null);
  const [editAssignRemoveFile, setEditAssignRemoveFile] = useState(false);
  const [editAssignLoading, setEditAssignLoading] = useState(false);

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
    } catch (err: any) {
      console.error(err);
      setNoticeModal({
        title: 'Gagal Membuat Modul',
        message: err?.message || 'Terjadi kesalahan saat membuat bab modul.',
        type: 'error',
      });
    } finally {
      setLoading(false);
    }
  };

  const handleConfirmDeleteModule = async () => {
    if (!moduleToDelete) return;
    setDeleteModuleLoading(true);
    try {
      await deleteModule(moduleToDelete.id);
      setModules((prev) => prev.filter((m) => m.id !== moduleToDelete.id));
      setModuleToDelete(null);
    } catch (err: any) {
      console.error(err);
      setNoticeModal({
        title: 'Gagal Menghapus Modul',
        message: err?.message || 'Terjadi kesalahan saat menghapus bab modul.',
        type: 'error',
      });
    } finally {
      setDeleteModuleLoading(false);
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
          setNoticeModal({
            title: 'Berkas Belum Dipilih',
            message: 'Silakan pilih berkas dokumen terlebih dahulu sebelum menyimpan.',
            type: 'warning',
          });
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
      setNoticeModal({
        title: 'Gagal Menyimpan Materi',
        message: err?.message || 'Terjadi kesalahan saat menyimpan konten materi pembelajaran.',
        type: 'error',
      });
    } finally {
      setLoading(false);
    }
  };

  const handleConfirmDeleteContent = async () => {
    if (!contentToDelete) return;
    setDeleteContentLoading(true);
    try {
      await deleteContent(contentToDelete.id);
      setModules((prev) =>
        prev.map((m) =>
          m.id === contentToDelete.moduleId
            ? { ...m, contents: m.contents.filter((c: any) => c.id !== contentToDelete.id) }
            : m
        )
      );
      setContentToDelete(null);
    } catch (err: any) {
      console.error(err);
      setNoticeModal({
        title: 'Gagal Menghapus Materi',
        message: err?.message || 'Terjadi kesalahan saat menghapus materi pembelajaran.',
        type: 'error',
      });
    } finally {
      setDeleteContentLoading(false);
    }
  };

  // 3. Quiz handlers
  const handleAddQuestionToQuizDraft = () => {
    if (!qText.trim()) return;

    let finalText = qText.trim();
    const limitAttr = qMediaMaxPlay !== 'unlimited' && Number(qMediaMaxPlay) > 0 ? ` data-max-play="${qMediaMaxPlay}"` : '';
    if (qMediaType === 'AUDIO' && qMediaUrl.trim()) {
      finalText = `${finalText}\n<div class="quiz-media-audio my-3" data-src="${qMediaUrl.trim()}"${limitAttr}></div>`;
    } else if (qMediaType === 'VIDEO' && qMediaUrl.trim()) {
      finalText = `${finalText}\n<div class="quiz-media-video my-3" data-src="${qMediaUrl.trim()}"${limitAttr}></div>`;
    }

    if (qType === QuestionType.MULTIPLE_CHOICE || qType === QuestionType.MULTIPLE_CHOICE_COMPLEX) {
      const validOptions = mcOptions.filter((o) => o.text.trim());
      if (validOptions.length < 2) {
        setNoticeModal({
          title: 'Pilihan Jawaban Kurang',
          message: 'Minimal sediakan 2 Pilihan Jawaban dengan teks yang terisi.',
          type: 'warning',
        });
        return;
      }
      const hasCorrect = validOptions.some((o) => o.isCorrect);
      if (!hasCorrect) {
        setNoticeModal({
          title: 'Kunci Jawaban Belum Dipilih',
          message: 'Pilih setidaknya 1 jawaban yang benar dengan menandai opsi.',
          type: 'warning',
        });
        return;
      }
      
      setQuestions((prev) => [
        ...prev,
        { type: qType, text: finalText, points: Number(qPoints), options: validOptions },
      ]);
    } else {
      setQuestions((prev) => [
        ...prev,
        { type: QuestionType.ESSAY, text: finalText, points: Number(qPoints), options: [] },
      ]);
    }

    setQText('');
    setQMediaType('NONE');
    setQMediaUrl('');
    setQMediaMaxPlay('unlimited');
    setMcOptions([
      { id: 'A', text: '', isCorrect: true },
      { id: 'B', text: '', isCorrect: false },
      { id: 'C', text: '', isCorrect: false },
      { id: 'D', text: '', isCorrect: false },
    ]);
  };

  const handleUploadDraftMediaFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setQIsUploading(true);
    try {
      const formData = new FormData();
      formData.append('file', file);
      const res = await fetch('/api/upload', { method: 'POST', body: formData });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || 'Gagal mengunggah berkas');
      }
      const data = await res.json();
      setQMediaUrl(data.url);
    } catch (err: any) {
      console.error(err);
      setNoticeModal({
        title: 'Upload Gagal',
        message: err?.message || 'Gagal mengunggah media audio/video.',
        type: 'error',
      });
    } finally {
      setQIsUploading(false);
    }
  };

  const handleUploadEditQMediaFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setEditQIsUploading(true);
    try {
      const formData = new FormData();
      formData.append('file', file);
      const res = await fetch('/api/upload', { method: 'POST', body: formData });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || 'Gagal mengunggah berkas');
      }
      const data = await res.json();
      setEditQMediaUrl(data.url);
    } catch (err: any) {
      console.error(err);
      setNoticeModal({
        title: 'Upload Gagal',
        message: err?.message || 'Gagal mengunggah media audio/video.',
        type: 'error',
      });
    } finally {
      setEditQIsUploading(false);
    }
  };

  const handleFetchBankData = async () => {
    if (bankData || bankLoading) return;
    setBankLoading(true);
    try {
      const data = await getQuestionBankByCategory(course.id);
      setBankData(data);
    } catch (err) {
      console.error('Failed to fetch bank data:', err);
      setNoticeModal({
        title: 'Gagal Memuat Bank Soal',
        message: 'Gagal memuat data dari Bank Soal. Silakan coba lagi.',
        type: 'error',
      });
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
        (bankQ.type === QuestionType.MULTIPLE_CHOICE || bankQ.type === QuestionType.MULTIPLE_CHOICE_COMPLEX) && Array.isArray(bankQ.options)
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
            (bq.type === QuestionType.MULTIPLE_CHOICE || bq.type === QuestionType.MULTIPLE_CHOICE_COMPLEX) && Array.isArray(bq.options)
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
        requireToken,
        token: requireToken ? quizToken : undefined,
        enableLockdown,
        maxTabSwitches: Number(maxTabSwitches) || 3,
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
      setRequireToken(false);
      setQuizToken('');
      setEnableLockdown(false);
      setMaxTabSwitches('3');
    } catch (err: any) {
      console.error(err);
      setNoticeModal({
        title: 'Gagal Membuat Kuis',
        message: err?.message || 'Terjadi kesalahan saat membuat kuis baru.',
        type: 'error',
      });
    } finally {
      setLoading(false);
    }
  };

  const handleConfirmDeleteQuiz = async () => {
    if (!quizToDelete) return;
    setDeleteQuizLoading(true);
    setDeleteQuizError(null);

    try {
      await deleteQuiz(quizToDelete.quizId);
      setModules((prev) =>
        prev.map((m) =>
          m.id === quizToDelete.moduleId
            ? { ...m, quizzes: m.quizzes.filter((q: any) => q.id !== quizToDelete.quizId) }
            : m
        )
      );
      setQuizToDelete(null);
    } catch (err: any) {
      console.error('Error deleting quiz:', err);
      setDeleteQuizError(err?.message || 'Gagal menghapus kuis. Silakan coba lagi.');
    } finally {
      setDeleteQuizLoading(false);
    }
  };

  // 4. Assignment handlers
  const handleSaveAssignment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeModuleId || !assignTitle.trim()) return;
    setLoading(true);
    try {
      let fileUrl: string | undefined = undefined;
      let fileName: string | undefined = undefined;
      let fileSize: number | undefined = undefined;

      if (assignFile) {
        const formData = new FormData();
        formData.append('file', assignFile);
        const res = await fetch('/api/upload', {
          method: 'POST',
          body: formData,
        });
        if (!res.ok) {
          const errJson = await res.json();
          throw new Error(errJson.error || 'Gagal mengunggah berkas lampiran guru');
        }
        const fileData = await res.json();
        fileUrl = fileData.url;
        fileName = fileData.fileName;
        fileSize = fileData.fileSize;
      }

      const finalAllowedTypes =
        buildAllowedTypesString(assignCategories, assignCustomExts) || 'pdf,docx,zip';

      const created = await createAssignment({
        moduleId: activeModuleId,
        title: assignTitle,
        description: assignDesc,
        deadline: assignDeadline || undefined,
        maxScore: Number(assignMaxScore),
        allowedTypes: finalAllowedTypes,
        fileUrl,
        fileName,
        fileSize,
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
      setAssignMaxScore(100);
      setAssignCategories(['pdf', 'office', 'archive']);
      setAssignCustomExts('');
      setAssignFile(null);
    } catch (err: any) {
      console.error(err);
      setNoticeModal({
        title: 'Gagal Membuat Penugasan',
        message: err?.message || 'Terjadi kesalahan saat membuat penugasan.',
        type: 'error',
      });
    } finally {
      setLoading(false);
    }
  };

  const handleOpenEditAssignment = (assign: any) => {
    const { categories, custom } = parseAllowedTypes(assign.allowedTypes);
    setEditingAssignment(assign);
    setEditAssignTitle(assign.title || '');
    setEditAssignDesc(assign.description || '');
    setEditAssignDeadline(formatDatetimeLocal(assign.deadline));
    setEditAssignMaxScore(assign.maxScore || 100);
    setEditAssignCategories(categories);
    setEditAssignCustomExts(custom);
    setEditAssignExistingFile(
      assign.fileUrl
        ? {
            url: assign.fileUrl,
            name: assign.fileName || 'Berkas Lampiran Guru',
            size: assign.fileSize,
          }
        : null
    );
    setEditAssignNewFile(null);
    setEditAssignRemoveFile(false);
  };

  const handleUpdateAssignment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingAssignment || !editAssignTitle.trim()) return;
    setEditAssignLoading(true);
    try {
      let fileUrl: string | null | undefined = undefined;
      let fileName: string | null | undefined = undefined;
      let fileSize: number | null | undefined = undefined;

      if (editAssignNewFile) {
        const formData = new FormData();
        formData.append('file', editAssignNewFile);
        const res = await fetch('/api/upload', {
          method: 'POST',
          body: formData,
        });
        if (!res.ok) {
          const errJson = await res.json();
          throw new Error(errJson.error || 'Gagal mengunggah berkas lampiran');
        }
        const fileData = await res.json();
        fileUrl = fileData.url;
        fileName = fileData.fileName;
        fileSize = fileData.fileSize;
      } else if (editAssignRemoveFile) {
        fileUrl = null;
        fileName = null;
        fileSize = null;
      }

      const finalAllowedTypes =
        buildAllowedTypesString(editAssignCategories, editAssignCustomExts) || 'pdf,docx,zip';

      const updated = await updateAssignment({
        id: editingAssignment.id,
        title: editAssignTitle,
        description: editAssignDesc,
        deadline: editAssignDeadline ? new Date(editAssignDeadline).toISOString() : null,
        maxScore: Number(editAssignMaxScore),
        allowedTypes: finalAllowedTypes,
        fileUrl,
        fileName,
        fileSize,
      });

      setModules((prev) =>
        prev.map((m) =>
          m.id === editingAssignment.moduleId
            ? {
                ...m,
                assignments: m.assignments.map((a: any) =>
                  a.id === editingAssignment.id
                    ? { ...a, ...updated, _count: a._count }
                    : a
                ),
              }
            : m
        )
      );

      setEditingAssignment(null);
      setNoticeModal({
        title: 'Penugasan Diperbarui',
        message: 'Perubahan penugasan dan batas waktu pengumpulan berhasil disimpan.',
        type: 'success',
      });
    } catch (err: any) {
      console.error(err);
      setNoticeModal({
        title: 'Gagal Memperbarui Penugasan',
        message: err?.message || 'Terjadi kesalahan saat memperbarui penugasan.',
        type: 'error',
      });
    } finally {
      setEditAssignLoading(false);
    }
  };

  const handleConfirmDeleteAssignment = async () => {
    if (!assignmentToDelete) return;
    setDeleteAssignmentLoading(true);
    try {
      await deleteAssignment(assignmentToDelete.id);
      setModules((prev) =>
        prev.map((m) =>
          m.id === assignmentToDelete.moduleId
            ? { ...m, assignments: m.assignments.filter((a: any) => a.id !== assignmentToDelete.id) }
            : m
        )
      );
      setAssignmentToDelete(null);
    } catch (err: any) {
      console.error(err);
      setNoticeModal({
        title: 'Gagal Menghapus Tugas',
        message: err?.message || 'Terjadi kesalahan saat menghapus penugasan.',
        type: 'error',
      });
    } finally {
      setDeleteAssignmentLoading(false);
    }
  };

  const handleEditQuizClick = async (quizId: string) => {
    setLoading(true);
    try {
      const data = await getQuizWithQuestions(quizId);
      setEditingQuiz(data);
    } catch (err: any) {
      console.error(err);
      setNoticeModal({
        title: 'Gagal Memuat Kuis',
        message: err?.message || 'Tidak dapat memuat butir soal kuis.',
        type: 'error',
      });
    } finally {
      setLoading(false);
    }
  };

  const handleOpenEditQuestionModal = (q: any) => {
    const extracted = extractMediaFromText(q.text);
    setEditQMediaType(extracted.type);
    setEditQMediaUrl(extracted.url);
    setEditQMediaMaxPlay(extracted.maxPlay ? String(extracted.maxPlay) : 'unlimited');
    setEditQMediaSource(extracted.url.startsWith('/api/files/') ? 'UPLOAD' : 'URL');
    setEditQuestionModal({
      id: q.id,
      questionId: q.id,
      type: q.type,
      text: extracted.cleanText,
      points: q.points,
      options: q.options || [],
    });
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
           setNoticeModal({
             title: 'Pilihan Jawaban Kurang',
             message: 'Minimal sediakan 2 Pilihan Jawaban dengan teks yang terisi.',
             type: 'warning',
           });
           setLoading(false);
           return;
         }
         opts = validOptions;
      }
      
      const questionId = editQuestionModal.id || editQuestionModal.questionId;
      if (!questionId) {
        setNoticeModal({
          title: 'Soal Tidak Valid',
          message: 'ID butir soal tidak ditemukan atau tidak valid.',
          type: 'error',
        });
        setLoading(false);
        return;
      }

      let finalText = editQuestionModal.text.trim();
      const limitAttr = editQMediaMaxPlay !== 'unlimited' && Number(editQMediaMaxPlay) > 0 ? ` data-max-play="${editQMediaMaxPlay}"` : '';
      if (editQMediaType === 'AUDIO' && editQMediaUrl.trim()) {
        finalText = `${finalText}\n<div class="quiz-media-audio my-3" data-src="${editQMediaUrl.trim()}"${limitAttr}></div>`;
      } else if (editQMediaType === 'VIDEO' && editQMediaUrl.trim()) {
        finalText = `${finalText}\n<div class="quiz-media-video my-3" data-src="${editQMediaUrl.trim()}"${limitAttr}></div>`;
      }

      await updateQuizQuestion(questionId, {
        text: finalText,
        points: editQuestionModal.points,
        options: opts
      });
      
      setNoticeModal({
        title: 'Berhasil Disimpan',
        message: 'Perubahan butir soal kuis berhasil disimpan.',
        type: 'success',
      });
      setEditQuestionModal(null);
      const data = await getQuizWithQuestions(editingQuiz.id);
      setEditingQuiz(data);
    } catch (err: any) {
      console.error(err);
      setNoticeModal({
        title: 'Gagal Menyimpan Soal',
        message: err?.message || 'Terjadi kesalahan saat memperbarui butir soal.',
        type: 'error',
      });
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
                    onClick={() =>
                      setModuleToDelete({
                        id: mod.id,
                        title: mod.title,
                        contentsCount: mod.contents.length,
                        quizzesCount: mod.quizzes.length,
                        assignmentsCount: mod.assignments.length,
                      })
                    }
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
                              onClick={() =>
                                setContentToDelete({
                                  moduleId: mod.id,
                                  id: c.id,
                                  title: c.title,
                                  type: c.type,
                                })
                              }
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
                              {q.requireToken && (
                                <Badge variant="outline" className="text-[10px] px-1.5 py-0 border-amber-400 text-amber-800 bg-amber-50 font-mono">
                                  Token: {q.token}
                                </Badge>
                              )}
                              {q.enableLockdown && (
                                <Badge className="text-[10px] px-1.5 py-0 bg-rose-100 text-rose-800 hover:bg-rose-100">
                                  Lockdown CBT
                                </Badge>
                              )}
                              {q.isRemedial && (
                                <Badge className="text-[10px] px-1.5 py-0 bg-amber-100 text-amber-900 border border-amber-300">
                                  Remedial
                                </Badge>
                              )}
                            </div>
                          </div>

                          <div className="flex items-center gap-1">
                            <Link href={`/teacher/course/${course.id}/quiz-attempts/${q.id}/proctor`}>
                              <Button
                                size="sm"
                                variant="outline"
                                className="h-7 text-xs border-emerald-500 text-emerald-700 hover:bg-emerald-50 font-bold flex items-center gap-1"
                              >
                                <Shield className="h-3 w-3 text-emerald-600" />
                                Live Proctor
                              </Button>
                            </Link>
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => handleEditQuizClick(q.id)}
                              className="h-7 text-xs border-amber-300 text-amber-700 hover:bg-amber-100"
                            >
                              Edit
                            </Button>
                            <Link href={`/teacher/course/${course.id}/quiz-attempts/${q.id}`}>
                              <Button
                                size="sm"
                                variant="outline"
                                className="h-7 text-xs border-blue-300 text-blue-700 hover:bg-blue-100"
                              >
                                Riwayat
                              </Button>
                            </Link>
                            <Button
                              size="sm"
                              variant="ghost"
                              onClick={() =>
                                setQuizToDelete({
                                  moduleId: mod.id,
                                  quizId: q.id,
                                  title: q.title,
                                  attemptsCount: q._count?.attempts,
                                })
                              }
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
                          className="flex flex-col sm:flex-row sm:items-center justify-between p-3 rounded-md bg-purple-50/40 border border-purple-200/70 gap-3"
                        >
                          <div>
                            <div className="font-semibold text-sm text-[#002446]">{a.title}</div>
                            <div className="text-xs text-gray-600 flex flex-wrap items-center gap-3 mt-1">
                              <span>Skor Max: {a.maxScore}</span>
                              <span>Terkumpul: {a._count.submissions} Siswa</span>
                              {a.deadline && (
                                <span className="flex items-center gap-1 text-purple-700 font-medium">
                                  <Calendar className="h-3 w-3" /> Deadline:{' '}
                                  {new Date(a.deadline).toLocaleDateString('id-ID', {
                                    day: 'numeric',
                                    month: 'short',
                                    year: 'numeric',
                                    hour: '2-digit',
                                    minute: '2-digit',
                                  })}
                                </span>
                              )}
                              {a.fileName && (
                                <a
                                  href={a.fileUrl}
                                  target="_blank"
                                  rel="noreferrer"
                                  className="inline-flex items-center gap-1 text-[11px] text-blue-600 hover:underline bg-blue-50 px-1.5 py-0.5 rounded"
                                  title="Lampiran Soal Guru"
                                >
                                  <Paperclip className="h-3 w-3" />
                                  <span className="truncate max-w-[120px]">{a.fileName}</span>
                                </a>
                              )}
                            </div>
                          </div>

                          <div className="flex items-center gap-1.5 shrink-0 self-end sm:self-auto">
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => handleOpenEditAssignment(a)}
                              className="h-7 text-xs border-purple-300 text-purple-700 hover:bg-purple-100 flex items-center gap-1"
                            >
                              <Edit className="h-3 w-3" /> Edit
                            </Button>
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
                              onClick={() =>
                                setAssignmentToDelete({
                                  moduleId: mod.id,
                                  id: a.id,
                                  title: a.title,
                                  submissionsCount: a._count.submissions,
                                })
                              }
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

              {/* CBT & Keamanan Ujian Lanjutan (Token & Lockdown) */}
              <div className="p-4 rounded-xl bg-slate-50 border border-slate-200 space-y-3">
                <div className="flex items-center gap-2">
                  <Shield className="h-4 w-4 text-[#002446]" />
                  <span className="text-xs font-bold text-[#002446] uppercase tracking-wider">
                    Keamanan Ujian & CBT
                  </span>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {/* Token Akses */}
                  <div className="space-y-2 p-3 bg-white rounded-lg border border-gray-200">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <input
                          type="checkbox"
                          id="qzRequireToken"
                          checked={requireToken}
                          onChange={(e) => {
                            setRequireToken(e.target.checked);
                            if (e.target.checked && !quizToken) {
                              setQuizToken(Math.random().toString(36).substring(2, 8).toUpperCase());
                            }
                          }}
                          className="rounded border-gray-300 text-[#002446] focus:ring-[#002446]"
                        />
                        <Label htmlFor="qzRequireToken" className="text-xs font-bold cursor-pointer text-gray-800">
                          Wajibkan Token Masuk
                        </Label>
                      </div>
                      {requireToken && (
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          onClick={() => setQuizToken(Math.random().toString(36).substring(2, 8).toUpperCase())}
                          className="h-6 px-2 text-[10px] text-[#FF8928] hover:bg-amber-50"
                        >
                          <RefreshCw className="h-3 w-3 mr-1" /> Acak
                        </Button>
                      )}
                    </div>

                    {requireToken && (
                      <div className="pt-1">
                        <Input
                          placeholder="misal: PAS2026"
                          value={quizToken}
                          onChange={(e) => setQuizToken(e.target.value.toUpperCase())}
                          maxLength={8}
                          className="font-mono text-center text-sm font-bold tracking-widest uppercase h-9 bg-gray-50"
                          required={requireToken}
                        />
                        <p className="text-[10px] text-gray-500 mt-1">
                          Siswa harus memasukkan token ini sebelum dapat mulai mengerjakan.
                        </p>
                      </div>
                    )}
                  </div>

                  {/* Lockdown CBT & Anti-Curang */}
                  <div className="space-y-2 p-3 bg-white rounded-lg border border-gray-200">
                    <div className="flex items-center gap-2">
                      <input
                        type="checkbox"
                        id="qzEnableLockdown"
                        checked={enableLockdown}
                        onChange={(e) => setEnableLockdown(e.target.checked)}
                        className="rounded border-gray-300 text-[#002446] focus:ring-[#002446]"
                      />
                      <Label htmlFor="qzEnableLockdown" className="text-xs font-bold cursor-pointer text-gray-800">
                        Mode Lockdown CBT
                      </Label>
                    </div>

                    <p className="text-[10px] text-gray-500">
                      Wajib fullscreen, blokir klik kanan, copy-paste, dan deteksi pindah tab.
                    </p>

                    {enableLockdown && (
                      <div className="pt-1 flex items-center justify-between gap-2 border-t border-gray-100">
                        <span className="text-[11px] text-gray-600 font-medium">Batas Pindah Tab:</span>
                        <select
                          value={maxTabSwitches}
                          onChange={(e) => setMaxTabSwitches(e.target.value)}
                          className="h-7 px-2 text-xs border border-gray-300 rounded bg-white text-gray-800 font-bold"
                        >
                          <option value="1">1 kali (Sangat Ketat)</option>
                          <option value="2">2 kali</option>
                          <option value="3">3 kali (Standar)</option>
                          <option value="5">5 kali (Longgar)</option>
                        </select>
                      </div>
                    )}
                  </div>
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
                    <div className="flex gap-2 flex-wrap">
                      <Button
                        type="button"
                        size="sm"
                        variant={qType === QuestionType.MULTIPLE_CHOICE ? 'default' : 'outline'}
                        onClick={() => setQType(QuestionType.MULTIPLE_CHOICE)}
                        className={
                          qType === QuestionType.MULTIPLE_CHOICE ? 'bg-[#002446] text-white' : ''
                        }
                      >
                        Pilihan Ganda
                      </Button>
                      <Button
                        type="button"
                        size="sm"
                        variant={qType === QuestionType.MULTIPLE_CHOICE_COMPLEX ? 'default' : 'outline'}
                        onClick={() => setQType(QuestionType.MULTIPLE_CHOICE_COMPLEX)}
                        className={
                          qType === QuestionType.MULTIPLE_CHOICE_COMPLEX ? 'bg-indigo-700 text-white' : 'border-indigo-200 text-indigo-700 hover:bg-indigo-50'
                        }
                      >
                        PG Kompleks (AKM)
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

                  {/* Media Soal (Listening Audio / Video) */}
                  <div className="p-3 rounded-lg border border-gray-200 bg-white space-y-2.5">
                    <div className="flex items-center justify-between">
                      <Label className="text-xs font-bold text-[#002446] flex items-center gap-1.5">
                        <Headphones className="w-3.5 h-3.5 text-[#FF8928]" />
                        Media Soal (Audio / Video)
                      </Label>
                      <div className="flex items-center gap-1">
                        <Button
                          type="button"
                          size="sm"
                          variant={qMediaType === 'NONE' ? 'default' : 'outline'}
                          className={`h-6 text-[11px] px-2 ${qMediaType === 'NONE' ? 'bg-[#002446] text-white' : 'text-gray-600'}`}
                          onClick={() => {
                            setQMediaType('NONE');
                            setQMediaUrl('');
                          }}
                        >
                          Tanpa Media
                        </Button>
                        <Button
                          type="button"
                          size="sm"
                          variant={qMediaType === 'AUDIO' ? 'default' : 'outline'}
                          className={`h-6 text-[11px] px-2 ${qMediaType === 'AUDIO' ? 'bg-indigo-600 text-white' : 'text-gray-600'}`}
                          onClick={() => setQMediaType('AUDIO')}
                        >
                          <Headphones className="w-3 h-3 mr-1" /> Audio
                        </Button>
                        <Button
                          type="button"
                          size="sm"
                          variant={qMediaType === 'VIDEO' ? 'default' : 'outline'}
                          className={`h-6 text-[11px] px-2 ${qMediaType === 'VIDEO' ? 'bg-rose-600 text-white' : 'text-gray-600'}`}
                          onClick={() => setQMediaType('VIDEO')}
                        >
                          <Video className="w-3 h-3 mr-1" /> Video
                        </Button>
                      </div>
                    </div>

                    {qMediaType !== 'NONE' && (
                      <div className="space-y-2 pt-2 border-t border-gray-100">
                        <div className="flex items-center gap-3 text-xs">
                          <span className="text-gray-500 font-medium">Sumber:</span>
                          <label className="flex items-center gap-1.5 cursor-pointer">
                            <input
                              type="radio"
                              name="qDraftMediaSource"
                              checked={qMediaSource === 'UPLOAD'}
                              onChange={() => setQMediaSource('UPLOAD')}
                              className="text-[#002446]"
                            />
                            <span>Upload ({qMediaType === 'AUDIO' ? 'MP3/WAV' : 'MP4/WebM'})</span>
                          </label>
                          <label className="flex items-center gap-1.5 cursor-pointer">
                            <input
                              type="radio"
                              name="qDraftMediaSource"
                              checked={qMediaSource === 'URL'}
                              onChange={() => setQMediaSource('URL')}
                              className="text-[#002446]"
                            />
                            <span>URL {qMediaType === 'VIDEO' ? '/ YouTube' : ''}</span>
                          </label>
                        </div>

                        {qMediaSource === 'UPLOAD' ? (
                          <div className="flex items-center gap-2">
                            <Input
                              type="file"
                              accept={qMediaType === 'AUDIO' ? 'audio/*' : 'video/*'}
                              onChange={handleUploadDraftMediaFile}
                              disabled={qIsUploading || loading}
                              className="text-xs h-8"
                            />
                            {qIsUploading && <span className="text-xs text-amber-600 animate-pulse">Mengunggah...</span>}
                          </div>
                        ) : (
                          <Input
                            type="url"
                            placeholder={qMediaType === 'AUDIO' ? 'https://example.com/audio.mp3' : 'https://www.youtube.com/watch?v=... atau link video'}
                            value={qMediaUrl}
                            onChange={(e) => setQMediaUrl(e.target.value)}
                            className="text-xs h-8"
                          />
                        )}

                        {qMediaUrl && (
                          <div className="text-[11px] text-emerald-700 bg-emerald-50 p-1.5 rounded-lg border border-emerald-200 flex items-center justify-between gap-2 min-w-0 overflow-hidden">
                            <span className="truncate min-w-0 flex-1">
                              Media aktif: <strong className="font-mono text-[10px] break-all">{qMediaUrl}</strong>
                            </span>
                            <Button
                              type="button"
                              variant="ghost"
                              size="sm"
                              onClick={() => setQMediaUrl('')}
                              className="h-5 px-1.5 text-[10px] text-red-600 hover:bg-red-100 shrink-0"
                            >
                              Hapus
                            </Button>
                          </div>
                        )}

                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 pt-1">
                          <div>
                            <Label className="text-[11px] text-gray-600">
                              {qMediaType === 'AUDIO' ? 'Batas Putar Siswa (Listening Quota)' : 'Batas Putar Siswa (Video Quota)'}
                            </Label>
                            <select
                              value={qMediaMaxPlay}
                              onChange={(e) => setQMediaMaxPlay(e.target.value)}
                              className="w-full mt-0.5 h-8 rounded-md border border-gray-300 px-2 text-xs bg-white"
                            >
                              <option value="unlimited">Bebas Putar (Tanpa Batas)</option>
                              <option value="1">Maksimal 1 Kali Putar</option>
                              <option value="2">Maksimal 2 Kali Putar</option>
                              <option value="3">Maksimal 3 Kali Putar</option>
                            </select>
                          </div>
                          <p className="text-[10px] text-gray-500 self-end pb-1">
                            {qMediaType === 'AUDIO'
                              ? 'Audio terkunci saat kuota putar siswa habis.'
                              : 'Video terkunci saat kuota putar siswa habis.'}
                          </p>
                        </div>
                      </div>
                    )}
                  </div>

                  {(qType === QuestionType.MULTIPLE_CHOICE || qType === QuestionType.MULTIPLE_CHOICE_COMPLEX) && (
                    <div className="space-y-3 pt-2 border-t border-gray-200">
                      <div>
                        <Label className="text-xs font-bold text-[#002446]">
                          {qType === QuestionType.MULTIPLE_CHOICE_COMPLEX
                            ? 'Pilihan Jawaban & Kunci Jawaban Kompleks (Centang > 1):'
                            : 'Pilihan Jawaban & Tentukan Kunci Jawaban:'}
                        </Label>
                        <p className="text-[11px] text-gray-500 mt-0.5">
                          {qType === QuestionType.MULTIPLE_CHOICE_COMPLEX
                            ? 'Centang kotak checkbox untuk memilih satu atau lebih jawaban benar (Standar AKM).'
                            : 'Klik radio button di samping huruf untuk memilih jawaban benar. Anda dapat menambah atau mengurangi pilihan (minimal 2).'}
                        </p>
                      </div>

                      <div className="space-y-2">
                        {mcOptions.map((opt) => (
                          <div
                            key={opt.id}
                            className={`flex items-center gap-2 p-2 rounded-lg border transition-all ${
                              opt.isCorrect
                                ? qType === QuestionType.MULTIPLE_CHOICE_COMPLEX
                                  ? 'bg-indigo-50/70 border-indigo-300 shadow-xs'
                                  : 'bg-emerald-50/70 border-emerald-300 shadow-xs'
                                : 'bg-white border-gray-200 hover:border-gray-300'
                            }`}
                          >
                            <label className="flex items-center gap-2 cursor-pointer select-none">
                              {qType === QuestionType.MULTIPLE_CHOICE_COMPLEX ? (
                                <input
                                  type="checkbox"
                                  checked={opt.isCorrect}
                                  onChange={() => {
                                    setMcOptions((prev) =>
                                      prev.map((o) => (o.id === opt.id ? { ...o, isCorrect: !o.isCorrect } : o))
                                    );
                                  }}
                                  className="w-4 h-4 text-indigo-600 focus:ring-indigo-500 rounded cursor-pointer"
                                />
                              ) : (
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
                              )}
                              <span
                                className={`flex items-center justify-center w-7 h-7 ${
                                  qType === QuestionType.MULTIPLE_CHOICE_COMPLEX ? 'rounded-md' : 'rounded-full'
                                } text-xs font-bold transition-colors ${
                                  opt.isCorrect
                                    ? qType === QuestionType.MULTIPLE_CHOICE_COMPLEX
                                      ? 'bg-indigo-600 text-white shadow-xs'
                                      : 'bg-emerald-600 text-white shadow-xs'
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
        <DialogContent className="sm:max-w-xl max-h-[90vh] overflow-y-auto">
          <form onSubmit={handleSaveAssignment}>
            <DialogHeader>
              <DialogTitle className="text-xl font-bold text-[#002446] flex items-center gap-2">
                <ClipboardList className="h-5 w-5 text-purple-600" /> Buat Penugasan Siswa
              </DialogTitle>
              <DialogDescription className="text-xs text-gray-500">
                Berikan instruksi tugas, batas waktu pengumpulan, jenis file yang diterima, serta lampiran lembar soal.
              </DialogDescription>
            </DialogHeader>

            <div className="space-y-4 py-3">
              <div className="space-y-1.5">
                <Label htmlFor="asTitle" className="text-xs font-semibold">Judul Tugas</Label>
                <Input
                  id="asTitle"
                  placeholder="misal: Tugas Praktikum / Analisis Kasus Bab 1"
                  value={assignTitle}
                  onChange={(e) => setAssignTitle(e.target.value)}
                  required
                />
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="asDesc" className="text-xs font-semibold">Instruksi & Kriteria Penugasan</Label>
                <textarea
                  id="asDesc"
                  rows={3}
                  placeholder="Tuliskan petunjuk lengkap pengumpulan tugas, kriteria pengerjaan, dan rubrik penilaian..."
                  value={assignDesc}
                  onChange={(e) => setAssignDesc(e.target.value)}
                  className="w-full p-2.5 rounded-md border border-gray-300 text-xs focus:outline-none focus:ring-2 focus:ring-[#002446]"
                  required
                />
              </div>

              {/* Lampiran Berkas Guru */}
              <div className="space-y-1.5 p-3 bg-purple-50/50 rounded-lg border border-purple-200">
                <Label className="text-xs font-bold text-purple-900 flex items-center gap-1.5">
                  <Paperclip className="h-3.5 w-3.5 text-purple-600" /> Lampiran Berkas dari Guru (Opsional)
                </Label>
                <p className="text-[11px] text-gray-500">
                  Unggah berkas lembar soal, studi kasus, atau panduan tugas (PDF, Word, Gambar, dll).
                </p>

                {assignFile ? (
                  <div className="flex items-center justify-between p-2 bg-white rounded border border-purple-200 mt-2 text-xs">
                    <div className="flex items-center gap-2 truncate">
                      <FileText className="h-4 w-4 text-purple-600 shrink-0" />
                      <span className="font-medium truncate text-gray-800">{assignFile.name}</span>
                      <span className="text-[10px] text-gray-400 shrink-0">
                        ({(assignFile.size / 1024).toFixed(1)} KB)
                      </span>
                    </div>
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      onClick={() => setAssignFile(null)}
                      className="h-6 w-6 p-0 text-red-500 hover:text-red-700 hover:bg-red-50"
                    >
                      <X className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                ) : (
                  <Input
                    type="file"
                    onChange={(e) => setAssignFile(e.target.files?.[0] || null)}
                    className="text-xs bg-white h-9 mt-1"
                  />
                )}
              </div>

              {/* Batas Waktu & Nilai Maksimal */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label htmlFor="asDeadline" className="text-xs font-semibold">Batas Waktu Pengumpulan</Label>
                  <Input
                    id="asDeadline"
                    type="datetime-local"
                    value={assignDeadline}
                    onChange={(e) => setAssignDeadline(e.target.value)}
                    required
                  />
                </div>

                <div className="space-y-1.5">
                  <Label htmlFor="asScore" className="text-xs font-semibold">Nilai Maksimal</Label>
                  <Input
                    id="asScore"
                    type="number"
                    min={1}
                    value={assignMaxScore}
                    onChange={(e) => setAssignMaxScore(Number(e.target.value))}
                    required
                  />
                </div>
              </div>

              {/* Pengaturan Jenis Berkas Siswa */}
              <div className="space-y-2 p-3 bg-gray-50 rounded-lg border">
                <div className="flex items-center justify-between">
                  <Label className="text-xs font-bold text-gray-800">
                    Jenis Berkas yang Diizinkan untuk Siswa:
                  </Label>
                  <span className="text-[10px] text-gray-500">Pilih kategori yang diperbolehkan</span>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 pt-1">
                  {ASSIGNMENT_FILE_CATEGORIES.map((cat) => {
                    const checked = assignCategories.includes(cat.id);
                    return (
                      <label
                        key={cat.id}
                        className={`flex items-center gap-2 p-2 rounded border text-xs cursor-pointer transition-colors ${
                          checked
                            ? 'bg-blue-50/70 border-blue-300 text-[#002446] font-medium'
                            : 'bg-white border-gray-200 text-gray-600 hover:bg-gray-100'
                        }`}
                      >
                        <input
                          type="checkbox"
                          checked={checked}
                          onChange={(e) => {
                            if (e.target.checked) {
                              setAssignCategories([...assignCategories, cat.id]);
                            } else {
                              setAssignCategories(assignCategories.filter((id) => id !== cat.id));
                            }
                          }}
                          className="rounded border-gray-300 text-[#002446] focus:ring-[#002446]"
                        />
                        <span>{cat.label}</span>
                      </label>
                    );
                  })}
                </div>

                <div className="pt-2 border-t mt-2">
                  <Label htmlFor="asCustomExts" className="text-[11px] text-gray-500 block mb-1">
                    Ekstensi Tambahan Kustom (opsional, pisahkan koma):
                  </Label>
                  <Input
                    id="asCustomExts"
                    placeholder="misal: txt, csv, ipynb"
                    value={assignCustomExts}
                    onChange={(e) => setAssignCustomExts(e.target.value)}
                    className="text-xs h-8 bg-white"
                  />
                </div>
              </div>
            </div>

            <DialogFooter className="pt-2">
              <Button type="button" variant="outline" onClick={() => setIsAssignModalOpen(false)}>
                Batal
              </Button>
              <Button type="submit" disabled={loading} className="bg-[#002446] hover:bg-[#002446]/90 text-white font-medium text-xs">
                {loading ? 'Menyimpan...' : 'Simpan Tugas'}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Modal 5: Edit Penugasan */}
      <Dialog open={Boolean(editingAssignment)} onOpenChange={(open) => !open && setEditingAssignment(null)}>
        <DialogContent className="sm:max-w-xl max-h-[90vh] overflow-y-auto">
          {editingAssignment && (
            <form onSubmit={handleUpdateAssignment}>
              <DialogHeader>
                <DialogTitle className="text-xl font-bold text-[#002446] flex items-center gap-2">
                  <Edit className="h-5 w-5 text-purple-600" /> Edit Penugasan
                </DialogTitle>
                <DialogDescription className="text-xs text-gray-500">
                  Ubah judul, instruksi, perpanjang batas waktu pengumpulan tugas, atau kelola berkas lampiran guru.
                </DialogDescription>
              </DialogHeader>

              <div className="space-y-4 py-3">
                <div className="space-y-1.5">
                  <Label htmlFor="editAsTitle" className="text-xs font-semibold">Judul Tugas</Label>
                  <Input
                    id="editAsTitle"
                    value={editAssignTitle}
                    onChange={(e) => setEditAssignTitle(e.target.value)}
                    required
                  />
                </div>

                <div className="space-y-1.5">
                  <Label htmlFor="editAsDesc" className="text-xs font-semibold">Instruksi & Kriteria Penugasan</Label>
                  <textarea
                    id="editAsDesc"
                    rows={3}
                    value={editAssignDesc}
                    onChange={(e) => setEditAssignDesc(e.target.value)}
                    className="w-full p-2.5 rounded-md border border-gray-300 text-xs focus:outline-none focus:ring-2 focus:ring-[#002446]"
                    required
                  />
                </div>

                {/* Lampiran Berkas Guru */}
                <div className="space-y-1.5 p-3 bg-purple-50/50 rounded-lg border border-purple-200">
                  <Label className="text-xs font-bold text-purple-900 flex items-center gap-1.5">
                    <Paperclip className="h-3.5 w-3.5 text-purple-600" /> Berkas Lampiran Soal Guru
                  </Label>

                  {editAssignExistingFile && !editAssignRemoveFile && !editAssignNewFile && (
                    <div className="flex items-center justify-between p-2 bg-white rounded border border-purple-200 text-xs mt-1">
                      <div className="flex items-center gap-2 truncate">
                        <FileText className="h-4 w-4 text-purple-600 shrink-0" />
                        <a
                          href={editAssignExistingFile.url}
                          target="_blank"
                          rel="noreferrer"
                          className="font-medium truncate text-blue-600 hover:underline"
                          title="Buka lampiran"
                        >
                          {editAssignExistingFile.name}
                        </a>
                      </div>
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        onClick={() => setEditAssignRemoveFile(true)}
                        className="h-6 px-2 text-xs text-red-600 hover:bg-red-50 hover:text-red-700"
                      >
                        Hapus Berkas
                      </Button>
                    </div>
                  )}

                  {editAssignRemoveFile && !editAssignNewFile && (
                    <div className="p-2 bg-amber-50 rounded border border-amber-200 text-xs text-amber-800 flex items-center justify-between mt-1">
                      <span>Lampiran lama akan dihapus setelah Anda menyimpan.</span>
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        onClick={() => setEditAssignRemoveFile(false)}
                        className="h-6 px-2 text-xs text-amber-900 underline"
                      >
                        Batal Hapus
                      </Button>
                    </div>
                  )}

                  {editAssignNewFile ? (
                    <div className="flex items-center justify-between p-2 bg-white rounded border border-purple-200 mt-2 text-xs">
                      <div className="flex items-center gap-2 truncate">
                        <Upload className="h-4 w-4 text-emerald-600 shrink-0" />
                        <span className="font-medium truncate text-gray-800">{editAssignNewFile.name}</span>
                        <span className="text-[10px] text-gray-400 shrink-0">
                          ({(editAssignNewFile.size / 1024).toFixed(1)} KB)
                        </span>
                      </div>
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        onClick={() => setEditAssignNewFile(null)}
                        className="h-6 w-6 p-0 text-red-500 hover:text-red-700 hover:bg-red-50"
                      >
                        <X className="h-3.5 w-3.5" />
                      </Button>
                    </div>
                  ) : (
                    <div className="pt-1">
                      <Label htmlFor="editAsNewFile" className="text-[11px] text-gray-600 block mb-1">
                        {editAssignExistingFile && !editAssignRemoveFile ? 'Ganti dengan berkas baru:' : 'Unggah berkas lampiran baru:'}
                      </Label>
                      <Input
                        id="editAsNewFile"
                        type="file"
                        onChange={(e) => {
                          setEditAssignNewFile(e.target.files?.[0] || null);
                          if (e.target.files?.[0]) setEditAssignRemoveFile(false);
                        }}
                        className="text-xs bg-white h-9"
                      />
                    </div>
                  )}
                </div>

                {/* Batas Waktu & Nilai Maksimal */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div className="space-y-1.5">
                    <Label htmlFor="editAsDeadline" className="text-xs font-semibold text-purple-900 flex items-center gap-1">
                      <Clock className="h-3.5 w-3.5 text-purple-600" /> Batas Waktu (Deadline)
                    </Label>
                    <Input
                      id="editAsDeadline"
                      type="datetime-local"
                      value={editAssignDeadline}
                      onChange={(e) => setEditAssignDeadline(e.target.value)}
                      required
                      className="border-purple-300 focus:ring-purple-600"
                    />
                    <p className="text-[10px] text-gray-500 leading-tight">
                      Ubah tanggal & jam ini untuk memberikan kelonggaran waktu bagi siswa.
                    </p>
                  </div>

                  <div className="space-y-1.5">
                    <Label htmlFor="editAsScore" className="text-xs font-semibold">Nilai Maksimal</Label>
                    <Input
                      id="editAsScore"
                      type="number"
                      min={1}
                      value={editAssignMaxScore}
                      onChange={(e) => setEditAssignMaxScore(Number(e.target.value))}
                      required
                    />
                  </div>
                </div>

                {/* Pengaturan Jenis Berkas Siswa */}
                <div className="space-y-2 p-3 bg-gray-50 rounded-lg border">
                  <div className="flex items-center justify-between">
                    <Label className="text-xs font-bold text-gray-800">
                      Jenis Berkas yang Diizinkan untuk Siswa:
                    </Label>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 pt-1">
                    {ASSIGNMENT_FILE_CATEGORIES.map((cat) => {
                      const checked = editAssignCategories.includes(cat.id);
                      return (
                        <label
                          key={cat.id}
                          className={`flex items-center gap-2 p-2 rounded border text-xs cursor-pointer transition-colors ${
                            checked
                              ? 'bg-blue-50/70 border-blue-300 text-[#002446] font-medium'
                              : 'bg-white border-gray-200 text-gray-600 hover:bg-gray-100'
                          }`}
                        >
                          <input
                            type="checkbox"
                            checked={checked}
                            onChange={(e) => {
                              if (e.target.checked) {
                                setEditAssignCategories([...editAssignCategories, cat.id]);
                              } else {
                                setEditAssignCategories(editAssignCategories.filter((id) => id !== cat.id));
                              }
                            }}
                            className="rounded border-gray-300 text-[#002446] focus:ring-[#002446]"
                          />
                          <span>{cat.label}</span>
                        </label>
                      );
                    })}
                  </div>

                  <div className="pt-2 border-t mt-2">
                    <Label htmlFor="editAsCustomExts" className="text-[11px] text-gray-500 block mb-1">
                      Ekstensi Tambahan Kustom (opsional, pisahkan koma):
                    </Label>
                    <Input
                      id="editAsCustomExts"
                      placeholder="misal: txt, csv, ipynb"
                      value={editAssignCustomExts}
                      onChange={(e) => setEditAssignCustomExts(e.target.value)}
                      className="text-xs h-8 bg-white"
                    />
                  </div>
                </div>
              </div>

              <DialogFooter className="pt-2">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setEditingAssignment(null)}
                  disabled={editAssignLoading}
                >
                  Batal
                </Button>
                <Button
                  type="submit"
                  disabled={editAssignLoading}
                  className="bg-[#002446] hover:bg-[#002446]/90 text-white font-medium text-xs"
                >
                  {editAssignLoading ? 'Menyimpan Perubahan...' : 'Simpan Perubahan'}
                </Button>
              </DialogFooter>
            </form>
          )}
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
              {editingQuiz?.questions?.map((q: any, idx: number) => {
                const extracted = extractMediaFromText(q.text);
                return (
                  <div key={q.id} className="p-3 text-sm flex items-center justify-between">
                    <div className="flex items-center gap-1.5 flex-wrap">
                      <span className="font-bold mr-1 text-[#002446]">#{idx + 1}</span>
                      <Badge variant="outline" className="mr-1 text-[10px]">
                        {q.type === 'MULTIPLE_CHOICE' ? 'PG' : 'Essay'}
                      </Badge>
                      {extracted.type === 'AUDIO' && (
                        <Badge className="mr-1 text-[10px] bg-indigo-50 text-indigo-700 border-indigo-200 flex items-center gap-1">
                          <Headphones className="w-3 h-3" />
                          Listening
                          {extracted.maxPlay ? ` (${extracted.maxPlay}x)` : ''}
                        </Badge>
                      )}
                      {extracted.type === 'VIDEO' && (
                        <Badge className="mr-1 text-[10px] bg-rose-50 text-rose-700 border-rose-200 flex items-center gap-1">
                          <Video className="w-3 h-3" />
                          Video
                        </Badge>
                      )}
                      <span className="text-gray-800">{extracted.cleanText.substring(0, 50)}{extracted.cleanText.length > 50 ? '...' : ''}</span>
                    </div>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => handleOpenEditQuestionModal(q)}
                      className="h-7 text-xs border-blue-300 text-blue-700 hover:bg-blue-100"
                    >
                      Edit Soal
                    </Button>
                  </div>
                );
              })}
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
                  <Textarea
                    rows={3}
                    value={editQuestionModal.text}
                    onChange={(e) => setEditQuestionModal({ ...editQuestionModal, text: e.target.value })}
                    required
                  />
                </div>

                {/* Media Soal (Audio Listening / Video) */}
                <div className="p-3 rounded-lg border border-gray-200 bg-gray-50/50 space-y-2.5">
                  <div className="flex items-center justify-between">
                    <Label className="text-xs font-bold text-[#002446] flex items-center gap-1.5">
                      <Headphones className="w-3.5 h-3.5 text-[#FF8928]" />
                      Media Soal (Audio / Video)
                    </Label>
                    <div className="flex items-center gap-1">
                      <Button
                        type="button"
                        size="sm"
                        variant={editQMediaType === 'NONE' ? 'default' : 'outline'}
                        className={`h-6 text-[11px] px-2 ${editQMediaType === 'NONE' ? 'bg-[#002446] text-white' : 'text-gray-600'}`}
                        onClick={() => {
                          setEditQMediaType('NONE');
                          setEditQMediaUrl('');
                        }}
                      >
                        Tanpa Media
                      </Button>
                      <Button
                        type="button"
                        size="sm"
                        variant={editQMediaType === 'AUDIO' ? 'default' : 'outline'}
                        className={`h-6 text-[11px] px-2 ${editQMediaType === 'AUDIO' ? 'bg-indigo-600 text-white' : 'text-gray-600'}`}
                        onClick={() => setEditQMediaType('AUDIO')}
                      >
                        <Headphones className="w-3 h-3 mr-1" /> Audio
                      </Button>
                      <Button
                        type="button"
                        size="sm"
                        variant={editQMediaType === 'VIDEO' ? 'default' : 'outline'}
                        className={`h-6 text-[11px] px-2 ${editQMediaType === 'VIDEO' ? 'bg-rose-600 text-white' : 'text-gray-600'}`}
                        onClick={() => setEditQMediaType('VIDEO')}
                      >
                        <Video className="w-3 h-3 mr-1" /> Video
                      </Button>
                    </div>
                  </div>

                  {editQMediaType !== 'NONE' && (
                    <div className="space-y-2 pt-2 border-t border-gray-100">
                      <div className="flex items-center gap-3 text-xs">
                        <span className="text-gray-500 font-medium">Sumber:</span>
                        <label className="flex items-center gap-1.5 cursor-pointer">
                          <input
                            type="radio"
                            name="editQMediaSource"
                            checked={editQMediaSource === 'UPLOAD'}
                            onChange={() => setEditQMediaSource('UPLOAD')}
                            className="text-[#002446]"
                          />
                          <span>Upload ({editQMediaType === 'AUDIO' ? 'MP3/WAV' : 'MP4/WebM'})</span>
                        </label>
                        <label className="flex items-center gap-1.5 cursor-pointer">
                          <input
                            type="radio"
                            name="editQMediaSource"
                            checked={editQMediaSource === 'URL'}
                            onChange={() => setEditQMediaSource('URL')}
                            className="text-[#002446]"
                          />
                          <span>URL {editQMediaType === 'VIDEO' ? '/ YouTube' : ''}</span>
                        </label>
                      </div>

                      {editQMediaSource === 'UPLOAD' ? (
                        <div className="flex items-center gap-2">
                          <Input
                            type="file"
                            accept={editQMediaType === 'AUDIO' ? 'audio/*' : 'video/*'}
                            onChange={handleUploadEditQMediaFile}
                            disabled={editQIsUploading || loading}
                            className="text-xs h-8 bg-white"
                          />
                          {editQIsUploading && <span className="text-xs text-amber-600 animate-pulse">Mengunggah...</span>}
                        </div>
                      ) : (
                        <Input
                          type="url"
                          placeholder={editQMediaType === 'AUDIO' ? 'https://example.com/audio.mp3' : 'https://www.youtube.com/watch?v=... atau link video'}
                          value={editQMediaUrl}
                          onChange={(e) => setEditQMediaUrl(e.target.value)}
                          className="text-xs h-8 bg-white"
                        />
                      )}

                      {editQMediaUrl && (
                        <div className="text-[11px] text-emerald-700 bg-emerald-50 p-1.5 rounded-lg border border-emerald-200 flex items-center justify-between gap-2 min-w-0 overflow-hidden">
                          <span className="truncate min-w-0 flex-1">
                            Media aktif: <strong className="font-mono text-[10px] break-all">{editQMediaUrl}</strong>
                          </span>
                          <Button
                            type="button"
                            variant="ghost"
                            size="sm"
                            onClick={() => setEditQMediaUrl('')}
                            className="h-5 px-1.5 text-[10px] text-red-600 hover:bg-red-100 shrink-0"
                          >
                            Hapus
                          </Button>
                        </div>
                      )}

                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 pt-1">
                          <div>
                            <Label className="text-[11px] text-gray-600">
                              {editQMediaType === 'AUDIO' ? 'Batas Putar Siswa (Listening Quota)' : 'Batas Putar Siswa (Video Quota)'}
                            </Label>
                            <select
                              value={editQMediaMaxPlay}
                              onChange={(e) => setEditQMediaMaxPlay(e.target.value)}
                              className="w-full mt-0.5 h-8 rounded-md border border-gray-300 px-2 text-xs bg-white"
                            >
                              <option value="unlimited">Bebas Putar (Tanpa Batas)</option>
                              <option value="1">Maksimal 1 Kali Putar</option>
                              <option value="2">Maksimal 2 Kali Putar</option>
                              <option value="3">Maksimal 3 Kali Putar</option>
                            </select>
                          </div>
                          <p className="text-[10px] text-gray-500 self-end pb-1">
                            {editQMediaType === 'AUDIO'
                              ? 'Audio terkunci saat kuota putar siswa habis.'
                              : 'Video terkunci saat kuota putar siswa habis.'}
                          </p>
                        </div>
                    </div>
                  )}
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

      {/* Modal Konfirmasi Hapus Kuis */}
      <Dialog open={Boolean(quizToDelete)} onOpenChange={(open) => !open && setQuizToDelete(null)}>
        <DialogContent className="max-w-md p-6 bg-white border border-gray-200">
          <DialogHeader className="space-y-3 text-center sm:text-center">
            <div className="mx-auto w-12 h-12 rounded-full bg-red-100 flex items-center justify-center text-red-600">
              <Trash2 className="w-6 h-6" />
            </div>
            <DialogTitle className="text-xl font-bold text-[#002446]">
              Hapus Kuis?
            </DialogTitle>
            <DialogDescription className="text-sm text-gray-600 leading-relaxed">
              Apakah Anda yakin ingin menghapus kuis <strong>{quizToDelete?.title}</strong>? Tindakan ini akan menghapus seluruh butir soal di dalamnya dan tidak dapat dibatalkan.
            </DialogDescription>
          </DialogHeader>

          {quizToDelete?.attemptsCount !== undefined && quizToDelete.attemptsCount > 0 && (
            <div className="p-3 bg-amber-50 border border-amber-200 rounded-lg text-xs text-amber-800 flex items-start gap-2 text-left">
              <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5 text-amber-600" />
              <div>
                <strong>Peringatan Riwayat Pengerjaan:</strong>
                <p className="mt-0.5">
                  Kuis ini memiliki <strong>{quizToDelete.attemptsCount}</strong> riwayat pengerjaan siswa yang juga akan ikut dihapus secara permanen.
                </p>
              </div>
            </div>
          )}

          {deleteQuizError && (
            <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-xs text-red-700 text-left">
              {deleteQuizError}
            </div>
          )}

          <DialogFooter className="flex-col sm:flex-row gap-2 pt-2">
            <Button
              type="button"
              variant="outline"
              disabled={deleteQuizLoading}
              onClick={() => setQuizToDelete(null)}
              className="w-full sm:w-1/2"
            >
              Batal
            </Button>
            <Button
              type="button"
              disabled={deleteQuizLoading}
              onClick={handleConfirmDeleteQuiz}
              className="w-full sm:w-1/2 bg-red-600 hover:bg-red-700 text-white font-bold"
            >
              {deleteQuizLoading ? 'Menghapus...' : 'Hapus Kuis'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Modal Konfirmasi Hapus Modul */}
      <Dialog open={Boolean(moduleToDelete)} onOpenChange={(open) => !open && setModuleToDelete(null)}>
        <DialogContent className="max-w-md p-6 bg-white border border-gray-200">
          <DialogHeader className="space-y-3 text-center sm:text-center">
            <div className="mx-auto w-12 h-12 rounded-full bg-red-100 flex items-center justify-center text-red-600">
              <Trash2 className="w-6 h-6" />
            </div>
            <DialogTitle className="text-xl font-bold text-[#002446]">
              Hapus Bab Modul?
            </DialogTitle>
            <DialogDescription className="text-sm text-gray-600 leading-relaxed">
              Apakah Anda yakin ingin menghapus bab modul <strong>{moduleToDelete?.title}</strong>?
            </DialogDescription>
          </DialogHeader>

          <div className="p-3 bg-amber-50 border border-amber-200 rounded-lg text-xs text-amber-800 flex items-start gap-2 text-left">
            <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5 text-amber-600" />
            <div>
              <strong>Peringatan Penghapusan:</strong>
              <p className="mt-0.5">
                Seluruh isi bab ini ({moduleToDelete?.contentsCount || 0} materi, {moduleToDelete?.quizzesCount || 0} kuis, {moduleToDelete?.assignmentsCount || 0} tugas) akan ikut dihapus secara permanen.
              </p>
            </div>
          </div>

          <DialogFooter className="flex-col sm:flex-row gap-2 pt-2">
            <Button
              type="button"
              variant="outline"
              disabled={deleteModuleLoading}
              onClick={() => setModuleToDelete(null)}
              className="w-full sm:w-1/2"
            >
              Batal
            </Button>
            <Button
              type="button"
              disabled={deleteModuleLoading}
              onClick={handleConfirmDeleteModule}
              className="w-full sm:w-1/2 bg-red-600 hover:bg-red-700 text-white font-bold"
            >
              {deleteModuleLoading ? 'Menghapus...' : 'Hapus Modul'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Modal Konfirmasi Hapus Materi */}
      <Dialog open={Boolean(contentToDelete)} onOpenChange={(open) => !open && setContentToDelete(null)}>
        <DialogContent className="max-w-md p-6 bg-white border border-gray-200">
          <DialogHeader className="space-y-3 text-center sm:text-center">
            <div className="mx-auto w-12 h-12 rounded-full bg-red-100 flex items-center justify-center text-red-600">
              <Trash2 className="w-6 h-6" />
            </div>
            <DialogTitle className="text-xl font-bold text-[#002446]">
              Hapus Materi?
            </DialogTitle>
            <DialogDescription className="text-sm text-gray-600 leading-relaxed">
              Apakah Anda yakin ingin menghapus materi <strong>{contentToDelete?.title}</strong>? Tindakan ini tidak dapat dibatalkan.
            </DialogDescription>
          </DialogHeader>

          <DialogFooter className="flex-col sm:flex-row gap-2 pt-2">
            <Button
              type="button"
              variant="outline"
              disabled={deleteContentLoading}
              onClick={() => setContentToDelete(null)}
              className="w-full sm:w-1/2"
            >
              Batal
            </Button>
            <Button
              type="button"
              disabled={deleteContentLoading}
              onClick={handleConfirmDeleteContent}
              className="w-full sm:w-1/2 bg-red-600 hover:bg-red-700 text-white font-bold"
            >
              {deleteContentLoading ? 'Menghapus...' : 'Hapus Materi'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Modal Konfirmasi Hapus Tugas */}
      <Dialog open={Boolean(assignmentToDelete)} onOpenChange={(open) => !open && setAssignmentToDelete(null)}>
        <DialogContent className="max-w-md p-6 bg-white border border-gray-200">
          <DialogHeader className="space-y-3 text-center sm:text-center">
            <div className="mx-auto w-12 h-12 rounded-full bg-red-100 flex items-center justify-center text-red-600">
              <Trash2 className="w-6 h-6" />
            </div>
            <DialogTitle className="text-xl font-bold text-[#002446]">
              Hapus Penugasan?
            </DialogTitle>
            <DialogDescription className="text-sm text-gray-600 leading-relaxed">
              Apakah Anda yakin ingin menghapus tugas <strong>{assignmentToDelete?.title}</strong>?
            </DialogDescription>
          </DialogHeader>

          {assignmentToDelete?.submissionsCount !== undefined && assignmentToDelete.submissionsCount > 0 && (
            <div className="p-3 bg-amber-50 border border-amber-200 rounded-lg text-xs text-amber-800 flex items-start gap-2 text-left">
              <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5 text-amber-600" />
              <div>
                <strong>Peringatan Pengumpulan Siswa:</strong>
                <p className="mt-0.5">
                  Tugas ini memiliki <strong>{assignmentToDelete.submissionsCount}</strong> pengumpulan berkas dari siswa yang juga akan ikut dihapus.
                </p>
              </div>
            </div>
          )}

          <DialogFooter className="flex-col sm:flex-row gap-2 pt-2">
            <Button
              type="button"
              variant="outline"
              disabled={deleteAssignmentLoading}
              onClick={() => setAssignmentToDelete(null)}
              className="w-full sm:w-1/2"
            >
              Batal
            </Button>
            <Button
              type="button"
              disabled={deleteAssignmentLoading}
              onClick={handleConfirmDeleteAssignment}
              className="w-full sm:w-1/2 bg-red-600 hover:bg-red-700 text-white font-bold"
            >
              {deleteAssignmentLoading ? 'Menghapus...' : 'Hapus Tugas'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Modal Notifikasi / Alert Dialog */}
      <Dialog open={Boolean(noticeModal)} onOpenChange={(open) => !open && setNoticeModal(null)}>
        <DialogContent className="max-w-md p-6 bg-white border border-gray-200 text-center">
          <DialogHeader className="space-y-3 text-center sm:text-center">
            <div
              className={`mx-auto w-12 h-12 rounded-full flex items-center justify-center ${
                noticeModal?.type === 'warning'
                  ? 'bg-amber-100 text-amber-600'
                  : noticeModal?.type === 'success'
                  ? 'bg-emerald-100 text-emerald-600'
                  : 'bg-red-100 text-red-600'
              }`}
            >
              {noticeModal?.type === 'warning' ? (
                <AlertTriangle className="w-6 h-6" />
              ) : noticeModal?.type === 'success' ? (
                <CheckCircle2 className="w-6 h-6" />
              ) : (
                <AlertCircle className="w-6 h-6" />
              )}
            </div>
            <DialogTitle className="text-lg font-bold text-[#002446]">
              {noticeModal?.title}
            </DialogTitle>
            <DialogDescription className="text-sm text-gray-600 leading-relaxed">
              {noticeModal?.message}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="pt-2">
            <Button
              type="button"
              onClick={() => setNoticeModal(null)}
              className="w-full bg-[#002446] hover:bg-[#002446]/90 text-white font-bold"
            >
              Tutup
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
