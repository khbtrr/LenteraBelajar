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
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { UsersRound, Plus, UserPlus, Trash2, Search } from 'lucide-react';
import {
  createCohort,
  addStudentToCohort,
  removeStudentFromCohort,
} from '@/lib/actions/cohort';
import { useDialog } from '@/context/DialogContext';

interface Student {
  id: string;
  name: string;
  email: string;
  nis: string | null;
}

interface CohortItem {
  id: string;
  name: string;
  members: { user: Student }[];
  _count: {
    members: number;
    enrollments: number;
  };
}

export function CohortsClient({
  initialCohorts,
  availableStudents,
}: {
  initialCohorts: CohortItem[];
  availableStudents: Student[];
}) {
  const { showAlert, showConfirm } = useDialog();
  const [cohorts, setCohorts] = useState<CohortItem[]>(initialCohorts);
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [cohortName, setCohortName] = useState('');
  const [selectedCohort, setSelectedCohort] = useState<CohortItem | null>(null);
  const [selectedStudentId, setSelectedStudentId] = useState('');
  const [loading, setLoading] = useState(false);
  const [search, setSearch] = useState('');

  const handleCreateCohort = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!cohortName.trim()) return;
    setLoading(true);
    try {
      const created = await createCohort(cohortName);
      setCohorts((prev) => [
        {
          ...created,
          members: [],
          _count: { members: 0, enrollments: 0 },
        },
        ...prev,
      ]);
      setCohortName('');
      setIsCreateOpen(false);
      await showAlert(`Grup kohort "${created.name}" berhasil dibuat!`, { type: 'success' });
    } catch (err: any) {
      console.error(err);
      await showAlert(err?.message || 'Gagal membuat grup kohort', { type: 'error' });
    } finally {
      setLoading(false);
    }
  };

  const handleAddMember = async () => {
    if (!selectedCohort || !selectedStudentId) return;
    setLoading(true);
    try {
      await addStudentToCohort(selectedCohort.id, selectedStudentId);
      const studentObj = availableStudents.find((s) => s.id === selectedStudentId);
      if (studentObj) {
        const updatedMembers = [
          ...selectedCohort.members,
          { user: studentObj },
        ];
        const updatedCohort = {
          ...selectedCohort,
          members: updatedMembers,
          _count: {
            ...selectedCohort._count,
            members: updatedMembers.length,
          },
        };
        setSelectedCohort(updatedCohort);
        setCohorts((prev) =>
          prev.map((c) => (c.id === selectedCohort.id ? updatedCohort : c))
        );
      }
      setSelectedStudentId('');
      await showAlert('Siswa berhasil ditambahkan ke grup kohort!', { type: 'success' });
    } catch (err: any) {
      console.error(err);
      await showAlert(err?.message || 'Gagal menambahkan siswa ke kohort', { type: 'error' });
    } finally {
      setLoading(false);
    }
  };

  const handleRemoveMember = async (userId: string) => {
    if (!selectedCohort) return;
    const confirmed = await showConfirm(
      'Keluarkan siswa ini dari grup kohort?',
      { title: 'Keluarkan dari Kohort', confirmText: 'Ya, Keluarkan', confirmVariant: 'destructive' }
    );
    if (!confirmed) return;

    setLoading(true);
    try {
      await removeStudentFromCohort(selectedCohort.id, userId);
      const updatedMembers = selectedCohort.members.filter(
        (m) => m.user.id !== userId
      );
      const updatedCohort = {
        ...selectedCohort,
        members: updatedMembers,
        _count: {
          ...selectedCohort._count,
          members: updatedMembers.length,
        },
      };
      setSelectedCohort(updatedCohort);
      setCohorts((prev) =>
        prev.map((c) => (c.id === selectedCohort.id ? updatedCohort : c))
      );
      await showAlert('Siswa berhasil dikeluarkan dari kohort.', { type: 'success' });
    } catch (err: any) {
      console.error(err);
      await showAlert(err?.message || 'Gagal mengeluarkan siswa dari kohort', { type: 'error' });
    } finally {
      setLoading(false);
    }
  };

  // Filter students who are not already in the selected cohort
  const unenrolledStudents = availableStudents.filter(
    (s) => !selectedCohort?.members.some((m) => m.user.id === s.id)
  );

  const filteredCohorts = cohorts.filter((c) =>
    c.name.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
        <div className="relative w-full sm:w-72">
          <Search className="absolute left-3 top-3 h-4 w-4 text-gray-400" />
          <Input
            placeholder="Cari nama kohort..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9 bg-white"
          />
        </div>

        <Button
          onClick={() => setIsCreateOpen(true)}
          className="bg-[#002446] hover:bg-[#002446]/90 text-white flex items-center gap-2 w-full sm:w-auto justify-center"
        >
          <Plus className="h-4 w-4" /> Buat Grup Kohort
        </Button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {filteredCohorts.length === 0 ? (
          <div className="col-span-full text-center py-12 text-gray-500 bg-white rounded-lg border">
            <UsersRound className="h-12 w-12 mx-auto text-gray-300 mb-2" />
            <p>Belum ada grup kohort yang dibuat.</p>
          </div>
        ) : (
          filteredCohorts.map((cohort) => (
            <Card key={cohort.id} className="border hover:shadow-sm transition-shadow">
              <CardHeader className="pb-3">
                <div className="flex items-center justify-between">
                  <Badge variant="outline" className="text-xs">
                    {cohort._count.enrollments} Course Sinkron
                  </Badge>
                  <Badge className="bg-[#FF8928] text-white text-xs">
                    {cohort._count.members} Siswa
                  </Badge>
                </div>
                <CardTitle className="text-lg font-bold text-[#002446] mt-2">
                  {cohort.name}
                </CardTitle>
              </CardHeader>

              <CardContent className="space-y-3 pt-0">
                <div className="text-xs text-gray-500 line-clamp-2">
                  {cohort.members.length > 0 ? (
                    cohort.members.map((m) => m.user.name).join(', ')
                  ) : (
                    <span className="italic">Belum ada siswa di dalam grup ini.</span>
                  )}
                </div>

                <div className="pt-3 border-t">
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => setSelectedCohort(cohort)}
                    className="w-full border-[#002446] text-[#002446] hover:bg-[#002446] hover:text-white flex items-center justify-center gap-1.5"
                  >
                    <UserPlus className="h-4 w-4" /> Kelola Anggota Siswa
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))
        )}
      </div>

      {/* Modal Buat Kohort */}
      <Dialog open={isCreateOpen} onOpenChange={setIsCreateOpen}>
        <DialogContent className="sm:max-w-md">
          <form onSubmit={handleCreateCohort}>
            <DialogHeader>
              <DialogTitle className="text-xl font-bold text-[#002446]">
                Buat Grup Kohort Baru
              </DialogTitle>
            </DialogHeader>
            <div className="space-y-4 py-4">
              <div className="space-y-2">
                <Label htmlFor="chName">Nama Grup Kohort</Label>
                <Input
                  id="chName"
                  placeholder="misal: Kohort-X-MIPA-1-2026"
                  value={cohortName}
                  onChange={(e) => setCohortName(e.target.value)}
                  required
                />
                <p className="text-xs text-gray-500">
                  Gunakan format penamaan yang mudah diidentifikasi (Kelas-Jurusan-Rombel-Tahun).
                </p>
              </div>
            </div>
            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                onClick={() => setIsCreateOpen(false)}
              >
                Batal
              </Button>
              <Button
                type="submit"
                disabled={loading}
                className="bg-[#002446] hover:bg-[#002446]/90 text-white"
              >
                {loading ? 'Menyimpan...' : 'Simpan'}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Modal Kelola Anggota Kohort */}
      <Dialog
        open={Boolean(selectedCohort)}
        onOpenChange={(open) => !open && setSelectedCohort(null)}
      >
        <DialogContent className="sm:max-w-2xl max-h-[85vh] flex flex-col">
          <DialogHeader>
            <DialogTitle className="text-xl font-bold text-[#002446]">
              Anggota {selectedCohort?.name}
            </DialogTitle>
          </DialogHeader>

          <div className="space-y-4 py-3 flex-1 overflow-hidden flex flex-col">
            {/* Tambah siswa ke kohort */}
            <div className="flex items-center gap-2 p-3 bg-gray-50 rounded-lg border">
              <div className="flex-1">
                <select
                  value={selectedStudentId}
                  onChange={(e) => setSelectedStudentId(e.target.value)}
                  className="w-full h-10 px-3 rounded-md border border-gray-300 bg-white text-sm focus:outline-none focus:ring-2 focus:ring-[#002446]"
                >
                  <option value="">-- Pilih Siswa untuk Ditambahkan --</option>
                  {unenrolledStudents.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.name} {s.nis ? `(NIS: ${s.nis})` : ''} - {s.email}
                    </option>
                  ))}
                </select>
              </div>
              <Button
                type="button"
                onClick={handleAddMember}
                disabled={!selectedStudentId || loading}
                className="bg-[#FF8928] hover:bg-[#FF8928]/90 text-white"
              >
                <Plus className="h-4 w-4 mr-1" /> Tambahkan
              </Button>
            </div>

            {/* List anggota saat ini */}
            <div className="flex-1 overflow-y-auto border rounded-lg">
              <Table>
                <TableHeader>
                  <TableRow className="bg-gray-50">
                    <TableHead>NIS</TableHead>
                    <TableHead>Nama Siswa</TableHead>
                    <TableHead>Email</TableHead>
                    <TableHead className="text-right">Aksi</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {!selectedCohort?.members || selectedCohort.members.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={4} className="text-center py-6 text-gray-500">
                        Belum ada siswa dalam grup ini.
                      </TableCell>
                    </TableRow>
                  ) : (
                    selectedCohort.members.map((m) => (
                      <TableRow key={m.user.id}>
                        <TableCell className="font-mono text-xs">
                          {m.user.nis || '-'}
                        </TableCell>
                        <TableCell className="font-medium text-[#002446]">
                          {m.user.name}
                        </TableCell>
                        <TableCell className="text-xs text-gray-500">
                          {m.user.email}
                        </TableCell>
                        <TableCell className="text-right">
                          <Button
                            size="sm"
                            variant="ghost"
                            className="text-red-500 hover:text-red-700 hover:bg-red-50"
                            onClick={() => handleRemoveMember(m.user.id)}
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
            </div>
          </div>

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => setSelectedCohort(null)}
            >
              Tutup
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
