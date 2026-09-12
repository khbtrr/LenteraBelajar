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
  addAnnouncementComment,
} from '@/lib/actions/announcement';
import {
  getForumThreadDetail,
  createForumThread,
  addForumComment,
  ForumThreadItem,
} from '@/lib/actions/forum';
import {
  Megaphone,
  MessageSquare,
  Pin,
  Plus,
  ArrowLeft,
  CornerDownRight,
  Send,
  MessageCircle,
  Clock,
  Layers,
  Sparkles,
  CheckCircle2,
} from 'lucide-react';

interface Props {
  course: any;
  modules: any[];
  initialAnnouncements: any[];
  initialThreads: ForumThreadItem[];
  initialThreadId?: string;
  initialModuleId?: string;
}

export function StudentCourseForumClient({
  course,
  modules,
  initialAnnouncements,
  initialThreads,
  initialThreadId,
  initialModuleId,
}: Props) {
  const router = useRouter();
  const [activeTab, setActiveTab] = useState<'announcements' | 'forum'>('announcements');

  // Announcements
  const [announcements, setAnnouncements] = useState<any[]>(initialAnnouncements);
  const [commentInputs, setCommentInputs] = useState<Record<string, string>>({});
  const [submittingComment, setSubmittingComment] = useState(false);

  // Forum Threads
  const [threads, setThreads] = useState<ForumThreadItem[]>(initialThreads);
  const [selectedModuleFilter, setSelectedModuleFilter] = useState<string>(
    initialModuleId || 'ALL'
  );
  const [selectedThreadId, setSelectedThreadId] = useState<string | null>(
    initialThreadId || null
  );
  const [activeThreadDetail, setActiveThreadDetail] = useState<any | null>(null);
  const [loadingThreadDetail, setLoadingThreadDetail] = useState(false);

  // Ask Question Modal
  const [isAskOpen, setIsAskOpen] = useState(false);
  const [newTitle, setNewTitle] = useState('');
  const [newContent, setNewContent] = useState('');
  const [newModuleId, setNewModuleId] = useState(initialModuleId || '');
  const [submittingQuestion, setSubmittingQuestion] = useState(false);

  // Reply state
  const [replyContent, setReplyContent] = useState('');
  const [replyingToId, setReplyingToId] = useState<string | null>(null);
  const [submittingReply, setSubmittingReply] = useState(false);

  useEffect(() => {
    if (initialThreadId) {
      setActiveTab('forum');
      setSelectedThreadId(initialThreadId);
    } else if (initialModuleId) {
      setActiveTab('forum');
      setSelectedModuleFilter(initialModuleId);
    }
  }, [initialThreadId, initialModuleId]);

  // Load thread detail when selected
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

  // Handle student comment on announcement
  const handleAddAnnouncementComment = async (annId: string) => {
    const text = commentInputs[annId];
    if (!text || !text.trim()) return;

    setSubmittingComment(true);
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
      alert(err.message || 'Gagal mengirim tanggapan');
    } finally {
      setSubmittingComment(false);
    }
  };

  // Handle student creating new forum thread
  const handleCreateQuestion = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newTitle.trim() || !newContent.trim()) return;

    setSubmittingQuestion(true);
    try {
      const created = await createForumThread({
        courseId: course.id,
        moduleId: newModuleId || undefined,
        title: newTitle.trim(),
        content: newContent.trim(),
      });

      setIsAskOpen(false);
      setNewTitle('');
      setNewContent('');
      router.refresh();
      setSelectedThreadId(created.id);
    } catch (err: any) {
      alert(err.message || 'Gagal mengirim pertanyaan');
    } finally {
      setSubmittingQuestion(false);
    }
  };

  // Handle reply on forum thread
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
      const updated = await getForumThreadDetail(selectedThreadId);
      setActiveThreadDetail(updated);
      router.refresh();
    } catch (err: any) {
      alert(err.message || 'Gagal mengirim balasan');
    } finally {
      setSubmittingReply(false);
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
              href={`/student/course/${course.id}/modules`}
              className="hover:underline flex items-center gap-1 text-gray-500 hover:text-[#002446]"
            >
              <ArrowLeft className="h-3.5 w-3.5" /> Kembali ke Modul Pembelajaran
            </Link>
            <span>•</span>
            <span>{course.category?.name || 'Mata Pelajaran'}</span>
          </div>
          <h1 className="text-2xl font-bold text-[#002446]">
            Forum & Pengumuman — {course.title}
          </h1>
          <p className="text-sm text-gray-500">
            Guru Pengampu: <strong>{course.teacher.name}</strong> • Cek pengumuman penting atau ajukan pertanyaan diskusi seputar materi.
          </p>
        </div>

        <Button
          size="sm"
          onClick={() => setIsAskOpen(true)}
          className="bg-[#002446] hover:bg-[#001b33] text-white flex items-center gap-1.5"
        >
          <Plus className="h-4 w-4" /> Tanya di Forum
        </Button>
      </div>

      {/* Tabs */}
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

      {/* TAB 1: PENGUMUMAN SISWA */}
      {activeTab === 'announcements' && (
        <div className="space-y-4">
          {announcements.length === 0 ? (
            <Card className="text-center py-16">
              <CardContent className="space-y-3">
                <Megaphone className="h-16 w-16 mx-auto text-gray-300" />
                <h3 className="text-lg font-bold text-gray-900">Belum Ada Pengumuman</h3>
                <p className="text-sm text-gray-500 max-w-md mx-auto">
                  Guru pengampu belum menerbitkan pengumuman pada mata pelajaran ini. Silakan periksa kembali nanti.
                </p>
              </CardContent>
            </Card>
          ) : (
            announcements.map((ann) => (
              <Card
                key={ann.id}
                className={`border overflow-hidden shadow-sm bg-white ${
                  ann.isPinned ? 'border-[#FF8928]/50 ring-1 ring-[#FF8928]/30' : 'border-gray-200'
                }`}
              >
                <div className="p-5 space-y-3">
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      {ann.isPinned && (
                        <Badge className="bg-[#FF8928] text-white hover:bg-[#FF8928] flex items-center gap-1 text-[11px]">
                          <Pin className="h-3 w-3 fill-white" /> Pengumuman Penting
                        </Badge>
                      )}
                      <h3 className="text-lg font-bold text-[#002446]">{ann.title}</h3>
                    </div>
                    <p className="text-xs text-gray-500 flex items-center gap-2">
                      <span>Diterbitkan oleh: <strong>{ann.author.name}</strong></span>
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

                  <div className="text-sm text-gray-700 whitespace-pre-wrap leading-relaxed pt-1">
                    {ann.content}
                  </div>

                  {/* Komentar Section */}
                  <div className="pt-4 border-t border-gray-100 space-y-3">
                    <div className="flex items-center gap-1.5 text-xs font-semibold text-gray-600">
                      <MessageCircle className="h-4 w-4 text-[#002446]" />
                      Tanggapan Siswa ({ann.comments?.length || 0})
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
                              <span>
                                {new Date(c.createdAt).toLocaleDateString('id-ID', {
                                  day: 'numeric',
                                  month: 'short',
                                  hour: '2-digit',
                                  minute: '2-digit',
                                })}
                              </span>
                            </div>
                            <p className="text-gray-700">{c.content}</p>
                          </div>
                        ))}
                      </div>
                    )}

                    {/* Form Tulis Tanggapan */}
                    <div className="flex items-center gap-2 pt-1">
                      <Input
                        placeholder="Tanyakan atau tanggapi pengumuman ini..."
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
                        disabled={submittingComment}
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

      {/* TAB 2: FORUM DISKUSI SISWA */}
      {activeTab === 'forum' && (
        <div className="space-y-4">
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
                  <div className="space-y-1">
                    <div className="flex flex-wrap items-center gap-2">
                      {activeThreadDetail.isPinned && (
                        <Badge className="bg-[#FF8928] text-white flex items-center gap-1 text-[11px]">
                          <Pin className="h-3 w-3 fill-white" /> Disematkan
                        </Badge>
                      )}
                      {activeThreadDetail.isSolved && (
                        <Badge className="bg-emerald-100 text-emerald-800 flex items-center gap-1 text-[11px]">
                          <CheckCircle2 className="h-3 w-3" /> Solusi Terverifikasi
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
                        })}
                      </span>
                    </p>
                  </div>
                </CardHeader>

                <CardContent className="p-5 pt-0 space-y-6">
                  <div className="text-sm text-gray-800 whitespace-pre-wrap leading-relaxed p-4 bg-gray-50/80 rounded-lg border border-gray-100">
                    {activeThreadDetail.content}
                  </div>

                  {/* Replies List */}
                  <div className="space-y-4">
                    <h4 className="text-sm font-bold text-[#002446] flex items-center gap-2">
                      <MessageSquare className="h-4 w-4" />
                      Jawaban & Diskusi ({activeThreadDetail.rootComments?.length || 0})
                    </h4>

                    {activeThreadDetail.rootComments?.length === 0 ? (
                      <p className="text-xs text-gray-500 italic">
                        Belum ada yang menjawab pertanyaan ini. Bantu temanmu dengan memberikan jawaban!
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
                                    <Sparkles className="h-3 w-3" /> Solusi Guru Terpilih
                                  </Badge>
                                )}
                              </div>

                              <span>
                                {new Date(comm.createdAt).toLocaleDateString('id-ID', {
                                  day: 'numeric',
                                  month: 'short',
                                  hour: '2-digit',
                                  minute: '2-digit',
                                })}
                              </span>
                            </div>

                            <p className="text-sm text-gray-800 whitespace-pre-wrap leading-relaxed">
                              {comm.content}
                            </p>

                            <div className="flex items-center gap-3 pt-3 mt-2 border-t border-gray-100">
                              <button
                                onClick={() => {
                                  setReplyingToId(comm.id);
                                  document.getElementById('studentForumReplyBox')?.focus();
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

                    {/* Reply Input Form */}
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
                        id="studentForumReplyBox"
                        placeholder="Tulis balasan atau penjelasan Anda..."
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
                        Punya pertanyaan seputar materi pelajaran? Jadilah yang pertama bertanya di forum ini!
                      </p>
                    </div>
                    <Button onClick={() => setIsAskOpen(true)} className="bg-[#002446] text-white">
                      <Plus className="h-4 w-4 mr-1.5" /> Tanya Sekarang
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
                              <Badge className="bg-emerald-100 text-emerald-800 text-[10px] py-0 px-1.5 flex items-center gap-1 font-semibold">
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
                              Ditanyakan oleh <strong>{t.authorName}</strong>
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

      {/* Modal Tanya di Forum */}
      <Dialog open={isAskOpen} onOpenChange={setIsAskOpen}>
        <DialogContent className="sm:max-w-md">
          <form onSubmit={handleCreateQuestion}>
            <DialogHeader>
              <DialogTitle className="text-xl font-bold text-[#002446]">
                Ajukan Pertanyaan ke Forum
              </DialogTitle>
              <DialogDescription className="text-xs text-gray-500">
                Pertanyaan Anda akan dilihat oleh guru dan teman-teman sekelas.
              </DialogDescription>
            </DialogHeader>

            <div className="space-y-4 py-4">
              <div className="space-y-1.5">
                <Label htmlFor="qTitle">Judul Pertanyaan *</Label>
                <Input
                  id="qTitle"
                  placeholder="Contoh: Mengapa nilai sin 90 derajat sama dengan 1?"
                  value={newTitle}
                  onChange={(e) => setNewTitle(e.target.value)}
                  required
                />
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="qModule">Terkait Bab / Modul (Opsional)</Label>
                <select
                  id="qModule"
                  value={newModuleId}
                  onChange={(e) => setNewModuleId(e.target.value)}
                  className="w-full h-10 px-3 border border-gray-300 rounded-md text-sm bg-white"
                >
                  <option value="">-- Pertanyaan Umum --</option>
                  {modules.map((m) => (
                    <option key={m.id} value={m.id}>
                      {m.title}
                    </option>
                  ))}
                </select>
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="qContent">Detail Pertanyaan *</Label>
                <textarea
                  id="qContent"
                  rows={4}
                  placeholder="Uraikan apa yang belum Anda pahami atau bagikan bagian soal yang ingin dibahas..."
                  value={newContent}
                  onChange={(e) => setNewContent(e.target.value)}
                  required
                  className="w-full p-3 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-[#002446]"
                />
              </div>
            </div>

            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                onClick={() => setIsAskOpen(false)}
                disabled={submittingQuestion}
              >
                Batal
              </Button>
              <Button
                type="submit"
                disabled={submittingQuestion}
                className="bg-[#002446] hover:bg-[#001b33] text-white"
              >
                {submittingQuestion ? 'Mengirim...' : 'Kirim Pertanyaan'}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
