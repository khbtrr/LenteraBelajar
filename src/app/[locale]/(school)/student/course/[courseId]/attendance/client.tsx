'use client';

import { useState, useEffect, useRef } from 'react';
import { Link } from '@/i18n/navigation';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { studentCheckIn } from '@/lib/actions/attendance';
import { AttendanceStatus } from '@prisma/client';
import {
  Calendar,
  Clock,
  QrCode,
  CheckCircle2,
  AlertCircle,
  ArrowLeft,
  KeyRound,
  ShieldCheck,
  Award,
} from 'lucide-react';

interface Props {
  course: any;
  overview: {
    totalSessions: number;
    presentCount: number;
    sickCount: number;
    permissionCount: number;
    absentCount: number;
    attendanceRate: number;
    history: Array<{
      sessionId: string;
      title: string;
      date: Date;
      startTime: Date | null;
      endTime: Date | null;
      isOpen: boolean;
      allowSelfCheckin: boolean;
      moduleTitle: string | null;
      status: AttendanceStatus;
      checkInAt: Date | null;
      notes: string | null;
    }>;
  };
  activeSession: any | null;
}

export function StudentAttendanceClient({
  course,
  overview,
  activeSession,
}: Props) {
  const router = useRouter();
  const [tokenInput, setTokenInput] = useState('');
  const [checkingIn, setCheckingIn] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  // Check if current user is already marked present in the active session
  const activeRecord = activeSession
    ? overview.history.find((h) => h.sessionId === activeSession.id)
    : null;
  const isAlreadyPresent = activeRecord?.status === AttendanceStatus.PRESENT;

  const handleCheckIn = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeSession) return;
    if (!tokenInput.trim()) {
      setErrorMessage('Harap masukkan kode token presensi.');
      return;
    }

    setCheckingIn(true);
    setErrorMessage(null);
    setSuccessMessage(null);

    try {
      const res = await studentCheckIn(activeSession.id, tokenInput.trim());
      if (res.success) {
        setSuccessMessage('Presensi berhasil dicatat! Anda dinyatakan Hadir.');
        setTokenInput('');
        router.refresh();
      } else {
        setErrorMessage(res.error || 'Gagal melakukan check-in');
      }
    } catch (err: any) {
      setErrorMessage(err.message || 'Terjadi kesalahan sistem');
    } finally {
      setCheckingIn(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Header & Breadcrumb */}
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
          Presensi & Kehadiran — {course.title}
        </h1>
        <p className="text-sm text-gray-500">
          Guru Pengampu: <strong>{course.teacher.name}</strong> • Pantau rekap kehadiran dan masukkan kode token check-in mandiri.
        </p>
      </div>

      {/* Active Session Check-in Box */}
      {activeSession && (
        <Card className="border-2 border-[#002446] shadow-md bg-gradient-to-r from-blue-50/70 via-white to-amber-50/40 overflow-hidden">
          <CardContent className="p-6">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
              <div className="space-y-2 flex-1">
                <div className="flex items-center gap-2">
                  <span className="relative flex h-3 w-3">
                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                    <span className="relative inline-flex rounded-full h-3 w-3 bg-emerald-500"></span>
                  </span>
                  <Badge className="bg-emerald-600 text-white text-xs">
                    Sesi Presensi Sedang Dibuka
                  </Badge>
                  {activeSession.moduleTitle && (
                    <Badge variant="outline" className="text-xs">
                      Modul: {activeSession.moduleTitle}
                    </Badge>
                  )}
                </div>

                <h3 className="text-xl font-bold text-[#002446]">{activeSession.title}</h3>

                <div className="flex flex-wrap items-center gap-4 text-xs text-gray-600">
                  <span className="flex items-center gap-1">
                    <Calendar className="h-3.5 w-3.5 text-gray-400" />
                    {new Date(activeSession.date).toLocaleDateString('id-ID', {
                      weekday: 'long',
                      day: 'numeric',
                      month: 'long',
                      year: 'numeric',
                    })}
                  </span>
                  {activeSession.startTime && activeSession.endTime && (
                    <span className="flex items-center gap-1">
                      <Clock className="h-3.5 w-3.5 text-gray-400" />
                      {new Date(activeSession.startTime).toLocaleTimeString('id-ID', {
                        hour: '2-digit',
                        minute: '2-digit',
                      })}{' '}
                      -{' '}
                      {new Date(activeSession.endTime).toLocaleTimeString('id-ID', {
                        hour: '2-digit',
                        minute: '2-digit',
                      })}
                    </span>
                  )}
                </div>
              </div>

              {/* Check-in Form or Present Status */}
              <div className="w-full md:w-80">
                {isAlreadyPresent ? (
                  <div className="p-4 bg-emerald-100/70 border border-emerald-300 rounded-xl text-center space-y-1.5">
                    <div className="inline-flex p-2 bg-emerald-600 text-white rounded-full">
                      <CheckCircle2 className="h-6 w-6" />
                    </div>
                    <h4 className="font-bold text-emerald-900 text-sm">
                      Anda Sudah Tercatat Hadir
                    </h4>
                    <p className="text-xs text-emerald-700">
                      Waktu check-in:{' '}
                      {activeRecord?.checkInAt
                        ? new Date(activeRecord.checkInAt).toLocaleTimeString('id-ID', {
                            hour: '2-digit',
                            minute: '2-digit',
                            second: '2-digit',
                          })
                        : 'Sesi ini'}
                    </p>
                  </div>
                ) : (
                  <form onSubmit={handleCheckIn} className="space-y-3 bg-white p-4 rounded-xl border border-gray-200 shadow-sm">
                    <div className="space-y-1">
                      <Label htmlFor="token" className="text-xs font-semibold text-gray-700 flex items-center gap-1">
                        <KeyRound className="h-3.5 w-3.5 text-[#FF8928]" /> Masukkan Kode Token Kelas
                      </Label>
                      <Input
                        id="token"
                        placeholder="Contoh: 847291"
                        value={tokenInput}
                        onChange={(e) => setTokenInput(e.target.value.toUpperCase())}
                        maxLength={8}
                        className="font-mono text-center text-lg font-bold tracking-widest uppercase h-11"
                        required
                      />
                    </div>

                    {errorMessage && (
                      <p className="text-xs text-rose-600 flex items-center gap-1">
                        <AlertCircle className="h-3.5 w-3.5" /> {errorMessage}
                      </p>
                    )}

                    {successMessage && (
                      <p className="text-xs text-emerald-600 flex items-center gap-1">
                        <CheckCircle2 className="h-3.5 w-3.5" /> {successMessage}
                      </p>
                    )}

                    <Button
                      type="submit"
                      disabled={checkingIn}
                      className="w-full bg-[#002446] hover:bg-[#001b33] text-white text-xs h-10 font-bold"
                    >
                      {checkingIn ? 'Memproses...' : 'Kirim Presensi Hadir'}
                    </Button>
                  </form>
                )}
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Statistics Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
        <Card className="bg-white border-gray-200 shadow-sm col-span-2 sm:col-span-1">
          <CardContent className="p-4 text-center">
            <p className="text-xs font-semibold text-gray-500 uppercase">Tingkat Kehadiran</p>
            <h3 className="text-3xl font-extrabold text-[#002446] mt-1">
              {overview.attendanceRate}%
            </h3>
            <p className="text-[11px] text-gray-400 mt-0.5">Dari {overview.totalSessions} pertemuan</p>
          </CardContent>
        </Card>

        <Card className="bg-white border-gray-200 shadow-sm">
          <CardContent className="p-4 text-center">
            <p className="text-xs font-semibold text-emerald-700 uppercase">Hadir (H)</p>
            <h3 className="text-2xl font-bold text-emerald-600 mt-1">{overview.presentCount}</h3>
            <p className="text-[11px] text-gray-400 mt-0.5">Sesi</p>
          </CardContent>
        </Card>

        <Card className="bg-white border-gray-200 shadow-sm">
          <CardContent className="p-4 text-center">
            <p className="text-xs font-semibold text-amber-700 uppercase">Sakit (S)</p>
            <h3 className="text-2xl font-bold text-amber-600 mt-1">{overview.sickCount}</h3>
            <p className="text-[11px] text-gray-400 mt-0.5">Sesi</p>
          </CardContent>
        </Card>

        <Card className="bg-white border-gray-200 shadow-sm">
          <CardContent className="p-4 text-center">
            <p className="text-xs font-semibold text-blue-700 uppercase">Izin (I)</p>
            <h3 className="text-2xl font-bold text-blue-600 mt-1">{overview.permissionCount}</h3>
            <p className="text-[11px] text-gray-400 mt-0.5">Sesi</p>
          </CardContent>
        </Card>

        <Card className="bg-white border-gray-200 shadow-sm">
          <CardContent className="p-4 text-center">
            <p className="text-xs font-semibold text-rose-700 uppercase">Alpa (A)</p>
            <h3 className="text-2xl font-bold text-rose-600 mt-1">{overview.absentCount}</h3>
            <p className="text-[11px] text-gray-400 mt-0.5">Sesi</p>
          </CardContent>
        </Card>
      </div>

      {/* History Table */}
      <Card className="border border-gray-200 shadow-sm bg-white">
        <CardHeader className="p-5 pb-3">
          <CardTitle className="text-lg font-bold text-[#002446]">
            Riwayat Pertemuan & Presensi
          </CardTitle>
          <CardDescription className="text-xs text-gray-500">
            Daftar sesi pertemuan kelas yang telah dan sedang berlangsung pada mata pelajaran ini.
          </CardDescription>
        </CardHeader>
        <CardContent className="p-0">
          {overview.history.length === 0 ? (
            <div className="py-12 text-center text-gray-400 text-sm">
              Belum ada sesi presensi pertemuan yang diadakan oleh guru.
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm">
                <thead className="bg-gray-50 border-y border-gray-200 text-xs font-semibold text-gray-600 uppercase">
                  <tr>
                    <th className="px-4 py-3">No</th>
                    <th className="px-4 py-3">Pertemuan</th>
                    <th className="px-4 py-3">Tanggal</th>
                    <th className="px-4 py-3">Waktu Check-in</th>
                    <th className="px-4 py-3 text-center">Status Anda</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {overview.history.map((h, idx) => {
                    const badge =
                      h.status === AttendanceStatus.PRESENT ? (
                        <Badge className="bg-emerald-100 text-emerald-800 hover:bg-emerald-100 font-bold">
                          Hadir
                        </Badge>
                      ) : h.status === AttendanceStatus.SICK ? (
                        <Badge className="bg-amber-100 text-amber-800 hover:bg-amber-100 font-bold">
                          Sakit
                        </Badge>
                      ) : h.status === AttendanceStatus.PERMISSION ? (
                        <Badge className="bg-blue-100 text-blue-800 hover:bg-blue-100 font-bold">
                          Izin
                        </Badge>
                      ) : (
                        <Badge className="bg-rose-100 text-rose-800 hover:bg-rose-100 font-bold">
                          Alpa
                        </Badge>
                      );

                    return (
                      <tr key={h.sessionId} className="hover:bg-gray-50/70 transition-colors">
                        <td className="px-4 py-3 text-gray-400 text-xs">{idx + 1}</td>
                        <td className="px-4 py-3">
                          <div className="font-semibold text-gray-900">{h.title}</div>
                          {h.moduleTitle && (
                            <div className="text-xs text-gray-500">Modul: {h.moduleTitle}</div>
                          )}
                        </td>
                        <td className="px-4 py-3 text-xs text-gray-600">
                          {new Date(h.date).toLocaleDateString('id-ID', {
                            day: 'numeric',
                            month: 'long',
                            year: 'numeric',
                          })}
                        </td>
                        <td className="px-4 py-3 text-xs text-gray-500 font-mono">
                          {h.checkInAt
                            ? new Date(h.checkInAt).toLocaleTimeString('id-ID', {
                                hour: '2-digit',
                                minute: '2-digit',
                              })
                            : '-'}
                        </td>
                        <td className="px-4 py-3 text-center">{badge}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
