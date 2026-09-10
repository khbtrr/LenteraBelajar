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
import { Users, UserPlus, Upload, Search, KeyRound, ShieldAlert, CheckCircle } from 'lucide-react';
import { createUser, bulkImportUsers, toggleUserActive, resetUserPassword } from '@/lib/actions/user';
import { Role } from '@prisma/client';
import * as XLSX from 'xlsx';

interface UserItem {
  id: string;
  name: string;
  email: string;
  role: Role;
  nis: string | null;
  nip: string | null;
  isActive: boolean;
  mustChangePassword: boolean;
  createdAt: Date;
}

export function AdminUsersClient({ initialUsers }: { initialUsers: any[] }) {
  const [users, setUsers] = useState<UserItem[]>(initialUsers);
  const [search, setSearch] = useState('');
  const [roleFilter, setRoleFilter] = useState<string>('ALL');
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [isImportOpen, setIsImportOpen] = useState(false);
  const [loading, setLoading] = useState(false);

  // Single User Form
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [role, setRole] = useState<Role>(Role.STUDENT);
  const [nis, setNis] = useState('');
  const [nip, setNip] = useState('');

  // Bulk Import State
  const [previewData, setPreviewData] = useState<any[]>([]);
  const [importStatus, setImportStatus] = useState<string | null>(null);

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      const created = await createUser({
        name,
        email,
        role,
        nis: role === Role.STUDENT ? nis : undefined,
        nip: role === Role.TEACHER || role === Role.SUPERVISOR ? nip : undefined,
      });

      setUsers((prev) => [created, ...prev]);
      setIsCreateOpen(false);
      setName('');
      setEmail('');
      setNis('');
      setNip('');
    } catch (err) {
      console.error(err);
      alert('Gagal membuat pengguna');
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
        alert('Format file tidak valid');
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
      setTimeout(() => {
        window.location.reload();
      }, 1000);
    } catch (err) {
      console.error(err);
      alert('Gagal mengimpor data');
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
    } catch (err) {
      console.error(err);
      alert('Gagal memperbarui status');
    }
  };

  const handleResetPassword = async (user: UserItem) => {
    const defaultText = user.role === Role.STUDENT && user.nis ? `NIS (${user.nis})` : 'Lentera123!';
    if (!confirm(`Reset password ${user.name} ke default: ${defaultText}? Pengguna akan diminta ganti password saat login.`)) {
      return;
    }
    try {
      await resetUserPassword(user.id);
      alert(`Password ${user.name} berhasil di-reset ke: ${defaultText}`);
    } catch (err) {
      console.error(err);
      alert('Gagal me-reset password');
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
    return matchSearch && matchRole;
  });

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
        <div className="flex items-center gap-3 w-full sm:w-auto">
          <div className="relative w-full sm:w-72">
            <Search className="absolute left-3 top-3 h-4 w-4 text-gray-400" />
            <Input
              placeholder="Cari nama, email, NIS, NIP..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-9 bg-white"
            />
          </div>
          <select
            value={roleFilter}
            onChange={(e) => setRoleFilter(e.target.value)}
            className="h-10 px-3 rounded-md border border-gray-300 bg-white text-sm focus:outline-none focus:ring-2 focus:ring-[#002446]"
          >
            <option value="ALL">Semua Role</option>
            <option value="TEACHER">Guru</option>
            <option value="STUDENT">Siswa</option>
            <option value="SUPERVISOR">Kepsek/Wakasek</option>
            <option value="ADMIN">Administrator</option>
          </select>
        </div>

        <div className="flex items-center gap-2 w-full sm:w-auto">
          <Button
            variant="outline"
            onClick={() => setIsImportOpen(true)}
            className="border-[#FF8928] text-[#FF8928] hover:bg-[#FF8928] hover:text-white flex items-center gap-1.5"
          >
            <Upload className="h-4 w-4" /> Impor CSV / Excel
          </Button>

          <Button
            onClick={() => setIsCreateOpen(true)}
            className="bg-[#002446] hover:bg-[#002446]/90 text-white flex items-center gap-1.5"
          >
            <UserPlus className="h-4 w-4" /> Tambah Pengguna
          </Button>
        </div>
      </div>

      <Card>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow className="bg-gray-50">
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
                  <TableCell colSpan={6} className="text-center py-10 text-gray-500">
                    Tidak ada pengguna ditemukan.
                  </TableCell>
                </TableRow>
              ) : (
                filtered.map((user) => (
                  <TableRow key={user.id}>
                    <TableCell className="font-medium text-[#002446]">
                      {user.name}
                    </TableCell>
                    <TableCell className="text-sm text-gray-600">
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
                    <TableCell className="text-xs font-mono">
                      {user.nis ? `NIS: ${user.nis}` : user.nip ? `NIP: ${user.nip}` : '-'}
                    </TableCell>
                    <TableCell>
                      <span
                        onClick={() => handleToggleActive(user)}
                        className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium cursor-pointer transition-colors ${
                          user.isActive
                            ? 'bg-green-100 text-green-800 hover:bg-green-200'
                            : 'bg-red-100 text-red-800 hover:bg-red-200'
                        }`}
                      >
                        {user.isActive ? 'Aktif' : 'Nonaktif'}
                      </span>
                    </TableCell>
                    <TableCell className="text-right">
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => handleResetPassword(user)}
                        title="Reset Password"
                        className="text-gray-500 hover:text-[#002446]"
                      >
                        <KeyRound className="h-4 w-4" />
                      </Button>
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
              <DialogTitle className="text-xl font-bold text-[#002446]">
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
                  className="w-full h-10 px-3 rounded-md border border-gray-300 bg-white text-sm focus:outline-none focus:ring-2 focus:ring-[#002446]"
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
                  <p className="text-xs text-gray-500">
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
                className="bg-[#002446] hover:bg-[#002446]/90 text-white"
              >
                {loading ? 'Menyimpan...' : 'Simpan Pengguna'}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Modal Impor Excel/CSV */}
      <Dialog open={isImportOpen} onOpenChange={setIsImportOpen}>
        <DialogContent className="sm:max-w-2xl max-h-[85vh] flex flex-col">
          <DialogHeader>
            <DialogTitle className="text-xl font-bold text-[#002446] flex items-center gap-2">
              <Upload className="h-5 w-5 text-[#FF8928]" /> Impor Pengguna Massal
            </DialogTitle>
          </DialogHeader>

          <div className="space-y-4 py-3 flex-1 overflow-hidden flex flex-col">
            <div className="p-3 bg-blue-50 border border-blue-200 rounded-lg text-xs text-blue-900 space-y-1">
              <p className="font-semibold">Format Kolom Spreadsheet (Excel / CSV):</p>
              <p>Kolom: <strong>Nama</strong>, <strong>Email</strong>, <strong>Role</strong> (STUDENT / TEACHER), <strong>NIS</strong> (untuk Siswa), <strong>NIP</strong> (opsional).</p>
              <p className="text-[#FF8928] font-medium">Siswa akan otomatis menggunakan NIS sebagai password awal dan wajib mengganti password saat login pertama kali.</p>
            </div>

            <div className="space-y-2">
              <Label htmlFor="fileInput">Pilih File Excel (.xlsx, .xls, .csv)</Label>
              <Input
                id="fileInput"
                type="file"
                accept=".xlsx,.xls,.csv"
                onChange={handleFileUpload}
              />
            </div>

            {previewData.length > 0 && (
              <div className="flex-1 overflow-y-auto border rounded-lg">
                <Table>
                  <TableHeader>
                    <TableRow className="bg-gray-50">
                      <TableHead>Nama</TableHead>
                      <TableHead>Email</TableHead>
                      <TableHead>Role</TableHead>
                      <TableHead>NIS / NIP</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {previewData.slice(0, 15).map((row, idx) => (
                      <TableRow key={idx}>
                        <TableCell className="font-medium text-xs">{row.name}</TableCell>
                        <TableCell className="text-xs">{row.email}</TableCell>
                        <TableCell className="text-xs">{row.role}</TableCell>
                        <TableCell className="text-xs font-mono">
                          {row.nis || row.nip || '-'}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
                {previewData.length > 15 && (
                  <div className="p-2 text-center text-xs text-gray-500 bg-gray-50 border-t">
                    ...dan {previewData.length - 15} baris lainnya
                  </div>
                )}
              </div>
            )}

            {importStatus && (
              <div className="p-3 bg-green-50 text-green-800 text-sm rounded-lg flex items-center gap-2">
                <CheckCircle className="h-4 w-4 text-green-600" />
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
