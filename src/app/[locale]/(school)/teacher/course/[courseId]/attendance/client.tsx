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
import { exportToExcel } from '@/lib/export';
import {
  createAttendanceSession,
  toggleAttendanceSession,
  deleteAttendanceSession,
  updateAttendanceRecord,
  getSessionDetails,
  syncAttendanceToGradebook,
  AttendanceSessionItem,
} from '@/lib/actions/attendance';
import { AttendanceStatus } from '@prisma/client';
import {
  Calendar,
  Clock,
  QrCode,
  Lock,
  Unlock,
  Plus,
  Download,
  CheckCircle2,
  AlertCircle,
  HelpCircle,
  XCircle,
  Trash2,
  RefreshCw,
  Award,
  Users,
  ChevronDown,
  ChevronUp,
  FileSpreadsheet,
  ArrowLeft,
  Copy,
  Check,
} from 'lucide-react';

interface Props {
  course: any;
  modules: any[];
  initialSessions: AttendanceSessionItem[];
  recapData: {
    sessions: Array<{ id: string; title: string; date: Date }>;
    students: Array<{
      student: { id: string; name: string; email: string; nis: string | null };
      present: number;
      sick: number;
      permission: number;
      absent: number;
      totalSessions: number;
      rate: number;
      sessions: Array<{
        sessionId: string;
        sessionTitle: string;
        date: Date;
        status: AttendanceStatus;
      }>;
    }>;
  };
}

