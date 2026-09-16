'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
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
import { Label } from '@/components/ui/label';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  UsersRound,
  Plus,
  UserPlus,
  Trash2,
  Search,
  TrendingUp,
  Award,
  Download,
  CheckCircle2,
  UserMinus,
  CheckSquare,
  Square,
  AlertCircle,
  ArrowRight,
  Filter,
} from 'lucide-react';
import {
  createCohort,
  addStudentToCohort,
  removeStudentFromCohort,
  bulkAddStudentsToCohort,
  bulkRemoveStudentsFromCohort,
  promoteCohortStudents,
  graduateCohortStudents,
} from '@/lib/actions/cohort';
import { useDialog } from '@/context/DialogContext';
import * as XLSX from 'xlsx';

interface Student {
  id: string;
  name: string;
  email: string;
  nis: string | null;
  cohortMemberships?: {
    cohort: { id: string; name: string };
  }[];
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
  const [students, setStudents] = useState<Student[]>(availableStudents);
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(false);

  // 1. Create Cohort Modal
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [cohortName, setCohortName] = useState('');

  // 2. Manage Members Modal
  const [selectedCohort, setSelectedCohort] = useState<CohortItem | null>(null);
  const [manageTab, setManageTab] = useState<'current' | 'add'>('current');
  const [studentSearch, setStudentSearch] = useState('');
  const [filterUnassignedOnly, setFilterUnassignedOnly] = useState(false);
  const [selectedToAddStudentIds, setSelectedToAddStudentIds] = useState<Set<string>>(new Set());
  const [selectedToRemoveStudentIds, setSelectedToRemoveStudentIds] = useState<Set<string>>(new Set());

  // 3. Promotion (Kenaikan Kelas) Modal
  const [isPromoteOpen, setIsPromoteOpen] = useState(false);
  const [sourceCohortId, setSourceCohortId] = useState('');
  const [targetCohortMode, setTargetCohortMode] = useState<'new' | 'existing'>('new');
  const [newTargetCohortName, setNewTargetCohortName] = useState('');
  const [existingTargetCohortId, setExistingTargetCohortId] = useState('');
  const [promotedStudentIds, setPromotedStudentIds] = useState<Set<string>>(new Set());
  const [removeFromSource, setRemoveFromSource] = useState(true);

  // 4. Graduation Modal
  const [isGraduationOpen, setIsGraduationOpen] = useState(false);
  const [gradCohortId, setGradCohortId] = useState('');
  const [graduatedStudentIds, setGraduatedStudentIds] = useState<Set<string>>(new Set());
  const [deactivateAccounts, setDeactivateAccounts] = useState(false);

  // Calculate unassigned students
  const unassignedStudentsCount = students.filter(
    (s) => !s.cohortMemberships || s.cohortMemberships.length === 0
  ).length;

  // Filter cohorts by search
  const filteredCohorts = cohorts.filter((c) =>
    c.name.toLowerCase().includes(search.toLowerCase())
  );

  // Export cohort members to Excel (.xlsx)
  const handleExportCohortExcel = (cohort: CohortItem) => {
    if (!cohort.members || cohort.members.length === 0) {
      showAlert(`Grup kohort "${cohort.name}" belum memiliki siswa untuk diekspor.`, { type: 'error' });
      return;
    }

    const rows = cohort.members.map((m, idx) => ({
      'No': idx + 1,
      'NIS': m.user.nis || '-',
      'Nama Lengkap': m.user.name,
      'Email Siswa': m.user.email,
      'Grup Kelas / Kohort': cohort.name,
    }));

    const worksheet = XLSX.utils.json_to_sheet(rows);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, 'Daftar Siswa');

