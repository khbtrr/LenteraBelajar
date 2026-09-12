'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import QRCode from 'qrcode';
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
  getLiveProctorData,
  grantExtraTime,
  forceSubmitAttempt,
  resetStudentAttempt,
  updateQuizSecuritySettings,
  LiveProctorData,
  ProctorStudentData,
} from '@/lib/actions/proctor';
import {
  Shield,
  ShieldAlert,
  ShieldCheck,
  Clock,
  Users,
  Search,
  RefreshCw,
  ArrowLeft,
  KeyRound,
  AlertTriangle,
  CheckCircle2,
  XCircle,
  Copy,
  Check,
  QrCode,
  SlidersHorizontal,
  PlusCircle,
  RotateCcw,
  Send,
  Zap,
} from 'lucide-react';

interface Props {
  initialData: LiveProctorData;
  courseId: string;
  quizId: string;
}

export function TeacherLiveProctorClient({ initialData, courseId, quizId }: Props) {
  const router = useRouter();
  const [data, setData] = useState<LiveProctorData>(initialData);
  const [loading, setLoading] = useState(false);
  const [autoRefresh, setAutoRefresh] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('ALL');

  // Token Modal Projector
  const [isTokenModalOpen, setIsTokenModalOpen] = useState(false);
  const [tokenQrUrl, setTokenQrUrl] = useState<string>('');
  const [copiedToken, setCopiedToken] = useState(false);

  // Settings Modal
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [settingsRequireToken, setSettingsRequireToken] = useState(data.quiz.requireToken);
  const [settingsToken, setSettingsToken] = useState(data.quiz.token || '');
  const [settingsLockdown, setSettingsLockdown] = useState(data.quiz.enableLockdown);
  const [settingsMaxSwitches, setSettingsMaxSwitches] = useState(data.quiz.maxTabSwitches);
  const [savingSettings, setSavingSettings] = useState(false);

  // Action states
  const [actionLoadingId, setActionLoadingId] = useState<string | null>(null);

  // Generate QR code for token projector
  useEffect(() => {
    if (data.quiz.token) {
      QRCode.toDataURL(data.quiz.token, { width: 280, margin: 2 })
        .then((url) => setTokenQrUrl(url))
        .catch((err) => console.error(err));
    }
  }, [data.quiz.token]);

  // Polling every 6 seconds when autoRefresh is enabled
  useEffect(() => {
    if (!autoRefresh) return;

    const interval = setInterval(async () => {
      try {
        const freshData = await getLiveProctorData(quizId);
        setData(freshData);
      } catch (err) {
        console.error('Failed to poll proctor data', err);
      }
    }, 6000);

    return () => clearInterval(interval);
  }, [autoRefresh, quizId]);

  const handleManualRefresh = async () => {
    setLoading(true);
    try {
      const freshData = await getLiveProctorData(quizId);
      setData(freshData);
    } catch (err: any) {
      alert(err.message || 'Gagal memperbarui data');
    } finally {
      setLoading(false);
    }
  };

  const handleCopyToken = () => {
    if (!data.quiz.token) return;
    navigator.clipboard.writeText(data.quiz.token);
    setCopiedToken(true);
    setTimeout(() => setCopiedToken(false), 2000);
  };

  const handleGrantExtraTime = async (attemptId: string, minutes: number) => {
    if (!confirm(`Berikan tambahan waktu ${minutes} menit untuk siswa ini?`)) return;
    setActionLoadingId(attemptId);
    try {
      await grantExtraTime(attemptId, minutes);
      await handleManualRefresh();
    } catch (err: any) {
      alert(err.message || 'Gagal menambah waktu');
    } finally {
      setActionLoadingId(null);
    }
  };

  const handleForceSubmit = async (attemptId: string) => {
    if (!confirm('Paksa kumpulkan lembar ujian siswa ini sekarang?')) return;
    setActionLoadingId(attemptId);
    try {
      await forceSubmitAttempt(attemptId, 'Dikumpulkan secara manual oleh pengawas ujian.');
      await handleManualRefresh();
    } catch (err: any) {
      alert(err.message || 'Gagal mengumpulkan ujian siswa');
    } finally {
      setActionLoadingId(null);
    }
  };

  const handleResetAttempt = async (attemptId: string) => {
    if (!confirm('PERINGATAN: Apakah Anda yakin ingin mereset ujian siswa ini? Seluruh jawaban yang telah diisi akan dihapus dan siswa dapat memulai kembali dari awal.')) {
      return;
    }
    setActionLoadingId(attemptId);
    try {
      await resetStudentAttempt(attemptId);
      await handleManualRefresh();
    } catch (err: any) {
      alert(err.message || 'Gagal mereset ujian siswa');
    } finally {
      setActionLoadingId(null);
    }
  };

  const handleSaveSettings = async (e: React.FormEvent) => {
    e.preventDefault();
    setSavingSettings(true);
    try {
      await updateQuizSecuritySettings(quizId, {
        requireToken: settingsRequireToken,
        token: settingsRequireToken ? settingsToken : undefined,
        enableLockdown: settingsLockdown,
        maxTabSwitches: Number(settingsMaxSwitches),
      });

      await handleManualRefresh();
      setIsSettingsOpen(false);
    } catch (err: any) {
      alert(err.message || 'Gagal memperbarui pengaturan keamanan');
    } finally {
      setSavingSettings(false);
    }
  };

  // Format seconds to mm:ss
  const formatTimeRemaining = (seconds: number | null) => {
    if (seconds === null) return '-';
    if (seconds <= 0) return '00:00 (Habis)';
    const m = Math.floor(seconds / 60);
    const s = seconds % 60;
    return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
  };

  // Filter students
  const filteredStudents = data.students.filter((st) => {
    const matchesSearch =
      st.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (st.nis && st.nis.toLowerCase().includes(searchQuery.toLowerCase())) ||
      st.email.toLowerCase().includes(searchQuery.toLowerCase());

    if (!matchesSearch) return false;
    if (statusFilter === 'ALL') return true;
    return st.status === statusFilter;
  });

  return (
    <div className="space-y-6">
      {/* Header & Breadcrumb */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 text-xs font-semibold text-[#FF8928] uppercase tracking-wider mb-1">
            <Link
              href={`/teacher/course/${courseId}/quiz-attempts/${quizId}`}
              className="hover:underline flex items-center gap-1 text-gray-500 hover:text-[#002446]"
            >
              <ArrowLeft className="h-3.5 w-3.5" /> Kembali ke Riwayat Nilai
            </Link>
            <span>•</span>
            <span>Live Proctoring CBT</span>
          </div>
          <h1 className="text-2xl font-bold text-[#002446] flex items-center gap-2.5">
            <Shield className="h-6 w-6 text-emerald-600" />
            Live Proctoring — {data.quiz.title}
          </h1>
          <div className="flex flex-wrap items-center gap-2 mt-1.5 text-xs text-gray-500">
            <Badge variant="outline" className="font-semibold text-gray-700 bg-white">
              <Clock className="h-3 w-3 mr-1 text-[#002446]" />
              Durasi: {data.quiz.duration ? `${data.quiz.duration} Menit` : 'Tanpa Batas'}
            </Badge>

            <Badge
              className={
                data.quiz.enableLockdown
                  ? 'bg-rose-100 text-rose-800 hover:bg-rose-100'
                  : 'bg-gray-100 text-gray-600 hover:bg-gray-100'
              }
            >
              <ShieldAlert className="h-3 w-3 mr-1" />
              Lockdown CBT: {data.quiz.enableLockdown ? `Aktif (Toleransi ${data.quiz.maxTabSwitches}x)` : 'Non-aktif'}
            </Badge>

            {data.quiz.requireToken && data.quiz.token ? (
              <Badge className="bg-amber-100 text-amber-900 hover:bg-amber-100 font-mono tracking-wider font-bold">
                <KeyRound className="h-3 w-3 mr-1 text-[#FF8928]" />
                Token: {data.quiz.token}
              </Badge>
            ) : (
              <Badge variant="outline" className="text-gray-500">
                Tanpa Token
              </Badge>
            )}
          </div>
        </div>

        {/* Action Controls */}
        <div className="flex flex-wrap items-center gap-2">
          {data.quiz.requireToken && data.quiz.token && (
            <Button
              size="sm"
              onClick={() => setIsTokenModalOpen(true)}
              className="bg-[#002446] hover:bg-[#001b33] text-white flex items-center gap-1.5 text-xs font-bold"
            >
              <QrCode className="h-4 w-4 text-[#FF8928]" /> Proyektor Token
            </Button>
          )}

          <Button
            variant="outline"
            size="sm"
            onClick={() => setIsSettingsOpen(true)}
            className="flex items-center gap-1.5 text-xs text-gray-700"
          >
            <SlidersHorizontal className="h-3.5 w-3.5" /> Atur Keamanan
          </Button>

          <Button
            variant="outline"
            size="sm"
            onClick={handleManualRefresh}
            disabled={loading}
            className="flex items-center gap-1.5 text-xs"
          >
            <RefreshCw className={`h-3.5 w-3.5 ${loading ? 'animate-spin' : ''}`} />
            Segarkan
          </Button>

          <button
            onClick={() => setAutoRefresh(!autoRefresh)}
            className={`px-2.5 py-1.5 rounded-md text-xs font-semibold flex items-center gap-1.5 border transition-colors ${
              autoRefresh
                ? 'bg-emerald-50 border-emerald-300 text-emerald-700'
                : 'bg-gray-100 border-gray-300 text-gray-500'
            }`}
          >
            <span
              className={`h-2 w-2 rounded-full ${
                autoRefresh ? 'bg-emerald-500 animate-pulse' : 'bg-gray-400'
              }`}
            ></span>
            {autoRefresh ? 'Live (6s)' : 'Jeda Polling'}
          </button>
        </div>
      </div>

      {/* KPI Metrics Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
        <Card className="bg-white border-gray-200 shadow-sm">
          <CardContent className="p-4 text-center">
            <p className="text-[11px] font-semibold text-gray-500 uppercase">Total Peserta</p>
            <h3 className="text-2xl font-bold text-[#002446] mt-1">{data.stats.total}</h3>
            <p className="text-[10px] text-gray-400">Siswa Terdaftar</p>
          </CardContent>
        </Card>

        <Card className="bg-white border-gray-200 shadow-sm">
          <CardContent className="p-4 text-center">
            <p className="text-[11px] font-semibold text-blue-600 uppercase">Sedang Mengerjakan</p>
            <h3 className="text-2xl font-bold text-blue-600 mt-1">{data.stats.inProgress}</h3>
            <p className="text-[10px] text-gray-400">Di Layar Ujian</p>
          </CardContent>
        </Card>

        <Card className="bg-white border-gray-200 shadow-sm">
          <CardContent className="p-4 text-center">
            <p className="text-[11px] font-semibold text-emerald-600 uppercase">Sudah Selesai</p>
            <h3 className="text-2xl font-bold text-emerald-600 mt-1">{data.stats.submitted}</h3>
            <p className="text-[10px] text-gray-400">Telah Mengumpulkan</p>
          </CardContent>
        </Card>

        <Card className="bg-white border-gray-200 shadow-sm">
          <CardContent className="p-4 text-center">
            <p className="text-[11px] font-semibold text-gray-500 uppercase">Belum Mulai</p>
            <h3 className="text-2xl font-bold text-gray-600 mt-1">{data.stats.notStarted}</h3>
            <p className="text-[10px] text-gray-400">Menunggu Mulai</p>
          </CardContent>
        </Card>

        <Card className="bg-white border-gray-200 shadow-sm col-span-2 sm:col-span-1">
          <CardContent className="p-4 text-center">
            <p className="text-[11px] font-semibold text-rose-600 uppercase">Pelanggaran Layar</p>
            <h3 className="text-2xl font-bold text-rose-600 mt-1">{data.stats.violationsCount}</h3>
            <p className="text-[10px] text-rose-500 font-medium">
              {data.stats.terminated > 0 ? `${data.stats.terminated} Diskualifikasi` : 'Insiden Tab-Switch'}
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Filter and Search Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-white p-3.5 border border-gray-200 rounded-xl shadow-sm">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
          <Input
            placeholder="Cari siswa berdasarkan nama atau NIS..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-9 text-xs h-9"
          />
        </div>

        <div className="flex items-center gap-2">
          <span className="text-xs font-semibold text-gray-500 uppercase">Filter Status:</span>
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="h-9 px-2.5 text-xs border border-gray-300 rounded-md bg-white font-medium text-gray-700"
          >
            <option value="ALL">Semua Peserta ({data.students.length})</option>
            <option value="IN_PROGRESS">Sedang Mengerjakan ({data.stats.inProgress})</option>
            <option value="SUBMITTED">Sudah Selesai ({data.stats.submitted})</option>
            <option value="NOT_STARTED">Belum Mulai ({data.stats.notStarted})</option>
            <option value="TERMINATED">Diskualifikasi / Auto-Submit ({data.stats.terminated})</option>
          </select>
        </div>
      </div>

      {/* Live Proctoring Student Table */}
      <Card className="border border-gray-200 shadow-sm bg-white overflow-hidden">
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="bg-gray-50 border-b border-gray-200 text-xs font-semibold text-gray-600 uppercase">
                <tr>
                  <th className="px-4 py-3">No</th>
                  <th className="px-4 py-3">NIS</th>
                  <th className="px-4 py-3">Nama Siswa</th>
                  <th className="px-4 py-3 text-center">Status Ujian</th>
                  <th className="px-4 py-3 text-center">Keaktifan</th>
                  <th className="px-4 py-3 text-center">Sisa Waktu</th>
                  <th className="px-4 py-3 text-center">Pelanggaran Tab</th>
                  <th className="px-4 py-3 text-center">Nilai</th>
                  <th className="px-4 py-3 text-center">Aksi Pengawas</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {filteredStudents.length === 0 ? (
                  <tr>
                    <td colSpan={9} className="px-4 py-12 text-center text-gray-400 text-xs">
                      Tidak ada peserta yang cocok dengan filter atau pencarian.
                    </td>
                  </tr>
                ) : (
                  filteredStudents.map((st, idx) => {
                    const isActing = actionLoadingId === st.attemptId;

                    return (
                      <tr key={st.userId} className="hover:bg-gray-50/70 transition-colors">
                        <td className="px-4 py-3 text-gray-400 text-xs">{idx + 1}</td>
                        <td className="px-4 py-3 font-mono text-xs text-gray-600">
                          {st.nis || '-'}
                        </td>
                        <td className="px-4 py-3">
                          <div className="font-semibold text-gray-900">{st.name}</div>
                          <div className="text-[11px] text-gray-400">{st.email}</div>
                          {st.terminationReason && (
                            <div className="text-[10px] text-rose-600 font-medium mt-0.5">
                              Alasan: {st.terminationReason}
                            </div>
                          )}
                        </td>
                        <td className="px-4 py-3 text-center">
                          {st.status === 'IN_PROGRESS' ? (
                            <Badge className="bg-blue-100 text-blue-800 hover:bg-blue-100 font-semibold text-xs">
                              Mengerjakan
                            </Badge>
                          ) : st.status === 'SUBMITTED' ? (
                            <Badge className="bg-emerald-100 text-emerald-800 hover:bg-emerald-100 font-semibold text-xs">
                              Selesai
                            </Badge>
                          ) : st.status === 'TERMINATED' ? (
                            <Badge className="bg-rose-100 text-rose-800 hover:bg-rose-100 font-semibold text-xs">
                              Diskualifikasi
                            </Badge>
                          ) : (
                            <Badge variant="outline" className="text-gray-500 text-xs">
                              Belum Mulai
                            </Badge>
                          )}
                        </td>
                        <td className="px-4 py-3 text-center">
                          {st.status === 'IN_PROGRESS' ? (
                            <div className="inline-flex items-center gap-1.5 text-xs">
                              <span
                                className={`h-2.5 w-2.5 rounded-full ${
                                  st.isOnline ? 'bg-emerald-500 animate-pulse' : 'bg-gray-300'
                                }`}
                              ></span>
                              <span className={st.isOnline ? 'text-emerald-700 font-medium' : 'text-gray-400'}>
                                {st.isOnline ? 'Online' : 'Offline'}
                              </span>
                            </div>
                          ) : (
                            <span className="text-xs text-gray-400">-</span>
                          )}
                        </td>
                        <td className="px-4 py-3 text-center font-mono text-xs">
                          {st.status === 'IN_PROGRESS' ? (
                            <span
                              className={`font-bold ${
                                (st.remainingSeconds || 0) < 300
                                  ? 'text-rose-600 animate-pulse'
                                  : 'text-[#002446]'
                              }`}
                            >
                              {formatTimeRemaining(st.remainingSeconds)}
                              {st.extraTimeMinutes > 0 && (
                                <span className="text-[10px] text-emerald-600 block">
                                  (+{st.extraTimeMinutes}m)
                                </span>
                              )}
                            </span>
                          ) : (
                            <span className="text-gray-400">-</span>
                          )}
                        </td>
                        <td className="px-4 py-3 text-center">
                          <span
                            className={`inline-block px-2 py-0.5 rounded-full text-xs font-bold ${
                              st.tabSwitchCount === 0
                                ? 'bg-emerald-50 text-emerald-700'
                                : st.tabSwitchCount < data.quiz.maxTabSwitches
                                ? 'bg-amber-100 text-amber-800'
                                : 'bg-rose-100 text-rose-800'
                            }`}
                          >
                            {st.tabSwitchCount} / {data.quiz.maxTabSwitches}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-center font-bold text-xs text-[#002446]">
                          {st.score !== null ? st.score : '-'}
                        </td>
                        <td className="px-4 py-3">
                          <div className="flex items-center justify-center gap-1">
                            {st.status === 'IN_PROGRESS' && st.attemptId && (
                              <>
                                <Button
                                  size="sm"
                                  variant="outline"
                                  disabled={isActing}
                                  onClick={() => handleGrantExtraTime(st.attemptId!, 10)}
                                  className="h-7 px-2 text-[11px] border-emerald-500 text-emerald-700 hover:bg-emerald-50"
                                  title="Tambah Waktu +10 Menit"
                                >
                                  +10m
                                </Button>

                                <Button
                                  size="sm"
                                  variant="outline"
                                  disabled={isActing}
                                  onClick={() => handleForceSubmit(st.attemptId!)}
                                  className="h-7 px-2 text-[11px] border-amber-500 text-amber-700 hover:bg-amber-50"
                                  title="Paksa Kumpulkan"
                                >
                                  Paksa Submit
                                </Button>
                              </>
                            )}

                            {st.attemptId && (
                              <Button
                                size="sm"
                                variant="ghost"
                                disabled={isActing}
                                onClick={() => handleResetAttempt(st.attemptId!)}
                                className="h-7 px-2 text-[11px] text-rose-600 hover:bg-rose-50"
                                title="Reset / Izinkan Mulai Ulang"
                              >
                                <RotateCcw className="h-3 w-3 mr-1" /> Reset
                              </Button>
                            )}
                          </div>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>

      {/* Modal Proyektor Token */}
      <Dialog open={isTokenModalOpen} onOpenChange={setIsTokenModalOpen}>
        <DialogContent className="sm:max-w-md text-center">
          <DialogHeader>
            <DialogTitle className="text-xl font-bold text-[#002446]">
              {data.quiz.title}
            </DialogTitle>
            <DialogDescription className="text-xs text-gray-500">
              Tampilkan layar ini kepada siswa di depan kelas untuk memasukkan token ujian.
            </DialogDescription>
          </DialogHeader>

          <div className="py-6 flex flex-col items-center justify-center space-y-4">
            {tokenQrUrl ? (
              <div className="p-3 bg-white border-2 border-[#002446] rounded-xl shadow-md inline-block">
                <img src={tokenQrUrl} alt="QR Code Token" className="w-56 h-56 mx-auto" />
              </div>
            ) : null}

            <div className="space-y-1 text-center">
              <p className="text-xs text-gray-500 uppercase tracking-wider font-semibold">
                Token Akses Ujian Resmi
              </p>
              <div className="flex items-center justify-center gap-2">
                <span className="font-mono text-4xl font-extrabold tracking-widest text-[#002446] bg-gray-100 px-5 py-2 rounded-xl border border-gray-200">
                  {data.quiz.token}
                </span>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={handleCopyToken}
                  className="h-12 w-12 p-0"
                  title="Salin Token"
                >
                  {copiedToken ? <Check className="h-5 w-5 text-emerald-600" /> : <Copy className="h-5 w-5" />}
                </Button>
              </div>
            </div>

            <p className="text-xs text-gray-500 max-w-xs">
              Siswa tidak dapat memulai ujian sebelum memasukkan kode token yang tertera di atas.
            </p>
          </div>

          <DialogFooter className="sm:justify-center">
            <Button
              onClick={() => setIsTokenModalOpen(false)}
              className="bg-[#002446] hover:bg-[#001b33] text-white px-8"
            >
              Tutup Layar Proyektor
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Modal Edit Pengaturan Keamanan */}
      <Dialog open={isSettingsOpen} onOpenChange={setIsSettingsOpen}>
        <DialogContent className="sm:max-w-md">
          <form onSubmit={handleSaveSettings}>
            <DialogHeader>
              <DialogTitle className="text-xl font-bold text-[#002446]">
                Pengaturan Keamanan CBT
              </DialogTitle>
              <DialogDescription className="text-xs text-gray-500">
                Sesuaikan aturan token dan toleransi lockdown untuk kuis ini secara instan.
              </DialogDescription>
            </DialogHeader>

            <div className="space-y-4 py-4">
              <div className="p-3 bg-gray-50 rounded-lg space-y-2 border">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <input
                      type="checkbox"
                      id="setRequireToken"
                      checked={settingsRequireToken}
                      onChange={(e) => {
                        setSettingsRequireToken(e.target.checked);
                        if (e.target.checked && !settingsToken) {
                          setSettingsToken(Math.random().toString(36).substring(2, 8).toUpperCase());
                        }
                      }}
                      className="rounded border-gray-300 text-[#002446] focus:ring-[#002446]"
                    />
                    <Label htmlFor="setRequireToken" className="text-xs font-bold cursor-pointer">
                      Wajibkan Token Akses Ujian
                    </Label>
                  </div>
                  {settingsRequireToken && (
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      onClick={() => setSettingsToken(Math.random().toString(36).substring(2, 8).toUpperCase())}
                      className="h-6 px-2 text-[10px] text-[#FF8928]"
                    >
                      <RefreshCw className="h-3 w-3 mr-1" /> Acak
                    </Button>
                  )}
                </div>

                {settingsRequireToken && (
                  <Input
                    placeholder="misal: PAS2026"
                    value={settingsToken}
                    onChange={(e) => setSettingsToken(e.target.value.toUpperCase())}
                    maxLength={8}
                    className="font-mono text-center text-sm font-bold tracking-widest uppercase h-9 bg-white"
                    required={settingsRequireToken}
                  />
                )}
              </div>

              <div className="p-3 bg-gray-50 rounded-lg space-y-2 border">
                <div className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    id="setLockdown"
                    checked={settingsLockdown}
                    onChange={(e) => setSettingsLockdown(e.target.checked)}
                    className="rounded border-gray-300 text-[#002446] focus:ring-[#002446]"
                  />
                  <Label htmlFor="setLockdown" className="text-xs font-bold cursor-pointer">
                    Mode Lockdown CBT (Fullscreen & Anti-Curang)
                  </Label>
                </div>

                {settingsLockdown && (
                  <div className="pt-2 flex items-center justify-between border-t border-gray-200">
                    <span className="text-xs text-gray-600 font-medium">Batas Pindah Tab:</span>
                    <select
                      value={settingsMaxSwitches}
                      onChange={(e) => setSettingsMaxSwitches(Number(e.target.value))}
                      className="h-8 px-2 text-xs border border-gray-300 rounded bg-white text-gray-800 font-bold"
                    >
                      <option value={1}>1 kali (Sangat Ketat)</option>
                      <option value={2}>2 kali</option>
                      <option value={3}>3 kali (Standar)</option>
                      <option value={5}>5 kali (Longgar)</option>
                    </select>
                  </div>
                )}
              </div>
            </div>

            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                onClick={() => setIsSettingsOpen(false)}
                disabled={savingSettings}
              >
                Batal
              </Button>
              <Button
                type="submit"
                disabled={savingSettings}
                className="bg-[#002446] hover:bg-[#001b33] text-white"
              >
                {savingSettings ? 'Menyimpan...' : 'Simpan Perubahan'}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
