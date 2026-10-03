'use client';

import { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import {
  Globe,
  Shield,
  User,
  CheckCircle2,
  Lock,
  Server,
  Loader2,
  Save,
  KeyRound,
  AlertCircle,
} from 'lucide-react';
import { updateSuperAdminProfile } from '@/lib/actions/platform';
import { useDialog } from '@/context/DialogContext';

interface PlatformSettingsClientProps {
  initialData: {
    currentUser: {
      id: string;
      name: string;
      email: string;
      role: string;
      createdAt: Date;
      lastLoginAt: Date | null;
    } | null;
    platform: {
      name: string;
      version: string;
      supportEmail: string;
      maxFailedLogins: number;
      lockoutDurationMinutes: number;
      passwordMinLength: number;
    };
  };
}

export function PlatformSettingsClient({ initialData }: PlatformSettingsClientProps) {
  const { showAlert } = useDialog();

  const [activeTab, setActiveTab] = useState<'platform' | 'security' | 'account'>('platform');

  // Profile State
  const [name, setName] = useState(initialData.currentUser?.name || '');
  const [email, setEmail] = useState(initialData.currentUser?.email || '');
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [loading, setLoading] = useState(false);

  const handleProfileSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (newPassword && newPassword !== confirmPassword) {
      await showAlert('Konfirmasi kata sandi baru tidak sesuai.', { type: 'error' });
      return;
    }

    if (newPassword && !currentPassword) {
      await showAlert('Kata sandi saat ini wajib diisi untuk mengubah kata sandi.', { type: 'error' });
      return;
    }

    setLoading(true);
    try {
      const res = await updateSuperAdminProfile({
        name,
        email,
        currentPassword: currentPassword || undefined,
        newPassword: newPassword || undefined,
      });

      await showAlert('Profil Super Admin berhasil diperbarui.', { type: 'success' });
      setName(res.name);
      setEmail(res.email);
      setCurrentPassword('');
      setNewPassword('');
      setConfirmPassword('');
    } catch (err: any) {
      console.error(err);
      await showAlert(err?.message || 'Gagal memperbarui profil', { type: 'error' });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Tab Navigation */}
      <div className="flex border-b border-gray-200 gap-2">
        <button
          type="button"
          onClick={() => setActiveTab('platform')}
          className={`flex items-center gap-2 px-4 py-2.5 text-xs font-semibold border-b-2 transition-colors cursor-pointer ${
            activeTab === 'platform'
              ? 'border-[#002446] text-[#002446]'
              : 'border-transparent text-gray-500 hover:text-gray-700'
          }`}
        >
          <Globe className="h-4 w-4 text-[#FF8928]" />
          Profil & Branding Platform
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('security')}
          className={`flex items-center gap-2 px-4 py-2.5 text-xs font-semibold border-b-2 transition-colors cursor-pointer ${
            activeTab === 'security'
              ? 'border-[#002446] text-[#002446]'
              : 'border-transparent text-gray-500 hover:text-gray-700'
          }`}
        >
          <Shield className="h-4 w-4 text-emerald-600" />
          Kebijakan Keamanan Global
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('account')}
          className={`flex items-center gap-2 px-4 py-2.5 text-xs font-semibold border-b-2 transition-colors cursor-pointer ${
            activeTab === 'account'
              ? 'border-[#002446] text-[#002446]'
              : 'border-transparent text-gray-500 hover:text-gray-700'
          }`}
        >
          <User className="h-4 w-4 text-sky-600" />
          Akun Super Admin
        </button>
      </div>

      {/* Tab 1: Platform Profile & Branding */}
      {activeTab === 'platform' && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <Card className="shadow-sm">
            <CardHeader>
              <CardTitle className="text-base font-bold text-[#002446] flex items-center gap-2">
                <Globe className="h-4 w-4 text-[#002446]" />
                Informasi Sistem Platform
              </CardTitle>
              <CardDescription className="text-xs">
                Detail identitas dan parameter inti lingkungan platform LenteraBelajar.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-1">
                <Label className="text-xs text-gray-500">Nama Platform</Label>
                <p className="text-sm font-semibold text-gray-800">
                  {initialData.platform.name}
                </p>
              </div>

              <div className="space-y-1">
                <Label className="text-xs text-gray-500">Versi Rilis Saat Ini</Label>
                <div className="flex items-center gap-2">
                  <span className="font-mono text-xs font-semibold text-[#002446]">
                    {initialData.platform.version}
                  </span>
                  <Badge className="bg-emerald-100 text-emerald-800 border-emerald-200 text-[10px]">
                    Stable Production
                  </Badge>
                </div>
              </div>

              <div className="space-y-1">
                <Label className="text-xs text-gray-500">Email Pusat Bantuan & Kontak Dukungan</Label>
                <p className="text-sm font-mono text-gray-800">
                  {initialData.platform.supportEmail}
                </p>
              </div>

              <div className="space-y-1">
                <Label className="text-xs text-gray-500">Status Operasional Seluruh Sistem</Label>
                <div className="flex items-center gap-2 text-xs font-semibold text-emerald-700">
                  <CheckCircle2 className="h-4 w-4 text-emerald-600" />
                  Semua Layanan Berjalan Normal (100% Uptime)
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="shadow-sm">
            <CardHeader>
              <CardTitle className="text-base font-bold text-[#002446] flex items-center gap-2">
                <Server className="h-4 w-4 text-[#FF8928]" />
                Infrastruktur & Arsitektur
              </CardTitle>
              <CardDescription className="text-xs">
                Konfigurasi stack teknologi dan mekanisme multi-tenant.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4 text-xs text-gray-600">
              <div className="p-3 bg-gray-50 rounded-lg space-y-1">
                <span className="font-semibold text-gray-800">Arsitektur Multi-Tenant:</span>
                <p className="text-gray-500">
                  Shared Database dengan Logical Tenant Isolation (School Scoping + UserSchool Association) untuk skalabilitas tinggi dan isolasi ketat.
                </p>
              </div>

              <div className="p-3 bg-gray-50 rounded-lg space-y-1">
                <span className="font-semibold text-gray-800">Database Engine:</span>
                <p className="text-gray-500 font-mono">
                  PostgreSQL dengan Prisma ORM & Transaction Locking (Atomic Upsert & Batch Submission).
                </p>
              </div>

              <div className="p-3 bg-gray-50 rounded-lg space-y-1">
                <span className="font-semibold text-gray-800">CBT Engine Resilience:</span>
                <p className="text-gray-500">
                  Snapshot-based persistent randomization order & automated background heartbeat monitoring.
                </p>
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Tab 2: Security & Authentication Policy */}
      {activeTab === 'security' && (
        <Card className="shadow-sm">
          <CardHeader>
            <CardTitle className="text-base font-bold text-[#002446] flex items-center gap-2">
              <Shield className="h-4 w-4 text-emerald-600" />
              Kebijakan Keamanan & Otentikasi Terpusat
            </CardTitle>
            <CardDescription className="text-xs">
              Parameter keamanan global yang diterapkan secara merata di seluruh institusi sekolah.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="p-4 border rounded-xl bg-gray-50/50 space-y-2">
                <div className="flex items-center gap-2 font-semibold text-sm text-[#002446]">
                  <Lock className="h-4 w-4 text-rose-600" />
                  Proteksi Brute-Force
                </div>
                <p className="text-xs text-gray-500">
                  Akun akan terkunci secara otomatis setelah{' '}
                  <span className="font-semibold text-gray-800">
                    {initialData.platform.maxFailedLogins} kali
                  </span>{' '}
                  percobaan kata sandi yang salah berturut-turut.
                </p>
                <Badge variant="outline" className="text-[10px] text-rose-700 bg-rose-50 border-rose-200">
                  Aktif Terproteksi
                </Badge>
              </div>

              <div className="p-4 border rounded-xl bg-gray-50/50 space-y-2">
                <div className="flex items-center gap-2 font-semibold text-sm text-[#002446]">
                  <AlertCircle className="h-4 w-4 text-amber-600" />
                  Durasi Penguncian Akun
                </div>
                <p className="text-xs text-gray-500">
                  Durasi penangguhan akun saat terjadi brute-force adalah{' '}
                  <span className="font-semibold text-gray-800">
                    {initialData.platform.lockoutDurationMinutes} menit
                  </span>{' '}
                  sebelum dapat mencoba kembali.
                </p>
                <Badge variant="outline" className="text-[10px] text-amber-700 bg-amber-50 border-amber-200">
                  Auto Unlock
                </Badge>
              </div>

              <div className="p-4 border rounded-xl bg-gray-50/50 space-y-2">
                <div className="flex items-center gap-2 font-semibold text-sm text-[#002446]">
                  <KeyRound className="h-4 w-4 text-sky-600" />
                  Standar Kata Sandi
                </div>
                <p className="text-xs text-gray-500">
                  Panjang minimal sandi adalah{' '}
                  <span className="font-semibold text-gray-800">
                    {initialData.platform.passwordMinLength} karakter
                  </span>{' '}
                  dengan enkripsi bcrypt salt rounds 12.
                </p>
                <Badge variant="outline" className="text-[10px] text-sky-700 bg-sky-50 border-sky-200">
                  Bcrypt Hash
                </Badge>
              </div>
            </div>

            <div className="p-4 bg-emerald-50/60 border border-emerald-100 rounded-xl space-y-2">
              <div className="font-semibold text-xs text-emerald-800 flex items-center gap-1.5">
                <CheckCircle2 className="h-4 w-4 text-emerald-600" />
                Keamanan Sesi & Berkas (Fase 2 Verified)
              </div>
              <ul className="text-xs text-emerald-700 space-y-1 list-disc pl-5">
                <li>Otentikasi sesi wajib (`auth()`) pada endpoint penyajian berkas `/api/files/[filename]`.</li>
                <li>Header `X-Content-Type-Options: nosniff` dan CSP sandbox untuk mencegah serangan XSS via unggahan berkas.</li>
                <li>Whitelist ekstensi ketat memblokir berkas script berbahaya (.html, .svg, .exe, .sh, .php, dll).</li>
                <li>Penamaan berkas acak kriptografis menggunakan `crypto.randomUUID()`.</li>
              </ul>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Tab 3: Super Admin Account */}
      {activeTab === 'account' && (
        <Card className="shadow-sm">
          <CardHeader>
            <CardTitle className="text-base font-bold text-[#002446] flex items-center gap-2">
              <User className="h-4 w-4 text-sky-600" />
              Profil & Kredensial Akun Super Administrator
            </CardTitle>
            <CardDescription className="text-xs">
              Perbarui nama tampilan, email resmi, dan kata sandi akun Super Admin yang sedang aktif.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleProfileSubmit} className="space-y-4 max-w-lg">
              <div className="space-y-1.5">
                <Label htmlFor="saName">Nama Lengkap</Label>
                <Input
                  id="saName"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  required
                />
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="saEmail">Alamat Email</Label>
                <Input
                  id="saEmail"
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                />
              </div>

              <div className="pt-4 border-t space-y-3">
                <h3 className="text-xs font-bold text-gray-500 uppercase tracking-wider">
                  Ubah Kata Sandi (Opsional)
                </h3>

                <div className="space-y-1.5">
                  <Label htmlFor="saCurrentPassword">Kata Sandi Saat Ini</Label>
                  <Input
                    id="saCurrentPassword"
                    type="password"
                    placeholder="Masukkan kata sandi lama Anda"
                    value={currentPassword}
                    onChange={(e) => setCurrentPassword(e.target.value)}
                  />
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div className="space-y-1.5">
                    <Label htmlFor="saNewPassword">Kata Sandi Baru</Label>
                    <Input
                      id="saNewPassword"
                      type="password"
                      placeholder="Minimal 6 karakter"
                      value={newPassword}
                      onChange={(e) => setNewPassword(e.target.value)}
                    />
                  </div>

                  <div className="space-y-1.5">
                    <Label htmlFor="saConfirmPassword">Konfirmasi Kata Sandi Baru</Label>
                    <Input
                      id="saConfirmPassword"
                      type="password"
                      placeholder="Ulangi kata sandi baru"
                      value={confirmPassword}
                      onChange={(e) => setConfirmPassword(e.target.value)}
                    />
                  </div>
                </div>
              </div>

              <div className="pt-4">
                <Button
                  type="submit"
                  disabled={loading}
                  className="bg-[#002446] hover:bg-[#002446]/90 text-white flex items-center gap-2"
                >
                  {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
                  {loading ? 'Menyimpan...' : 'Simpan Perubahan'}
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
