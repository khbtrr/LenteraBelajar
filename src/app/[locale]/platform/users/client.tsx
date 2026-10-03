'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
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
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  Users,
  Plus,
  Search,
  KeyRound,
  ShieldCheck,
  Building2,
  Filter,
  Loader2,
  ChevronLeft,
  ChevronRight,
  GraduationCap,
  BookOpen,
  Shield,
  Award,
} from 'lucide-react';
import {
  PlatformUserItem,
  getPlatformUsers,
  createPlatformUser,
  togglePlatformUserActive,
  resetPlatformUserPassword,
} from '@/lib/actions/platform';
import { Role } from '@prisma/client';
import { useDialog } from '@/context/DialogContext';

interface PlatformUsersClientProps {
  initialUsers: PlatformUserItem[];
  initialTotalCount: number;
  initialTotalPages: number;
  initialCurrentPage: number;
  schools: Array<{ id: string; name: string; code: string }>;
}

export function PlatformUsersClient({
  initialUsers,
  initialTotalCount,
  initialTotalPages,
  initialCurrentPage,
  schools,
}: PlatformUsersClientProps) {
  const { showAlert } = useDialog();

  const [users, setUsers] = useState<PlatformUserItem[]>(initialUsers);
  const [totalCount, setTotalCount] = useState(initialTotalCount);
  const [totalPages, setTotalPages] = useState(initialTotalPages);
  const [currentPage, setCurrentPage] = useState(initialCurrentPage);

  // Filters
  const [search, setSearch] = useState('');
  const [selectedSchool, setSelectedSchool] = useState<string>('ALL');
  const [selectedRole, setSelectedRole] = useState<string>('ALL');
  const [loading, setLoading] = useState(false);

  // Create User Modal State
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [createForm, setCreateForm] = useState<{
    name: string;
    email: string;
    password: string;
    role: Role;
    schoolId: string;
    nip: string;
  }>({
    name: '',
    email: '',
    password: '',
    role: Role.ADMIN,
    schoolId: '',
    nip: '',
  });
  const [createLoading, setCreateLoading] = useState(false);

  // Reset Password Modal State
  const [isResetOpen, setIsResetOpen] = useState(false);
  const [userToReset, setUserToReset] = useState<PlatformUserItem | null>(null);
  const [newPassword, setNewPassword] = useState('');
  const [resetLoading, setResetLoading] = useState(false);

  // Fetch with current filters
  const applyFilters = async (page = 1) => {
    setLoading(true);
    try {
      const res = await getPlatformUsers({
        search,
        schoolId: selectedSchool,
        role: selectedRole,
        page,
        limit: 20,
      });
      setUsers(res.users);
      setTotalCount(res.totalCount);
      setTotalPages(res.totalPages);
      setCurrentPage(res.currentPage);
    } catch (err: any) {
      console.error(err);
      await showAlert(err?.message || 'Gagal memuat data pengguna', { type: 'error' });
    } finally {
      setLoading(false);
    }
  };

  const handleCreateSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setCreateLoading(true);
    try {
      await createPlatformUser({
        name: createForm.name,
        email: createForm.email,
        password: createForm.password,
        role: createForm.role,
        schoolId: createForm.role === Role.SUPER_ADMIN ? undefined : createForm.schoolId,
        nip: createForm.nip,
      });

      await showAlert(`Akun untuk ${createForm.name} berhasil dibuat.`, { type: 'success' });
      setIsCreateOpen(false);
      setCreateForm({
        name: '',
        email: '',
        password: '',
        role: Role.ADMIN,
        schoolId: '',
        nip: '',
      });
      await applyFilters(currentPage);
    } catch (err: any) {
      console.error(err);
      await showAlert(err?.message || 'Gagal membuat pengguna baru', { type: 'error' });
    } finally {
      setCreateLoading(false);
    }
  };

  const handleToggleActive = async (user: PlatformUserItem) => {
    try {
      const res = await togglePlatformUserActive(user.id);
      setUsers((prev) =>
        prev.map((u) => (u.id === user.id ? { ...u, isActive: res.isActive } : u))
      );
      await showAlert(
        `Status akun ${user.name} berhasil diubah menjadi ${res.isActive ? 'Aktif' : 'Non-Aktif'}.`,
        { type: 'info' }
      );
    } catch (err: any) {
      console.error(err);
      await showAlert(err?.message || 'Gagal mengubah status akun', { type: 'error' });
    }
  };

  const handleResetPasswordSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!userToReset) return;
    setResetLoading(true);
    try {
      await resetPlatformUserPassword(userToReset.id, newPassword);
      await showAlert(
        `Kata sandi untuk ${userToReset.name} berhasil diatur ulang. Pengguna diwajibkan mengganti kata sandi saat login berikutnya.`,
        { type: 'success' }
      );
      setIsResetOpen(false);
      setUserToReset(null);
      setNewPassword('');
    } catch (err: any) {
      console.error(err);
      await showAlert(err?.message || 'Gagal mengatur ulang kata sandi', { type: 'error' });
    } finally {
      setResetLoading(false);
    }
  };

  const getRoleBadge = (role: Role) => {
    switch (role) {
      case Role.SUPER_ADMIN:
        return (
          <Badge className="bg-purple-100 text-purple-800 border-purple-200 flex items-center gap-1 font-medium text-xs">
            <Shield className="h-3 w-3" /> Super Admin
          </Badge>
        );
      case Role.ADMIN:
        return (
          <Badge className="bg-emerald-100 text-emerald-800 border-emerald-200 flex items-center gap-1 font-medium text-xs">
            <ShieldCheck className="h-3 w-3" /> Admin Sekolah
          </Badge>
        );
      case Role.SUPERVISOR:
        return (
          <Badge className="bg-amber-100 text-amber-800 border-amber-200 flex items-center gap-1 font-medium text-xs">
            <Award className="h-3 w-3" /> Pengawas
          </Badge>
        );
      case Role.TEACHER:
        return (
          <Badge className="bg-orange-100 text-orange-800 border-orange-200 flex items-center gap-1 font-medium text-xs">
            <BookOpen className="h-3 w-3" /> Guru
          </Badge>
        );
      case Role.STUDENT:
        return (
          <Badge className="bg-sky-100 text-sky-800 border-sky-200 flex items-center gap-1 font-medium text-xs">
            <GraduationCap className="h-3 w-3" /> Siswa
          </Badge>
        );
      default:
        return <Badge variant="outline">{role}</Badge>;
    }
  };

  return (
    <div className="space-y-6">
      {/* Filter Bar */}
      <Card className="shadow-sm">
        <CardContent className="p-4 space-y-4">
          <div className="flex flex-col md:flex-row gap-3 items-center justify-between">
            {/* Search Input */}
            <div className="relative w-full md:w-80">
              <Search className="absolute left-3 top-2.5 h-4 w-4 text-gray-400" />
              <Input
                placeholder="Cari nama, email, NIP, atau NIS..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && applyFilters(1)}
                className="pl-9 h-9 text-sm bg-white"
              />
            </div>

            {/* Select School */}
            <div className="w-full md:w-64">
              <Select
                value={selectedSchool}
                onValueChange={(val) => setSelectedSchool(val)}
              >
                <SelectTrigger className="h-9 text-xs bg-white">
                  <SelectValue placeholder="Pilih Sekolah" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="ALL">Semua Institusi Sekolah</SelectItem>
                  {schools.map((sch) => (
                    <SelectItem key={sch.id} value={sch.id}>
                      {sch.name} ({sch.code})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Select Role */}
            <div className="w-full md:w-48">
              <Select
                value={selectedRole}
                onValueChange={(val) => setSelectedRole(val)}
              >
                <SelectTrigger className="h-9 text-xs bg-white">
                  <SelectValue placeholder="Semua Peran" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="ALL">Semua Peran</SelectItem>
                  <SelectItem value={Role.SUPER_ADMIN}>Super Admin</SelectItem>
                  <SelectItem value={Role.ADMIN}>Admin Sekolah</SelectItem>
                  <SelectItem value={Role.SUPERVISOR}>Pengawas</SelectItem>
                  <SelectItem value={Role.TEACHER}>Guru</SelectItem>
                  <SelectItem value={Role.STUDENT}>Siswa</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* Action Buttons */}
            <div className="flex items-center gap-2 w-full md:w-auto">
              <Button
                variant="outline"
                size="sm"
                onClick={() => applyFilters(1)}
                disabled={loading}
                className="h-9 text-xs flex items-center gap-1.5"
              >
                {loading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Filter className="h-3.5 w-3.5" />}
                Terapkan Filter
              </Button>

              <Button
                size="sm"
                onClick={() => setIsCreateOpen(true)}
                className="h-9 text-xs bg-[#002446] hover:bg-[#002446]/90 text-white flex items-center gap-1.5"
              >
                <Plus className="h-4 w-4" />
                Tambah Pengguna
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Users Table */}
      <Card className="shadow-sm">
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow className="bg-gray-50/80">
                <TableHead className="font-semibold text-[#002446]">Pengguna</TableHead>
                <TableHead className="font-semibold text-[#002446]">Peran</TableHead>
                <TableHead className="font-semibold text-[#002446]">Institusi Sekolah</TableHead>
                <TableHead className="font-semibold text-[#002446]">Status</TableHead>
                <TableHead className="font-semibold text-[#002446]">Terdaftar</TableHead>
                <TableHead className="text-right font-semibold text-[#002446]">Aksi</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading ? (
                <TableRow>
                  <TableCell colSpan={6} className="text-center py-12 text-gray-500">
                    <Loader2 className="h-6 w-6 animate-spin mx-auto mb-2 text-[#002446]" />
                    Memuat data pengguna...
                  </TableCell>
                </TableRow>
              ) : users.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={6} className="text-center py-12 text-gray-500">
                    Tidak ditemukan pengguna yang sesuai dengan kriteria filter.
                  </TableCell>
                </TableRow>
              ) : (
                users.map((user) => (
                  <TableRow key={user.id} className="hover:bg-gray-50/50">
                    <TableCell>
                      <div className="font-semibold text-sm text-[#002446]">{user.name}</div>
                      <div className="text-xs text-gray-500 font-mono">{user.email}</div>
                      {(user.nip || user.nis) && (
                        <div className="text-[11px] text-gray-500">
                          {user.nip ? `NIP: ${user.nip}` : `NIS: ${user.nis}`}
                        </div>
                      )}
                    </TableCell>

                    <TableCell>{getRoleBadge(user.role)}</TableCell>

                    <TableCell>
                      {user.schoolName ? (
                        <div className="flex items-center gap-1.5 text-xs text-gray-700">
                          <Building2 className="h-3.5 w-3.5 text-gray-400 shrink-0" />
                          <span className="truncate max-w-[180px]">{user.schoolName}</span>
                          {user.schoolCode && (
                            <Badge variant="outline" className="font-mono text-[10px] px-1 py-0">
                              {user.schoolCode}
                            </Badge>
                          )}
                        </div>
                      ) : (
                        <span className="text-xs text-gray-500 italic">Platform Global</span>
                      )}
                    </TableCell>

                    <TableCell>
                      <span
                        onClick={() => handleToggleActive(user)}
                        className={`inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-medium cursor-pointer transition-colors ${
                          user.isActive
                            ? 'bg-green-100 text-green-800 hover:bg-green-200'
                            : 'bg-red-100 text-red-800 hover:bg-red-200'
                        }`}
                      >
                        {user.isActive ? 'Aktif' : 'Non-Aktif'}
                      </span>
                    </TableCell>

                    <TableCell className="text-xs text-gray-500">
                      <div>
                        {new Date(user.createdAt).toLocaleDateString('id-ID', {
                          day: 'numeric',
                          month: 'short',
                          year: 'numeric',
                        })}
                      </div>
                      {user.lastLoginAt && (
                        <div className="text-[10px] text-gray-500">
                          Login: {new Date(user.lastLoginAt).toLocaleDateString('id-ID', {
                            day: 'numeric',
                            month: 'short',
                          })}
                        </div>
                      )}
                    </TableCell>

                    <TableCell className="text-right">
                      <div className="flex items-center justify-end gap-1.5">
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => {
                            setUserToReset(user);
                            setIsResetOpen(true);
                          }}
                          className="h-7 text-xs text-gray-600 border-gray-200 hover:bg-gray-100 flex items-center gap-1"
                          title="Reset Kata Sandi"
                        >
                          <KeyRound className="h-3.5 w-3.5 text-[#FF8928]" />
                          Reset Sandi
                        </Button>

                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => handleToggleActive(user)}
                          className="h-7 text-xs text-gray-500 hover:text-gray-700"
                        >
                          {user.isActive ? 'Suspend' : 'Aktifkan'}
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>

          {/* Pagination Controls */}
          {totalPages > 1 && (
            <div className="p-4 border-t flex items-center justify-between text-xs text-gray-500">
              <div>
                Menampilkan halaman <span className="font-semibold text-gray-700">{currentPage}</span> dari{' '}
                <span className="font-semibold text-gray-700">{totalPages}</span> ({totalCount} total pengguna)
              </div>
              <div className="flex items-center gap-1">
                <Button
                  size="sm"
                  variant="outline"
                  disabled={currentPage <= 1 || loading}
                  onClick={() => applyFilters(currentPage - 1)}
                  className="h-8 w-8 p-0"
                >
                  <ChevronLeft className="h-4 w-4" />
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  disabled={currentPage >= totalPages || loading}
                  onClick={() => applyFilters(currentPage + 1)}
                  className="h-8 w-8 p-0"
                >
                  <ChevronRight className="h-4 w-4" />
                </Button>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Modal Tambah Pengguna Baru */}
      <Dialog open={isCreateOpen} onOpenChange={setIsCreateOpen}>
        <DialogContent className="sm:max-w-lg">
          <form onSubmit={handleCreateSubmit}>
            <DialogHeader>
              <DialogTitle className="text-xl font-bold text-[#002446] flex items-center gap-2">
                <Users className="h-5 w-5 text-[#FF8928]" />
                Daftarkan Pengguna Platform Baru
              </DialogTitle>
            </DialogHeader>

            <div className="space-y-4 py-4">
              <div className="space-y-1.5">
                <Label htmlFor="uName">Nama Lengkap</Label>
                <Input
                  id="uName"
                  placeholder="Contoh: Budi Santoso, M.Pd"
                  value={createForm.name}
                  onChange={(e) => setCreateForm({ ...createForm, name: e.target.value })}
                  required
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label htmlFor="uEmail">Alamat Email</Label>
                  <Input
                    id="uEmail"
                    type="email"
                    placeholder="email@sekolah.sch.id"
                    value={createForm.email}
                    onChange={(e) => setCreateForm({ ...createForm, email: e.target.value })}
                    required
                  />
                </div>

                <div className="space-y-1.5">
                  <Label htmlFor="uPassword">Kata Sandi Awal</Label>
                  <Input
                    id="uPassword"
                    type="password"
                    placeholder="Minimal 6 karakter"
                    value={createForm.password}
                    onChange={(e) => setCreateForm({ ...createForm, password: e.target.value })}
                    required
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label htmlFor="uRole">Peran Akun (Role)</Label>
                  <Select
                    value={createForm.role}
                    onValueChange={(val) => setCreateForm({ ...createForm, role: val as Role })}
                  >
                    <SelectTrigger id="uRole">
                      <SelectValue placeholder="Pilih Peran" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value={Role.ADMIN}>Admin Sekolah</SelectItem>
                      <SelectItem value={Role.SUPER_ADMIN}>Super Admin Platform</SelectItem>
                      <SelectItem value={Role.SUPERVISOR}>Pengawas</SelectItem>
                      <SelectItem value={Role.TEACHER}>Guru</SelectItem>
                      <SelectItem value={Role.STUDENT}>Siswa</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-1.5">
                  <Label htmlFor="uNip">NIP / Identitas (Opsional)</Label>
                  <Input
                    id="uNip"
                    placeholder="Contoh: 19850101..."
                    value={createForm.nip}
                    onChange={(e) => setCreateForm({ ...createForm, nip: e.target.value })}
                  />
                </div>
              </div>

              {createForm.role !== Role.SUPER_ADMIN && (
                <div className="space-y-1.5">
                  <Label htmlFor="uSchool">Institusi Sekolah</Label>
                  <Select
                    value={createForm.schoolId}
                    onValueChange={(val) => setCreateForm({ ...createForm, schoolId: val })}
                  >
                    <SelectTrigger id="uSchool">
                      <SelectValue placeholder="Pilih Sekolah Pengguna" />
                    </SelectTrigger>
                    <SelectContent>
                      {schools.map((sch) => (
                        <SelectItem key={sch.id} value={sch.id}>
                          {sch.name} ({sch.code})
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <p className="text-[11px] text-gray-500">
                    Akun ini akan dihubungkan secara otomatis dengan database sekolah yang dipilih.
                  </p>
                </div>
              )}
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
                disabled={createLoading}
                className="bg-[#002446] hover:bg-[#002446]/90 text-white flex items-center gap-1.5"
              >
                {createLoading && <Loader2 className="h-4 w-4 animate-spin" />}
                {createLoading ? 'Menyimpan...' : 'Simpan Pengguna'}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Modal Reset Kata Sandi */}
      <Dialog open={isResetOpen} onOpenChange={setIsResetOpen}>
        <DialogContent className="sm:max-w-md">
          <form onSubmit={handleResetPasswordSubmit}>
            <DialogHeader>
              <DialogTitle className="text-xl font-bold text-[#002446] flex items-center gap-2">
                <KeyRound className="h-5 w-5 text-[#FF8928]" />
                Atur Ulang Kata Sandi
              </DialogTitle>
            </DialogHeader>

            <div className="space-y-4 py-4">
              <div className="p-3 bg-gray-50 rounded-lg text-xs text-gray-600 space-y-1">
                <div>
                  Pengguna:{' '}
                  <span className="font-semibold text-gray-800">{userToReset?.name}</span>
                </div>
                <div>
                  Email:{' '}
                  <span className="font-mono text-gray-800">{userToReset?.email}</span>
                </div>
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="rPassword">Kata Sandi Baru</Label>
                <Input
                  id="rPassword"
                  type="password"
                  placeholder="Masukkan kata sandi baru (min. 6 karakter)"
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  required
                />
                <p className="text-[11px] text-gray-500">
                  Setelah reset, pengguna diwajibkan mengganti kata sandi secara mandiri pada saat login pertama kali.
                </p>
              </div>
            </div>

            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                onClick={() => {
                  setIsResetOpen(false);
                  setUserToReset(null);
                  setNewPassword('');
                }}
              >
                Batal
              </Button>
              <Button
                type="submit"
                disabled={resetLoading}
                className="bg-[#002446] hover:bg-[#002446]/90 text-white flex items-center gap-1.5"
              >
                {resetLoading && <Loader2 className="h-4 w-4 animate-spin" />}
                {resetLoading ? 'Menyimpan...' : 'Perbarui Kata Sandi'}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
