'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogDescription,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  createCourseAnnouncement,
  deleteCourseAnnouncement,
  togglePinAnnouncement,
  addAnnouncementComment,
  deleteAnnouncementComment,
} from '@/lib/actions/announcement';
import {
  getForumThreadDetail,
  createForumThread,
  addForumComment,
  markCommentAsAnswer,
  togglePinForumThread,
  deleteForumThread,
  deleteForumComment,
  ForumThreadItem,
} from '@/lib/actions/forum';
import { useDialog } from '@/context/DialogContext';
import {
  Megaphone,
  MessageSquare,
  Pin,
  PinOff,
  Plus,
  Trash2,
  CheckCircle,
  CheckCircle2,
  ArrowLeft,
  CornerDownRight,
  Send,
  MessageCircle,
  Clock,
  Layers,
  Sparkles,
} from 'lucide-react';

interface Props {
  course: any;
  modules: any[];
  initialAnnouncements: any[];
  initialThreads: ForumThreadItem[];
  initialThreadId?: string;
}

export function TeacherCourseForumClient({
  course,
  modules,
  initialAnnouncements,
  initialThreads,
  initialThreadId,
}: Props) {
  const router = useRouter();
  const { showAlert, showConfirm } = useDialog();
  const [activeTab, setActiveTab] = useState<'announcements' | 'forum'>('announcements');

  // Pengumuman state
  const [announcements, setAnnouncements] = useState<any[]>(initialAnnouncements);
  const [isNewAnnouncementOpen, setIsNewAnnouncementOpen] = useState(false);
  const [annTitle, setAnnTitle] = useState('');
  const [annContent, setAnnContent] = useState('');
  const [annIsPinned, setAnnIsPinned] = useState(true);
  const [loadingAnn, setLoadingAnn] = useState(false);
  const [commentInputs, setCommentInputs] = useState<Record<string, string>>({});

  // Forum state
  const [threads, setThreads] = useState<ForumThreadItem[]>(initialThreads);
  const [selectedModuleFilter, setSelectedModuleFilter] = useState<string>('ALL');
  const [selectedThreadId, setSelectedThreadId] = useState<string | null>(
    initialThreadId || null
  );
  const [activeThreadDetail, setActiveThreadDetail] = useState<any | null>(null);
  const [loadingThreadDetail, setLoadingThreadDetail] = useState(false);

  // New Thread modal
  const [isNewThreadOpen, setIsNewThreadOpen] = useState(false);
  const [threadTitle, setThreadTitle] = useState('');
  const [threadContent, setThreadContent] = useState('');
  const [threadModuleId, setThreadModuleId] = useState('');
  const [loadingThread, setLoadingThread] = useState(false);

  // Reply state
  const [replyContent, setReplyContent] = useState('');
  const [replyingToId, setReplyingToId] = useState<string | null>(null);
  const [submittingReply, setSubmittingReply] = useState(false);

  // If initialThreadId is set, switch to forum tab
  useEffect(() => {
    if (initialThreadId) {
      setActiveTab('forum');
      setSelectedThreadId(initialThreadId);
    }
  }, [initialThreadId]);

  // Load thread detail
  useEffect(() => {
    if (!selectedThreadId) {
      setActiveThreadDetail(null);
      return;
    }

    let isMounted = true;
    setLoadingThreadDetail(true);
    getForumThreadDetail(selectedThreadId)
      .then((detail) => {
        if (isMounted) {
          setActiveThreadDetail(detail);
          setLoadingThreadDetail(false);
        }
      })
      .catch((err) => {
        console.error(err);
        if (isMounted) setLoadingThreadDetail(false);
      });

    return () => {
      isMounted = false;
    };
  }, [selectedThreadId]);

  // --- Handlers Pengumuman ---
  const handleCreateAnnouncement = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!annTitle.trim() || !annContent.trim()) return;

    setLoadingAnn(true);
    try {
      const created = await createCourseAnnouncement({
        courseId: course.id,
        title: annTitle.trim(),
        content: annContent.trim(),
        isPinned: annIsPinned,
      });

      setAnnouncements((prev) => [created, ...prev]);
      setIsNewAnnouncementOpen(false);
      setAnnTitle('');
      setAnnContent('');
      router.refresh();
      await showAlert('Pengumuman berhasil dipublikasikan!', { type: 'success' });
    } catch (err: any) {
      await showAlert(err.message || 'Gagal membuat pengumuman', { type: 'error' });
    } finally {
      setLoadingAnn(false);
    }
  };

  const handleTogglePin = async (id: string, currentPinned: boolean) => {
    try {
      await togglePinAnnouncement(id, !currentPinned);
      setAnnouncements((prev) =>
        prev.map((a) => (a.id === id ? { ...a, isPinned: !currentPinned } : a))
      );
      router.refresh();
    } catch (err: any) {
      await showAlert(err.message || 'Gagal mengubah pin pengumuman', { type: 'error' });
    }
  };

  const handleDeleteAnnouncement = async (id: string) => {
    const confirmed = await showConfirm(
      'Apakah Anda yakin ingin menghapus pengumuman ini?',
      { title: 'Hapus Pengumuman', confirmText: 'Ya, Hapus', confirmVariant: 'destructive' }
    );
    if (!confirmed) return;
    try {
      await deleteCourseAnnouncement(id);
      setAnnouncements((prev) => prev.filter((a) => a.id !== id));
      router.refresh();
      await showAlert('Pengumuman berhasil dihapus.', { type: 'success' });
    } catch (err: any) {
      await showAlert(err.message || 'Gagal menghapus pengumuman', { type: 'error' });
    }
  };

  const handleAddAnnouncementComment = async (annId: string) => {
    const text = commentInputs[annId];
    if (!text || !text.trim()) return;

    try {
      const comment = await addAnnouncementComment(annId, text.trim());
      setAnnouncements((prev) =>
        prev.map((a) =>
          a.id === annId ? { ...a, comments: [...(a.comments || []), comment] } : a
        )
      );
      setCommentInputs((prev) => ({ ...prev, [annId]: '' }));
      router.refresh();
    } catch (err: any) {
      await showAlert(err.message || 'Gagal menambahkan komentar', { type: 'error' });
    }
  };

  const handleDeleteAnnouncementComment = async (annId: string, commentId: string) => {
    const confirmed = await showConfirm(
      'Apakah Anda yakin ingin menghapus komentar ini?',
      { title: 'Hapus Komentar', confirmText: 'Ya, Hapus', confirmVariant: 'destructive' }
    );
    if (!confirmed) return;
    try {
      await deleteAnnouncementComment(commentId);
      setAnnouncements((prev) =>
        prev.map((a) =>
          a.id === annId
            ? { ...a, comments: a.comments.filter((c: any) => c.id !== commentId) }
            : a
        )
      );
      router.refresh();
    } catch (err: any) {
      await showAlert(err.message || 'Gagal menghapus komentar', { type: 'error' });
    }
  };

  // --- Handlers Forum ---
  const handleCreateThread = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!threadTitle.trim() || !threadContent.trim()) return;

    setLoadingThread(true);
    try {
      const created = await createForumThread({
        courseId: course.id,
        moduleId: threadModuleId || undefined,
        title: threadTitle.trim(),
        content: threadContent.trim(),
      });

      setIsNewThreadOpen(false);
      setThreadTitle('');
      setThreadContent('');
      router.refresh();
      setSelectedThreadId(created.id);
      await showAlert('Topik diskusi berhasil dibuat!', { type: 'success' });
    } catch (err: any) {
      await showAlert(err.message || 'Gagal membuat topik diskusi', { type: 'error' });
    } finally {
      setLoadingThread(false);
    }
  };

  const handleAddReply = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedThreadId || !replyContent.trim()) return;

    setSubmittingReply(true);
    try {
      await addForumComment({
        threadId: selectedThreadId,
        content: replyContent.trim(),
        parentId: replyingToId || undefined,
      });

      setReplyContent('');
      setReplyingToId(null);
      // Reload thread details
      const updated = await getForumThreadDetail(selectedThreadId);
      setActiveThreadDetail(updated);
      router.refresh();
    } catch (err: any) {
      await showAlert(err.message || 'Gagal mengirim balasan', { type: 'error' });
    } finally {
      setSubmittingReply(false);
    }
  };

  const handleMarkAnswer = async (commentId: string) => {
    if (!selectedThreadId) return;
    try {
      await markCommentAsAnswer(selectedThreadId, commentId);
      const updated = await getForumThreadDetail(selectedThreadId);
      setActiveThreadDetail(updated);
      setThreads((prev) =>
        prev.map((t) => (t.id === selectedThreadId ? { ...t, isSolved: true } : t))
      );
      router.refresh();
      await showAlert('Balasan ini berhasil ditandai sebagai Jawaban Terbaik!', { type: 'success' });
    } catch (err: any) {
      await showAlert(err.message || 'Gagal menandai jawaban', { type: 'error' });
    }
  };

  const handleTogglePinThread = async (threadId: string) => {
    try {
      await togglePinForumThread(threadId);
      setThreads((prev) =>
        prev.map((t) => (t.id === threadId ? { ...t, isPinned: !t.isPinned } : t))
      );
      if (activeThreadDetail && activeThreadDetail.id === threadId) {
        setActiveThreadDetail({
          ...activeThreadDetail,
          isPinned: !activeThreadDetail.isPinned,
        });
      }
      router.refresh();
    } catch (err: any) {
      await showAlert(err.message || 'Gagal mengubah pin diskusi', { type: 'error' });
    }
  };

  const handleDeleteThread = async (threadId: string) => {
    const confirmed = await showConfirm(
      'Hapus topik diskusi ini beserta seluruh balasannya?',
      { title: 'Hapus Topik Diskusi', confirmText: 'Ya, Hapus', confirmVariant: 'destructive' }
    );
    if (!confirmed) return;
    try {
      await deleteForumThread(threadId);
      setThreads((prev) => prev.filter((t) => t.id !== threadId));
      if (selectedThreadId === threadId) {
        setSelectedThreadId(null);
        setActiveThreadDetail(null);
      }
      router.refresh();
      await showAlert('Topik diskusi berhasil dihapus.', { type: 'success' });
    } catch (err: any) {
      await showAlert(err.message || 'Gagal menghapus topik diskusi', { type: 'error' });
    }
  };

  const handleDeleteComment = async (commentId: string) => {
    const confirmed = await showConfirm(
      'Apakah Anda yakin ingin menghapus balasan ini?',
      { title: 'Hapus Balasan', confirmText: 'Ya, Hapus', confirmVariant: 'destructive' }
    );
    if (!confirmed) return;
    try {
      await deleteForumComment(commentId);
      if (selectedThreadId) {
        const updated = await getForumThreadDetail(selectedThreadId);
        setActiveThreadDetail(updated);
      }
      router.refresh();
    } catch (err: any) {
      await showAlert(err.message || 'Gagal menghapus balasan', { type: 'error' });
    }
  };

  const filteredThreads = threads.filter((t) => {
    if (selectedModuleFilter === 'ALL') return true;
    return t.moduleId === selectedModuleFilter;
  });

  return (
    <div className="space-y-6">
      {/* Header & Breadcrumb */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 text-xs font-semibold text-[#FF8928] uppercase tracking-wider mb-1">
            <Link
              href={`/teacher/course/${course.id}/modules`}
              className="hover:underline flex items-center gap-1 text-gray-500 hover:text-[#002446]"
            >
              <ArrowLeft className="h-3.5 w-3.5" /> Kembali ke Modul
            </Link>
            <span>•</span>
            <span>{course.category?.name || 'Mata Pelajaran'}</span>
          </div>
          <h1 className="text-2xl font-bold text-[#002446]">
            Interaksi Pembelajaran — {course.title}
          </h1>
          <p className="text-sm text-gray-500">
            Sampaikan pengumuman penting, buka forum tanya-jawab materi, dan diskusikan silabus bersama siswa.
          </p>
        </div>

        <div className="flex items-center gap-2">
          {activeTab === 'announcements' ? (
            <Button
              size="sm"
              onClick={() => setIsNewAnnouncementOpen(true)}
              className="bg-[#002446] hover:bg-[#001b33] text-white flex items-center gap-1.5"
            >
              <Megaphone className="h-4 w-4" /> Buat Pengumuman
            </Button>
          ) : (
            <Button
              size="sm"
              onClick={() => setIsNewThreadOpen(true)}
              className="bg-[#002446] hover:bg-[#001b33] text-white flex items-center gap-1.5"
            >
              <Plus className="h-4 w-4" /> Topik Diskusi Baru
            </Button>
          )}
        </div>
      </div>

      {/* Tabs Switcher */}
      <div className="flex border-b border-gray-200 gap-4">
        <button
          onClick={() => {
            setActiveTab('announcements');
            setSelectedThreadId(null);
          }}
          className={`pb-3 text-sm font-semibold transition-colors flex items-center gap-2 border-b-2 ${
            activeTab === 'announcements'
              ? 'border-[#002446] text-[#002446]'
              : 'border-transparent text-gray-500 hover:text-gray-700'
          }`}
        >
          <Megaphone className="h-4 w-4" />
          Pengumuman Kursus ({announcements.length})
        </button>

        <button
          onClick={() => setActiveTab('forum')}
          className={`pb-3 text-sm font-semibold transition-colors flex items-center gap-2 border-b-2 ${
            activeTab === 'forum'
              ? 'border-[#002446] text-[#002446]'
              : 'border-transparent text-gray-500 hover:text-gray-700'
          }`}
        >
          <MessageSquare className="h-4 w-4" />
          Forum Tanya-Jawab ({threads.length})
        </button>
      </div>

      {/* TAB 1: PENGUMUMAN */}
      {activeTab === 'announcements' && (
        <div className="space-y-4">
          {announcements.length === 0 ? (
            <Card className="text-center py-16">
              <CardContent className="space-y-4">
                <Megaphone className="h-16 w-16 mx-auto text-gray-300" />
                <div className="space-y-1">
                  <h3 className="text-lg font-bold text-gray-900">Belum Ada Pengumuman</h3>
                  <p className="text-sm text-gray-500 max-w-md mx-auto">
                    Buat pengumuman penting untuk menginformasikan jadwal ujian, perubahan materi, atau pengingat batas tugas ke seluruh siswa.
                  </p>
                </div>
                <Button
                  onClick={() => setIsNewAnnouncementOpen(true)}
                  className="bg-[#002446] text-white"
                >
                  <Plus className="h-4 w-4 mr-1.5" /> Buat Pengumuman Pertama
                </Button>
              </CardContent>
            </Card>
          ) : (
            announcements.map((ann) => (
              <Card
                key={ann.id}
                className={`border overflow-hidden shadow-sm transition-shadow bg-white ${
                  ann.isPinned ? 'border-[#FF8928]/50 ring-1 ring-[#FF8928]/30' : 'border-gray-200'
                }`}
              >
                <div className="p-5 space-y-3">
                  <div className="flex items-start justify-between gap-3">
                    <div className="space-y-1">
                      <div className="flex items-center gap-2">
                        {ann.isPinned && (
                          <Badge className="bg-[#FF8928] text-white hover:bg-[#FF8928] flex items-center gap-1 text-[11px]">
                            <Pin className="h-3 w-3 fill-white" /> Disematkan (Pinned Banner)
                          </Badge>
                        )}
                        <h3 className="text-lg font-bold text-[#002446]">{ann.title}</h3>
                      </div>
                      <p className="text-xs text-gray-500 flex items-center gap-2">
                        <span>Oleh: <strong>{ann.author.name}</strong></span>
                        <span>•</span>
                        <span>
                          {new Date(ann.createdAt).toLocaleDateString('id-ID', {
                            weekday: 'long',
                            day: 'numeric',
                            month: 'long',
                            year: 'numeric',
                            hour: '2-digit',
                            minute: '2-digit',
                          })}
                        </span>
                      </p>
                    </div>

                    <div className="flex items-center gap-1">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleTogglePin(ann.id, ann.isPinned)}
                        className={`text-xs px-2.5 ${
                          ann.isPinned ? 'text-[#FF8928] hover:bg-amber-50' : 'text-gray-400 hover:text-gray-700'
                        }`}
                        title={ann.isPinned ? 'Lepas Pin' : 'Sematkan ke Atas'}
                      >
                        {ann.isPinned ? <PinOff className="h-4 w-4" /> : <Pin className="h-4 w-4" />}
                      </Button>

                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleDeleteAnnouncement(ann.id)}
                        className="text-red-500 hover:bg-red-50 text-xs px-2.5"
                        title="Hapus Pengumuman"
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>

                  <div className="text-sm text-gray-700 whitespace-pre-wrap leading-relaxed pt-1">
                    {ann.content}
                  </div>

                  {/* Komentar Section */}
                  <div className="pt-4 border-t border-gray-100 space-y-3">
                    <div className="flex items-center gap-1.5 text-xs font-semibold text-gray-600">
                      <MessageCircle className="h-4 w-4 text-[#002446]" />
                      Tanggapan / Diskusi ({ann.comments?.length || 0})
                    </div>

                    {ann.comments && ann.comments.length > 0 && (
                      <div className="space-y-2 pl-2 sm:pl-4 border-l-2 border-gray-100">
                        {ann.comments.map((c: any) => (
                          <div key={c.id} className="text-xs bg-gray-50 p-2.5 rounded-lg space-y-1">
                            <div className="flex items-center justify-between text-gray-500">
                              <span className="font-semibold text-gray-800 flex items-center gap-1.5">
                                {c.author.name}
                                {c.author.role === 'TEACHER' && (
                                  <Badge variant="outline" className="text-[10px] px-1 py-0 border-blue-400 text-blue-700">
                                    Guru
                                  </Badge>
                                )}
                              </span>
                              <div className="flex items-center gap-2">
                                <span>
                                  {new Date(c.createdAt).toLocaleDateString('id-ID', {
                                    day: 'numeric',
                                    month: 'short',
                                    hour: '2-digit',
                                    minute: '2-digit',
                                  })}
                                </span>
                                <button
                                  onClick={() => handleDeleteAnnouncementComment(ann.id, c.id)}
                                  className="text-gray-400 hover:text-red-600"
                                >
                                  <Trash2 className="h-3 w-3" />
                                </button>
                              </div>
                            </div>
                            <p className="text-gray-700">{c.content}</p>
                          </div>
                        ))}
                      </div>
                    )}

                    {/* Form Tulis Komentar */}
                    <div className="flex items-center gap-2 pt-1">
                      <Input
                        placeholder="Tulis tanggapan atau penjelasan tambahan..."
                        value={commentInputs[ann.id] || ''}
                        onChange={(e) =>
                          setCommentInputs((prev) => ({ ...prev, [ann.id]: e.target.value }))
                        }
                        onKeyDown={(e) => {
                          if (e.key === 'Enter') {
                            e.preventDefault();
                            handleAddAnnouncementComment(ann.id);
                          }
                        }}
                        className="text-xs h-9"
                      />
                      <Button
                        size="sm"
                        onClick={() => handleAddAnnouncementComment(ann.id)}
                        className="bg-[#002446] hover:bg-[#001b33] text-white text-xs h-9 px-3"
                      >
                        <Send className="h-3.5 w-3.5" />
                      </Button>
                    </div>
                  </div>
                </div>
              </Card>
            ))
          )}
        </div>
      )}

      {/* TAB 2: FORUM DISKUSI */}
      {activeTab === 'forum' && (
        <div className="space-y-4">
          {/* Thread Detail View if selected */}
          {selectedThreadId && activeThreadDetail ? (
            <div className="space-y-4">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setSelectedThreadId(null)}
                className="flex items-center gap-1.5 text-xs text-gray-600"
              >
                <ArrowLeft className="h-3.5 w-3.5" /> Kembali ke Daftar Topik
              </Button>

              <Card className="border border-gray-200 shadow-sm bg-white">
                <CardHeader className="p-5 pb-3">
                  <div className="flex items-start justify-between gap-3">
                    <div className="space-y-1">
                      <div className="flex flex-wrap items-center gap-2">
                        {activeThreadDetail.isPinned && (
                          <Badge className="bg-[#FF8928] text-white flex items-center gap-1 text-[11px]">
                            <Pin className="h-3 w-3 fill-white" /> Disematkan
                          </Badge>
                        )}
                        {activeThreadDetail.isSolved && (
                          <Badge className="bg-emerald-100 text-emerald-800 flex items-center gap-1 text-[11px]">
                            <CheckCircle2 className="h-3 w-3" /> Solusi Ditemukan
                          </Badge>
                        )}
                        {activeThreadDetail.moduleTitle && (
                          <Badge variant="outline" className="text-xs text-gray-600">
                            Modul: {activeThreadDetail.moduleTitle}
                          </Badge>
                        )}
                      </div>
                      <CardTitle className="text-xl font-bold text-[#002446] mt-2">
                        {activeThreadDetail.title}
                      </CardTitle>
                      <p className="text-xs text-gray-500 flex items-center gap-2">
                        <span>Ditanyakan oleh: <strong>{activeThreadDetail.authorName}</strong></span>
                        <span>•</span>
                        <span>
                          {new Date(activeThreadDetail.createdAt).toLocaleDateString('id-ID', {
                            weekday: 'long',
                            day: 'numeric',
                            month: 'long',
                            year: 'numeric',
                            hour: '2-digit',
                            minute: '2-digit',
                          })}
                        </span>
                      </p>
                    </div>

                    <div className="flex items-center gap-1">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleTogglePinThread(activeThreadDetail.id)}
                        className={`text-xs px-2.5 ${
                          activeThreadDetail.isPinned ? 'text-[#FF8928]' : 'text-gray-400'
                        }`}
                        title="Pin Topik"
                      >
                        {activeThreadDetail.isPinned ? <PinOff className="h-4 w-4" /> : <Pin className="h-4 w-4" />}
                      </Button>

                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleDeleteThread(activeThreadDetail.id)}
                        className="text-red-500 hover:bg-red-50 text-xs px-2.5"
                        title="Hapus Topik"
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                </CardHeader>

                <CardContent className="p-5 pt-0 space-y-6">
                  <div className="text-sm text-gray-800 whitespace-pre-wrap leading-relaxed p-4 bg-gray-50/80 rounded-lg border border-gray-100">
                    {activeThreadDetail.content}
                  </div>

                  {/* Comments & Replies list */}
                  <div className="space-y-4">
                    <h4 className="text-sm font-bold text-[#002446] flex items-center gap-2">
                      <MessageSquare className="h-4 w-4" />
                      Balasan & Tanggapan ({activeThreadDetail.rootComments?.length || 0})
                    </h4>

                    {activeThreadDetail.rootComments?.length === 0 ? (
                      <p className="text-xs text-gray-500 italic">
                        Belum ada balasan pada topik ini. Jadilah yang pertama menjawab!
                      </p>
                    ) : (
                      <div className="space-y-3">
                        {activeThreadDetail.rootComments?.map((comm: any) => (
                          <div
                            key={comm.id}
                            className={`p-4 rounded-lg border transition-all ${
                              comm.isAnswer
                                ? 'bg-emerald-50/70 border-emerald-300 ring-1 ring-emerald-200'
                                : 'bg-white border-gray-200'
                            }`}
                          >
                            <div className="flex items-center justify-between text-xs text-gray-500 mb-2">
                              <div className="flex items-center gap-2">
                                <span className="font-bold text-gray-900">{comm.authorName}</span>
                                {comm.authorRole === 'TEACHER' && (
                                  <Badge className="bg-[#002446] text-white text-[10px] py-0 px-1.5">
                                    Guru
                                  </Badge>
                                )}
                                {comm.isAnswer && (
                                  <Badge className="bg-emerald-600 text-white text-[10px] py-0 px-1.5 flex items-center gap-1 font-semibold">
                                    <Sparkles className="h-3 w-3" /> Jawaban Terpilih (Solusi)
                                  </Badge>
                                )}
                              </div>

                              <div className="flex items-center gap-2">
                                <span>
                                  {new Date(comm.createdAt).toLocaleDateString('id-ID', {
                                    day: 'numeric',
                                    month: 'short',
                                    hour: '2-digit',
                                    minute: '2-digit',
                                  })}
                                </span>
                                <button
                                  onClick={() => handleDeleteComment(comm.id)}
                                  className="text-gray-400 hover:text-red-600"
                                >
                                  <Trash2 className="h-3.5 w-3.5" />
                                </button>
                              </div>
                            </div>

                            <p className="text-sm text-gray-800 whitespace-pre-wrap leading-relaxed">
                              {comm.content}
                            </p>

                            <div className="flex items-center gap-3 pt-3 mt-2 border-t border-gray-100">
                              <button
                                onClick={() => handleMarkAnswer(comm.id)}
                                className={`text-xs font-semibold flex items-center gap-1 transition-colors ${
                                  comm.isAnswer
                                    ? 'text-emerald-700'
                                    : 'text-gray-500 hover:text-emerald-600'
                                }`}
                              >
                                <CheckCircle className="h-3.5 w-3.5" />
                                {comm.isAnswer ? 'Solusi Aktif' : 'Tandai sebagai Solusi'}
                              </button>

                              <button
                                onClick={() => {
                                  setReplyingToId(comm.id);
                                  document.getElementById('forumReplyBox')?.focus();
                                }}
                                className="text-xs font-semibold text-gray-500 hover:text-[#002446] flex items-center gap-1"
                              >
                                <CornerDownRight className="h-3.5 w-3.5" /> Balas
                              </button>
                            </div>

                            {/* Nested Replies */}
                            {comm.replies && comm.replies.length > 0 && (
                              <div className="mt-3 pl-4 border-l-2 border-gray-200 space-y-2">
                                {comm.replies.map((reply: any) => (
                                  <div key={reply.id} className="bg-gray-50 p-3 rounded-lg text-xs space-y-1">
                                    <div className="flex items-center justify-between text-gray-500">
                                      <span className="font-semibold text-gray-900">
                                        {reply.authorName}
                                      </span>
                                      <button
                                        onClick={() => handleDeleteComment(reply.id)}
                                        className="text-gray-400 hover:text-red-600"
                                      >
                                        <Trash2 className="h-3 w-3" />
                                      </button>
                                    </div>
                                    <p className="text-gray-700 text-xs">{reply.content}</p>
                                  </div>
                                ))}
                              </div>
                            )}
                          </div>
                        ))}
                      </div>
                    )}

                    {/* Reply Input Box */}
                    <form onSubmit={handleAddReply} className="pt-4 border-t border-gray-200 space-y-2">
                      {replyingToId && (
                        <div className="flex items-center justify-between bg-blue-50 px-3 py-1.5 rounded text-xs text-blue-800">
                          <span>Membalas komentar...</span>
                          <button
                            type="button"
                            onClick={() => setReplyingToId(null)}
                            className="text-blue-600 hover:underline font-bold"
                          >
                            Batal
                          </button>
                        </div>
                      )}
                      <textarea
                        id="forumReplyBox"
                        placeholder="Tulis penjelasan, bantuan jawaban, atau balasan Anda..."
                        value={replyContent}
                        onChange={(e) => setReplyContent(e.target.value)}
                        rows={3}
                        required
                        className="w-full p-3 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#002446]"
                      />
                      <div className="flex justify-end">
                        <Button
                          type="submit"
                          disabled={submittingReply}
                          className="bg-[#002446] hover:bg-[#001b33] text-white text-xs px-4"
                        >
                          {submittingReply ? 'Mengirim...' : 'Kirim Balasan'}
                        </Button>
                      </div>
                    </form>
                  </div>
                </CardContent>
              </Card>
            </div>
          ) : (
            // Thread List View
            <div className="space-y-4">
              {/* Filter Modul Bar */}
              <div className="flex items-center justify-between gap-3 bg-white p-3 border border-gray-200 rounded-lg shadow-sm">
                <div className="flex items-center gap-2">
                  <span className="text-xs font-semibold text-gray-500 uppercase">Filter Modul:</span>
                  <select
                    value={selectedModuleFilter}
                    onChange={(e) => setSelectedModuleFilter(e.target.value)}
                    className="h-8 px-2 text-xs border border-gray-300 rounded bg-white text-gray-700"
                  >
                    <option value="ALL">Semua Modul</option>
                    {modules.map((m) => (
                      <option key={m.id} value={m.id}>
                        {m.title}
                      </option>
                    ))}
                  </select>
                </div>

                <span className="text-xs text-gray-500">
                  Menampilkan {filteredThreads.length} topik
                </span>
              </div>

              {filteredThreads.length === 0 ? (
                <Card className="text-center py-16">
                  <CardContent className="space-y-4">
                    <MessageSquare className="h-16 w-16 mx-auto text-gray-300" />
                    <div className="space-y-1">
                      <h3 className="text-lg font-bold text-gray-900">Belum Ada Topik Diskusi</h3>
                      <p className="text-sm text-gray-500 max-w-md mx-auto">
                        Mulai topik diskusi pertama atau tunggu pertanyaan dari siswa seputar modul pelajaran.
                      </p>
                    </div>
                    <Button onClick={() => setIsNewThreadOpen(true)} className="bg-[#002446] text-white">
                      <Plus className="h-4 w-4 mr-1.5" /> Buat Topik Diskusi
                    </Button>
                  </CardContent>
                </Card>
              ) : (
                <div className="space-y-3">
                  {filteredThreads.map((t) => (
                    <Card
                      key={t.id}
                      onClick={() => setSelectedThreadId(t.id)}
                      className={`cursor-pointer hover:shadow-md transition-all border bg-white ${
                        t.isPinned ? 'border-[#FF8928]/40 ring-1 ring-[#FF8928]/20' : 'border-gray-200'
                      }`}
                    >
                      <CardContent className="p-4 sm:p-5 flex items-start justify-between gap-4">
                        <div className="space-y-1.5 flex-1">
                          <div className="flex flex-wrap items-center gap-2">
                            {t.isPinned && (
                              <Badge className="bg-[#FF8928] text-white text-[10px] py-0 px-1.5 flex items-center gap-1">
                                <Pin className="h-2.5 w-2.5 fill-white" /> Disematkan
                              </Badge>
                            )}
                            {t.isSolved && (
                              <Badge className="bg-emerald-100 text-emerald-800 text-[10px] py-0 px-1.5 flex items-center gap-1">
                                <CheckCircle2 className="h-2.5 w-2.5" /> Solved
                              </Badge>
                            )}
                            {t.moduleTitle && (
                              <Badge variant="outline" className="text-[10px] py-0 px-1.5 text-gray-600">
                                {t.moduleTitle}
                              </Badge>
                            )}
                          </div>

                          <h4 className="text-base font-bold text-[#002446] hover:text-[#FF8928] transition-colors">
                            {t.title}
                          </h4>

                          <p className="text-xs text-gray-600 line-clamp-2">{t.content}</p>

                          <div className="flex items-center gap-3 text-xs text-gray-400 pt-1">
                            <span>
                              Ditanyakan oleh <strong>{t.authorName}</strong> ({t.authorRole})
                            </span>
                            <span>•</span>
                            <span>
                              {new Date(t.createdAt).toLocaleDateString('id-ID', {
                                day: 'numeric',
                                month: 'short',
                              })}
                            </span>
                          </div>
                        </div>

                        <div className="flex flex-col items-end justify-between self-stretch">
                          <Badge variant="outline" className="flex items-center gap-1 text-xs text-gray-600">
                            <MessageSquare className="h-3.5 w-3.5 text-[#002446]" />
                            {t._count.comments} Balasan
                          </Badge>
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* Modal Buat Pengumuman Baru */}
      <Dialog open={isNewAnnouncementOpen} onOpenChange={setIsNewAnnouncementOpen}>
        <DialogContent className="sm:max-w-md">
          <form onSubmit={handleCreateAnnouncement}>
            <DialogHeader>
              <DialogTitle className="text-xl font-bold text-[#002446]">
                Buat Pengumuman Baru
              </DialogTitle>
              <DialogDescription className="text-xs text-gray-500">
                Pengumuman akan langsung dikirimkan sebagai notifikasi ke seluruh siswa terdaftar.
              </DialogDescription>
            </DialogHeader>

            <div className="space-y-4 py-4">
              <div className="space-y-1.5">
                <Label htmlFor="annTitle">Judul Pengumuman *</Label>
                <Input
                  id="annTitle"
                  placeholder="Contoh: Jadwal Ujian Tengah Semester & Kisi-kisi"
                  value={annTitle}
                  onChange={(e) => setAnnTitle(e.target.value)}
                  required
                />
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="annContent">Isi Pengumuman *</Label>
                <textarea
                  id="annContent"
                  rows={4}
                  placeholder="Tuliskan detail pengumuman secara lengkap..."
                  value={annContent}
                  onChange={(e) => setAnnContent(e.target.value)}
                  required
                  className="w-full p-3 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-[#002446]"
                />
              </div>

              <div className="flex items-center gap-2 pt-1">
                <input
                  type="checkbox"
                  id="annIsPinned"
                  checked={annIsPinned}
                  onChange={(e) => setAnnIsPinned(e.target.checked)}
                  className="h-4 w-4 rounded border-gray-300 text-[#002446] focus:ring-[#002446]"
                />
                <Label htmlFor="annIsPinned" className="text-xs cursor-pointer">
                  Sematkan ke bagian atas kursus siswa (Banner Pinned)
                </Label>
              </div>
            </div>

            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                onClick={() => setIsNewAnnouncementOpen(false)}
                disabled={loadingAnn}
              >
                Batal
              </Button>
              <Button
                type="submit"
                disabled={loadingAnn}
                className="bg-[#002446] hover:bg-[#001b33] text-white"
              >
                {loadingAnn ? 'Menerbitkan...' : 'Terbitkan Pengumuman'}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Modal Buat Topik Diskusi Baru */}
      <Dialog open={isNewThreadOpen} onOpenChange={setIsNewThreadOpen}>
        <DialogContent className="sm:max-w-md">
          <form onSubmit={handleCreateThread}>
            <DialogHeader>
              <DialogTitle className="text-xl font-bold text-[#002446]">
                Mulai Topik Diskusi Baru
              </DialogTitle>
              <DialogDescription className="text-xs text-gray-500">
                Ajukan topik pemantik atau pertanyaan untuk memicu diskusi aktif bersama siswa.
              </DialogDescription>
            </DialogHeader>

            <div className="space-y-4 py-4">
              <div className="space-y-1.5">
                <Label htmlFor="threadTitle">Judul Diskusi *</Label>
                <Input
                  id="threadTitle"
                  placeholder="Contoh: Apa perbedaan utama antara DDL dan DML?"
                  value={threadTitle}
                  onChange={(e) => setThreadTitle(e.target.value)}
                  required
                />
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="threadModule">Terkait Modul (Opsional)</Label>
                <select
                  id="threadModule"
                  value={threadModuleId}
                  onChange={(e) => setThreadModuleId(e.target.value)}
                  className="w-full h-10 px-3 border border-gray-300 rounded-md text-sm bg-white"
                >
                  <option value="">-- Diskusi Umum Kursus --</option>
                  {modules.map((m) => (
                    <option key={m.id} value={m.id}>
                      {m.title}
                    </option>
                  ))}
                </select>
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="threadContent">Isi Topik / Pertanyaan *</Label>
                <textarea
                  id="threadContent"
                  rows={4}
                  placeholder="Uraikan detail pertanyaan atau instruksi diskusi Anda..."
                  value={threadContent}
                  onChange={(e) => setThreadContent(e.target.value)}
                  required
                  className="w-full p-3 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-[#002446]"
                />
              </div>
            </div>

            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                onClick={() => setIsNewThreadOpen(false)}
                disabled={loadingThread}
              >
                Batal
              </Button>
              <Button
                type="submit"
                disabled={loadingThread}
                className="bg-[#002446] hover:bg-[#001b33] text-white"
              >
                {loadingThread ? 'Menyimpan...' : 'Buka Diskusi'}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
