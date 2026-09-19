'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Link } from '@/i18n/navigation';
import {
  ArrowLeft,
  Plus,
  Trash2,
  Pencil,
  FileUp,
  FileDown,
  HelpCircle,
  BookOpen,
  Search,
  CheckCircle2,
  AlertTriangle,
  Database,
  AlertCircle,
  Headphones,
  Video,
  UploadCloud,
  Link2,
} from 'lucide-react';
import { QuestionTextRenderer } from '@/components/quiz/question-text-renderer';
import {
  createQuestionBankCategory,
  updateQuestionBankCategory,
  deleteQuestionBankCategory,
  addQuestionToBank,
  updateBankQuestion,
  deleteBankQuestion,
  bulkAddQuestionsToBank,
} from '@/lib/actions/question-bank';

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

type Option = { id?: string; text: string; isCorrect: boolean };
type Question = {
  id: string;
  text: string;
  type: 'MULTIPLE_CHOICE' | 'MULTIPLE_CHOICE_COMPLEX' | 'ESSAY';
  points: number;
  categoryId: string | null;
  options?: Option[];
};
type Category = {
  id: string;
  name: string;
  questions?: Question[];
};

export function QuestionBankClient({ courseId, course, initialData, initialStats = {} }: any) {
  const router = useRouter();
  const t = useTranslations('teacherQuestionBank');
  
  // Data state to ensure immediate reactive updates
  const [bankData, setBankData] = useState<{
    categories: any[];
    uncategorized: any[];
    uncategorizedCount: number;
  }>({
    categories: initialData?.categories || (Array.isArray(initialData) ? initialData : []),
    uncategorized: initialData?.uncategorized || [],
    uncategorizedCount: initialData?.uncategorizedCount || (initialData?.uncategorized?.length || 0),
  });

  useEffect(() => {
    if (initialData) {
      setBankData({
        categories: initialData?.categories || (Array.isArray(initialData) ? initialData : []),
        uncategorized: initialData?.uncategorized || [],
        uncategorizedCount: initialData?.uncategorizedCount || (initialData?.uncategorized?.length || 0),
      });
    }
  }, [initialData]);

  // States
  const [selectedCategoryId, setSelectedCategoryId] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  // Category States
  const [editingCategory, setEditingCategory] = useState<string | null>(null);
  const [categoryName, setCategoryName] = useState('');
  const [isAddingCategory, setIsAddingCategory] = useState(false);

  // Question Modal States
  const [isQuestionModalOpen, setIsQuestionModalOpen] = useState(false);
  const [editingQuestion, setEditingQuestion] = useState<Question | null>(null);
  const [questionType, setQuestionType] = useState<'MULTIPLE_CHOICE' | 'MULTIPLE_CHOICE_COMPLEX' | 'ESSAY'>('MULTIPLE_CHOICE');
  const [questionText, setQuestionText] = useState('');
  const [questionPoints, setQuestionPoints] = useState<number>(10);
  const [questionOptions, setQuestionOptions] = useState<Option[]>([
    { id: 'A', text: '', isCorrect: true },
    { id: 'B', text: '', isCorrect: false },
  ]);

  // Media States for Question (Audio / Video)
  const [mediaType, setMediaType] = useState<'NONE' | 'AUDIO' | 'VIDEO'>('NONE');
  const [mediaSourceType, setMediaSourceType] = useState<'UPLOAD' | 'URL'>('UPLOAD');
  const [mediaUrl, setMediaUrl] = useState('');
  const [mediaMaxPlay, setMediaMaxPlay] = useState<string>('unlimited');
  const [isUploadingMedia, setIsUploadingMedia] = useState(false);

  // Import Modal States
  const [isImportModalOpen, setIsImportModalOpen] = useState(false);
  const [importTab, setImportTab] = useState<'aiken' | 'word'>('aiken');
  const [aikenMode, setAikenMode] = useState<'paste' | 'file'>('paste');
  const [aikenText, setAikenText] = useState('');
  const [aikenFile, setAikenFile] = useState<File | null>(null);
  const [importFile, setImportFile] = useState<File | null>(null);
  const [importPreview, setImportPreview] = useState<any[]>([]);
  const [importWarnings, setImportWarnings] = useState<string[]>([]);

  // Confirmation & Alert Modal States (replaces window.confirm & window.alert)
  const [categoryToDelete, setCategoryToDelete] = useState<{ id: string; name: string; count: number } | null>(null);
  const [questionToDelete, setQuestionToDelete] = useState<string | null>(null);
  const [noticeModal, setNoticeModal] = useState<{ title: string; message: string; type?: 'error' | 'warning' | 'info' | 'success' } | null>(null);

  // Computed data
  const categories = bankData.categories || [];
  const uncategorizedQuestions = bankData.uncategorized || [];
  const allQuestions = [
    ...categories.flatMap((c: any) => c.questions || []),
    ...uncategorizedQuestions,
  ];

  const displayedQuestions = selectedCategoryId === 'uncategorized'
    ? uncategorizedQuestions
    : selectedCategoryId === null 
      ? allQuestions
      : categories.find((c: any) => c.id === selectedCategoryId)?.questions || [];

  // Handlers
  const handleAddCategory = async () => {
    if (!categoryName.trim()) return;
    setLoading(true);
    try {
      const created = await createQuestionBankCategory(courseId, categoryName);
      setBankData((prev) => ({
        ...prev,
        categories: [...(prev.categories || []), { ...created, questions: [], _count: { questions: 0 } }],
      }));
      setCategoryName('');
      setIsAddingCategory(false);
      router.refresh();
    } catch (e: any) {
      console.error(e);
      setNoticeModal({
        title: t('addCategoryFailedTitle'),
        message: e?.message || t('addCategoryFailedDesc'),
        type: 'error',
      });
    } finally {
      setLoading(false);
    }
  };

  const handleUpdateCategory = async (id: string) => {
    if (!categoryName.trim()) return;
    setLoading(true);
    try {
      await updateQuestionBankCategory(id, categoryName);
      setBankData((prev) => ({
        ...prev,
        categories: (prev.categories || []).map((c: any) => c.id === id ? { ...c, name: categoryName } : c),
      }));
      setEditingCategory(null);
      setCategoryName('');
      router.refresh();
    } catch (e: any) {
      console.error(e);
      setNoticeModal({
        title: t('updateCategoryFailedTitle'),
        message: e?.message || t('updateCategoryFailedDesc'),
        type: 'error',
      });
    } finally {
      setLoading(false);
    }
  };

  const confirmDeleteCategory = async () => {
    if (!categoryToDelete) return;
    const id = categoryToDelete.id;
    setLoading(true);
    try {
      await deleteQuestionBankCategory(id);
      setBankData((prev) => {
        const deletedCat = (prev.categories || []).find((c: any) => c.id === id);
        const movedQuestions = deletedCat?.questions || [];
        return {
          ...prev,
          categories: (prev.categories || []).filter((c: any) => c.id !== id),
          uncategorized: [...(prev.uncategorized || []), ...movedQuestions],
          uncategorizedCount: (prev.uncategorizedCount || 0) + movedQuestions.length,
        };
      });
      if (selectedCategoryId === id) setSelectedCategoryId(null);
      setCategoryToDelete(null);
      router.refresh();
    } catch (e: any) {
      console.error(e);
      setNoticeModal({
        title: t('deleteCategoryFailedTitle'),
        message: e?.message || t('deleteCategoryFailedDesc'),
        type: 'error',
      });
    } finally {
      setLoading(false);
    }
  };

  const openAddQuestion = () => {
    setEditingQuestion(null);
    setQuestionType('MULTIPLE_CHOICE');
    setQuestionText('');
    setQuestionPoints(10);
    setQuestionOptions([{ text: '', isCorrect: true }, { text: '', isCorrect: false }]);
    setMediaType('NONE');
    setMediaSourceType('UPLOAD');
    setMediaUrl('');
    setMediaMaxPlay('unlimited');
    setIsQuestionModalOpen(true);
  };

  const openEditQuestion = (q: Question) => {
    setEditingQuestion(q);
    setQuestionType(q.type);
    setQuestionPoints(q.points);
    if ((q.type === 'MULTIPLE_CHOICE' || q.type === 'MULTIPLE_CHOICE_COMPLEX') && q.options) {
      setQuestionOptions(q.options);
    } else {
      setQuestionOptions([{ text: '', isCorrect: true }, { text: '', isCorrect: false }]);
    }

    const extracted = extractMediaFromText(q.text);
    setMediaType(extracted.type);
    setMediaUrl(extracted.url);
    setMediaMaxPlay(extracted.maxPlay ? String(extracted.maxPlay) : 'unlimited');
    setQuestionText(extracted.cleanText);
    setMediaSourceType(extracted.url.startsWith('/api/files/') ? 'UPLOAD' : 'URL');

    setIsQuestionModalOpen(true);
  };

  const handleUploadMediaFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setIsUploadingMedia(true);
    try {
      const formData = new FormData();
      formData.append('file', file);
      const res = await fetch('/api/upload', {
        method: 'POST',
        body: formData,
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || t('uploadMediaError'));
      }
      const data = await res.json();
      setMediaUrl(data.url);
    } catch (err: any) {
      console.error(err);
      setNoticeModal({
        title: t('uploadFailedTitle'),
        message: err?.message || t('uploadFailedDesc'),
        type: 'error',
      });
    } finally {
      setIsUploadingMedia(false);
    }
  };

  const handleSaveQuestion = async () => {
    if (!questionText.trim()) return;

    if (questionType === 'MULTIPLE_CHOICE') {
      const hasCorrect = questionOptions.some((o) => o.isCorrect);
      if (!hasCorrect) {
        setNoticeModal({
          title: t('keyRequiredTitle'),
          message: t('keyRequiredSingle'),
          type: 'warning',
        });
        return;
      }
    } else if (questionType === 'MULTIPLE_CHOICE_COMPLEX') {
      const correctCount = questionOptions.filter((o) => o.isCorrect).length;
      if (correctCount === 0) {
        setNoticeModal({
          title: t('keyRequiredTitle'),
          message: t('keyRequiredComplex'),
          type: 'warning',
        });
        return;
      }
    }

    setLoading(true);
    try {
      let finalText = questionText.trim();
      const limitAttr = mediaMaxPlay !== 'unlimited' && Number(mediaMaxPlay) > 0 ? ` data-max-play="${mediaMaxPlay}"` : '';
      if (mediaType === 'AUDIO' && mediaUrl.trim()) {
        finalText = `${finalText}\n<div class="quiz-media-audio my-3" data-src="${mediaUrl.trim()}"${limitAttr}></div>`;
      } else if (mediaType === 'VIDEO' && mediaUrl.trim()) {
        finalText = `${finalText}\n<div class="quiz-media-video my-3" data-src="${mediaUrl.trim()}"${limitAttr}></div>`;
      }

      const data = {
        text: finalText,
        type: questionType,
        points: questionPoints,
        categoryId: selectedCategoryId === 'uncategorized' ? null : selectedCategoryId,
        options: (questionType === 'MULTIPLE_CHOICE' || questionType === 'MULTIPLE_CHOICE_COMPLEX')
          ? questionOptions.map((opt, idx) => ({
              id: opt.id || getOptionLetter(idx),
              text: opt.text,
              isCorrect: opt.isCorrect,
            }))
          : [],
      };

      if (editingQuestion) {
        const updated = await updateBankQuestion(editingQuestion.id, data);
        setBankData((prev) => {
          const updateItem = (item: any) => (item.id === editingQuestion.id ? { ...item, ...updated } : item);
          return {
            ...prev,
            categories: (prev.categories || []).map((c: any) => ({
              ...c,
              questions: (c.questions || []).map(updateItem),
            })),
            uncategorized: (prev.uncategorized || []).map(updateItem),
          };
        });
      } else {
        const created = await addQuestionToBank({ courseId, ...data });
        setBankData((prev) => {
          if (data.categoryId) {
            return {
              ...prev,
              categories: (prev.categories || []).map((c: any) =>
                c.id === data.categoryId
                  ? {
                      ...c,
                      questions: [created, ...(c.questions || [])],
                      _count: { questions: (c._count?.questions || 0) + 1 },
                    }
                  : c
              ),
            };
          } else {
            return {
              ...prev,
              uncategorized: [created, ...(prev.uncategorized || [])],
              uncategorizedCount: (prev.uncategorizedCount || 0) + 1,
            };
          }
        });
      }
      setIsQuestionModalOpen(false);
      router.refresh();
    } catch (e: any) {
      console.error(e);
      setNoticeModal({
        title: t('saveQuestionFailedTitle'),
        message: e?.message || t('saveQuestionFailedDesc'),
        type: 'error',
      });
    } finally {
      setLoading(false);
    }
  };

  const confirmDeleteQuestion = async () => {
    if (!questionToDelete) return;
    const id = questionToDelete;
    setLoading(true);
    try {
      await deleteBankQuestion(id);
      setBankData((prev) => ({
        ...prev,
        categories: (prev.categories || []).map((c: any) => ({
          ...c,
          questions: (c.questions || []).filter((q: any) => q.id !== id),
          _count: {
            questions: Math.max(
              0,
              (c._count?.questions || 0) - (c.questions?.some((q: any) => q.id === id) ? 1 : 0)
            ),
          },
        })),
        uncategorized: (prev.uncategorized || []).filter((q: any) => q.id !== id),
        uncategorizedCount: Math.max(
          0,
          (prev.uncategorizedCount || 0) - (prev.uncategorized?.some((q: any) => q.id === id) ? 1 : 0)
        ),
      }));
      setQuestionToDelete(null);
      router.refresh();
    } catch (e: any) {
      console.error(e);
      setNoticeModal({
        title: t('deleteQuestionFailedTitle'),
        message: e?.message || t('deleteQuestionFailedDesc'),
        type: 'error',
      });
    } finally {
      setLoading(false);
    }
  };

  const handleAddOption = () => {
    setQuestionOptions([...questionOptions, { text: '', isCorrect: false }]);
  };

  const handleOptionChange = (index: number, text: string) => {
    const newOptions = [...questionOptions];
    newOptions[index].text = text;
    setQuestionOptions(newOptions);
  };

  const handleCorrectOptionChange = (index: number) => {
    if (questionType === 'MULTIPLE_CHOICE_COMPLEX') {
      const newOptions = [...questionOptions];
      newOptions[index] = {
        ...newOptions[index],
        isCorrect: !newOptions[index].isCorrect,
      };
      setQuestionOptions(newOptions);
    } else {
      const newOptions = questionOptions.map((opt, i) => ({
        ...opt,
        isCorrect: i === index,
      }));
      setQuestionOptions(newOptions);
    }
  };

  const handleParseAiken = async () => {
    setLoading(true);
    setImportWarnings([]);
    try {
      let res: Response;
      if (aikenMode === 'paste') {
        if (!aikenText.trim()) {
          setNoticeModal({
            title: t('emptyTextTitle'),
            message: t('emptyTextDesc'),
            type: 'warning',
          });
          setLoading(false);
          return;
        }
        res = await fetch('/api/quiz-import/aiken', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ rawText: aikenText }),
        });
      } else {
        if (!aikenFile) {
          setNoticeModal({
            title: t('noFileSelectedTitle'),
            message: t('noFileSelectedDesc'),
            type: 'warning',
          });
          setLoading(false);
          return;
        }
        const formData = new FormData();
        formData.append('file', aikenFile);
        res = await fetch('/api/quiz-import/aiken', {
          method: 'POST',
          body: formData,
        });
      }

      const data = await res.json();
      if (!res.ok) {
        setNoticeModal({
          title: t('processAikenFailedTitle'),
          message: data.error || t('processAikenFailedDesc'),
          type: 'error',
        });
        return;
      }

      if (data.warnings && data.warnings.length > 0) {
        setImportWarnings(data.warnings);
      }

      if (data.questions && data.questions.length > 0) {
        setImportPreview(data.questions);
      } else {
        setNoticeModal({
          title: t('noQuestionsFoundTitle'),
          message: t('noQuestionsFoundAikenDesc'),
          type: 'warning',
        });
      }
    } catch (e: any) {
      console.error(e);
      setNoticeModal({
        title: t('systemErrorTitle'),
        message: e?.message || t('systemErrorAikenDesc'),
        type: 'error',
      });
    } finally {
      setLoading(false);
    }
  };

  const handleLoadAikenSample = () => {
    const sample = `Apa ibukota negara Indonesia saat ini?
A. Surabaya
B. Bandung
C. Jakarta
D. Medan
ANSWER: C

Manakah yang termasuk pulau-pulau besar di Indonesia? (Pilih lebih dari satu)
A. Pulau Jawa
B. Pulau Madura
C. Pulau Kalimantan
D. Pulau Sumatera
ANSWER: A, C, D
POINTS: 2

Sebutkan dan jelaskan fungsi organ lambung dalam sistem pencernaan manusia!
ANSWER: ESSAY
POINTS: 5`;
    setAikenText(sample);
  };

  const handleRemoveOption = (index: number) => {
    if (questionOptions.length <= 2) return;
    const newOptions = questionOptions.filter((_, i) => i !== index);
    if (questionOptions[index].isCorrect) {
      newOptions[0].isCorrect = true;
    }
    setQuestionOptions(newOptions);
  };

  const handleUploadWord = async () => {
    if (!importFile) return;
    setLoading(true);
    setImportWarnings([]);
    try {
      const formData = new FormData();
      formData.append('file', importFile);
      formData.append('courseId', courseId);
      if (selectedCategoryId && selectedCategoryId !== 'uncategorized') {
        formData.append('categoryId', selectedCategoryId);
      }

      const res = await fetch('/api/quiz-import', { method: 'POST', body: formData });
      const data = await res.json();
      if (!res.ok) {
        setNoticeModal({
          title: t('processWordFailedTitle'),
          message: data.error || t('processWordFailedDesc'),
          type: 'error',
        });
        return;
      }

      if (data.warnings && data.warnings.length > 0) {
        setImportWarnings(data.warnings);
      }

      if (data.questions && data.questions.length > 0) {
        setImportPreview(data.questions);
      } else {
        setNoticeModal({
          title: t('noQuestionsFoundTitle'),
          message: t('noQuestionsFoundWordDesc'),
          type: 'warning',
        });
      }
    } catch (e: any) {
      console.error(e);
      setNoticeModal({
        title: t('systemErrorTitle'),
        message: e?.message || t('systemErrorWordDesc'),
        type: 'error',
      });
    } finally {
      setLoading(false);
    }
  };

  const handleConfirmImport = async () => {
    if (importPreview.length === 0) return;
    setLoading(true);
    try {
      const targetCategoryId = selectedCategoryId === 'uncategorized' ? null : selectedCategoryId;
      await bulkAddQuestionsToBank(courseId, targetCategoryId, importPreview);
      setIsImportModalOpen(false);
      setImportPreview([]);
      setImportFile(null);
      router.refresh();
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  const getOptionLetter = (index: number) => String.fromCharCode(65 + index);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <Button variant="ghost" size="sm" asChild className="mb-2 -ml-3 text-muted-foreground hover:text-foreground">
            <Link href={`/teacher/course/${courseId}/modules`}>
              <ArrowLeft className="w-4 h-4 mr-2" />
              {t('backToModules')}
            </Link>
          </Button>
          <div className="flex items-center gap-3">
            <div className="p-3 bg-[#002446] text-white rounded-xl">
              <Database className="w-6 h-6" />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-[#002446]">{t('pageTitle')}</h1>
              <p className="text-muted-foreground">{course.title}</p>
            </div>
          </div>
        </div>
        <div className="flex gap-4">
          <Card className="bg-slate-50 w-full sm:w-auto">
            <CardContent className="p-4 flex flex-wrap sm:flex-nowrap justify-around gap-4 sm:gap-6">
              <div className="text-center">
                <p className="text-2xl font-bold text-[#002446]">{allQuestions.length}</p>
                <p className="text-xs text-muted-foreground uppercase tracking-wider">{t('totalQuestions')}</p>
              </div>
              <div className="text-center">
                <p className="text-2xl font-bold text-[#FF8928]">
                  {categories.reduce((acc: number, c: any) => acc + (c.questions?.length || 0), 0)}
                </p>
                <p className="text-xs text-muted-foreground uppercase tracking-wider">{t('categorized')}</p>
              </div>
              <div className="text-center">
                <p className="text-2xl font-bold text-slate-400">{uncategorizedQuestions.length}</p>
                <p className="text-xs text-muted-foreground uppercase tracking-wider">{t('uncategorized')}</p>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
        {/* Left Sidebar - Categories */}
        <div className="lg:col-span-1 space-y-4">
          <Card>
            <CardHeader className="pb-3 border-b">
              <CardTitle className="text-lg font-semibold flex items-center justify-between">
                {t('categoriesTitle')}
                <Button variant="ghost" size="icon" onClick={() => setIsAddingCategory(true)} disabled={loading}>
                  <Plus className="w-4 h-4 text-[#FF8928]" />
                </Button>
              </CardTitle>
            </CardHeader>
            <CardContent className="p-2 space-y-1">
              <div
                className={`flex items-center justify-between p-2 rounded-md cursor-pointer transition-colors ${
                  selectedCategoryId === null ? 'bg-[#002446]/10 text-[#002446] font-medium' : 'hover:bg-slate-100'
                }`}
                onClick={() => setSelectedCategoryId(null)}
              >
                <span className="truncate">{t('allQuestions')}</span>
                <Badge variant="secondary">{initialStats?.total || 0}</Badge>
              </div>

              {isAddingCategory && (
                <div className="p-2 flex items-center gap-2">
                  <Input
                    autoFocus
                    placeholder={t('categoryNamePlaceholder')}
                    value={categoryName}
                    onChange={(e) => setCategoryName(e.target.value)}
                    onKeyDown={(e) => e.key === 'Enter' && handleAddCategory()}
                    className="h-8 text-sm"
                  />
                  <Button size="sm" className="h-8 bg-[#002446] hover:bg-[#002446]/90 text-white" onClick={handleAddCategory} disabled={loading}>
                    {t('saveBtn')}
                  </Button>
                  <Button size="sm" variant="ghost" className="h-8" onClick={() => { setIsAddingCategory(false); setCategoryName(''); }} disabled={loading}>
                    {t('cancelBtn')}
                  </Button>
                </div>
              )}

              {categories.map((cat: any) => (
                <div key={cat.id}>
                  {editingCategory === cat.id ? (
                    <div className="p-2 flex items-center gap-2">
                      <Input
                        autoFocus
                        value={categoryName}
                        onChange={(e) => setCategoryName(e.target.value)}
                        onKeyDown={(e) => e.key === 'Enter' && handleUpdateCategory(cat.id)}
                        className="h-8 text-sm"
                      />
                      <Button size="sm" className="h-8 bg-[#002446] hover:bg-[#002446]/90 text-white" onClick={() => handleUpdateCategory(cat.id)} disabled={loading}>
                        {t('saveBtn')}
                      </Button>
                      <Button size="sm" variant="ghost" className="h-8" onClick={() => { setEditingCategory(null); setCategoryName(''); }} disabled={loading}>
                        {t('cancelBtn')}
                      </Button>
                    </div>
                  ) : (
                    <div
                      className={`group flex items-center justify-between p-2 rounded-md cursor-pointer transition-colors ${
                        selectedCategoryId === cat.id ? 'bg-[#002446]/10 text-[#002446] font-medium' : 'hover:bg-slate-100'
                      }`}
                      onClick={() => setSelectedCategoryId(cat.id)}
                    >
                      <span className="truncate pr-2" title={cat.name}>{cat.name}</span>
                      <div className="flex items-center gap-1">
                        <Badge variant="secondary" className="group-hover:hidden">{cat.questions?.length || 0}</Badge>
                        <div className="hidden group-hover:flex items-center space-x-1">
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-6 w-6 text-slate-500 hover:text-[#002446]"
                            onClick={(e) => { e.stopPropagation(); setEditingCategory(cat.id); setCategoryName(cat.name); }}
                            disabled={loading}
                          >
                            <Pencil className="w-3 h-3" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-6 w-6 text-slate-500 hover:text-red-600"
                            onClick={(e) => {
                              e.stopPropagation();
                              setCategoryToDelete({
                                id: cat.id,
                                name: cat.name,
                                count: cat.questions?.length || 0,
                              });
                            }}
                            disabled={loading}
                          >
                            <Trash2 className="w-3 h-3" />
                          </Button>
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              ))}

              <div
                className={`flex items-center justify-between p-2 rounded-md cursor-pointer transition-colors ${
                  selectedCategoryId === 'uncategorized' ? 'bg-[#002446]/10 text-[#002446] font-medium' : 'hover:bg-slate-100'
                }`}
                onClick={() => setSelectedCategoryId('uncategorized')}
              >
                <span className="truncate italic text-slate-600">{t('uncategorizedQuestions')}</span>
                <Badge variant="secondary">{uncategorizedQuestions.length}</Badge>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Right Main Area - Questions */}
        <div className="lg:col-span-3 space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white p-4 rounded-xl border shadow-sm">
            <div className="flex items-center gap-2">
              <BookOpen className="w-5 h-5 text-[#002446]" />
              <h2 className="font-semibold text-lg">
                {selectedCategoryId === null ? t('allQuestions') : selectedCategoryId === 'uncategorized' ? t('uncategorizedQuestions') : categories.find((c: any) => c.id === selectedCategoryId)?.name || t('defaultCategoryName')}
              </h2>
              <Badge className="ml-2 bg-[#002446]/10 text-[#002446] hover:bg-[#002446]/20 border-none">
                {t('questionsCount', { count: displayedQuestions.length })}
              </Badge>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <Button variant="outline" className="border-[#002446] text-[#002446] hover:bg-[#002446]/5 w-full sm:w-auto" onClick={() => setIsImportModalOpen(true)}>
                <FileUp className="w-4 h-4 mr-2" />
                {t('importQuestionsBtn')}
              </Button>
              <Button className="bg-[#FF8928] hover:bg-[#FF8928]/90 text-white border-none w-full sm:w-auto" onClick={openAddQuestion}>
                <Plus className="w-4 h-4 mr-2" />
                {t('addQuestionBtn')}
              </Button>
            </div>
          </div>

          <div className="grid gap-4">
            {displayedQuestions.length === 0 ? (
              <div className="text-center py-12 bg-white rounded-xl border border-dashed">
                <HelpCircle className="w-12 h-12 text-slate-300 mx-auto mb-3" />
                <h3 className="text-lg font-medium text-slate-900">{t('noQuestionsTitle')}</h3>
                <p className="text-slate-500 max-w-sm mx-auto mt-1">{t('noQuestionsDesc')}</p>
                <Button className="mt-4 bg-[#002446] hover:bg-[#002446]/90 text-white" onClick={openAddQuestion}>
                  <Plus className="w-4 h-4 mr-2" />
                  {t('addFirstQuestionBtn')}
                </Button>
              </div>
            ) : (
              displayedQuestions.map((q: any, idx: number) => (
                <Card key={q.id} className="overflow-hidden hover:shadow-md transition-shadow">
                  <div className="p-5 flex flex-col md:flex-row gap-4">
                    <div className="flex-grow space-y-3">
                      <div className="flex items-start justify-between">
                        <div className="flex items-center gap-2">
                          <span className="font-bold text-slate-400">#{idx + 1}</span>
                          <Badge
                            variant="outline"
                            className={
                              q.type === 'MULTIPLE_CHOICE'
                                ? 'border-blue-200 text-blue-700 bg-blue-50'
                                : q.type === 'MULTIPLE_CHOICE_COMPLEX'
                                ? 'border-indigo-200 text-indigo-700 bg-indigo-50 font-semibold'
                                : 'border-purple-200 text-purple-700 bg-purple-50'
                            }
                          >
                            {q.type === 'MULTIPLE_CHOICE'
                              ? t('typeMultipleChoice')
                              : q.type === 'MULTIPLE_CHOICE_COMPLEX'
                              ? t('typeComplex')
                              : t('typeEssay')}
                          </Badge>
                          <Badge variant="outline" className="border-amber-200 text-amber-700 bg-amber-50">
                            {t('points', { points: q.points })}
                          </Badge>
                          {q.text && (q.text.includes('quiz-media-audio') || /\[(?:Audio|Suara):/i.test(q.text)) && (
                            <Badge className="bg-indigo-100 text-indigo-800 border-indigo-300 text-xs flex items-center gap-1">
                              <Headphones className="w-3 h-3" /> {t('listeningBadge')}
                            </Badge>
                          )}
                          {q.text && (q.text.includes('quiz-media-video') || /\[(?:Video|YouTube):/i.test(q.text)) && (
                            <Badge className="bg-rose-100 text-rose-800 border-rose-300 text-xs flex items-center gap-1">
                              <Video className="w-3 h-3" /> {t('videoBadge')}
                            </Badge>
                          )}
                          {q.categoryId && (
                            <Badge variant="secondary" className="bg-slate-100">
                              {categories.find((c: any) => c.id === q.categoryId)?.name || t('defaultCategoryName')}
                            </Badge>
                          )}
                        </div>
                        <div className="flex items-center gap-1">
                          <Button variant="ghost" size="icon" className="h-8 w-8 text-slate-500 hover:text-[#002446] hover:bg-slate-100" onClick={() => openEditQuestion(q)} disabled={loading}>
                            <Pencil className="w-4 h-4" />
                          </Button>
                          <Button variant="ghost" size="icon" className="h-8 w-8 text-slate-500 hover:text-red-600 hover:bg-red-50" onClick={() => setQuestionToDelete(q.id)} disabled={loading}>
                            <Trash2 className="w-4 h-4" />
                          </Button>
                        </div>
                      </div>

                      <QuestionTextRenderer text={q.text} questionId={q.id} className="text-slate-800" />

                      {q.type === 'MULTIPLE_CHOICE' && q.options && (
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 mt-3">
                          {q.options.map((opt: any, optIdx: number) => (
                            <div key={opt.id || optIdx} className={`flex items-center gap-2 p-2 rounded-md border ${opt.isCorrect ? 'bg-green-50 border-green-200' : 'bg-slate-50 border-slate-100'}`}>
                              <span className={`flex items-center justify-center w-6 h-6 rounded-full text-xs font-bold ${opt.isCorrect ? 'bg-green-500 text-white' : 'bg-slate-200 text-slate-600'}`}>
                                {getOptionLetter(optIdx)}
                              </span>
                              <span className={`text-sm truncate ${opt.isCorrect ? 'text-green-800 font-medium' : 'text-slate-600'}`}>{opt.text}</span>
                              {opt.isCorrect && <CheckCircle2 className="w-4 h-4 text-green-500 ml-auto" />}
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>
                </Card>
              ))
            )}
          </div>
        </div>
      </div>

      {/* Add/Edit Question Modal */}
      <Dialog open={isQuestionModalOpen} onOpenChange={setIsQuestionModalOpen}>
        <DialogContent className="w-[95vw] sm:max-w-2xl max-h-[90vh] p-0 flex flex-col overflow-hidden bg-white shadow-2xl rounded-2xl border">
          <DialogHeader className="p-5 sm:p-6 pb-3 border-b border-gray-100 shrink-0 bg-white">
            <DialogTitle className="text-xl font-bold text-[#002446]">
              {editingQuestion ? t('editQuestionTitle') : t('addQuestionTitle')}
            </DialogTitle>
          </DialogHeader>

          <div className="p-5 sm:p-6 py-4 overflow-y-auto overflow-x-hidden flex-1 space-y-5">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label>{t('questionTypeLabel')}</Label>
                <Select value={questionType} onValueChange={(val: any) => setQuestionType(val)} disabled={!!editingQuestion || loading}>
                  <SelectTrigger>
                    <SelectValue placeholder={t('selectTypePlaceholder')} />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="MULTIPLE_CHOICE">{t('optMultipleChoice')}</SelectItem>
                    <SelectItem value="MULTIPLE_CHOICE_COMPLEX">{t('optComplex')}</SelectItem>
                    <SelectItem value="ESSAY">{t('optEssay')}</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label>{t('pointsLabel')}</Label>
                <Input type="number" min="1" value={questionPoints} onChange={(e) => setQuestionPoints(Number(e.target.value))} disabled={loading} />
              </div>
            </div>

            <div className="space-y-1.5">
              <Label>{t('questionPromptLabel')}</Label>
              <Textarea 
                placeholder={t('questionPromptPlaceholder')} 
                className="min-h-[100px] w-full" 
                value={questionText} 
                onChange={(e) => setQuestionText(e.target.value)} 
                disabled={loading}
              />
            </div>

            {/* Media Audio / Video Attachment */}
            <div className="p-3.5 rounded-xl border border-gray-200 bg-gray-50/70 space-y-3 min-w-0 overflow-hidden">
              <div className="flex items-center justify-between flex-wrap gap-2">
                <Label className="text-xs font-bold text-[#002446] flex items-center gap-1.5">
                  <Headphones className="w-3.5 h-3.5 text-[#FF8928]" />
                  {t('mediaHeader')}
                </Label>
                <div className="flex items-center gap-1">
                  <Button
                    type="button"
                    size="sm"
                    variant={mediaType === 'NONE' ? 'default' : 'outline'}
                    className={`h-7 text-xs ${mediaType === 'NONE' ? 'bg-[#002446] text-white' : 'text-gray-600'}`}
                    onClick={() => {
                      setMediaType('NONE');
                      setMediaUrl('');
                    }}
                  >
                    {t('noMedia')}
                  </Button>
                  <Button
                    type="button"
                    size="sm"
                    variant={mediaType === 'AUDIO' ? 'default' : 'outline'}
                    className={`h-7 text-xs ${mediaType === 'AUDIO' ? 'bg-indigo-600 text-white' : 'text-gray-600'}`}
                    onClick={() => setMediaType('AUDIO')}
                  >
                    <Headphones className="w-3.5 h-3.5 mr-1" /> {t('audioMedia')}
                  </Button>
                  <Button
                    type="button"
                    size="sm"
                    variant={mediaType === 'VIDEO' ? 'default' : 'outline'}
                    className={`h-7 text-xs ${mediaType === 'VIDEO' ? 'bg-rose-600 text-white' : 'text-gray-600'}`}
                    onClick={() => setMediaType('VIDEO')}
                  >
                    <Video className="w-3.5 h-3.5 mr-1" /> {t('videoMedia')}
                  </Button>
                </div>
              </div>

              {mediaType !== 'NONE' && (
                <div className="space-y-3 pt-2 border-t border-gray-200 min-w-0">
                  {/* Source Toggle */}
                  <div className="flex items-center gap-4 text-xs flex-wrap">
                    <span className="text-gray-500 font-medium">{t('sourceLabel')}</span>
                    <label className="flex items-center gap-1.5 cursor-pointer">
                      <input
                        type="radio"
                        name="qbMediaSource"
                        checked={mediaSourceType === 'UPLOAD'}
                        onChange={() => setMediaSourceType('UPLOAD')}
                        className="text-[#002446]"
                      />
                      <span>{t('uploadFileLabel', { types: mediaType === 'AUDIO' ? 'MP3/WAV' : 'MP4/WebM' })}</span>
                    </label>
                    <label className="flex items-center gap-1.5 cursor-pointer">
                      <input
                        type="radio"
                        name="qbMediaSource"
                        checked={mediaSourceType === 'URL'}
                        onChange={() => setMediaSourceType('URL')}
                        className="text-[#002446]"
                      />
                      <span>{t('urlLinkLabel', { suffix: mediaType === 'VIDEO' ? '/ YouTube' : '' })}</span>
                    </label>
                  </div>

                  {/* Input Source */}
                  {mediaSourceType === 'UPLOAD' ? (
                    <div className="flex items-center gap-2">
                      <Input
                        type="file"
                        accept={mediaType === 'AUDIO' ? 'audio/*' : 'video/*'}
                        onChange={handleUploadMediaFile}
                        disabled={isUploadingMedia || loading}
                        className="text-xs bg-white"
                      />
                      {isUploadingMedia && <span className="text-xs text-amber-600 font-medium animate-pulse shrink-0">{t('uploadingMedia')}</span>}
                    </div>
                  ) : (
                    <Input
                      type="url"
                      placeholder={mediaType === 'AUDIO' ? t('audioPlaceholder') : t('videoPlaceholder')}
                      value={mediaUrl}
                      onChange={(e) => setMediaUrl(e.target.value)}
                      className="text-xs bg-white w-full"
                    />
                  )}

                  {mediaUrl && (
                    <div className="text-xs text-emerald-700 bg-emerald-50 p-2 rounded-lg border border-emerald-200 flex items-center justify-between gap-2 min-w-0 overflow-hidden">
                      <span className="truncate min-w-0 flex-1">
                        {t('activeMediaLabel')} <strong className="font-mono text-[11px] break-all">{mediaUrl}</strong>
                      </span>
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        onClick={() => setMediaUrl('')}
                        className="h-6 px-2 text-[10px] text-red-600 hover:bg-red-100 shrink-0"
                      >
                        {t('removeMedia')}
                      </Button>
                    </div>
                  )}

                  {/* Batas Pemutaran Siswa (Audio / Video) */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
                    <div>
                      <Label className="text-xs text-gray-600">
                        {mediaType === 'AUDIO' ? t('mediaQuotaAudio') : t('mediaQuotaVideo')}
                      </Label>
                      <select
                        value={mediaMaxPlay}
                        onChange={(e) => setMediaMaxPlay(e.target.value)}
                        className="w-full mt-1 h-9 rounded-md border border-gray-300 px-3 text-xs bg-white focus:ring-2 focus:ring-[#002446]"
                      >
                        <option value="unlimited">{t('quotaUnlimited')}</option>
                        <option value="1">{t('quota1')}</option>
                        <option value="2">{t('quota2')}</option>
                        <option value="3">{t('quota3')}</option>
                      </select>
                    </div>
                    <p className="text-[11px] text-gray-500 self-end pb-1">
                      {mediaType === 'AUDIO'
                        ? t('quotaNoteAudio')
                        : t('quotaNoteVideo')}
                    </p>
                  </div>
                </div>
              )}
            </div>

            {(questionType === 'MULTIPLE_CHOICE' || questionType === 'MULTIPLE_CHOICE_COMPLEX') && (
              <div className="space-y-3 pt-1">
                <div className="flex items-center justify-between">
                  <div>
                    <Label className="text-xs font-bold text-[#002446]">
                      {questionType === 'MULTIPLE_CHOICE_COMPLEX'
                        ? t('optionsLabelComplex')
                        : t('optionsLabelSingle')}
                    </Label>
                    <p className="text-[11px] text-gray-500 mt-0.5">
                      {questionType === 'MULTIPLE_CHOICE_COMPLEX'
                        ? t('optionsNoteComplex')
                        : t('optionsNoteSingle')}
                    </p>
                  </div>
                  <Button type="button" variant="outline" size="sm" onClick={handleAddOption} disabled={loading} className="text-xs h-8">
                    <Plus className="w-3.5 h-3.5 mr-1 text-[#FF8928]" /> {t('addOptionBtn', { letter: getOptionLetter(questionOptions.length) })}
                  </Button>
                </div>
                <div className="space-y-2">
                  {questionOptions.map((opt, idx) => (
                    <div
                      key={idx}
                      className={`flex items-center gap-2.5 p-2 rounded-lg border transition-all ${
                        opt.isCorrect
                          ? questionType === 'MULTIPLE_CHOICE_COMPLEX'
                            ? 'bg-indigo-50/70 border-indigo-300 shadow-xs'
                            : 'bg-emerald-50/70 border-emerald-300 shadow-xs'
                          : 'bg-white border-gray-200 hover:border-gray-300'
                      }`}
                    >
                      <label className="flex items-center gap-2 cursor-pointer select-none shrink-0">
                        {questionType === 'MULTIPLE_CHOICE_COMPLEX' ? (
                          <input
                            type="checkbox"
                            checked={opt.isCorrect}
                            onChange={() => handleCorrectOptionChange(idx)}
                            className="w-4 h-4 text-indigo-600 focus:ring-indigo-500 rounded cursor-pointer"
                            disabled={loading}
                          />
                        ) : (
                          <input
                            type="radio"
                            name="correctOption"
                            checked={opt.isCorrect}
                            onChange={() => handleCorrectOptionChange(idx)}
                            className="w-4 h-4 text-emerald-600 focus:ring-emerald-500 cursor-pointer"
                            disabled={loading}
                          />
                        )}
                        <span
                          className={`flex items-center justify-center w-7 h-7 ${
                            questionType === 'MULTIPLE_CHOICE_COMPLEX' ? 'rounded-md' : 'rounded-full'
                          } text-xs font-bold transition-colors ${
                            opt.isCorrect
                              ? questionType === 'MULTIPLE_CHOICE_COMPLEX'
                                ? 'bg-indigo-600 text-white shadow-xs'
                                : 'bg-emerald-600 text-white shadow-xs'
                              : 'bg-gray-100 text-gray-700'
                          }`}
                        >
                          {getOptionLetter(idx)}
                        </span>
                      </label>

                      <Input
                        value={opt.text}
                        onChange={(e) => handleOptionChange(idx, e.target.value)}
                        placeholder={t('optionPlaceholder', { letter: getOptionLetter(idx) })}
                        disabled={loading}
                        className={`flex-1 bg-white text-sm ${
                          opt.isCorrect
                            ? questionType === 'MULTIPLE_CHOICE_COMPLEX'
                              ? 'border-indigo-300 focus-visible:ring-indigo-500'
                              : 'border-emerald-300 focus-visible:ring-emerald-500'
                            : ''
                        }`}
                      />

                      {opt.isCorrect && (
                        <span className={`text-[11px] font-semibold px-2 py-1 rounded hidden sm:inline whitespace-nowrap shrink-0 ${
                          questionType === 'MULTIPLE_CHOICE_COMPLEX'
                            ? 'text-indigo-700 bg-indigo-100/80'
                            : 'text-emerald-700 bg-emerald-100/80'
                        }`}>
                          ✓ {t('correctKey')}
                        </span>
                      )}

                      {questionOptions.length > 2 && (
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          className="h-8 w-8 p-0 text-gray-400 hover:text-red-600 hover:bg-red-50 shrink-0"
                          onClick={() => handleRemoveOption(idx)}
                          disabled={loading}
                          title={t('deleteOptionTitle', { letter: getOptionLetter(idx) })}
                        >
                          <Trash2 className="w-4 h-4" />
                        </Button>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
          <DialogFooter className="p-4 sm:px-6 border-t border-gray-100 bg-gray-50/90 shrink-0 flex items-center justify-end gap-2.5">
            <Button variant="outline" onClick={() => setIsQuestionModalOpen(false)} disabled={loading}>
              {t('cancelBtn')}
            </Button>
            <Button className="bg-[#002446] hover:bg-[#002446]/90 text-white font-medium" onClick={handleSaveQuestion} disabled={loading}>
              {loading ? t('savingQuestion') : t('saveQuestion')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Import Modal */}
      <Dialog open={isImportModalOpen} onOpenChange={setIsImportModalOpen}>
        <DialogContent className="w-[95vw] sm:max-w-3xl max-h-[92vh] p-0 flex flex-col overflow-hidden bg-white shadow-2xl rounded-2xl border">
          <DialogHeader className="p-5 sm:p-6 pb-3 border-b border-gray-100 shrink-0 bg-white">
            <div className="flex items-center justify-between">
              <div>
                <DialogTitle className="text-xl font-bold text-[#002446]">{t('importModalTitle')}</DialogTitle>
                <DialogDescription className="text-xs text-gray-500 mt-1">
                  {t('importModalDesc')}
                </DialogDescription>
              </div>
            </div>
            {/* Tabs Header */}
            <div className="flex gap-2 pt-3 border-t border-gray-100 mt-3">
              <button
                type="button"
                onClick={() => {
                  setImportTab('aiken');
                  setImportPreview([]);
                  setImportWarnings([]);
                }}
                className={`px-4 py-2 text-xs font-semibold rounded-lg transition-all flex items-center gap-1.5 ${
                  importTab === 'aiken'
                    ? 'bg-[#002446] text-white shadow-xs'
                    : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                }`}
              >
                <span>{t('tabAiken')}</span>
                <span className="bg-[#FF8928] text-white text-[10px] px-1.5 py-0.2 rounded font-bold">{t('badgePopular')}</span>
              </button>
              <button
                type="button"
                onClick={() => {
                  setImportTab('word');
                  setImportPreview([]);
                  setImportWarnings([]);
                }}
                className={`px-4 py-2 text-xs font-semibold rounded-lg transition-all flex items-center gap-1.5 ${
                  importTab === 'word'
                    ? 'bg-[#002446] text-white shadow-xs'
                    : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                }`}
              >
                <span>{t('tabWord')}</span>
              </button>
            </div>
          </DialogHeader>

          <div className="p-5 sm:p-6 py-4 overflow-y-auto overflow-x-hidden flex-1 space-y-4">
            {importTab === 'aiken' ? (
              <div className="space-y-4">
                {/* Aiken Mode Toggle */}
                <div className="flex items-center justify-between bg-slate-50 p-2.5 rounded-xl border border-slate-200">
                  <div className="flex gap-2">
                    <Button
                      type="button"
                      size="sm"
                      variant={aikenMode === 'paste' ? 'default' : 'ghost'}
                      className={`text-xs h-8 ${aikenMode === 'paste' ? 'bg-[#002446] text-white' : 'text-gray-600'}`}
                      onClick={() => setAikenMode('paste')}
                    >
                      {t('modePaste')}
                    </Button>
                    <Button
                      type="button"
                      size="sm"
                      variant={aikenMode === 'file' ? 'default' : 'ghost'}
                      className={`text-xs h-8 ${aikenMode === 'file' ? 'bg-[#002446] text-white' : 'text-gray-600'}`}
                      onClick={() => setAikenMode('file')}
                    >
                      {t('modeFile')}
                    </Button>
                  </div>
                  {aikenMode === 'paste' && (
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={handleLoadAikenSample}
                      className="text-xs h-8 text-[#FF8928] border-[#FF8928]/30 hover:bg-[#FF8928]/10"
                    >
                      {t('loadSample')}
                    </Button>
                  )}
                </div>

                {aikenMode === 'paste' ? (
                  <div className="space-y-2">
                    <Label className="text-xs font-semibold text-gray-700">
                      {t('aikenTextLabel')}
                    </Label>
                    <Textarea
                      rows={9}
                      placeholder={t('aikenTextPlaceholder')}
                      value={aikenText}
                      onChange={(e) => setAikenText(e.target.value)}
                      className="font-mono text-xs leading-relaxed bg-white"
                      disabled={loading}
                    />
                    <div className="flex justify-end pt-1">
                      <Button
                        type="button"
                        className="bg-[#FF8928] hover:bg-[#FF8928]/90 text-white text-xs font-semibold h-9"
                        onClick={handleParseAiken}
                        disabled={loading || !aikenText.trim()}
                      >
                        {loading ? t('processing') : t('previewAikenBtn')}
                      </Button>
                    </div>
                  </div>
                ) : (
                  <div className="border-2 border-dashed border-slate-200 rounded-xl p-6 text-center space-y-3">
                    <FileUp className="w-9 h-9 text-slate-300 mx-auto" />
                    <p className="text-xs text-slate-600">
                      {t('aikenUploadPrompt')}
                    </p>
                    <Input
                      type="file"
                      accept=".txt,.aiken"
                      className="max-w-xs mx-auto text-xs"
                      onChange={(e) => setAikenFile(e.target.files?.[0] || null)}
                      disabled={loading}
                    />
                    {aikenFile && (
                      <Button
                        type="button"
                        className="mt-2 bg-[#FF8928] hover:bg-[#FF8928]/90 text-white text-xs font-semibold h-9"
                        onClick={handleParseAiken}
                        disabled={loading}
                      >
                        {loading ? t('processing') : t('previewFileAikenBtn')}
                      </Button>
                    )}
                  </div>
                )}
              </div>
            ) : (
              /* Word .docx Tab */
              <div className="border-2 border-dashed border-slate-200 rounded-xl p-6 text-center space-y-4">
                <div className="flex flex-col items-center justify-center">
                  <FileUp className="w-10 h-10 text-slate-300 mb-2" />
                  <p className="text-sm text-slate-600">{t('wordUploadPrompt')}</p>
                </div>

                <div className="p-3.5 bg-blue-50/90 border border-blue-200 rounded-lg flex flex-col sm:flex-row items-center justify-between gap-3 text-left">
                  <div className="text-xs text-slate-700">
                    <p className="font-bold text-[#002446]">{t('noTemplateTitle')}</p>
                    <p className="text-slate-500 mt-0.5">{t('noTemplateDesc')}</p>
                  </div>
                  <a
                    href="/api/quiz-import/template"
                    download="template-soal-kuis.docx"
                    className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-semibold rounded-md bg-[#002446] text-white hover:bg-[#002446]/90 transition-colors shrink-0 shadow-xs"
                  >
                    <FileDown className="w-4 h-4 text-[#FF8928]" />
                    {t('downloadTemplateBtn')}
                  </a>
                </div>

                <div className="pt-2">
                  <Input
                    type="file"
                    accept=".docx"
                    className="max-w-xs mx-auto text-xs"
                    onChange={(e) => setImportFile(e.target.files?.[0] || null)}
                    disabled={loading || importPreview.length > 0}
                  />
                </div>

                {importFile && importPreview.length === 0 && (
                  <Button className="mt-2 bg-[#FF8928] hover:bg-[#FF8928]/90 text-white text-xs font-semibold h-9" onClick={handleUploadWord} disabled={loading}>
                    {loading ? t('processing') : t('previewWordBtn')}
                  </Button>
                )}
              </div>
            )}

            {importWarnings.length > 0 && (
              <div className="p-3 bg-amber-50 border border-amber-200 rounded-lg text-xs text-amber-800 space-y-1">
                <p className="font-semibold flex items-center gap-1">
                  <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0" />
                  {t('importNotes', { count: importWarnings.length })}
                </p>
                <ul className="list-disc pl-5 space-y-0.5 max-h-28 overflow-y-auto">
                  {importWarnings.map((w, idx) => (
                    <li key={idx}>{w}</li>
                  ))}
                </ul>
              </div>
            )}

            {importPreview.length > 0 && (
              <div className="space-y-3 mt-4 pt-3 border-t">
                <div className="flex items-center justify-between">
                  <h3 className="font-semibold text-base flex items-center gap-2 text-[#002446]">
                    <Database className="w-5 h-5 text-[#FF8928]" />
                    {t('previewResultTitle', { count: importPreview.length })}
                  </h3>
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    className="text-xs text-red-600 hover:bg-red-50 h-7"
                    onClick={() => {
                      setImportPreview([]);
                      setImportWarnings([]);
                    }}
                  >
                    {t('clearPreview')}
                  </Button>
                </div>

                <div className="border rounded-md max-h-[300px] overflow-y-auto bg-slate-50 p-2 space-y-2">
                  {importPreview.map((q, i) => {
                    const correctOptions = (q.options || []).filter((o: any) => o.isCorrect);
                    const correctLabels = correctOptions.map((o: any) => o.id || o.text).join(', ');
                    return (
                      <div key={i} className="p-3 bg-white border rounded shadow-xs text-sm space-y-1.5">
                        <div className="flex items-center gap-2">
                          <span className="font-bold text-xs text-slate-400">#{i + 1}</span>
                          <Badge
                            variant="outline"
                            className={
                              q.type === 'MULTIPLE_CHOICE'
                                ? 'border-blue-200 text-blue-700 bg-blue-50 text-[11px]'
                                : q.type === 'MULTIPLE_CHOICE_COMPLEX'
                                ? 'border-indigo-200 text-indigo-700 bg-indigo-50 text-[11px] font-semibold'
                                : 'border-purple-200 text-purple-700 bg-purple-50 text-[11px]'
                            }
                          >
                            {q.type === 'MULTIPLE_CHOICE'
                              ? t('typeSingleShort')
                              : q.type === 'MULTIPLE_CHOICE_COMPLEX'
                              ? t('typeComplex')
                              : t('typeEssay')}
                          </Badge>
                          <Badge variant="outline" className="border-amber-200 text-amber-700 bg-amber-50 text-[11px]">
                            {t('points', { points: q.points })}
                          </Badge>
                        </div>
                        <div
                          className="font-medium text-xs text-slate-800 line-clamp-3 whitespace-pre-line"
                          dangerouslySetInnerHTML={{ __html: q.text }}
                        />
                        {q.options && q.options.length > 0 && (
                          <div className="text-[11px] text-slate-500 pt-1 border-t border-slate-100 flex items-center justify-between">
                            <span>{t('optionsCount', { count: q.options.length })}</span>
                            <span className="font-medium text-emerald-700">
                              {t('correctAnswerLabel', { key: correctLabels || t('none') })}
                            </span>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
          </div>

          <DialogFooter className="p-4 sm:px-6 border-t border-gray-100 bg-gray-50/90 shrink-0 flex items-center justify-end gap-2.5">
            <Button
              variant="outline"
              onClick={() => {
                setIsImportModalOpen(false);
                setImportPreview([]);
                setImportWarnings([]);
                setImportFile(null);
                setAikenFile(null);
              }}
              disabled={loading}
            >
              {t('cancelBtn')}
            </Button>
            <Button
              className="bg-[#002446] hover:bg-[#002446]/90 text-white font-medium"
              onClick={handleConfirmImport}
              disabled={loading || importPreview.length === 0}
            >
              {loading ? t('importing') : t('confirmImportBtn', { count: importPreview.length })}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Modal Konfirmasi Hapus Kategori */}
      <Dialog open={Boolean(categoryToDelete)} onOpenChange={(open) => !open && setCategoryToDelete(null)}>
        <DialogContent className="max-w-md p-6 bg-white border border-gray-200">
          <DialogHeader className="space-y-3 text-center sm:text-center">
            <div className="mx-auto w-12 h-12 rounded-full bg-red-100 flex items-center justify-center text-red-600">
              <Trash2 className="w-6 h-6" />
            </div>
            <DialogTitle className="text-xl font-bold text-[#002446]">
              {t('deleteCategoryTitle')}
            </DialogTitle>
            <DialogDescription className="text-sm text-gray-600 leading-relaxed">
              {t('deleteCategoryConfirm', { name: categoryToDelete?.name || '' })}
            </DialogDescription>
          </DialogHeader>

          <div className="p-3 bg-amber-50 border border-amber-200 rounded-lg text-xs text-amber-800 flex items-start gap-2 text-left">
            <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5 text-amber-600" />
            <div>
              <strong>{t('infoQuestionTitle')}</strong>
              <p className="mt-0.5">
                {t('deleteCategoryNote', { count: categoryToDelete?.count || 0 })}
              </p>
            </div>
          </div>

          <DialogFooter className="flex-col sm:flex-row gap-2 pt-2">
            <Button
              type="button"
              variant="outline"
              disabled={loading}
              onClick={() => setCategoryToDelete(null)}
              className="w-full sm:w-1/2"
            >
              {t('cancelBtn')}
            </Button>
            <Button
              type="button"
              disabled={loading}
              onClick={confirmDeleteCategory}
              className="w-full sm:w-1/2 bg-red-600 hover:bg-red-700 text-white font-bold"
            >
              {loading ? t('deleting') : t('deleteCategoryBtn')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Modal Konfirmasi Hapus Butir Soal */}
      <Dialog open={Boolean(questionToDelete)} onOpenChange={(open) => !open && setQuestionToDelete(null)}>
        <DialogContent className="max-w-md p-6 bg-white border border-gray-200">
          <DialogHeader className="space-y-3 text-center sm:text-center">
            <div className="mx-auto w-12 h-12 rounded-full bg-red-100 flex items-center justify-center text-red-600">
              <Trash2 className="w-6 h-6" />
            </div>
            <DialogTitle className="text-xl font-bold text-[#002446]">
              {t('deleteQuestionTitle')}
            </DialogTitle>
            <DialogDescription className="text-sm text-gray-600 leading-relaxed">
              {t('deleteQuestionConfirm')}
            </DialogDescription>
          </DialogHeader>

          <DialogFooter className="flex-col sm:flex-row gap-2 pt-2">
            <Button
              type="button"
              variant="outline"
              disabled={loading}
              onClick={() => setQuestionToDelete(null)}
              className="w-full sm:w-1/2"
            >
              {t('cancelBtn')}
            </Button>
            <Button
              type="button"
              disabled={loading}
              onClick={confirmDeleteQuestion}
              className="w-full sm:w-1/2 bg-red-600 hover:bg-red-700 text-white font-bold"
            >
              {loading ? t('deleting') : t('deleteQuestionBtn')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Notice / Alert Dialog Modal */}
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
              {t('closeBtn')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