    const safeFileName = `Daftar_Siswa_${cohort.name.replace(/[^a-zA-Z0-9_-]/g, '_')}.xlsx`;
    XLSX.writeFile(workbook, safeFileName);
  };

  // Create Cohort Handler
  const handleCreateCohort = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!cohortName.trim()) return;
    setLoading(true);
    try {
      const created = await createCohort(cohortName.trim());
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

  // Open Manage Members Modal
  const handleOpenManageMembers = (cohort: CohortItem) => {
    setSelectedCohort(cohort);
    setManageTab('current');
    setStudentSearch('');
    setSelectedToAddStudentIds(new Set());
    setSelectedToRemoveStudentIds(new Set());
  };

  // Bulk Add Students to Cohort
  const handleBulkAdd = async () => {
    if (!selectedCohort || selectedToAddStudentIds.size === 0) return;
    setLoading(true);
    try {
      const userIds = Array.from(selectedToAddStudentIds);
      await bulkAddStudentsToCohort(selectedCohort.id, userIds);

      const addedStudents = students.filter((s) => selectedToAddStudentIds.has(s.id));
      const newMembers = [
        ...selectedCohort.members,
        ...addedStudents.map((s) => ({ user: s })),
      ];

      const updatedCohort = {
        ...selectedCohort,
        members: newMembers,
        _count: {
          ...selectedCohort._count,
          members: newMembers.length,
        },
      };

      setSelectedCohort(updatedCohort);
      setCohorts((prev) =>
        prev.map((c) => (c.id === selectedCohort.id ? updatedCohort : c))
      );

      // Update student memberships locally
      setStudents((prev) =>
        prev.map((s) => {
          if (selectedToAddStudentIds.has(s.id)) {
            const existing = s.cohortMemberships || [];
            return {
              ...s,
              cohortMemberships: [...existing, { cohort: { id: selectedCohort.id, name: selectedCohort.name } }],
            };
          }
          return s;
        })
      );

      setSelectedToAddStudentIds(new Set());
      await showAlert(`${userIds.length} siswa berhasil ditambahkan ke grup ${selectedCohort.name}!`, { type: 'success' });
    } catch (err: any) {
      console.error(err);
      await showAlert(err?.message || 'Gagal menambahkan siswa secara massal', { type: 'error' });
    } finally {
      setLoading(false);
    }
  };

  // Bulk Remove Students from Cohort
  const handleBulkRemove = async () => {
    if (!selectedCohort || selectedToRemoveStudentIds.size === 0) return;
    const confirmed = await showConfirm(
      `Apakah Anda yakin ingin mengeluarkan ${selectedToRemoveStudentIds.size} siswa dari ${selectedCohort.name}?`,
      {
        title: 'Keluarkan Siswa',
        confirmText: 'Ya, Keluarkan',
        cancelText: 'Batal',
      }
    );
    if (!confirmed) return;

    setLoading(true);
    try {
      const userIds = Array.from(selectedToRemoveStudentIds);
      await bulkRemoveStudentsFromCohort(selectedCohort.id, userIds);

      const remainingMembers = selectedCohort.members.filter(
        (m) => !selectedToRemoveStudentIds.has(m.user.id)
      );

      const updatedCohort = {
        ...selectedCohort,
        members: remainingMembers,
        _count: {
          ...selectedCohort._count,
          members: remainingMembers.length,
        },
      };

      setSelectedCohort(updatedCohort);
      setCohorts((prev) =>
        prev.map((c) => (c.id === selectedCohort.id ? updatedCohort : c))
      );

      // Update local student memberships
      setStudents((prev) =>
        prev.map((s) => {
          if (selectedToRemoveStudentIds.has(s.id)) {
            return {
              ...s,
              cohortMemberships: (s.cohortMemberships || []).filter(
                (cm) => cm.cohort.id !== selectedCohort.id
              ),
            };
          }
          return s;
        })
      );

      setSelectedToRemoveStudentIds(new Set());
      await showAlert(`${userIds.length} siswa berhasil dikeluarkan dari ${selectedCohort.name}`, { type: 'success' });
    } catch (err: any) {
      console.error(err);
      await showAlert(err?.message || 'Gagal mengeluarkan siswa', { type: 'error' });
    } finally {
      setLoading(false);
    }
  };

  // Open Promotion Modal
  const handleOpenPromote = () => {
    setIsPromoteOpen(true);
    setSourceCohortId('');
    setTargetCohortMode('new');
    setNewTargetCohortName('');
    setExistingTargetCohortId('');
    setPromotedStudentIds(new Set());
    setRemoveFromSource(true);
  };

  // When source cohort changes in Promotion
  const handleSelectSourceCohort = (cId: string) => {
    setSourceCohortId(cId);
    const sourceCohort = cohorts.find((c) => c.id === cId);
    if (sourceCohort) {
      // Pre-select all students by default
      setPromotedStudentIds(new Set(sourceCohort.members.map((m) => m.user.id)));
      // Suggest automatic new cohort name (e.g. X to XI)
      const suggestedName = sourceCohort.name
        .replace(/Kelas\s*X\b/i, 'Kelas XI')
        .replace(/Kelas\s*XI\b/i, 'Kelas XII')
        .replace(/X-/i, 'XI-')
        .replace(/XI-/i, 'XII-');
      setNewTargetCohortName(suggestedName !== sourceCohort.name ? suggestedName : `${sourceCohort.name} - Naik Kelas`);
    } else {
      setPromotedStudentIds(new Set());
      setNewTargetCohortName('');
    }
  };

  // Execute Promotion
  const handleExecutePromotion = async () => {
    if (!sourceCohortId) {
      await showAlert('Pilih kelas/kohort asal terlebih dahulu', { type: 'error' });
      return;
    }

    if (targetCohortMode === 'new' && !newTargetCohortName.trim()) {
      await showAlert('Ketikkan nama kohort tujuan baru', { type: 'error' });
      return;
    }

    if (targetCohortMode === 'existing' && !existingTargetCohortId) {
      await showAlert('Pilih kohort tujuan yang sudah ada', { type: 'error' });
      return;
    }

    if (promotedStudentIds.size === 0) {
      await showAlert('Pilih minimal satu siswa yang naik kelas', { type: 'error' });
      return;
    }

    setLoading(true);
    try {
      const res = await promoteCohortStudents({
        sourceCohortId,
        targetCohortId: targetCohortMode === 'existing' ? existingTargetCohortId : undefined,
        newTargetCohortName: targetCohortMode === 'new' ? newTargetCohortName.trim() : undefined,
        studentIds: Array.from(promotedStudentIds),
        removeFromSourceCohort: removeFromSource,
      });

      await showAlert(
        `Kenaikan kelas berhasil! ${res.promotedCount} siswa telah dipromosikan ke kelas tujuan.`,
        { type: 'success' }
      );
      setIsPromoteOpen(false);
      window.location.reload();
    } catch (err: any) {
      console.error(err);
      await showAlert(err?.message || 'Gagal mengeksekusi kenaikan kelas', { type: 'error' });
    } finally {
      setLoading(false);
    }
  };

  // Open Graduation Modal
  const handleOpenGraduation = () => {
    setIsGraduationOpen(true);
    setGradCohortId('');
    setGraduatedStudentIds(new Set());
    setDeactivateAccounts(false);
  };

  const handleSelectGradCohort = (cId: string) => {
    setGradCohortId(cId);
    const sourceCohort = cohorts.find((c) => c.id === cId);
    if (sourceCohort) {
      setGraduatedStudentIds(new Set(sourceCohort.members.map((m) => m.user.id)));
    } else {
      setGraduatedStudentIds(new Set());
    }
  };

  const handleExecuteGraduation = async () => {
    if (!gradCohortId || graduatedStudentIds.size === 0) {
      await showAlert('Pilih kohort dan minimal satu siswa yang lulus', { type: 'error' });
      return;
    }

    const confirmed = await showConfirm(
      `Yakin ingin meluluskan ${graduatedStudentIds.size} siswa terpilih?${
        deactivateAccounts ? ' Akun siswa juga akan dinonaktifkan (status alumni).' : ''
      }`,
      {
        title: 'Konfirmasi Kelulusan Siswa',
        confirmText: 'Ya, Luluskan Siswa',
        cancelText: 'Batal',
      }
    );
    if (!confirmed) return;

    setLoading(true);
    try {
      const res = await graduateCohortStudents({
        cohortId: gradCohortId,
        studentIds: Array.from(graduatedStudentIds),
        deactivateAccount: deactivateAccounts,
      });

      await showAlert(`Proses kelulusan selesai! ${res.graduatedCount} siswa telah diluluskan.`, { type: 'success' });
      setIsGraduationOpen(false);
      window.location.reload();
    } catch (err: any) {
      console.error(err);
      await showAlert(err?.message || 'Gagal memproses kelulusan', { type: 'error' });
    } finally {
      setLoading(false);
    }
  };

  // Candidate students to add (not yet in selected cohort)
  const availableToAdd = students.filter((s) => {
    const isAlreadyMember = selectedCohort?.members.some((m) => m.user.id === s.id);
    if (isAlreadyMember) return false;

    if (filterUnassignedOnly) {
      const hasAnyCohort = s.cohortMemberships && s.cohortMemberships.length > 0;
      if (hasAnyCohort) return false;
    }

    if (!studentSearch.trim()) return true;
    const q = studentSearch.toLowerCase();
    return (
      s.name.toLowerCase().includes(q) ||
      (s.nis && s.nis.toLowerCase().includes(q)) ||
      s.email.toLowerCase().includes(q)
    );
  });

  return (
    <div className="space-y-6">
      {/* Unassigned Students Notice Banner */}
      {unassignedStudentsCount > 0 && (
        <div className="p-4 rounded-xl bg-amber-50 dark:bg-amber-950/20 border border-amber-200 dark:border-amber-900/50 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs">
          <div className="flex items-center gap-2.5 text-amber-900 dark:text-amber-200">
            <AlertCircle className="w-5 h-5 text-amber-600 flex-shrink-0" />
            <div>
              <span className="font-bold">{unassignedStudentsCount} Siswa Belum Memiliki Kelas!</span>
              <p className="text-amber-700 dark:text-amber-300 mt-0.5">
                Siswa-siswa ini belum terdaftar di grup kohort manapun. Anda dapat memasukkannya menggunakan fitur Multi-Select Tambah Siswa.
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Top Action Bar */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-4">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Cari nama grup kohort..."
            className="pl-9 text-sm"
          />
        </div>

        <div className="flex items-center gap-2.5 flex-wrap">
          <Button
            onClick={handleOpenPromote}
            className="bg-emerald-600 hover:bg-emerald-700 text-white flex items-center gap-1.5 text-xs font-semibold"
          >
            <TrendingUp className="w-4 h-4" />
            Kenaikan Kelas (Promosi)
          </Button>

          <Button
            onClick={handleOpenGraduation}
            variant="outline"
            className="border-purple-300 text-purple-700 hover:bg-purple-50 dark:border-purple-800 dark:text-purple-300 dark:hover:bg-purple-950/30 flex items-center gap-1.5 text-xs font-semibold"
          >
            <Award className="w-4 h-4 text-purple-600" />
            Kelulusan Siswa
          </Button>

          <Button
            onClick={() => setIsCreateOpen(true)}
            className="bg-[#002446] hover:bg-[#001b33] text-white flex items-center gap-1.5 text-xs font-semibold"
          >
            <Plus className="w-4 h-4" />
            Buat Kohort Baru
          </Button>
        </div>
      </div>

      {/* Cohorts Grid Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {filteredCohorts.length === 0 ? (
          <div className="col-span-full text-center py-12 text-gray-500 bg-white dark:bg-gray-900 rounded-xl border border-dashed p-8">
            <UsersRound className="h-10 w-10 mx-auto text-gray-400 mb-2" />
            <p className="font-semibold text-gray-700 dark:text-gray-300">Belum ada grup kohort yang dibuat.</p>
            <p className="text-xs text-gray-500 mt-1">
              Buat grup kelas/kohort untuk mengelompokkan siswa secara terstruktur.
            </p>
          </div>
        ) : (
          filteredCohorts.map((cohort) => (
            <Card
              key={cohort.id}
              className="hover:shadow-md transition-shadow border-gray-200 dark:border-gray-800 flex flex-col justify-between"
            >
              <CardHeader className="pb-3">
                <div className="flex items-center justify-between gap-2">
                  <Badge variant="outline" className="text-xs">
                    {cohort._count.enrollments} Course Sinkron
                  </Badge>
                  <Badge className="bg-[#FF8928] text-white text-xs">
                    {cohort._count.members} Siswa
                  </Badge>
                </div>
                <CardTitle className="text-lg font-bold text-[#002446] dark:text-white mt-2 truncate">
                  {cohort.name}
                </CardTitle>
              </CardHeader>

              <CardContent className="space-y-4 pt-0">
                <div className="text-xs text-gray-500 dark:text-gray-400 line-clamp-2 min-h-[32px]">
                  {cohort.members.length > 0 ? (
                    cohort.members.map((m) => m.user.name).join(', ')
                  ) : (
                    <span className="italic text-gray-400">Belum ada siswa di dalam grup ini.</span>
                  )}
                </div>

                <div className="pt-3 border-t border-gray-100 dark:border-gray-800 flex items-center gap-2">
                  <Button
                    size="sm"
                    onClick={() => handleOpenManageMembers(cohort)}
                    className="flex-1 bg-[#002446] hover:bg-[#001b33] text-white text-xs flex items-center justify-center gap-1.5"
                  >
                    <UserPlus className="h-3.5 w-3.5" />
                    Kelola Anggota
                  </Button>

                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => handleExportCohortExcel(cohort)}
                    className="text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800 text-xs px-2.5"
                    title="Ekspor Daftar Siswa ke Excel (.xlsx)"
                  >
                    <Download className="h-3.5 w-3.5" />
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))
        )}
      </div>

      {/* 1. Modal Buat Kohort */}
      <Dialog open={isCreateOpen} onOpenChange={setIsCreateOpen}>
        <DialogContent className="sm:max-w-md">
          <form onSubmit={handleCreateCohort}>
            <DialogHeader>
              <DialogTitle className="text-lg font-bold text-[#002446] dark:text-white">
                Buat Grup Kohort Baru
              </DialogTitle>
            </DialogHeader>
            <div className="space-y-3 py-3">
              <div className="space-y-1.5">
                <Label htmlFor="chName" className="font-medium">
                  Nama Grup Kohort <span className="text-red-500">*</span>
                </Label>
                <Input
                  id="chName"
                  placeholder="misal: Kohort-X-MIPA-1-2026"
                  value={cohortName}
                  onChange={(e) => setCohortName(e.target.value)}
                  required
                />
                <p className="text-xs text-gray-500">
                  Format disarankan: Jenjang-Kelas-Jurusan-Tahun (contoh: X-MIPA-1-2026).
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
                className="bg-[#002446] hover:bg-[#001b33] text-white"
              >
                {loading ? 'Menyimpan...' : 'Simpan Kohort'}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* 2. Modal Kelola Anggota Kohort (Multi-Select & Bulk) */}
      <Dialog
        open={Boolean(selectedCohort)}
        onOpenChange={(open) => !open && setSelectedCohort(null)}
      >
        <DialogContent className="sm:max-w-3xl max-h-[90vh] flex flex-col">
          <DialogHeader className="border-b pb-3">
            <div className="flex items-center justify-between">
              <div>
                <DialogTitle className="text-xl font-bold text-[#002446] dark:text-white flex items-center gap-2">
                  <UsersRound className="w-5 h-5 text-[#FF8928]" />
                  {selectedCohort?.name}
                </DialogTitle>
                <DialogDescription className="text-xs mt-0.5">
                  Total {selectedCohort?.members.length || 0} siswa terdaftar di grup ini.
                </DialogDescription>
              </div>
              {selectedCohort && (
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => handleExportCohortExcel(selectedCohort)}
                  className="text-xs flex items-center gap-1.5"
                >
                  <Download className="w-3.5 h-3.5" />
                  Ekspor Excel (.xlsx)
                </Button>
              )}
            </div>

            {/* Nav Tabs Inside Modal */}
            <div className="flex gap-2 pt-3">
              <button
                type="button"
                onClick={() => setManageTab('current')}
                className={`px-3 py-1.5 text-xs font-semibold rounded-lg transition-colors ${
                  manageTab === 'current'
                    ? 'bg-[#002446] text-white'
                    : 'bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-400'
                }`}
              >
                Anggota di Kelas Ini ({selectedCohort?.members.length || 0})
              </button>
              <button
                type="button"
                onClick={() => setManageTab('add')}
                className={`px-3 py-1.5 text-xs font-semibold rounded-lg transition-colors ${
                  manageTab === 'add'
                    ? 'bg-[#002446] text-white'
                    : 'bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-400'
                }`}
              >
                + Tambah Siswa Baru Massal
              </button>
            </div>
          </DialogHeader>

          {/* TAB 1: CURRENT MEMBERS */}
          {manageTab === 'current' && (
            <div className="space-y-3 py-2 flex-1 overflow-hidden flex flex-col">
              {selectedCohort && selectedCohort.members.length > 0 && (
                <div className="flex items-center justify-between bg-gray-50 dark:bg-gray-800/40 p-2.5 rounded-lg border text-xs">
                  <div className="flex items-center gap-2">
                    <input
                      type="checkbox"
                      id="selectAllRemove"
                      checked={
                        selectedCohort.members.length > 0 &&
                        selectedToRemoveStudentIds.size === selectedCohort.members.length
                      }
                      onChange={(e) => {
                        if (e.target.checked) {
                          setSelectedToRemoveStudentIds(
                            new Set(selectedCohort.members.map((m) => m.user.id))
                          );
                        } else {
                          setSelectedToRemoveStudentIds(new Set());
                        }
                      }}
                      className="w-4 h-4 rounded accent-rose-600 cursor-pointer"
                    />
                    <Label htmlFor="selectAllRemove" className="font-semibold cursor-pointer">
                      Pilih Semua Anggota ({selectedCohort.members.length})
                    </Label>
                  </div>

                  {selectedToRemoveStudentIds.size > 0 && (
                    <Button
                      size="sm"
                      onClick={handleBulkRemove}
                      disabled={loading}
                      className="bg-rose-600 hover:bg-rose-700 text-white text-xs h-7 px-2.5 flex items-center gap-1"
                    >
                      <UserMinus className="w-3.5 h-3.5" />
                      Keluarkan {selectedToRemoveStudentIds.size} Siswa Terpilih
                    </Button>
                  )}
                </div>
              )}

              <div className="flex-1 overflow-y-auto border rounded-lg max-h-[50vh]">
                <Table>
                  <TableHeader>
                    <TableRow className="bg-gray-50/70 dark:bg-gray-800/50">
                      <TableHead className="w-10"></TableHead>
                      <TableHead>NIS</TableHead>
                      <TableHead>Nama Siswa</TableHead>
                      <TableHead>Email</TableHead>
                      <TableHead className="text-right">Aksi</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {!selectedCohort?.members || selectedCohort.members.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={5} className="text-center py-8 text-gray-500 text-xs">
                          Belum ada siswa dalam grup ini. Klik tab &quot;+ Tambah Siswa Baru Massal&quot; untuk memasukkan siswa.
                        </TableCell>
                      </TableRow>
                    ) : (
                      selectedCohort.members.map((m) => {
                        const isChecked = selectedToRemoveStudentIds.has(m.user.id);
                        return (
                          <TableRow key={m.user.id} className="hover:bg-gray-50/50 dark:hover:bg-gray-800/30">
                            <TableCell>
                              <input
                                type="checkbox"
                                checked={isChecked}
                                onChange={(e) => {
                                  const updated = new Set(selectedToRemoveStudentIds);
                                  if (e.target.checked) updated.add(m.user.id);
                                  else updated.delete(m.user.id);
                                  setSelectedToRemoveStudentIds(updated);
                                }}
                                className="w-4 h-4 rounded accent-rose-600 cursor-pointer"
                              />
                            </TableCell>
                            <TableCell className="font-mono text-xs text-gray-600 dark:text-gray-400">
                              {m.user.nis || '-'}
                            </TableCell>
                            <TableCell className="font-semibold text-xs text-[#002446] dark:text-white">
                              {m.user.name}
                            </TableCell>
                            <TableCell className="text-xs text-gray-500">
                              {m.user.email}
                            </TableCell>
                            <TableCell className="text-right">
                              <Button
                                size="sm"
                                variant="ghost"
                                className="text-rose-500 hover:text-rose-700 hover:bg-rose-50 dark:hover:bg-rose-950/30 h-7 w-7 p-0"
                                onClick={() => {
                                  setSelectedToRemoveStudentIds(new Set([m.user.id]));
                                  handleBulkRemove();
                                }}
                                disabled={loading}
                                title="Keluarkan siswa"
                              >
                                <Trash2 className="h-3.5 w-3.5" />
                              </Button>
                            </TableCell>
                          </TableRow>
                        );
                      })
                    )}
                  </TableBody>
                </Table>
              </div>
            </div>
          )}

          {/* TAB 2: BULK ADD MEMBERS */}
          {manageTab === 'add' && (
            <div className="space-y-3 py-2 flex-1 overflow-hidden flex flex-col">
              <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 bg-gray-50 dark:bg-gray-800/40 p-3 rounded-xl border text-xs">
                <div className="relative flex-1">
                  <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-gray-400" />
                  <Input
                    value={studentSearch}
                    onChange={(e) => setStudentSearch(e.target.value)}
                    placeholder="Cari siswa berdasarkan nama atau NIS..."
                    className="pl-8 h-8 text-xs bg-white dark:bg-gray-900"
                  />
                </div>

                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => setFilterUnassignedOnly(!filterUnassignedOnly)}
                    className={`px-3 py-1.5 rounded-lg border text-xs font-semibold flex items-center gap-1.5 transition-colors ${
                      filterUnassignedOnly
                        ? 'bg-amber-100 text-amber-800 border-amber-300'
                        : 'bg-white dark:bg-gray-900 text-gray-600 border-gray-300'
                    }`}
                  >
                    <Filter className="w-3 h-3" />
                    Hanya Siswa Tanpa Kelas
                  </button>

                  <Button
                    size="sm"
                    onClick={handleBulkAdd}
                    disabled={selectedToAddStudentIds.size === 0 || loading}
                    className="bg-[#FF8928] hover:bg-[#ff7b10] text-white text-xs h-8 px-3 font-semibold flex items-center gap-1"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    Tambahkan ({selectedToAddStudentIds.size}) Siswa
                  </Button>
                </div>
              </div>

              {/* Table of Available Students */}
              <div className="flex-1 overflow-y-auto border rounded-lg max-h-[50vh]">
                <Table>
                  <TableHeader>
                    <TableRow className="bg-gray-50/70 dark:bg-gray-800/50">
                      <TableHead className="w-10">
                        <input
                          type="checkbox"
                          checked={
                            availableToAdd.length > 0 &&
                            selectedToAddStudentIds.size === availableToAdd.length
                          }
                          onChange={(e) => {
                            if (e.target.checked) {
                              setSelectedToAddStudentIds(new Set(availableToAdd.map((s) => s.id)));
                            } else {
                              setSelectedToAddStudentIds(new Set());
                            }
                          }}
                          className="w-4 h-4 rounded accent-[#002446] cursor-pointer"
                        />
                      </TableHead>
                      <TableHead>NIS</TableHead>
                      <TableHead>Nama Siswa</TableHead>
                      <TableHead>Email</TableHead>
                      <TableHead>Status Kelas Saat Ini</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {availableToAdd.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={5} className="text-center py-8 text-gray-400 text-xs">
                          Tidak ada siswa yang sesuai filter untuk ditambahkan.
                        </TableCell>
                      </TableRow>
                    ) : (
                      availableToAdd.map((s) => {
                        const isChecked = selectedToAddStudentIds.has(s.id);
                        const hasCohort = s.cohortMemberships && s.cohortMemberships.length > 0;
                        return (
                          <TableRow key={s.id} className="hover:bg-gray-50/50 dark:hover:bg-gray-800/30">
                            <TableCell>
                              <input
                                type="checkbox"
                                checked={isChecked}
                                onChange={(e) => {
                                  const updated = new Set(selectedToAddStudentIds);
                                  if (e.target.checked) updated.add(s.id);
                                  else updated.delete(s.id);
                                  setSelectedToAddStudentIds(updated);
                                }}
                                className="w-4 h-4 rounded accent-[#002446] cursor-pointer"
                              />
                            </TableCell>
                            <TableCell className="font-mono text-xs text-gray-600 dark:text-gray-400">
                              {s.nis || '-'}
                            </TableCell>
                            <TableCell className="font-semibold text-xs text-[#002446] dark:text-white">
                              {s.name}
                            </TableCell>
                            <TableCell className="text-xs text-gray-500">
                              {s.email}
                            </TableCell>
                            <TableCell>
                              {hasCohort ? (
                                <Badge variant="outline" className="text-[10px] text-gray-600">
                                  {s.cohortMemberships?.map((cm) => cm.cohort.name).join(', ')}
                                </Badge>
                              ) : (
                                <Badge className="bg-amber-100 text-amber-800 dark:bg-amber-950/60 dark:text-amber-300 text-[10px]">
                                  Belum Ada Kelas
                                </Badge>
                              )}
                            </TableCell>
                          </TableRow>
                        );
                      })
                    )}
                  </TableBody>
                </Table>
              </div>
            </div>
          )}

          <DialogFooter className="pt-2 border-t">
            <Button
              type="button"
              variant="outline"
              onClick={() => setSelectedCohort(null)}
            >
              Selesai / Tutup
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* 3. Modal Wizard Kenaikan Kelas (Promosi Kohort) */}
      <Dialog open={isPromoteOpen} onOpenChange={setIsPromoteOpen}>
        <DialogContent className="sm:max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="text-xl font-bold text-[#002446] dark:text-white flex items-center gap-2">
              <TrendingUp className="w-5 h-5 text-emerald-600" />
              Siklus Kenaikan Kelas (Promosi Kohort)
            </DialogTitle>
            <DialogDescription className="text-xs">
              Pindahkan atau promosikan seluruh rombongan belajar dari kelas lama ke kelas tingkat berikutnya secara massal.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-2 text-xs">
            {/* Step 1: Pilih Kohort Asal */}
            <div className="space-y-1.5">
              <Label className="font-semibold">
                1. Pilih Kelas / Kohort Asal <span className="text-red-500">*</span>
              </Label>
              <select
                value={sourceCohortId}
                onChange={(e) => handleSelectSourceCohort(e.target.value)}
                className="w-full h-10 px-3 rounded-lg border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-900 text-xs"
              >
                <option value="">-- Pilih Kohort Asal (misal: Kelas X-MIPA-1) --</option>
                {cohorts.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name} ({c.members.length} Siswa)
                  </option>
                ))}
              </select>
            </div>

            {/* Step 2: Tentukan Kohort Tujuan */}
            {sourceCohortId && (
              <div className="space-y-3 p-3 bg-gray-50 dark:bg-gray-800/40 rounded-xl border">
                <Label className="font-semibold">
                  2. Tentukan Kelas / Kohort Tujuan <span className="text-red-500">*</span>
                </Label>
                <div className="flex items-center gap-4">
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="radio"
                      name="targetMode"
                      checked={targetCohortMode === 'new'}
                      onChange={() => setTargetCohortMode('new')}
                      className="accent-emerald-600"
                    />
                    <span>Buat Kohort Baru</span>
                  </label>
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="radio"
                      name="targetMode"
                      checked={targetCohortMode === 'existing'}
                      onChange={() => setTargetCohortMode('existing')}
                      className="accent-emerald-600"
                    />
                    <span>Gunakan Kohort yang Sudah Ada</span>
                  </label>
                </div>

                {targetCohortMode === 'new' ? (
                  <div className="space-y-1">
                    <Input
                      value={newTargetCohortName}
                      onChange={(e) => setNewTargetCohortName(e.target.value)}
                      placeholder="Nama kelas tujuan baru (misal: Kohort-XI-MIPA-1-2027)"
                      className="text-xs"
                    />
                    <p className="text-[11px] text-gray-500">
                      Kohort baru ini akan otomatis dibuat dan diisi oleh siswa yang dipromosikan.
                    </p>
                  </div>
                ) : (
                  <select
                    value={existingTargetCohortId}
                    onChange={(e) => setExistingTargetCohortId(e.target.value)}
                    className="w-full h-9 px-3 rounded-lg border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-900 text-xs"
                  >
                    <option value="">-- Pilih Kohort Tujuan --</option>
                    {cohorts
                      .filter((c) => c.id !== sourceCohortId)
                      .map((c) => (
                        <option key={c.id} value={c.id}>
                          {c.name} ({c.members.length} Siswa)
                        </option>
                      ))}
                  </select>
                )}
              </div>
            )}

            {/* Step 3: Seleksi Siswa yang Naik Kelas */}
            {sourceCohortId && (
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <Label className="font-semibold">
                    3. Siswa yang Naik Kelas ({promotedStudentIds.size} Terpilih)
                  </Label>
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => {
                        const source = cohorts.find((c) => c.id === sourceCohortId);
                        if (source) setPromotedStudentIds(new Set(source.members.map((m) => m.user.id)));
                      }}
                      className="text-[11px] text-emerald-600 hover:underline font-semibold"
                    >
                      Pilih Semua
                    </button>
                    <span>•</span>
                    <button
                      type="button"
                      onClick={() => setPromotedStudentIds(new Set())}
                      className="text-[11px] text-gray-500 hover:underline"
                    >
                      Batalkan Semua
                    </button>
                  </div>
                </div>
                <p className="text-[11px] text-gray-500">
                  Hapus centang bagi siswa yang <strong>tinggal kelas</strong> agar tetap berada di kelas lama.
                </p>

                <div className="border rounded-lg max-h-48 overflow-y-auto divide-y bg-white dark:bg-gray-900">
                  {cohorts
                    .find((c) => c.id === sourceCohortId)
                    ?.members.map((m) => {
                      const isSelected = promotedStudentIds.has(m.user.id);
                      return (
                        <label
                          key={m.user.id}
                          className="flex items-center justify-between p-2 hover:bg-gray-50 dark:hover:bg-gray-800 cursor-pointer"
                        >
                          <div className="flex items-center gap-2.5">
                            <input
                              type="checkbox"
                              checked={isSelected}
                              onChange={(e) => {
                                const updated = new Set(promotedStudentIds);
                                if (e.target.checked) updated.add(m.user.id);
                                else updated.delete(m.user.id);
                                setPromotedStudentIds(updated);
                              }}
                              className="w-4 h-4 rounded accent-emerald-600"
                            />
                            <div>
                              <span className="font-medium text-[#002446] dark:text-white">
                                {m.user.name}
                              </span>
                              <span className="text-gray-400 ml-2 font-mono">
                                {m.user.nis ? `(NIS: ${m.user.nis})` : ''}
                              </span>
                            </div>
                          </div>
                          <Badge variant={isSelected ? 'default' : 'secondary'} className="text-[10px]">
                            {isSelected ? 'Naik Kelas' : 'Tinggal Kelas'}
                          </Badge>
                        </label>
                      );
                    })}
                </div>
              </div>
            )}

            {/* Step 4: Toggle Opsi Keluarkan dari Kohort Asal */}
            {sourceCohortId && (
              <div className="p-3 bg-emerald-50/60 dark:bg-emerald-950/20 border border-emerald-200 dark:border-emerald-900/40 rounded-xl flex items-center gap-3">
                <input
                  type="checkbox"
                  id="removeSource"
                  checked={removeFromSource}
                  onChange={(e) => setRemoveFromSource(e.target.checked)}
                  className="w-4 h-4 rounded accent-emerald-600 cursor-pointer"
                />
                <Label htmlFor="removeSource" className="text-xs font-semibold text-emerald-950 dark:text-emerald-200 cursor-pointer">
                  Keluarkan siswa yang naik kelas dari kohort asal (disarankan)
                </Label>
              </div>
            )}
          </div>

          <DialogFooter className="pt-2 border-t">
            <Button
              type="button"
              variant="outline"
              onClick={() => setIsPromoteOpen(false)}
              disabled={loading}
            >
              Batal
            </Button>
            <Button
              onClick={handleExecutePromotion}
              disabled={!sourceCohortId || promotedStudentIds.size === 0 || loading}
              className="bg-emerald-600 hover:bg-emerald-700 text-white font-semibold flex items-center gap-1.5"
            >
              <TrendingUp className="w-4 h-4" />
              {loading ? 'Memproses...' : `Eksekusi Kenaikan Kelas (${promotedStudentIds.size} Siswa)`}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* 4. Modal Kelulusan Siswa (Graduation) */}
      <Dialog open={isGraduationOpen} onOpenChange={setIsGraduationOpen}>
        <DialogContent className="sm:max-w-md max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="text-xl font-bold text-[#002446] dark:text-white flex items-center gap-2">
              <Award className="w-5 h-5 text-purple-600" />
              Kelulusan Siswa (Tingkat Akhir)
            </DialogTitle>
            <DialogDescription className="text-xs">
              Lepaskan siswa tingkat akhir dari keanggotaan kohort aktif saat mereka telah menyelesaikan pendidikan.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-2 text-xs">
            <div className="space-y-1.5">
              <Label className="font-semibold">
                Pilih Kelas Tingkat Akhir (misal: Kelas XII) <span className="text-red-500">*</span>
              </Label>
              <select
                value={gradCohortId}
                onChange={(e) => handleSelectGradCohort(e.target.value)}
                className="w-full h-10 px-3 rounded-lg border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-900 text-xs"
              >
                <option value="">-- Pilih Kohort Siswa Lulus --</option>
                {cohorts.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name} ({c.members.length} Siswa)
                  </option>
                ))}
              </select>
            </div>

            {gradCohortId && (
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <Label className="font-semibold">
                    Daftar Siswa yang Lulus ({graduatedStudentIds.size} Siswa)
                  </Label>
                </div>
                <div className="border rounded-lg max-h-44 overflow-y-auto divide-y bg-white dark:bg-gray-900">
                  {cohorts
                    .find((c) => c.id === gradCohortId)
                    ?.members.map((m) => {
                      const isChecked = graduatedStudentIds.has(m.user.id);
                      return (
                        <label
                          key={m.user.id}
                          className="flex items-center gap-2.5 p-2 hover:bg-gray-50 dark:hover:bg-gray-800 cursor-pointer"
                        >
                          <input
                            type="checkbox"
                            checked={isChecked}
                            onChange={(e) => {
                              const updated = new Set(graduatedStudentIds);
                              if (e.target.checked) updated.add(m.user.id);
                              else updated.delete(m.user.id);
                              setGraduatedStudentIds(updated);
                            }}
                            className="w-4 h-4 rounded accent-purple-600"
                          />
                          <span className="font-medium text-[#002446] dark:text-white">
                            {m.user.name}
                          </span>
                        </label>
                      );
                    })}
                </div>

                <div className="p-3 bg-purple-50/60 dark:bg-purple-950/20 border border-purple-200 dark:border-purple-900/40 rounded-xl flex items-center gap-3 mt-3">
                  <input
                    type="checkbox"
                    id="deact"
                    checked={deactivateAccounts}
                    onChange={(e) => setDeactivateAccounts(e.target.checked)}
                    className="w-4 h-4 rounded accent-purple-600 cursor-pointer"
                  />
                  <Label htmlFor="deact" className="text-xs font-semibold text-purple-950 dark:text-purple-200 cursor-pointer">
                    Tandai akun sebagai alumni & nonaktifkan akses login
                  </Label>
                </div>
              </div>
            )}
          </div>

          <DialogFooter className="pt-2 border-t">
            <Button
              type="button"
              variant="outline"
              onClick={() => setIsGraduationOpen(false)}
              disabled={loading}
            >
              Batal
            </Button>
            <Button
              onClick={handleExecuteGraduation}
              disabled={!gradCohortId || graduatedStudentIds.size === 0 || loading}
              className="bg-purple-600 hover:bg-purple-700 text-white font-semibold"
            >
              {loading ? 'Memproses...' : `Luluskan (${graduatedStudentIds.size}) Siswa`}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
