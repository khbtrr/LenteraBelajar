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
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Users, UserPlus, RefreshCw, Trash2, CheckCircle2, Search } from 'lucide-react';
import {
  syncCohortToCourse,
  manualEnrollStudent,
  removeEnrollment,
} from '@/lib/actions/cohort';

interface EnrolledUser {
  id: string;
  name: string;
  email: string;
  nis: string | null;
}

interface EnrollmentItem {
  id: string;
  method: 'COHORT_SYNC' | 'MANUAL';
  createdAt: Date;
  user: EnrolledUser;
  cohort: { id: string; name: string } | null;
}

interface CohortOption {
  id: string;
  name: string;
  _count: { members: number };
}

interface StudentOption {
  id: string;
  name: string;
  email: string;
  nis: string | null;
}

export function CourseEnrollmentsClient({
  course,
  availableCohorts,
  availableStudents,
}: {
  course: any;
  availableCohorts: CohortOption[];
  availableStudents: StudentOption[];
}) {
  const [enrollments, setEnrollments] = useState<EnrollmentItem[]>(course.enrollments || []);
  const [isCohortSyncOpen, setIsCohortSyncOpen] = useState(false);
  const [isManualOpen, setIsManualOpen] = useState(false);
  const [selectedCohortId, setSelectedCohortId] = useState(availableCohorts[0]?.id || '');
  const [selectedStudentId, setSelectedStudentId] = useState('');
  const [loading, setLoading] = useState(false);
  const [search, setSearch] = useState('');
  const [alertMsg, setAlertMsg] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  const handleSyncCohort = async () => {
    if (!selectedCohortId) return;
    setLoading(true);
    setAlertMsg(null);
    try {
      const res = await syncCohortToCourse(course.id, selectedCohortId);
      const cohortObj = availableCohorts.find((c) => c.id === selectedCohortId);
      setAlertMsg({
        type: 'success',
        text: `Sukses menyinkronkan grup kohort "${cohortObj?.name}". ${res.enrolledCount} siswa telah didaftarkan ke course.`,
      });
      setIsCohortSyncOpen(false);
      // Refresh page or update list
      window.location.reload();
    } catch (err) {
      console.error(err);
      setAlertMsg({ type: 'error', text: 'Gagal menyinkronkan kohort' });
    } finally {
      setLoading(false);
    }
  };

  const handleManualEnroll = async () => {
    if (!selectedStudentId) return;
    setLoading(true);
    setAlertMsg(null);
    try {
      await manualEnrollStudent(course.id, selectedStudentId);
      const studentObj = availableStudents.find((s) => s.id === selectedStudentId);
      if (studentObj) {
        setEnrollments((prev) => [
          ...prev,
          {
            id: `temp-${Date.now()}`,
            method: 'MANUAL',
            createdAt: new Date(),
            user: studentObj,
            cohort: null,
          },
        ]);
        setAlertMsg({
          type: 'success',
          text: `Siswa ${studentObj.name} berhasil didaftarkan secara manual.`,
        });
      }
      setIsManualOpen(false);
      setSelectedStudentId('');
    } catch (err) {
      console.error(err);
      setAlertMsg({ type: 'error', text: 'Gagal mendaftarkan siswa' });
    } finally {
      setLoading(false);
    }
  };

  const handleRemoveStudent = async (userId: string, userName: string) => {
    if (!confirm(`Keluarkan siswa "${userName}" dari course ini?`)) return;
    setLoading(true);
    try {
      await removeEnrollment(course.id, userId);
      setEnrollments((prev) => prev.filter((e) => e.user.id !== userId));
    } catch (err) {
      console.error(err);
      alert('Gagal mengeluarkan siswa');
    } finally {
      setLoading(false);
    }
  };

  const unenrolledStudents = availableStudents.filter(
    (s) => !enrollments.some((e) => e.user.id === s.id)
  );

  const filteredEnrollments = enrollments.filter((e) => {
    const q = search.toLowerCase();
    return (
      e.user.name.toLowerCase().includes(q) ||
      e.user.email.toLowerCase().includes(q) ||
      (e.user.nis || '').includes(q) ||
      (e.cohort?.name || '').toLowerCase().includes(q)
    );
  });

  return (
    <div className="space-y-6">
      {alertMsg && (
        <div
          className={`p-4 rounded-lg text-sm flex items-center gap-2 ${
            alertMsg.type === 'success'
              ? 'bg-green-50 border border-green-200 text-green-800'
              : 'bg-red-50 border border-red-200 text-red-800'
          }`}
        >
          <CheckCircle2 className="h-4 w-4" />
          {alertMsg.text}
        </div>
      )}

      {/* Action Header */}
      <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
        <div className="relative w-full sm:w-80">
          <Search className="absolute left-3 top-3 h-4 w-4 text-gray-400" />
          <Input
            placeholder="Cari NIS, nama, atau kohort..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9 bg-white"
          />
        </div>

        <div className="flex items-center gap-2 w-full sm:w-auto">
          {/* Main Enrollment Method: Cohort Sync */}
          <Button
            onClick={() => setIsCohortSyncOpen(true)}
            className="bg-[#FF8928] hover:bg-[#FF8928]/90 text-white flex items-center gap-2 font-medium"
          >
            <RefreshCw className="h-4 w-4" />
            Cohort Sync / Add Group
          </Button>

          <Button
            variant="outline"
            onClick={() => setIsManualOpen(true)}
            className="border-[#002446] text-[#002446] hover:bg-[#002446] hover:text-white flex items-center gap-2"
          >
            <UserPlus className="h-4 w-4" />
            Daftar Manual
          </Button>
        </div>
      </div>

      <Card>
        <CardHeader className="pb-3 flex flex-row items-center justify-between">
          <CardTitle className="text-lg font-bold text-[#002446] flex items-center gap-2">
            <Users className="h-5 w-5 text-[#FF8928]" />
            Daftar Siswa Terdaftar ({enrollments.length})
          </CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow className="bg-gray-50">
                <TableHead>NIS</TableHead>
                <TableHead>Nama Siswa</TableHead>
                <TableHead>Email</TableHead>
                <TableHead>Metode Enrollment</TableHead>
                <TableHead>Tanggal Terdaftar</TableHead>
                <TableHead className="text-right">Aksi</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredEnrollments.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={6} className="text-center py-12 text-gray-500">
                    <Users className="h-10 w-10 mx-auto text-gray-300 mb-2" />
                    Belum ada siswa yang terdaftar di course ini.
                    <p className="text-xs text-gray-400 mt-1">
                      Gunakan tombol <strong>Cohort Sync / Add Group</strong> di atas untuk mendaftarkan seluruh siswa dari suatu kohort sekaligus.
                    </p>
                  </TableCell>
                </TableRow>
              ) : (
                filteredEnrollments.map((enr) => (
                  <TableRow key={enr.id}>
                    <TableCell className="font-mono text-xs">
                      {enr.user.nis || '-'}
                    </TableCell>
                    <TableCell className="font-medium text-[#002446]">
                      {enr.user.name}
                    </TableCell>
                    <TableCell className="text-xs text-gray-500">
                      {enr.user.email}
                    </TableCell>
                    <TableCell>
                      {enr.method === 'COHORT_SYNC' ? (
                        <Badge className="bg-[#002446] text-white text-xs font-normal">
                          Cohort Sync: {enr.cohort?.name || 'Grup'}
                        </Badge>
                      ) : (
                        <Badge variant="outline" className="text-xs font-normal">
                          Manual
                        </Badge>
                      )}
                    </TableCell>
                    <TableCell className="text-xs text-gray-600">
                      {new Date(enr.createdAt).toLocaleDateString('id-ID', {
                        day: 'numeric',
                        month: 'short',
                        year: 'numeric',
                      })}
                    </TableCell>
                    <TableCell className="text-right">
                      <Button
                        size="sm"
                        variant="ghost"
                        className="text-red-500 hover:text-red-700 hover:bg-red-50"
                        onClick={() => handleRemoveStudent(enr.user.id, enr.user.name)}
                        disabled={loading}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* Dialog Cohort Sync */}
      <Dialog open={isCohortSyncOpen} onOpenChange={setIsCohortSyncOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="text-xl font-bold text-[#002446] flex items-center gap-2">
              <RefreshCw className="h-5 w-5 text-[#FF8928]" />
              Enrollment Method: Cohort Sync
            </DialogTitle>
          </DialogHeader>

          <div className="space-y-4 py-4">
            <p className="text-sm text-gray-600">
              Pilih grup kohort yang sesuai. Seluruh siswa di dalam kohort tersebut otomatis akan terdaftar di course ini.
            </p>

            <div className="space-y-2">
              <Label htmlFor="cohortSelect">Pilih Grup Kohort</Label>
              <select
                id="cohortSelect"
                value={selectedCohortId}
                onChange={(e) => setSelectedCohortId(e.target.value)}
                className="w-full h-10 px-3 rounded-md border border-gray-300 bg-white text-sm focus:outline-none focus:ring-2 focus:ring-[#002446]"
              >
                {availableCohorts.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name} ({c._count.members} Siswa)
                  </option>
                ))}
              </select>
            </div>
          </div>

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => setIsCohortSyncOpen(false)}
            >
              Batal
            </Button>
            <Button
              type="button"
              onClick={handleSyncCohort}
              disabled={loading || !selectedCohortId}
              className="bg-[#FF8928] hover:bg-[#FF8928]/90 text-white"
            >
              {loading ? 'Menyinkronkan...' : 'Sinkronkan & Daftarkan'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Dialog Pendaftaran Manual */}
      <Dialog open={isManualOpen} onOpenChange={setIsManualOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="text-xl font-bold text-[#002446] flex items-center gap-2">
              <UserPlus className="h-5 w-5 text-[#002446]" />
              Pendaftaran Siswa Manual
            </DialogTitle>
          </DialogHeader>

          <div className="space-y-4 py-4">
            <p className="text-sm text-gray-600">
              Pilih satu per satu siswa untuk didaftarkan secara mandiri ke course ini.
            </p>

            <div className="space-y-2">
              <Label htmlFor="manualStudentSelect">Pilih Siswa</Label>
              <select
                id="manualStudentSelect"
                value={selectedStudentId}
                onChange={(e) => setSelectedStudentId(e.target.value)}
                className="w-full h-10 px-3 rounded-md border border-gray-300 bg-white text-sm focus:outline-none focus:ring-2 focus:ring-[#002446]"
              >
                <option value="">-- Pilih Siswa --</option>
                {unenrolledStudents.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.name} {s.nis ? `(NIS: ${s.nis})` : ''} - {s.email}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => setIsManualOpen(false)}
            >
              Batal
            </Button>
            <Button
              type="button"
              onClick={handleManualEnroll}
              disabled={loading || !selectedStudentId}
              className="bg-[#002446] hover:bg-[#002446]/90 text-white"
            >
              {loading ? 'Mendaftarkan...' : 'Daftarkan Siswa'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
