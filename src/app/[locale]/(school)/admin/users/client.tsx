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
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  UserPlus,
  Upload,
  Search,
  KeyRound,
  CheckCircle,
  Pencil,
  Trash2,
  Download,
  Unlock,
} from 'lucide-react';
import {
  createUser,
  updateUser,
  deleteUser,
  bulkImportUsers,
  toggleUserActive,
  resetUserPassword,
} from '@/lib/actions/user';
import { unlockUserAccount } from '@/lib/actions/auth-lockout';
import { Role } from '@prisma/client';
import * as XLSX from 'xlsx';
import { useDialog } from '@/context/DialogContext';

interface UserItem {
  id: string;
  name: string;
  email: string;
  role: Role;
  nis: string | null;
  nip: string | null;
  isActive: boolean;
  mustChangePassword: boolean;
  failedLoginAttempts?: number;
  lockedUntil?: Date | string | null;
  createdAt: Date;
}

export function AdminUsersClient({ initialUsers }: { initialUsers: any[] }) {
  const { showAlert, showConfirm } = useDialog();
  const [users, setUsers] = useState<UserItem[]>(initialUsers);
  const [search, setSearch] = useState('');
  const [roleFilter, setRoleFilter] = useState<string>('ALL');
  const [statusFilter, setStatusFilter] = useState<string>('ACTIVE');
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [isEditOpen, setIsEditOpen] = useState(false);
  const [isImportOpen, setIsImportOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [previewData, setPreviewData] = useState<any[]>([]);
  const [importStatus, setImportStatus] = useState<string | null>(null);

  // Form states (Create)
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [role, setRole] = useState<Role>(Role.STUDENT);
  const [nis, setNis] = useState('');
  const [nip, setNip] = useState('');

  // Form states (Edit)
  const [editUserId, setEditUserId] = useState('');
  const [editName, setEditName] = useState('');
  const [editEmail, setEditEmail] = useState('');
  const [editRole, setEditRole] = useState<Role>(Role.STUDENT);
  const [editNis, setEditNis] = useState('');
  const [editNip, setEditNip] = useState('');
  const [editIsActive, setEditIsActive] = useState(true);

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      const created = await createUser({
        name,
        email,
        role,
        nis: role === Role.STUDENT ? nis : undefined,
        nip: role === Role.TEACHER ? nip : undefined,
      });

      setUsers((prev) => [created, ...prev]);
      setIsCreateOpen(false);
      setName('');
      setEmail('');
      setNis('');
      setNip('');
      await showAlert(`Pengguna ${created.name} berhasil ditambahkan!`, { type: 'success' });
    } catch (err: any) {
      console.error(err);
      await showAlert(err?.message || 'Gagal membuat pengguna', { type: 'error' });
    } finally {
      setLoading(false);
    }
  };

  const handleOpenEdit = (user: UserItem) => {
    setEditUserId(user.id);
    setEditName(user.name);
    setEditEmail(user.email);
    setEditRole(user.role);
    setEditNis(user.nis || '');
    setEditNip(user.nip || '');
    setEditIsActive(user.isActive);
    setIsEditOpen(true);
  };

  const handleUpdate = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      const updated = await updateUser(editUserId, {
        name: editName,
        email: editEmail,
        role: editRole,
        nis: editRole === Role.STUDENT ? editNis : null,
        nip: editRole === Role.TEACHER ? editNip : null,
        isActive: editIsActive,
      });

      setUsers((prev) =>
        prev.map((u) => (u.id === editUserId ? { ...u, ...updated } : u))
      );
      setIsEditOpen(false);
      await showAlert(`Data pengguna ${updated.name} berhasil diperbarui!`, { type: 'success' });
    } catch (err: any) {
      console.error(err);
      await showAlert(err?.message || 'Gagal memperbarui pengguna', { type: 'error' });
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async (user: UserItem) => {
    const confirmed = await showConfirm(
      `Apakah Anda yakin ingin menonaktifkan pengguna "${user.name}"?\n\nSiswa yang lulus atau guru yang pindah dapat dialihkan ke status Nonaktif agar riwayat akademik dan tugas tetap terjaga.`,
      {
        title: 'Konfirmasi Penonaktifan Pengguna',
        confirmText: 'Ya, Nonaktifkan',
        cancelText: 'Batal',
      }
    );
    if (!confirmed) return;

    setLoading(true);
    try {
      const res = await deleteUser(user.id, false);
      setUsers((prev) =>
        prev.map((u) => (u.id === user.id ? { ...u, isActive: false } : u))
      );
      await showAlert(
        res.message || `Pengguna ${user.name} berhasil dinonaktifkan.`,
        { type: 'success' }
      );
    } catch (err: any) {
      console.error(err);
      await showAlert(err?.message || 'Gagal menonaktifkan pengguna', { type: 'error' });
    } finally {
      setLoading(false);
    }
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (evt) => {
      try {
        const bstr = evt.target?.result;
        const wb = XLSX.read(bstr, { type: 'binary' });
        const wsname = wb.SheetNames[0];
        const ws = wb.Sheets[wsname];
        const data = XLSX.utils.sheet_to_json<any>(ws);

        // Normalize data
        const parsed = data.map((row: any) => ({
          name: row.Nama || row.nama || row.Name || row.name || '',
          email: row.Email || row.email || '',
          role: (row.Role || row.role || 'STUDENT').toUpperCase() as Role,
          nis: String(row.NIS || row.nis || ''),
          nip: String(row.NIP || row.nip || ''),
        }));

        setPreviewData(parsed.filter((p) => p.email && p.name));
      } catch (err) {
        console.error(err);
        showAlert('Format file tidak valid atau rusak. Gunakan file Excel (.xlsx / .xls).', { type: 'error' });
      }
    };
    reader.readAsBinaryString(file);
  };

  const handleConfirmImport = async () => {
    if (previewData.length === 0) return;
    setLoading(true);
    setImportStatus(null);
    try {
      const res = await bulkImportUsers(previewData);
      setImportStatus(`Berhasil mengimpor ${res.count} pengguna!`);
      await showAlert(`Berhasil mengimpor ${res.count} pengguna! Halaman akan disegarkan.`, { type: 'success' });
      setTimeout(() => {
        window.location.reload();
      }, 500);
    } catch (err: any) {
      console.error(err);
      await showAlert(err?.message || 'Gagal mengimpor data', { type: 'error' });
    } finally {
      setLoading(false);
    }
  };

  const handleToggleActive = async (user: UserItem) => {
    try {
      const updated = await toggleUserActive(user.id);
      setUsers((prev) =>
        prev.map((u) => (u.id === user.id ? { ...u, isActive: updated.isActive } : u))
      );
    } catch (err: any) {
      console.error(err);
      await showAlert(err?.message || 'Gagal memperbarui status', { type: 'error' });
    }
  };

  const handleResetPassword = async (user: UserItem) => {
    const defaultText = user.role === Role.STUDENT && user.nis ? `NIS (${user.nis})` : 'Lentera123!';
    const confirmed = await showConfirm(
      `Reset password ${user.name} ke default: ${defaultText}?\n\nPengguna akan diminta mengganti password saat login berikutnya.`,
      { title: 'Konfirmasi Reset Password', confirmText: 'Ya, Reset Password' }
    );
    if (!confirmed) {
      return;
    }
    try {
      await resetUserPassword(user.id);
      await showAlert(`Password ${user.name} berhasil di-reset ke: ${defaultText}`, { type: 'success' });
    } catch (err: any) {
      console.error(err);
      await showAlert(err?.message || 'Gagal me-reset password', { type: 'error' });
    }
  };

  const handleUnlockAccount = async (user: UserItem) => {
    const confirmed = await showConfirm(
      `Buka kunci akun untuk ${user.name} (${user.email}) sekarang? Jumlah percobaan login gagal akan di-reset ke 0.`,
      { title: 'Buka Kunci Akun', confirmText: 'Ya, Buka Kunci' }
    );
    if (!confirmed) return;

    try {
      await unlockUserAccount(user.id);
      setUsers((prev) =>
        prev.map((u) =>
          u.id === user.id
            ? { ...u, lockedUntil: null, failedLoginAttempts: 0 }
            : u
        )
      );
      await showAlert(`Akun ${user.name} berhasil dibuka kuncinya.`, { type: 'success' });
    } catch (err: any) {
      console.error(err);
      await showAlert(err?.message || 'Gagal membuka kunci akun', { type: 'error' });
    }
  };

  const filtered = users.filter((u) => {
    const q = search.toLowerCase();
    const matchSearch =
      u.name.toLowerCase().includes(q) ||
      u.email.toLowerCase().includes(q) ||
      (u.nis || '').includes(q) ||
      (u.nip || '').includes(q);
    const matchRole = roleFilter === 'ALL' || u.role === roleFilter;
    const matchStatus =
      statusFilter === 'ALL' ||
      (statusFilter === 'ACTIVE' && u.isActive) ||
      (statusFilter === 'INACTIVE' && !u.isActive);

    return matchSearch && matchRole && matchStatus;
  });

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
        <div className="flex flex-wrap items-center gap-3 w-full sm:w-auto">
          <div className="relative w-full sm:w-64">
            <Search className="absolute left-3 top-3 h-4 w-4 text-gray-400 dark:text-gray-500" />
            <Input
              placeholder="Cari nama, email, NIS, NIP..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-9 bg-white dark:bg-gray-800/60 dark:border-gray-700 dark:text-white dark:placeholder:text-gray-500"
            />
          </div>

          {/* Role Filter */}
          <select
            value={roleFilter}
            onChange={(e) => setRoleFilter(e.target.value)}
            className="h-10 px-3 rounded-md border border-gray-300 bg-white text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-brand-500 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-100 transition-colors"
          >
            <option value="ALL">Semua Role</option>
            <option value="TEACHER">Guru</option>
            <option value="STUDENT">Siswa</option>
            <option value="SUPERVISOR">Kepsek/Wakasek</option>
            <option value="ADMIN">Administrator</option>
          </select>

          {/* Status Filter (Active / Inactive / All) */}
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="h-10 px-3 rounded-md border border-gray-300 bg-white text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-brand-500 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-100 transition-colors"
          >
            <option value="ACTIVE">Status: Aktif</option>
            <option value="INACTIVE">Status: Nonaktif (Alumni/Pindah)</option>
            <option value="ALL">Status: Semua</option>
          </select>
        </div>

        <div className="flex items-center gap-2 w-full sm:w-auto">
          <Button
            variant="outline"
            onClick={() => setIsImportOpen(true)}
            className="border-[#FF8928] text-[#FF8928] hover:bg-[#FF8928] hover:text-white dark:border-[#FF8928] dark:text-[#FF8928] dark:hover:bg-[#FF8928] dark:hover:text-white flex items-center gap-1.5"
          >
            <Upload className="h-4 w-4" /> Impor CSV / Excel
          </Button>

          <Button
            onClick={() => setIsCreateOpen(true)}
            className="bg-[#002446] hover:bg-[#002446]/90 dark:bg-brand-600 dark:hover:bg-brand-700 text-white flex items-center gap-1.5"
          >
            <UserPlus className="h-4 w-4" /> Tambah Pengguna
          </Button>
        </div>
      </div>

      <Card>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Nama Pengguna</TableHead>
                <TableHead>Email</TableHead>
                <TableHead>Role</TableHead>
                <TableHead>Identitas (NIS/NIP)</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-right">Aksi</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={6} className="text-center py-10 text-gray-500 dark:text-gray-400">
                    Tidak ada pengguna ditemukan.
                  </TableCell>
                </TableRow>
              ) : (
                filtered.map((user) => (
                  <TableRow key={user.id}>
                    <TableCell className="font-medium text-[#002446] dark:text-white">
                      {user.name}
                    </TableCell>
                    <TableCell className="text-sm text-gray-600 dark:text-gray-300">
                      {user.email}
                    </TableCell>
                    <TableCell>
                      <Badge
                        className={
                          user.role === Role.ADMIN
                            ? 'bg-purple-600 text-white'
                            : user.role === Role.TEACHER
                            ? 'bg-[#002446] text-white'
                            : user.role === Role.STUDENT
                            ? 'bg-[#FF8928] text-white'
                            : 'bg-emerald-600 text-white'
                        }
                      >
                        {user.role}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-xs font-mono text-gray-600 dark:text-gray-400">
                      {user.nis ? `NIS: ${user.nis}` : user.nip ? `NIP: ${user.nip}` : '-'}
                    </TableCell>
                    <TableCell>
                      <div className="flex flex-col gap-1 items-start">
                        <span
                          onClick={() => handleToggleActive(user)}
                          title="Klik untuk ubah status"
                          className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium cursor-pointer transition-colors ${
                            user.isActive
                              ? 'bg-green-100 text-green-800 hover:bg-green-200 dark:bg-green-950/40 dark:text-green-400 dark:border dark:border-green-800'
                              : 'bg-red-100 text-red-800 hover:bg-red-200 dark:bg-red-950/40 dark:text-red-400 dark:border dark:border-red-800'
                          }`}
                        >
                          {user.isActive ? 'Aktif' : 'Nonaktif'}
                        </span>
                        {user.lockedUntil && new Date(user.lockedUntil) > new Date() && (
                          <span
                            className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-semibold bg-rose-100 text-rose-800 border border-rose-300 dark:bg-rose-950/60 dark:text-rose-300 dark:border-rose-800"
                            title={`Terkunci hingga ${new Date(user.lockedUntil).toLocaleTimeString()}`}
                          >
                            🔒 Terkunci
                          </span>
                        )}
                      </div>
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex items-center justify-end gap-1">
                        {user.lockedUntil && new Date(user.lockedUntil) > new Date() && (
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => handleUnlockAccount(user)}
                            title="Buka Kunci Akun Pengguna"
                            className="h-8 w-8 p-0 text-amber-600 hover:text-amber-800 hover:bg-amber-50 dark:text-amber-400 dark:hover:bg-amber-950/30"
                          >
                            <Unlock className="h-4 w-4" />
                          </Button>
                        )}
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => handleOpenEdit(user)}
                          title="Edit Pengguna"
                          className="h-8 w-8 p-0 text-gray-500 hover:text-blue-600 hover:bg-blue-50 dark:hover:bg-blue-900/20 dark:text-gray-400 dark:hover:text-blue-400"
                        >
                          <Pencil className="h-4 w-4" />
                        </Button>
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => handleResetPassword(user)}
                          title="Reset Password"
                          className="h-8 w-8 p-0 text-gray-500 hover:text-[#002446] hover:bg-gray-100 dark:hover:bg-gray-800 dark:text-gray-400 dark:hover:text-white"
                        >
                          <KeyRound className="h-4 w-4" />
                        </Button>
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => handleDelete(user)}
                          title={user.isActive ? 'Nonaktifkan Pengguna' : 'Pengguna Sudah Nonaktif'}
                          className="h-8 w-8 p-0 text-gray-500 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20 dark:text-gray-400 dark:hover:text-red-400"
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* Modal Tambah Pengguna */}
      <Dialog open={isCreateOpen} onOpenChange={setIsCreateOpen}>
        <DialogContent className="sm:max-w-md">
          <form onSubmit={handleCreate}>
            <DialogHeader>
              <DialogTitle className="text-xl font-bold text-[#002446] dark:text-white">
                Tambah Pengguna Baru
              </DialogTitle>
            </DialogHeader>
            <div className="space-y-4 py-4">
              <div className="space-y-2">
                <Label htmlFor="uName">Nama Lengkap</Label>
                <Input
                  id="uName"
                  placeholder="Nama Lengkap"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  required
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="uEmail">Email</Label>
                <Input
                  id="uEmail"
                  type="email"
                  placeholder="user@sekolah.sch.id"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="uRole">Role Pengguna</Label>
                <select
                  id="uRole"
                  value={role}
                  onChange={(e) => setRole(e.target.value as Role)}
                  className="w-full h-10 px-3 rounded-md border border-gray-300 bg-white text-sm focus:outline-none focus:ring-2 focus:ring-[#002446] dark:border-gray-700 dark:bg-gray-800 dark:text-gray-100 transition-colors"
                >
                  <option value={Role.STUDENT}>Siswa</option>
                  <option value={Role.TEACHER}>Guru</option>
                  <option value={Role.SUPERVISOR}>Kepala Sekolah / Wakasek</option>
                  <option value={Role.ADMIN}>Administrator</option>
                </select>
              </div>

              {role === Role.STUDENT ? (
                <div className="space-y-2">
                  <Label htmlFor="uNis">NIS (Nomor Induk Siswa)</Label>
                  <Input
                    id="uNis"
                    placeholder="misal: 20261001"
                    value={nis}
                    onChange={(e) => setNis(e.target.value)}
                    required
                  />
                  <p className="text-xs text-gray-500 dark:text-gray-400">
                    NIS ini akan digunakan sebagai <strong>password default</strong> saat pertama kali login.
                  </p>
                </div>
              ) : (
                <div className="space-y-2">
                  <Label htmlFor="uNip">NIP (Nomor Induk Pegawai - Opsional)</Label>
                  <Input
                    id="uNip"
                    placeholder="misal: 198501012010011001"
                    value={nip}
                    onChange={(e) => setNip(e.target.value)}
                  />
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
                disabled={loading}
                className="bg-[#002446] hover:bg-[#002446]/90 dark:bg-brand-600 dark:hover:bg-brand-700 text-white"
              >
                {loading ? 'Menyimpan...' : 'Simpan Pengguna'}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Modal Edit Pengguna */}
      <Dialog open={isEditOpen} onOpenChange={setIsEditOpen}>
        <DialogContent className="sm:max-w-md">
          <form onSubmit={handleUpdate}>
            <DialogHeader>
              <DialogTitle className="text-xl font-bold text-[#002446] dark:text-white">
                Edit Data Pengguna
              </DialogTitle>
            </DialogHeader>
            <div className="space-y-4 py-4">
              <div className="space-y-2">
                <Label htmlFor="editName">Nama Lengkap</Label>
                <Input
                  id="editName"
                  placeholder="Nama Lengkap"
                  value={editName}
                  onChange={(e) => setEditName(e.target.value)}
                  required
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="editEmail">Email</Label>
                <Input
                  id="editEmail"
                  type="email"
                  placeholder="user@sekolah.sch.id"
                  value={editEmail}
                  onChange={(e) => setEditEmail(e.target.value)}
                  required
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="editRole">Role Pengguna</Label>
                <select
                  id="editRole"
                  value={editRole}
                  onChange={(e) => setEditRole(e.target.value as Role)}
                  className="w-full h-10 px-3 rounded-md border border-gray-300 bg-white text-sm focus:outline-none focus:ring-2 focus:ring-[#002446] dark:border-gray-700 dark:bg-gray-800 dark:text-gray-100 transition-colors"
                >
                  <option value={Role.STUDENT}>Siswa</option>
                  <option value={Role.TEACHER}>Guru</option>
                  <option value={Role.SUPERVISOR}>Kepala Sekolah / Wakasek</option>
                  <option value={Role.ADMIN}>Administrator</option>
                </select>
              </div>

              {editRole === Role.STUDENT ? (
                <div className="space-y-2">
                  <Label htmlFor="editNis">NIS (Nomor Induk Siswa)</Label>
                  <Input
                    id="editNis"
                    placeholder="misal: 20261001"
                    value={editNis}
                    onChange={(e) => setEditNis(e.target.value)}
                  />
                </div>
              ) : (
                <div className="space-y-2">
                  <Label htmlFor="editNip">NIP (Nomor Induk Pegawai - Opsional)</Label>
                  <Input
                    id="editNip"
                    placeholder="misal: 198501012010011001"
                    value={editNip}
                    onChange={(e) => setEditNip(e.target.value)}
                  />
                </div>
              )}

              <div className="space-y-2">
                <Label htmlFor="editStatus">Status Akun</Label>
                <select
                  id="editStatus"
                  value={editIsActive ? 'ACTIVE' : 'INACTIVE'}
                  onChange={(e) => setEditIsActive(e.target.value === 'ACTIVE')}
                  className="w-full h-10 px-3 rounded-md border border-gray-300 bg-white text-sm focus:outline-none focus:ring-2 focus:ring-[#002446] dark:border-gray-700 dark:bg-gray-800 dark:text-gray-100 transition-colors"
                >
                  <option value="ACTIVE">Aktif</option>
                  <option value="INACTIVE">Nonaktif (Lulus / Pindah)</option>
                </select>
              </div>
            </div>
            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                onClick={() => setIsEditOpen(false)}
              >
                Batal
              </Button>
              <Button
                type="submit"
                disabled={loading}
                className="bg-[#002446] hover:bg-[#002446]/90 dark:bg-brand-600 dark:hover:bg-brand-700 text-white"
              >
                {loading ? 'Menyimpan...' : 'Perbarui Pengguna'}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Modal Impor Excel/CSV */}
      <Dialog open={isImportOpen} onOpenChange={setIsImportOpen}>
        <DialogContent className="sm:max-w-2xl max-h-[85vh] flex flex-col">
          <DialogHeader>
            <DialogTitle className="text-xl font-bold text-[#002446] dark:text-white flex items-center gap-2">
              <Upload className="h-5 w-5 text-[#FF8928]" /> Impor Pengguna Massal
            </DialogTitle>
          </DialogHeader>

          <div className="space-y-4 py-3 flex-1 overflow-hidden flex flex-col">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-3 bg-blue-50 dark:bg-blue-950/40 border border-blue-200 dark:border-blue-800/60 rounded-lg text-xs text-blue-900 dark:text-blue-200">
              <div className="space-y-1">
                <p className="font-semibold">Format Kolom Spreadsheet (Excel / CSV):</p>
                <p>Kolom: <strong>Nama</strong>, <strong>Email</strong>, <strong>Role</strong> (STUDENT / TEACHER), <strong>NIS</strong> (untuk Siswa), <strong>NIP</strong> (opsional).</p>
                <p className="text-[#FF8928] dark:text-orange-400 font-medium">Siswa akan otomatis menggunakan NIS sebagai password awal dan wajib mengganti password saat login pertama kali.</p>
              </div>
              <a
                href="/templates/template-impor-pengguna.xlsx"
                download="template-impor-pengguna.xlsx"
                className="shrink-0 inline-flex items-center justify-center gap-1.5 px-3 py-2 bg-white dark:bg-gray-800 border border-blue-300 dark:border-blue-700 rounded-md text-xs font-medium text-blue-700 dark:text-blue-300 hover:bg-blue-100/50 dark:hover:bg-gray-700 transition-colors shadow-sm"
              >
                <Download className="h-4 w-4 text-blue-600 dark:text-blue-400" />
                Unduh Template Excel
              </a>
            </div>

            <div className="space-y-2">
              <Label htmlFor="fileInput">Pilih File Excel (.xlsx, .xls, .csv)</Label>
              <Input
                id="fileInput"
                type="file"
                accept=".xlsx,.xls,.csv"
                onChange={handleFileUpload}
                className="cursor-pointer file:cursor-pointer file:font-semibold file:text-brand-600 dark:file:text-brand-400"
              />
            </div>

            {previewData.length > 0 && (
              <div className="flex-1 overflow-y-auto border border-gray-200 dark:border-gray-800 rounded-lg">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Nama</TableHead>
                      <TableHead>Email</TableHead>
                      <TableHead>Role</TableHead>
                      <TableHead>NIS / NIP</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {previewData.slice(0, 15).map((row, idx) => (
                      <TableRow key={idx}>
                        <TableCell className="font-medium text-xs text-gray-900 dark:text-gray-100">{row.name}</TableCell>
                        <TableCell className="text-xs text-gray-600 dark:text-gray-300">{row.email}</TableCell>
                        <TableCell className="text-xs text-gray-600 dark:text-gray-300">{row.role}</TableCell>
                        <TableCell className="text-xs font-mono text-gray-600 dark:text-gray-400">
                          {row.nis || row.nip || '-'}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
                {previewData.length > 15 && (
                  <div className="p-2 text-center text-xs text-gray-500 dark:text-gray-400 bg-gray-50 dark:bg-gray-800/40 border-t border-gray-200 dark:border-gray-800">
                    ...dan {previewData.length - 15} baris lainnya
                  </div>
                )}
              </div>
            )}

            {importStatus && (
              <div className="p-3 bg-green-50 dark:bg-green-950/40 text-green-800 dark:text-green-300 text-sm rounded-lg flex items-center gap-2 border border-green-200 dark:border-green-800">
                <CheckCircle className="h-4 w-4 text-green-600 dark:text-green-400" />
                {importStatus}
              </div>
            )}
          </div>

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => {
                setIsImportOpen(false);
                setPreviewData([]);
                setImportStatus(null);
              }}
            >
              Tutup
            </Button>
            <Button
              type="button"
              disabled={previewData.length === 0 || loading}
              onClick={handleConfirmImport}
              className="bg-[#FF8928] hover:bg-[#FF8928]/90 text-white"
            >
              {loading ? 'Mengimpor...' : `Konfirmasi Impor (${previewData.length} Pengguna)`}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
