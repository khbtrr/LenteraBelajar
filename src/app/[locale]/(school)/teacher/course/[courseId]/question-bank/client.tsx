'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Link } from '@/i18n/navigation';
import { ArrowLeft, Plus, Trash2, Pencil, FileUp, FileDown, HelpCircle, BookOpen, Search, CheckCircle2, AlertTriangle, Database, AlertCircle } from 'lucide-react';
import {
  createQuestionBankCategory,
  updateQuestionBankCategory,
  deleteQuestionBankCategory,
  addQuestionToBank,
  updateBankQuestion,
  deleteBankQuestion,
  bulkAddQuestionsToBank,
} from '@/lib/actions/question-bank';

type Option = { id?: string; text: string; isCorrect: boolean };
type Question = {
  id: string;
  text: string;
  type: 'MULTIPLE_CHOICE' | 'ESSAY';
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
  const [questionType, setQuestionType] = useState<'MULTIPLE_CHOICE' | 'ESSAY'>('MULTIPLE_CHOICE');
  const [questionText, setQuestionText] = useState('');
  const [questionPoints, setQuestionPoints] = useState<number>(10);
  const [questionOptions, setQuestionOptions] = useState<Option[]>([
    { id: 'A', text: '', isCorrect: true },
    { id: 'B', text: '', isCorrect: false },
  ]);

  // Import Modal States
  const [isImportModalOpen, setIsImportModalOpen] = useState(false);
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
        title: 'Gagal Menambahkan Kategori',
        message: e?.message || 'Terjadi kesalahan saat menambahkan kategori.',
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
        title: 'Gagal Memperbarui Kategori',
        message: e?.message || 'Terjadi kesalahan saat memperbarui kategori.',
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
        title: 'Gagal Menghapus Kategori',
        message: e?.message || 'Terjadi kesalahan saat menghapus kategori.',
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
    setIsQuestionModalOpen(true);
  };

  const openEditQuestion = (q: Question) => {
    setEditingQuestion(q);
    setQuestionType(q.type);
    setQuestionText(q.text);
    setQuestionPoints(q.points);
    if (q.type === 'MULTIPLE_CHOICE' && q.options) {
      setQuestionOptions(q.options);
    } else {
      setQuestionOptions([{ text: '', isCorrect: true }, { text: '', isCorrect: false }]);
    }
    setIsQuestionModalOpen(true);
  };

  const handleSaveQuestion = async () => {
    if (!questionText.trim()) return;
    setLoading(true);
    try {
      const data = {
        text: questionText,
        type: questionType,
        points: questionPoints,
        categoryId: selectedCategoryId === 'uncategorized' ? null : selectedCategoryId,
        options: questionType === 'MULTIPLE_CHOICE' 
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
        title: 'Gagal Menyimpan Soal',
        message: e?.message || 'Terjadi kesalahan saat menyimpan butir soal.',
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
        title: 'Gagal Menghapus Soal',
        message: e?.message || 'Terjadi kesalahan saat menghapus butir soal.',
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
    const newOptions = questionOptions.map((opt, i) => ({
      ...opt,
      isCorrect: i === index,
    }));
    setQuestionOptions(newOptions);
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
          title: 'Gagal Memproses File',
          message: data.error || 'Terjadi kesalahan saat memproses file dokumen Word.',
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
          title: 'Soal Tidak Ditemukan',
          message: 'Tidak ada butir soal yang berhasil terbaca dari dokumen. Pastikan penulisan nomor soal diawali angka dan titik (misal: 1. Pertanyaan...)',
          type: 'warning',
        });
      }
    } catch (e: any) {
      console.error(e);
      setNoticeModal({
        title: 'Kesalahan Sistem',
        message: e?.message || 'Terjadi kesalahan saat mengunggah dan memproses file.',
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
    <div className="container mx-auto p-4 md:p-6 space-y-6">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <Button variant="ghost" size="sm" asChild className="mb-2 -ml-3 text-muted-foreground hover:text-foreground">
            <Link href={`/teacher/course/${courseId}/modules`}>
              <ArrowLeft className="w-4 h-4 mr-2" />
              Kembali ke Modul
            </Link>
          </Button>
          <div className="flex items-center gap-3">
            <div className="p-3 bg-[#002446] text-white rounded-xl">
              <Database className="w-6 h-6" />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-[#002446]">Bank Soal</h1>
              <p className="text-muted-foreground">{course.title}</p>
            </div>
          </div>
        </div>
        <div className="flex gap-4">
          <Card className="bg-slate-50">
            <CardContent className="p-4 flex gap-6">
              <div className="text-center">
                <p className="text-2xl font-bold text-[#002446]">{allQuestions.length}</p>
                <p className="text-xs text-muted-foreground uppercase tracking-wider">Total Soal</p>
              </div>
              <div className="text-center">
                <p className="text-2xl font-bold text-[#FF8928]">
                  {categories.reduce((acc: number, c: any) => acc + (c.questions?.length || 0), 0)}
                </p>
                <p className="text-xs text-muted-foreground uppercase tracking-wider">Berkategori</p>
              </div>
              <div className="text-center">
                <p className="text-2xl font-bold text-slate-400">{uncategorizedQuestions.length}</p>
                <p className="text-xs text-muted-foreground uppercase tracking-wider">Belum Kategori</p>
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
                Kategori
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
                <span className="truncate">Semua Soal</span>
                <Badge variant="secondary">{initialStats?.total || 0}</Badge>
              </div>

              {isAddingCategory && (
                <div className="p-2 flex items-center gap-2">
                  <Input
                    autoFocus
                    placeholder="Nama kategori..."
                    value={categoryName}
                    onChange={(e) => setCategoryName(e.target.value)}
                    onKeyDown={(e) => e.key === 'Enter' && handleAddCategory()}
                    className="h-8 text-sm"
                  />
                  <Button size="sm" className="h-8 bg-[#002446] hover:bg-[#002446]/90 text-white" onClick={handleAddCategory} disabled={loading}>
                    Simpan
                  </Button>
                  <Button size="sm" variant="ghost" className="h-8" onClick={() => { setIsAddingCategory(false); setCategoryName(''); }} disabled={loading}>
                    Batal
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
                        Simpan
                      </Button>
                      <Button size="sm" variant="ghost" className="h-8" onClick={() => { setEditingCategory(null); setCategoryName(''); }} disabled={loading}>
                        Batal
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
                <span className="truncate italic text-slate-600">Belum Berkategori</span>
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
                {selectedCategoryId === null ? 'Semua Soal' : selectedCategoryId === 'uncategorized' ? 'Belum Berkategori' : categories.find((c: any) => c.id === selectedCategoryId)?.name || 'Kategori'}
              </h2>
              <Badge className="ml-2 bg-[#002446]/10 text-[#002446] hover:bg-[#002446]/20 border-none">
                {displayedQuestions.length} Soal
              </Badge>
            </div>
            <div className="flex items-center gap-2">
              <Button variant="outline" className="border-[#002446] text-[#002446] hover:bg-[#002446]/5" onClick={() => setIsImportModalOpen(true)}>
                <FileUp className="w-4 h-4 mr-2" />
                Impor dari Word
              </Button>
              <Button className="bg-[#FF8928] hover:bg-[#FF8928]/90 text-white border-none" onClick={openAddQuestion}>
                <Plus className="w-4 h-4 mr-2" />
                Tambah Soal
              </Button>
            </div>
          </div>

          <div className="grid gap-4">
            {displayedQuestions.length === 0 ? (
              <div className="text-center py-12 bg-white rounded-xl border border-dashed">
                <HelpCircle className="w-12 h-12 text-slate-300 mx-auto mb-3" />
                <h3 className="text-lg font-medium text-slate-900">Belum ada soal</h3>
                <p className="text-slate-500 max-w-sm mx-auto mt-1">Tambahkan soal baru atau impor dari file Word untuk mulai mengisi bank soal ini.</p>
                <Button className="mt-4 bg-[#002446] hover:bg-[#002446]/90 text-white" onClick={openAddQuestion}>
                  <Plus className="w-4 h-4 mr-2" />
                  Tambah Soal Pertama
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
                          <Badge variant="outline" className={q.type === 'MULTIPLE_CHOICE' ? 'border-blue-200 text-blue-700 bg-blue-50' : 'border-purple-200 text-purple-700 bg-purple-50'}>
                            {q.type === 'MULTIPLE_CHOICE' ? 'Pilihan Ganda' : 'Essay'}
                          </Badge>
                          <Badge variant="outline" className="border-amber-200 text-amber-700 bg-amber-50">
                            {q.points} Poin
                          </Badge>
                          {q.categoryId && (
                            <Badge variant="secondary" className="bg-slate-100">
                              {categories.find((c: any) => c.id === q.categoryId)?.name || 'Kategori'}
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

                      <div className="text-slate-800 line-clamp-2" dangerouslySetInnerHTML={{ __html: q.text }} />

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
        <DialogContent className="sm:max-w-[700px] max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="text-xl font-bold text-[#002446]">
              {editingQuestion ? 'Edit Soal' : 'Tambah Soal Baru'}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-6 py-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Tipe Soal</Label>
                <Select value={questionType} onValueChange={(val: any) => setQuestionType(val)} disabled={!!editingQuestion || loading}>
                  <SelectTrigger>
                    <SelectValue placeholder="Pilih tipe" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="MULTIPLE_CHOICE">Pilihan Ganda</SelectItem>
                    <SelectItem value="ESSAY">Essay</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Poin</Label>
                <Input type="number" min="1" value={questionPoints} onChange={(e) => setQuestionPoints(Number(e.target.value))} disabled={loading} />
              </div>
            </div>

            <div className="space-y-2">
              <Label>Pertanyaan</Label>
              <Textarea 
                placeholder="Tuliskan pertanyaan Anda di sini..." 
                className="min-h-[120px]" 
                value={questionText} 
                onChange={(e) => setQuestionText(e.target.value)} 
                disabled={loading}
              />
            </div>

            {questionType === 'MULTIPLE_CHOICE' && (
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <Label>Opsi Jawaban</Label>
                  <Button type="button" variant="outline" size="sm" onClick={handleAddOption} disabled={loading}>
                    <Plus className="w-3 h-3 mr-1" /> Tambah Opsi
                  </Button>
                </div>
                <div className="space-y-3">
                  {questionOptions.map((opt, idx) => (
                    <div key={idx} className="flex items-start gap-3">
                      <div className="pt-2">
                        <input
                          type="radio"
                          name="correctOption"
                          checked={opt.isCorrect}
                          onChange={() => handleCorrectOptionChange(idx)}
                          className="w-4 h-4 text-[#002446] focus:ring-[#002446] mt-1"
                          disabled={loading}
                        />
                      </div>
                      <div className="flex-grow flex items-center gap-2">
                        <div className="flex items-center justify-center w-8 h-8 rounded bg-slate-100 text-slate-600 font-bold flex-shrink-0">
                          {getOptionLetter(idx)}
                        </div>
                        <Input
                          value={opt.text}
                          onChange={(e) => handleOptionChange(idx, e.target.value)}
                          placeholder={`Opsi ${getOptionLetter(idx)}`}
                          disabled={loading}
                        />
                      </div>
                      {questionOptions.length > 2 && (
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          className="text-red-500 hover:text-red-700 hover:bg-red-50"
                          onClick={() => handleRemoveOption(idx)}
                          disabled={loading}
                        >
                          <Trash2 className="w-4 h-4" />
                        </Button>
                      )}
                    </div>
                  ))}
                </div>
                <p className="text-sm text-slate-500">Pilih radio button untuk menandai jawaban yang benar.</p>
              </div>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsQuestionModalOpen(false)} disabled={loading}>Batal</Button>
            <Button className="bg-[#002446] hover:bg-[#002446]/90 text-white" onClick={handleSaveQuestion} disabled={loading}>
              {loading ? 'Menyimpan...' : 'Simpan Soal'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Import Modal */}
      <Dialog open={isImportModalOpen} onOpenChange={setIsImportModalOpen}>
        <DialogContent className="sm:max-w-[700px] max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="text-xl font-bold text-[#002446]">Impor Soal dari Word</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="border-2 border-dashed border-slate-200 rounded-xl p-6 text-center space-y-4">
              <div className="flex flex-col items-center justify-center">
                <FileUp className="w-10 h-10 text-slate-300 mb-2" />
                <p className="text-sm text-slate-600">Unggah file Microsoft Word (.docx) dengan format yang sesuai.</p>
              </div>

              {/* Template Download Banner */}
              <div className="p-3.5 bg-blue-50/90 border border-blue-200 rounded-lg flex flex-col sm:flex-row items-center justify-between gap-3 text-left">
                <div className="text-xs text-slate-700">
                  <p className="font-bold text-[#002446]">Belum punya format Word yang sesuai?</p>
                  <p className="text-slate-500 mt-0.5">Unduh template acuan kami dan edit langsung soal Anda di dalamnya.</p>
                </div>
                <a
                  href="/api/quiz-import/template"
                  download="template-soal-kuis.docx"
                  className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-semibold rounded-md bg-[#002446] text-white hover:bg-[#002446]/90 transition-colors shrink-0 shadow-xs"
                >
                  <FileDown className="w-4 h-4 text-[#FF8928]" />
                  Unduh Template (.docx)
                </a>
              </div>

              <div className="pt-2">
                <Input
                  type="file"
                  accept=".docx"
                  className="max-w-xs mx-auto"
                  onChange={(e) => setImportFile(e.target.files?.[0] || null)}
                  disabled={loading || importPreview.length > 0}
                />
              </div>

              {importFile && importPreview.length === 0 && (
                <Button className="mt-2 bg-[#FF8928] hover:bg-[#FF8928]/90 text-white" onClick={handleUploadWord} disabled={loading}>
                  {loading ? 'Memproses...' : 'Pratinjau Impor'}
                </Button>
              )}
            </div>

            {importWarnings.length > 0 && (
              <div className="p-3 bg-amber-50 border border-amber-200 rounded-lg text-xs text-amber-800 space-y-1">
                <p className="font-semibold flex items-center gap-1">
                  <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0" />
                  Catatan Format Impor:
                </p>
                <ul className="list-disc pl-5 space-y-0.5">
                  {importWarnings.map((w, idx) => (
                    <li key={idx}>{w}</li>
                  ))}
                </ul>
              </div>
            )}

            {importPreview.length > 0 && (
              <div className="space-y-3 mt-6">
                <h3 className="font-semibold text-lg flex items-center gap-2">
                  <Database className="w-5 h-5 text-[#002446]" />
                  Pratinjau Hasil Impor ({importPreview.length} Soal)
                </h3>
                <div className="border rounded-md max-h-[300px] overflow-y-auto bg-slate-50 p-2 space-y-2">
                  {importPreview.map((q, i) => (
                    <div key={i} className="p-3 bg-white border rounded shadow-sm text-sm">
                      <div className="flex gap-2 mb-1">
                        <Badge variant="outline">{q.type === 'MULTIPLE_CHOICE' ? 'PG' : 'Essay'}</Badge>
                        <Badge variant="outline">{q.points} Poin</Badge>
                      </div>
                      <div
                        className="font-medium line-clamp-3 [&_img]:max-h-24 [&_img]:rounded [&_img]:my-1"
                        dangerouslySetInnerHTML={{ __html: q.text }}
                      />
                      {q.type === 'MULTIPLE_CHOICE' && q.options && (
                        <p className="text-xs text-slate-500 mt-1">
                          {q.options.length} Opsi • Jawaban benar: {q.options.findIndex((o: any) => o.isCorrect) > -1 ? getOptionLetter(q.options.findIndex((o: any) => o.isCorrect)) : '?'}
                        </p>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => { setIsImportModalOpen(false); setImportPreview([]); setImportWarnings([]); setImportFile(null); }} disabled={loading}>
              Batal
            </Button>
            <Button className="bg-[#002446] hover:bg-[#002446]/90 text-white" onClick={handleConfirmImport} disabled={loading || importPreview.length === 0}>
              {loading ? 'Mengimpor...' : `Konfirmasi Impor (${importPreview.length} Soal)`}
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
              Hapus Kategori Bank Soal?
            </DialogTitle>
            <DialogDescription className="text-sm text-gray-600 leading-relaxed">
              Apakah Anda yakin ingin menghapus kategori <strong>&quot;{categoryToDelete?.name}&quot;</strong>?
            </DialogDescription>
          </DialogHeader>

          <div className="p-3 bg-amber-50 border border-amber-200 rounded-lg text-xs text-amber-800 flex items-start gap-2 text-left">
            <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5 text-amber-600" />
            <div>
              <strong>Informasi Soal:</strong>
              <p className="mt-0.5">
                Butir soal ({categoryToDelete?.count || 0} butir) di dalam kategori ini tidak akan terhapus, melainkan otomatis dialihkan ke kategori <strong>&quot;Belum Berkategori&quot;</strong>.
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
              Batal
            </Button>
            <Button
              type="button"
              disabled={loading}
              onClick={confirmDeleteCategory}
              className="w-full sm:w-1/2 bg-red-600 hover:bg-red-700 text-white font-bold"
            >
              {loading ? 'Menghapus...' : 'Hapus Kategori'}
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
              Hapus Butir Soal?
            </DialogTitle>
            <DialogDescription className="text-sm text-gray-600 leading-relaxed">
              Apakah Anda yakin ingin menghapus butir soal ini dari Bank Soal? Tindakan ini tidak dapat dibatalkan.
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
              Batal
            </Button>
            <Button
              type="button"
              disabled={loading}
              onClick={confirmDeleteQuestion}
              className="w-full sm:w-1/2 bg-red-600 hover:bg-red-700 text-white font-bold"
            >
              {loading ? 'Menghapus...' : 'Hapus Soal'}
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
              Tutup
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