export function TeacherAttendanceClient({
  course,
  modules,
  initialSessions,
  recapData,
}: Props) {
  const router = useRouter();
  const [activeTab, setActiveTab] = useState<'sessions' | 'matrix'>('sessions');
  const [sessions, setSessions] = useState<AttendanceSessionItem[]>(initialSessions);
  const [loading, setLoading] = useState(false);

  // Sesi Aktif / Terbuka untuk edit detail peserta
  const [expandedSessionId, setExpandedSessionId] = useState<string | null>(
    initialSessions[0]?.id || null
  );
  const [activeSessionDetails, setActiveSessionDetails] = useState<any | null>(null);
  const [loadingDetails, setLoadingDetails] = useState(false);

  // Modal Sesi Baru
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [newTitle, setNewTitle] = useState('');
  const [newDate, setNewDate] = useState(new Date().toISOString().split('T')[0]);
  const [newStartTime, setNewStartTime] = useState('');
  const [newEndTime, setNewEndTime] = useState('');
  const [newModuleId, setNewModuleId] = useState('');
  const [newToken, setNewToken] = useState('');
  const [allowSelfCheckin, setAllowSelfCheckin] = useState(true);

  // Modal QR & Token Projector
  const [qrModalSession, setQrModalSession] = useState<AttendanceSessionItem | null>(null);
  const [qrDataUrl, setQrDataUrl] = useState<string>('');
  const [copiedToken, setCopiedToken] = useState(false);

  // Sinkronisasi Buku Nilai
  const [syncing, setSyncing] = useState(false);
  const [syncSuccessMessage, setSyncSuccessMessage] = useState<string | null>(null);

  // Load session details when expanding
  useEffect(() => {
    if (!expandedSessionId) {
      setActiveSessionDetails(null);
      return;
    }

    let isMounted = true;
    setLoadingDetails(true);
    getSessionDetails(expandedSessionId)
      .then((data) => {
        if (isMounted) {
          setActiveSessionDetails(data);
          setLoadingDetails(false);
        }
      })
      .catch((err) => {
        console.error(err);
        if (isMounted) setLoadingDetails(false);
      });

    return () => {
      isMounted = false;
    };
  }, [expandedSessionId]);

  // Generate QR code when QR modal is opened
  useEffect(() => {
    if (!qrModalSession || !qrModalSession.token) {
      setQrDataUrl('');
      return;
    }

    QRCode.toDataURL(qrModalSession.token, { width: 300, margin: 2 })
      .then((url) => setQrDataUrl(url))
      .catch((err) => console.error('Error generating QR', err));
  }, [qrModalSession]);

  const handleCreateSession = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newTitle.trim()) return;

    setLoading(true);
    try {
      const created = await createAttendanceSession({
        courseId: course.id,
        title: newTitle,
        date: newDate,
        startTime: newStartTime ? `${newDate}T${newStartTime}:00` : undefined,
        endTime: newEndTime ? `${newDate}T${newEndTime}:00` : undefined,
        moduleId: newModuleId || undefined,
        token: newToken || undefined,
        allowSelfCheckin,
      });

      setIsCreateOpen(false);
      setNewTitle('');
      setNewToken('');
      router.refresh();
      setExpandedSessionId(created.id);
    } catch (err: any) {
      alert(err.message || 'Gagal membuat sesi presensi');
    } finally {
      setLoading(false);
    }
  };

  const handleToggleOpen = async (sessionId: string, currentIsOpen: boolean) => {
    try {
      await toggleAttendanceSession(sessionId, !currentIsOpen);
      setSessions((prev) =>
        prev.map((s) => (s.id === sessionId ? { ...s, isOpen: !currentIsOpen } : s))
      );
      if (activeSessionDetails && activeSessionDetails.id === sessionId) {
        setActiveSessionDetails({ ...activeSessionDetails, isOpen: !currentIsOpen });
      }
      router.refresh();
    } catch (err: any) {
      alert(err.message || 'Gagal mengubah status sesi');
    }
  };

  const handleDeleteSession = async (sessionId: string) => {
    if (!confirm('Apakah Anda yakin ingin menghapus sesi presensi ini beserta seluruh data kehadirannya?')) {
      return;
    }

    try {
      await deleteAttendanceSession(sessionId);
      setSessions((prev) => prev.filter((s) => s.id !== sessionId));
      if (expandedSessionId === sessionId) setExpandedSessionId(null);
      router.refresh();
    } catch (err: any) {
      alert(err.message || 'Gagal menghapus sesi');
    }
  };

  const handleStatusChange = async (recordId: string, newStatus: AttendanceStatus) => {
    if (!activeSessionDetails) return;

    // Optimistic UI update
    const previousRecords = [...activeSessionDetails.records];
    setActiveSessionDetails({
      ...activeSessionDetails,
      records: activeSessionDetails.records.map((r: any) =>
        r.id === recordId ? { ...r, status: newStatus } : r
      ),
    });

    try {
      await updateAttendanceRecord(recordId, newStatus);
      router.refresh();
    } catch (err: any) {
      alert(err.message || 'Gagal mengupdate status kehadiran');
      setActiveSessionDetails({ ...activeSessionDetails, records: previousRecords });
    }
  };

  const handleCopyToken = (token: string) => {
    navigator.clipboard.writeText(token);
    setCopiedToken(true);
    setTimeout(() => setCopiedToken(false), 2000);
  };

  const handleSyncGradebook = async () => {
    if (!confirm('Sinkronkan nilai persentase kehadiran ke Buku Nilai (Gradebook) sekarang?')) {
      return;
    }

    setSyncing(true);
    setSyncSuccessMessage(null);
    try {
      const res = await syncAttendanceToGradebook(course.id, 'Nilai Presensi', 100);
      setSyncSuccessMessage(`Berhasil menyinkronkan nilai presensi untuk ${res.count} siswa ke Gradebook!`);
      setTimeout(() => setSyncSuccessMessage(null), 5000);
    } catch (err: any) {
      alert(err.message || 'Gagal menyinkronkan ke Buku Nilai');
    } finally {
      setSyncing(false);
    }
  };

  const handleExportExcel = () => {
    const rows = recapData.students.map((st, index) => {
      const row: Record<string, unknown> = {
        No: index + 1,
        NIS: st.student.nis || '-',
        'Nama Siswa': st.student.name,
        Email: st.student.email,
      };

      recapData.sessions.forEach((sess) => {
        const sRecord = st.sessions.find((s) => s.sessionId === sess.id);
        const statusLetter =
          sRecord?.status === 'PRESENT'
            ? 'H'
            : sRecord?.status === 'SICK'
            ? 'S'
            : sRecord?.status === 'PERMISSION'
            ? 'I'
            : 'A';
        row[sess.title] = statusLetter;
      });

      row['Total Hadir (H)'] = st.present;
      row['Total Sakit (S)'] = st.sick;
      row['Total Izin (I)'] = st.permission;
      row['Total Alpa (A)'] = st.absent;
      row['Persentase Kehadiran'] = `${st.rate}%`;

      return row;
    });

    exportToExcel(rows, `Rekap_Presensi_${course.title.replace(/\s+/g, '_')}`);
  };

  // Calculate overall class attendance rate
  const overallRate =
    recapData.students.length > 0
      ? Math.round(
          recapData.students.reduce((acc, curr) => acc + curr.rate, 0) /
            recapData.students.length
        )
      : 0;

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
            Presensi & Kehadiran Siswa — {course.title}
          </h1>
          <p className="text-sm text-gray-500">
            Kelola sesi pertemuan, buka kode token/QR check-in, dan tinjau rekapitulasi kehadiran kelas.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={handleExportExcel}
            className="flex items-center gap-1.5"
          >
            <Download className="h-4 w-4" /> Ekspor Excel
          </Button>

          <Button
            variant="outline"
            size="sm"
            onClick={handleSyncGradebook}
            disabled={syncing}
            className="flex items-center gap-1.5 border-emerald-600 text-emerald-700 hover:bg-emerald-50"
          >
            <Award className="h-4 w-4" />
            {syncing ? 'Menyinkronkan...' : 'Sinkron ke Gradebook'}
          </Button>

          <Button
            size="sm"
            onClick={() => setIsCreateOpen(true)}
            className="bg-[#002446] hover:bg-[#001b33] text-white flex items-center gap-1.5"
          >
            <Plus className="h-4 w-4" /> Buka Sesi Baru
          </Button>
        </div>
      </div>

      {syncSuccessMessage && (
        <div className="p-3 bg-emerald-50 border border-emerald-200 text-emerald-800 rounded-lg text-sm flex items-center gap-2">
          <CheckCircle2 className="h-4 w-4 text-emerald-600" />
          {syncSuccessMessage}
        </div>
      )}

      {/* Metrics Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <Card className="bg-white border-gray-200 shadow-sm">
          <CardContent className="p-4 flex items-center justify-between">
            <div>
              <p className="text-xs font-semibold text-gray-500 uppercase">Total Sesi Pertemuan</p>
              <h3 className="text-2xl font-bold text-[#002446] mt-1">{sessions.length}</h3>
            </div>
            <div className="h-10 w-10 rounded-full bg-blue-50 flex items-center justify-center text-blue-600">
              <Calendar className="h-5 w-5" />
            </div>
          </CardContent>
        </Card>

        <Card className="bg-white border-gray-200 shadow-sm">
          <CardContent className="p-4 flex items-center justify-between">
            <div>
              <p className="text-xs font-semibold text-gray-500 uppercase">Rata-rata Kehadiran</p>
              <h3 className="text-2xl font-bold text-emerald-600 mt-1">{overallRate}%</h3>
            </div>
            <div className="h-10 w-10 rounded-full bg-emerald-50 flex items-center justify-center text-emerald-600">
              <CheckCircle2 className="h-5 w-5" />
            </div>
          </CardContent>
        </Card>

        <Card className="bg-white border-gray-200 shadow-sm">
          <CardContent className="p-4 flex items-center justify-between">
            <div>
              <p className="text-xs font-semibold text-gray-500 uppercase">Total Siswa Terdaftar</p>
              <h3 className="text-2xl font-bold text-[#FF8928] mt-1">{recapData.students.length}</h3>
            </div>
            <div className="h-10 w-10 rounded-full bg-amber-50 flex items-center justify-center text-[#FF8928]">
              <Users className="h-5 w-5" />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Navigation Tabs */}
      <div className="flex border-b border-gray-200 gap-4">
        <button
          onClick={() => setActiveTab('sessions')}
          className={`pb-3 text-sm font-semibold transition-colors flex items-center gap-2 border-b-2 ${
            activeTab === 'sessions'
              ? 'border-[#002446] text-[#002446]'
              : 'border-transparent text-gray-500 hover:text-gray-700'
          }`}
        >
          <Calendar className="h-4 w-4" />
          Sesi Pertemuan Presensi ({sessions.length})
        </button>

        <button
          onClick={() => setActiveTab('matrix')}
          className={`pb-3 text-sm font-semibold transition-colors flex items-center gap-2 border-b-2 ${
            activeTab === 'matrix'
              ? 'border-[#002446] text-[#002446]'
              : 'border-transparent text-gray-500 hover:text-gray-700'
          }`}
        >
          <FileSpreadsheet className="h-4 w-4" />
          Matriks Rekapitulasi Kelas
        </button>
      </div>

      {/* Tab 1: Sesi Pertemuan */}
      {activeTab === 'sessions' && (
        <div className="space-y-4">
          {sessions.length === 0 ? (
            <Card className="text-center py-16">
              <CardContent className="space-y-4">
                <Calendar className="h-16 w-16 mx-auto text-gray-300" />
                <div className="space-y-1">
                  <h3 className="text-lg font-bold text-gray-900">Belum Ada Sesi Presensi</h3>
                  <p className="text-sm text-gray-500 max-w-md mx-auto">
                    Buka sesi presensi pertemuan kelas pertama Anda untuk mengaktifkan kode check-in atau menginput daftar hadir siswa.
                  </p>
                </div>
                <Button onClick={() => setIsCreateOpen(true)} className="bg-[#002446] text-white">
                  <Plus className="h-4 w-4 mr-1.5" /> Buka Sesi Pertama
                </Button>
              </CardContent>
            </Card>
          ) : (
            sessions.map((sess) => {
              const isExpanded = expandedSessionId === sess.id;
              const formattedDate = new Date(sess.date).toLocaleDateString('id-ID', {
                weekday: 'long',
                day: 'numeric',
                month: 'long',
                year: 'numeric',
              });

              return (
                <Card key={sess.id} className="border border-gray-200 overflow-hidden shadow-sm bg-white">
                  {/* Sesi Header Bar */}
                  <div className="p-4 sm:p-5 flex flex-col md:flex-row md:items-center justify-between gap-4 bg-gray-50/50">
                    <div className="space-y-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="font-bold text-base text-[#002446]">{sess.title}</span>
                        {sess.moduleTitle && (
                          <Badge variant="outline" className="text-xs bg-white text-gray-600">
                            Modul: {sess.moduleTitle}
                          </Badge>
                        )}
                        <Badge
                          className={
                            sess.isOpen
                              ? 'bg-emerald-100 text-emerald-800 hover:bg-emerald-100'
                              : 'bg-gray-200 text-gray-700 hover:bg-gray-200'
                          }
                        >
                          {sess.isOpen ? 'Sesi Terbuka' : 'Sesi Dikunci'}
                        </Badge>
                      </div>

                      <div className="flex flex-wrap items-center gap-4 text-xs text-gray-500">
                        <span className="flex items-center gap-1">
                          <Calendar className="h-3.5 w-3.5 text-gray-400" />
                          {formattedDate}
                        </span>
                        {sess.startTime && sess.endTime && (
                          <span className="flex items-center gap-1">
                            <Clock className="h-3.5 w-3.5 text-gray-400" />
                            {new Date(sess.startTime).toLocaleTimeString('id-ID', {
                              hour: '2-digit',
                              minute: '2-digit',
                            })}{' '}
                            -{' '}
                            {new Date(sess.endTime).toLocaleTimeString('id-ID', {
                              hour: '2-digit',
                              minute: '2-digit',
                            })}
                          </span>
                        )}
                      </div>
                    </div>

                    {/* Sesi Action Buttons */}
                    <div className="flex flex-wrap items-center gap-2">
                      {sess.token && (
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => setQrModalSession(sess)}
                          className="text-xs font-semibold flex items-center gap-1.5 border-[#002446] text-[#002446] hover:bg-blue-50"
                        >
                          <QrCode className="h-4 w-4 text-[#FF8928]" />
                          Token: <span className="font-mono tracking-widest">{sess.token}</span>
                        </Button>
                      )}

                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => handleToggleOpen(sess.id, sess.isOpen)}
                        className={`text-xs flex items-center gap-1.5 ${
                          sess.isOpen ? 'text-amber-700 hover:bg-amber-50' : 'text-emerald-700 hover:bg-emerald-50'
                        }`}
                      >
                        {sess.isOpen ? (
                          <>
                            <Lock className="h-3.5 w-3.5" /> Kunci Sesi
                          </>
                        ) : (
                          <>
                            <Unlock className="h-3.5 w-3.5" /> Buka Sesi
                          </>
                        )}
                      </Button>

                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleDeleteSession(sess.id)}
                        className="text-red-600 hover:bg-red-50 text-xs px-2"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>

                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => setExpandedSessionId(isExpanded ? null : sess.id)}
                        className="text-xs text-gray-700 font-medium"
                      >
                        {isExpanded ? (
                          <>
                            Tutup Detail <ChevronUp className="h-4 w-4 ml-1" />
                          </>
                        ) : (
                          <>
                            Daftar Hadir ({sess.counts.present}/{sess.counts.total}){' '}
                            <ChevronDown className="h-4 w-4 ml-1" />
                          </>
                        )}
                      </Button>
                    </div>
                  </div>

                  {/* Summary Bar */}
                  <div className="px-5 py-2.5 bg-white border-t border-b border-gray-100 flex flex-wrap items-center gap-4 text-xs font-medium">
                    <span className="text-emerald-700 flex items-center gap-1">
                      <span className="h-2 w-2 rounded-full bg-emerald-500"></span>
                      Hadir: {sess.counts.present}
                    </span>
                    <span className="text-amber-700 flex items-center gap-1">
                      <span className="h-2 w-2 rounded-full bg-amber-500"></span>
                      Sakit: {sess.counts.sick}
                    </span>
                    <span className="text-blue-700 flex items-center gap-1">
                      <span className="h-2 w-2 rounded-full bg-blue-500"></span>
                      Izin: {sess.counts.permission}
                    </span>
                    <span className="text-rose-700 flex items-center gap-1">
                      <span className="h-2 w-2 rounded-full bg-rose-500"></span>
                      Alpa: {sess.counts.absent}
                    </span>
                  </div>

                  {/* Expanded Student Attendance Table */}
                  {isExpanded && (
                    <div className="p-5 bg-white">
                      {loadingDetails ? (
                        <div className="py-8 text-center text-sm text-gray-500 flex items-center justify-center gap-2">
                          <RefreshCw className="h-4 w-4 animate-spin text-[#002446]" />
                          Memuat data daftar hadir siswa...
                        </div>
                      ) : activeSessionDetails && activeSessionDetails.records ? (
                        <div className="overflow-x-auto border border-gray-200 rounded-lg">
                          <table className="w-full text-left text-sm">
                            <thead className="bg-gray-50 border-b border-gray-200 text-xs font-semibold text-gray-600 uppercase">
                              <tr>
                                <th className="px-4 py-3">No</th>
                                <th className="px-4 py-3">NIS</th>
                                <th className="px-4 py-3">Nama Siswa</th>
                                <th className="px-4 py-3">Waktu Check-in</th>
                                <th className="px-4 py-3 text-center">Status Kehadiran</th>
                              </tr>
                            </thead>
                            <tbody className="divide-y divide-gray-100">
                              {activeSessionDetails.records.map((rec: any, idx: number) => {
                                const checkInTimeFormatted = rec.checkInAt
                                  ? new Date(rec.checkInAt).toLocaleTimeString('id-ID', {
                                      hour: '2-digit',
                                      minute: '2-digit',
                                      second: '2-digit',
                                    })
                                  : '-';

                                return (
                                  <tr key={rec.id} className="hover:bg-gray-50/60 transition-colors">
                                    <td className="px-4 py-3 text-gray-400 text-xs">{idx + 1}</td>
                                    <td className="px-4 py-3 font-mono text-xs text-gray-600">
                                      {rec.user?.nis || '-'}
                                    </td>
                                    <td className="px-4 py-3 font-medium text-gray-900">
                                      {rec.user?.name}
                                    </td>
                                    <td className="px-4 py-3 text-xs text-gray-500">
                                      {checkInTimeFormatted}
                                    </td>
                                    <td className="px-4 py-3">
                                      <div className="flex items-center justify-center gap-1.5">
                                        <button
                                          onClick={() => handleStatusChange(rec.id, AttendanceStatus.PRESENT)}
                                          className={`px-2.5 py-1 text-xs font-bold rounded transition-colors ${
                                            rec.status === AttendanceStatus.PRESENT
                                              ? 'bg-emerald-600 text-white shadow-sm'
                                              : 'bg-gray-100 text-gray-600 hover:bg-emerald-100 hover:text-emerald-800'
                                          }`}
                                          title="Hadir"
                                        >
                                          H
                                        </button>
                                        <button
                                          onClick={() => handleStatusChange(rec.id, AttendanceStatus.SICK)}
                                          className={`px-2.5 py-1 text-xs font-bold rounded transition-colors ${
                                            rec.status === AttendanceStatus.SICK
                                              ? 'bg-amber-500 text-white shadow-sm'
                                              : 'bg-gray-100 text-gray-600 hover:bg-amber-100 hover:text-amber-800'
                                          }`}
                                          title="Sakit"
                                        >
                                          S
                                        </button>
                                        <button
                                          onClick={() => handleStatusChange(rec.id, AttendanceStatus.PERMISSION)}
                                          className={`px-2.5 py-1 text-xs font-bold rounded transition-colors ${
                                            rec.status === AttendanceStatus.PERMISSION
                                              ? 'bg-blue-600 text-white shadow-sm'
                                              : 'bg-gray-100 text-gray-600 hover:bg-blue-100 hover:text-blue-800'
                                          }`}
                                          title="Izin"
                                        >
                                          I
                                        </button>
                                        <button
                                          onClick={() => handleStatusChange(rec.id, AttendanceStatus.ABSENT)}
                                          className={`px-2.5 py-1 text-xs font-bold rounded transition-colors ${
                                            rec.status === AttendanceStatus.ABSENT
                                              ? 'bg-rose-600 text-white shadow-sm'
                                              : 'bg-gray-100 text-gray-600 hover:bg-rose-100 hover:text-rose-800'
                                          }`}
                                          title="Alpa"
                                        >
                                          A
                                        </button>
                                      </div>
                                    </td>
                                  </tr>
                                );
                              })}
                            </tbody>
                          </table>
                        </div>
                      ) : null}
                    </div>
                  )}
                </Card>
              );
            })
          )}
        </div>
      )}

      {/* Tab 2: Matriks Rekap Kelas */}
      {activeTab === 'matrix' && (
        <Card className="border border-gray-200 shadow-sm bg-white">
          <CardHeader className="pb-3">
            <CardTitle className="text-lg font-bold text-[#002446]">
              Rekapitulasi Kehadiran Kelas Keseluruhan
            </CardTitle>
            <CardDescription className="text-xs text-gray-500">
              Keterangan: <strong>H</strong> = Hadir, <strong>S</strong> = Sakit, <strong>I</strong> = Izin, <strong>A</strong> = Alpa. Persentase dihitung dari (H + I) / Total Sesi.
            </CardDescription>
          </CardHeader>
          <CardContent className="p-0">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-gray-50 border-y border-gray-200 font-semibold text-gray-600 uppercase">
                  <tr>
                    <th className="px-4 py-3">No</th>
                    <th className="px-4 py-3">NIS</th>
                    <th className="px-4 py-3 min-w-[180px]">Nama Siswa</th>
                    {recapData.sessions.map((sess, idx) => (
                      <th
                        key={sess.id}
                        className="px-2 py-3 text-center border-l border-gray-200 whitespace-nowrap"
                        title={sess.title}
                      >
                        P{idx + 1}
                      </th>
                    ))}
                    <th className="px-3 py-3 text-center border-l border-gray-200 text-emerald-700">H</th>
                    <th className="px-3 py-3 text-center text-amber-700">S</th>
                    <th className="px-3 py-3 text-center text-blue-700">I</th>
                    <th className="px-3 py-3 text-center text-rose-700">A</th>
                    <th className="px-4 py-3 text-center bg-gray-100 border-l border-gray-200">% Hadir</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {recapData.students.map((st, idx) => (
                    <tr key={st.student.id} className="hover:bg-gray-50 transition-colors">
                      <td className="px-4 py-2.5 text-gray-400">{idx + 1}</td>
                      <td className="px-4 py-2.5 font-mono text-gray-600">{st.student.nis || '-'}</td>
                      <td className="px-4 py-2.5 font-medium text-gray-900">{st.student.name}</td>
                      {recapData.sessions.map((sess) => {
                        const rec = st.sessions.find((s) => s.sessionId === sess.id);
                        const status = rec?.status || 'ABSENT';
                        const badgeColor =
                          status === 'PRESENT'
                            ? 'text-emerald-700 bg-emerald-50'
                            : status === 'SICK'
                            ? 'text-amber-700 bg-amber-50'
                            : status === 'PERMISSION'
                            ? 'text-blue-700 bg-blue-50'
                            : 'text-rose-700 bg-rose-50';
                        const label = status === 'PRESENT' ? 'H' : status === 'SICK' ? 'S' : status === 'PERMISSION' ? 'I' : 'A';
                        return (
                          <td
                            key={sess.id}
                            className="px-2 py-2.5 text-center border-l border-gray-100 font-bold"
                          >
                            <span className={`inline-block px-1.5 py-0.5 rounded text-[11px] ${badgeColor}`}>
                              {label}
                            </span>
                          </td>
                        );
                      })}
                      <td className="px-3 py-2.5 text-center border-l border-gray-100 font-semibold text-emerald-700">
                        {st.present}
                      </td>
                      <td className="px-3 py-2.5 text-center font-semibold text-amber-700">{st.sick}</td>
                      <td className="px-3 py-2.5 text-center font-semibold text-blue-700">{st.permission}</td>
                      <td className="px-3 py-2.5 text-center font-semibold text-rose-700">{st.absent}</td>
                      <td className="px-4 py-2.5 text-center bg-gray-50/80 border-l border-gray-200 font-bold text-[#002446]">
                        {st.rate}%
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Modal QR Code & Token Projector */}
      <Dialog open={!!qrModalSession} onOpenChange={(open) => !open && setQrModalSession(null)}>
        <DialogContent className="sm:max-w-md text-center">
          <DialogHeader>
            <DialogTitle className="text-xl font-bold text-[#002446]">
              {qrModalSession?.title}
            </DialogTitle>
            <DialogDescription className="text-xs text-gray-500">
              Tampilkan layar ini kepada siswa di kelas untuk scan QR atau masukkan kode 6-digit.
            </DialogDescription>
          </DialogHeader>

          <div className="py-6 flex flex-col items-center justify-center space-y-4">
            {qrDataUrl ? (
              <div className="p-3 bg-white border-2 border-[#002446] rounded-xl shadow-md inline-block">
                <img src={qrDataUrl} alt="QR Code Presensi" className="w-56 h-56 mx-auto" />
              </div>
            ) : (
              <div className="h-56 w-56 bg-gray-100 flex items-center justify-center text-xs text-gray-400">
                Membuat QR Code...
              </div>
            )}

            <div className="space-y-1 text-center">
              <p className="text-xs text-gray-500 uppercase tracking-wider font-semibold">
                Kode Token Check-in Mandiri
              </p>
              <div className="flex items-center justify-center gap-2">
                <span className="font-mono text-4xl font-extrabold tracking-widest text-[#002446] bg-gray-100 px-4 py-1.5 rounded-lg border border-gray-200">
                  {qrModalSession?.token}
                </span>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => qrModalSession?.token && handleCopyToken(qrModalSession.token)}
                  className="h-11 w-11 p-0"
                  title="Salin Token"
                >
                  {copiedToken ? <Check className="h-5 w-5 text-emerald-600" /> : <Copy className="h-5 w-5" />}
                </Button>
              </div>
            </div>
          </div>

          <DialogFooter className="sm:justify-center">
            <Button
              onClick={() => setQrModalSession(null)}
              className="bg-[#002446] hover:bg-[#001b33] text-white px-8"
            >
              Selesai / Tutup
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Modal Buka Sesi Baru */}
      <Dialog open={isCreateOpen} onOpenChange={setIsCreateOpen}>
        <DialogContent className="sm:max-w-lg">
          <form onSubmit={handleCreateSession}>
            <DialogHeader>
              <DialogTitle className="text-xl font-bold text-[#002446]">
                Buka Sesi Presensi Baru
              </DialogTitle>
              <DialogDescription className="text-xs text-gray-500">
                Buat sesi pertemuan untuk merekam absensi siswa dengan kode token unik.
              </DialogDescription>
            </DialogHeader>

            <div className="space-y-4 py-4">
              <div className="space-y-1.5">
                <Label htmlFor="sessionTitle">Judul Pertemuan *</Label>
                <Input
                  id="sessionTitle"
                  placeholder="Contoh: Pertemuan 3: Praktikum Basis Data"
                  value={newTitle}
                  onChange={(e) => setNewTitle(e.target.value)}
                  required
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label htmlFor="sessionDate">Tanggal *</Label>
                  <Input
                    id="sessionDate"
                    type="date"
                    value={newDate}
                    onChange={(e) => setNewDate(e.target.value)}
                    required
                  />
                </div>

                <div className="space-y-1.5">
                  <Label htmlFor="sessionModule">Terkait Modul (Opsional)</Label>
                  <select
                    id="sessionModule"
                    value={newModuleId}
                    onChange={(e) => setNewModuleId(e.target.value)}
                    className="w-full h-10 px-3 border border-gray-300 rounded-md text-sm bg-white"
                  >
                    <option value="">-- Tanpa Modul Khusus --</option>
                    {modules.map((m) => (
                      <option key={m.id} value={m.id}>
                        {m.title}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label htmlFor="sessionStartTime">Waktu Mulai (Opsional)</Label>
                  <Input
                    id="sessionStartTime"
                    type="time"
                    value={newStartTime}
                    onChange={(e) => setNewStartTime(e.target.value)}
                  />
                </div>

                <div className="space-y-1.5">
                  <Label htmlFor="sessionEndTime">Waktu Berakhir (Opsional)</Label>
                  <Input
                    id="sessionEndTime"
                    type="time"
                    value={newEndTime}
                    onChange={(e) => setNewEndTime(e.target.value)}
                  />
                </div>
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="sessionCustomToken">
                  Kode Token Kustom (Kosongkan untuk acak 6-digit)
                </Label>
                <Input
                  id="sessionCustomToken"
                  placeholder="Contoh: BIO123 atau kosongkan"
                  value={newToken}
                  onChange={(e) => setNewToken(e.target.value.toUpperCase())}
                  maxLength={8}
                  className="font-mono uppercase"
                />
              </div>

              <div className="flex items-center gap-2 pt-2">
                <input
                  type="checkbox"
                  id="allowSelfCheckin"
                  checked={allowSelfCheckin}
                  onChange={(e) => setAllowSelfCheckin(e.target.checked)}
                  className="h-4 w-4 rounded border-gray-300 text-[#002446] focus:ring-[#002446]"
                />
                <Label htmlFor="allowSelfCheckin" className="text-xs cursor-pointer">
                  Izinkan siswa melakukan check-in mandiri dengan token/QR
                </Label>
              </div>
            </div>

            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                onClick={() => setIsCreateOpen(false)}
                disabled={loading}
              >
                Batal
              </Button>
              <Button
                type="submit"
                disabled={loading}
                className="bg-[#002446] hover:bg-[#001b33] text-white"
              >
                {loading ? 'Menyimpan...' : 'Buka Sesi Sekarang'}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
