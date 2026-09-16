'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Link } from '@/i18n/navigation';
import { useDialog } from '@/context/DialogContext';
import {
  updateSchoolProfile,
  updateAcademicSettings,
  updateCbtSettings,
  updateAdminProfile,
  updateAdminPassword,
} from '@/lib/actions/school-settings';
import {
  Building2,
  GraduationCap,
  ShieldCheck,
  UserCog,
  Upload,
  Trash2,
  Save,
  CheckCircle2,
  Calendar,
  ExternalLink,
  Lock,
  KeyRound,
  Eye,
  EyeOff,
  Globe,
  Phone,
  Mail,
  Sliders,
  Check,
  HelpCircle,
} from 'lucide-react';
import Image from 'next/image';

interface SchoolData {
  id: string;
  name: string;
  code: string;
  address: string | null;
  logo: string | null;
  phone: string | null;
  email: string | null;
  website: string | null;
  defaultPassingGrade: number | null;
  cbtLockdownEnabled: boolean;
  cbtMaxTabSwitches: number;
  cbtRequireToken: boolean;
  cbtShuffleQuestions: boolean;
  cbtShuffleOptions: boolean;
}

interface AdminUserData {
  id: string;
  name: string;
  email: string;
  role: string;
  mustChangePassword: boolean;
}

interface ActiveAcademicYear {
  id: string;
  name: string;
  startDate: Date;
  endDate: Date;
  status: string;
}

interface AdminSettingsClientProps {
  initialSchool: SchoolData;
  activeAcademicYear: ActiveAcademicYear | null;
  adminUser: AdminUserData | null;
}

export function AdminSettingsClient({
  initialSchool,
  activeAcademicYear,
  adminUser,
}: AdminSettingsClientProps) {
  const { showAlert } = useDialog();
  const [activeTab, setActiveTab] = useState<'profile' | 'academic' | 'cbt' | 'admin'>('profile');

  // Tab 1: Profile State
  const [schoolName, setSchoolName] = useState(initialSchool.name || '');
  const [schoolCode, setSchoolCode] = useState(initialSchool.code || '');
  const [address, setAddress] = useState(initialSchool.address || '');
  const [phone, setPhone] = useState(initialSchool.phone || '');
  const [email, setEmail] = useState(initialSchool.email || '');
  const [website, setWebsite] = useState(initialSchool.website || '');
  const [logo, setLogo] = useState<string | null>(initialSchool.logo);
  const [isUploadingLogo, setIsUploadingLogo] = useState(false);
  const [savingProfile, setSavingProfile] = useState(false);

  // Tab 2: Academic State
  const [passingGrade, setPassingGrade] = useState<number>(initialSchool.defaultPassingGrade ?? 75);
  const [savingAcademic, setSavingAcademic] = useState(false);

  // Tab 3: CBT Defaults State
  const [cbtLockdown, setCbtLockdown] = useState<boolean>(initialSchool.cbtLockdownEnabled ?? true);
  const [maxTabSwitches, setMaxTabSwitches] = useState<number>(initialSchool.cbtMaxTabSwitches ?? 3);
  const [requireToken, setRequireToken] = useState<boolean>(initialSchool.cbtRequireToken ?? false);
  const [shuffleQuestions, setShuffleQuestions] = useState<boolean>(initialSchool.cbtShuffleQuestions ?? false);
  const [shuffleOptions, setShuffleOptions] = useState<boolean>(initialSchool.cbtShuffleOptions ?? false);
  const [savingCbt, setSavingCbt] = useState(false);

  // Tab 4: Admin Account State
  const [adminName, setAdminName] = useState(adminUser?.name || '');
  const [adminEmail, setAdminEmail] = useState(adminUser?.email || '');
  const [savingAdminProfile, setSavingAdminProfile] = useState(false);

  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showCurrentPassword, setShowCurrentPassword] = useState(false);
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [savingPassword, setSavingPassword] = useState(false);

  // Logo upload handler
  const handleLogoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith('image/')) {
      await showAlert('File harus berupa gambar (.png, .jpg, .jpeg, .webp, .svg)', { type: 'error' });
      return;
    }

    if (file.size > 5 * 1024 * 1024) {
      await showAlert('Ukuran gambar maksimal 5 MB', { type: 'error' });
      return;
    }

    setIsUploadingLogo(true);
    try {
      const formData = new FormData();
      formData.append('file', file);

      const res = await fetch('/api/upload', {
        method: 'POST',
        body: formData,
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Gagal mengunggah logo');
      }

      setLogo(data.url);
      await showAlert('Logo berhasil diunggah! Jangan lupa klik "Simpan Profil Sekolah".', { type: 'success' });
    } catch (err: any) {
      console.error(err);
      await showAlert(err?.message || 'Terjadi kesalahan saat mengunggah logo', { type: 'error' });
    } finally {
      setIsUploadingLogo(false);
    }
  };

  // Profile submit
  const handleProfileSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSavingProfile(true);
    try {
      await updateSchoolProfile({
        name: schoolName,
        code: schoolCode,
        address,
        phone,
        email,
        website,
        logo: logo || undefined,
      });
      await showAlert('Profil dan identitas sekolah berhasil diperbarui!', { type: 'success' });
    } catch (err: any) {
      console.error(err);
      await showAlert(err?.message || 'Gagal menyimpan profil sekolah', { type: 'error' });
    } finally {
      setSavingProfile(false);
    }
  };

  // Academic submit
  const handleAcademicSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSavingAcademic(true);
    try {
      await updateAcademicSettings({
        defaultPassingGrade: Number(passingGrade),
      });
      await showAlert('Standar KKM akademik sekolah berhasil diperbarui!', { type: 'success' });
    } catch (err: any) {
      console.error(err);
      await showAlert(err?.message || 'Gagal menyimpan standar akademik', { type: 'error' });
    } finally {
      setSavingAcademic(false);
    }
  };

  // CBT submit
  const handleCbtSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSavingCbt(true);
    try {
      await updateCbtSettings({
        cbtLockdownEnabled: cbtLockdown,
        cbtMaxTabSwitches: Number(maxTabSwitches),
        cbtRequireToken: requireToken,
        cbtShuffleQuestions: shuffleQuestions,
        cbtShuffleOptions: shuffleOptions,
      });
      await showAlert('Pengaturan default CBT berhasil disimpan!', { type: 'success' });
    } catch (err: any) {
      console.error(err);
      await showAlert(err?.message || 'Gagal menyimpan pengaturan CBT', { type: 'error' });
    } finally {
      setSavingCbt(false);
    }
  };

  // Admin profile submit
  const handleAdminProfileSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSavingAdminProfile(true);
    try {
      await updateAdminProfile({
        name: adminName,
        email: adminEmail,
      });
      await showAlert('Data akun administrator berhasil diperbarui!', { type: 'success' });
    } catch (err: any) {
      console.error(err);
      await showAlert(err?.message || 'Gagal menyimpan profil administrator', { type: 'error' });
    } finally {
      setSavingAdminProfile(false);
    }
  };

  // Password change submit
  const handlePasswordSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (newPassword !== confirmPassword) {
      await showAlert('Konfirmasi kata sandi baru tidak cocok', { type: 'error' });
      return;
    }
    setSavingPassword(true);
    try {
      await updateAdminPassword({
        currentPassword,
        newPassword,
        confirmPassword,
      });
      setCurrentPassword('');
      setNewPassword('');
      setConfirmPassword('');
      await showAlert('Kata sandi administrator berhasil diubah!', { type: 'success' });
    } catch (err: any) {
      console.error(err);
      await showAlert(err?.message || 'Gagal mengubah kata sandi', { type: 'error' });
    } finally {
      setSavingPassword(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Navigation Tabs */}
      <div className="flex overflow-x-auto no-scrollbar border-b border-gray-200 dark:border-gray-800 gap-2 pb-1">
        <button
          type="button"
          onClick={() => setActiveTab('profile')}
          className={`flex items-center gap-2 px-4 py-2.5 text-sm font-medium rounded-lg transition-all whitespace-nowrap ${
            activeTab === 'profile'
              ? 'bg-[#002446] text-white shadow-sm'
              : 'text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800'
          }`}
        >
          <Building2 className="w-4 h-4" />
          Profil & Branding Sekolah
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('academic')}
          className={`flex items-center gap-2 px-4 py-2.5 text-sm font-medium rounded-lg transition-all whitespace-nowrap ${
            activeTab === 'academic'
              ? 'bg-[#002446] text-white shadow-sm'
              : 'text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800'
          }`}
        >
          <GraduationCap className="w-4 h-4" />
          Standar Akademik
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('cbt')}
          className={`flex items-center gap-2 px-4 py-2.5 text-sm font-medium rounded-lg transition-all whitespace-nowrap ${
            activeTab === 'cbt'
              ? 'bg-[#002446] text-white shadow-sm'
              : 'text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800'
          }`}
        >
          <ShieldCheck className="w-4 h-4" />
          Default Keamanan CBT
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('admin')}
          className={`flex items-center gap-2 px-4 py-2.5 text-sm font-medium rounded-lg transition-all whitespace-nowrap ${
            activeTab === 'admin'
              ? 'bg-[#002446] text-white shadow-sm'
              : 'text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800'
          }`}
        >
          <UserCog className="w-4 h-4" />
          Akun Administrator
        </button>
      </div>

      {/* Tab 1: Profil & Branding Sekolah */}
      {activeTab === 'profile' && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2">
            <Card>
              <CardHeader>
                <CardTitle className="text-lg font-bold text-[#002446] dark:text-white flex items-center gap-2">
                  <Building2 className="w-5 h-5 text-[#FF8928]" />
                  Informasi & Kontak Sekolah
                </CardTitle>
                <CardDescription>
                  Data ini digunakan sebagai identitas resmi sekolah dan tercantum pada laporan hasil belajar.
                </CardDescription>
              </CardHeader>
              <CardContent>
                <form onSubmit={handleProfileSubmit} className="space-y-4">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="space-y-1.5">
                      <Label htmlFor="schoolName" className="font-medium">
                        Nama Sekolah <span className="text-red-500">*</span>
                      </Label>
                      <Input
                        id="schoolName"
                        value={schoolName}
                        onChange={(e) => setSchoolName(e.target.value)}
                        placeholder="Contoh: SMA Negeri 1 Maju Bersama"
                        required
                      />
                    </div>

                    <div className="space-y-1.5">
                      <Label htmlFor="schoolCode" className="font-medium">
                        NPSN / Kode Sekolah <span className="text-red-500">*</span>
                      </Label>
                      <Input
                        id="schoolCode"
                        value={schoolCode}
                        onChange={(e) => setSchoolCode(e.target.value)}
                        placeholder="Contoh: 10203040"
                        required
                      />
                    </div>
                  </div>

                  <div className="space-y-1.5">
                    <Label htmlFor="address" className="font-medium">
                      Alamat Lengkap Sekolah
                    </Label>
                    <Textarea
                      id="address"
                      value={address}
                      onChange={(e) => setAddress(e.target.value)}
                      placeholder="Jl. Pendidikan No. 123, Kelurahan, Kecamatan, Kota/Kabupaten, Provinsi"
                      rows={2}
                    />
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <div className="space-y-1.5">
                      <Label htmlFor="phone" className="font-medium flex items-center gap-1.5">
                        <Phone className="w-3.5 h-3.5 text-gray-500" />
                        Nomor Telepon
                      </Label>
                      <Input
                        id="phone"
                        value={phone}
                        onChange={(e) => setPhone(e.target.value)}
                        placeholder="(021) 1234567"
                      />
                    </div>

                    <div className="space-y-1.5">
                      <Label htmlFor="email" className="font-medium flex items-center gap-1.5">
                        <Mail className="w-3.5 h-3.5 text-gray-500" />
                        Email Resmi
                      </Label>
                      <Input
                        id="email"
                        type="email"
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                        placeholder="info@sman1maju.sch.id"
                      />
                    </div>

                    <div className="space-y-1.5">
                      <Label htmlFor="website" className="font-medium flex items-center gap-1.5">
                        <Globe className="w-3.5 h-3.5 text-gray-500" />
                        Website Sekolah
                      </Label>
                      <Input
                        id="website"
                        value={website}
                        onChange={(e) => setWebsite(e.target.value)}
                        placeholder="https://sman1maju.sch.id"
                      />
                    </div>
                  </div>

                  {/* Logo Upload Section */}
                  <div className="pt-2 border-t border-gray-100 dark:border-gray-800">
                    <Label className="font-medium block mb-2">Logo Resmi Sekolah</Label>
                    <div className="flex flex-col sm:flex-row items-start sm:items-center gap-4">
                      {logo ? (
                        <div className="relative w-20 h-20 rounded-xl border border-gray-200 dark:border-gray-700 overflow-hidden bg-white p-2 shadow-sm flex items-center justify-center flex-shrink-0">
                          {/* eslint-disable-next-line @next/next/no-img-element */}
                          <img
                            src={logo}
                            alt="Logo Sekolah"
                            className="max-h-full max-w-full object-contain"
                          />
                        </div>
                      ) : (
                        <div className="w-20 h-20 rounded-xl border-2 border-dashed border-gray-300 dark:border-gray-700 bg-gray-50 dark:bg-gray-800/50 flex flex-col items-center justify-center text-gray-400 flex-shrink-0">
                          <Building2 className="w-8 h-8 text-gray-300" />
                          <span className="text-[10px] mt-1">Belum Ada</span>
                        </div>
                      )}

                      <div className="space-y-2 flex-1">
                        <div className="flex items-center gap-2">
                          <label
                            htmlFor="logo-upload"
                            className="inline-flex items-center gap-2 px-3.5 py-2 text-xs font-semibold rounded-lg bg-gray-100 dark:bg-gray-800 hover:bg-gray-200 dark:hover:bg-gray-700 text-gray-700 dark:text-gray-200 cursor-pointer transition-colors"
                          >
                            <Upload className="w-3.5 h-3.5" />
                            {isUploadingLogo ? 'Mengunggah...' : 'Pilih File Logo'}
                          </label>
                          <input
                            id="logo-upload"
                            type="file"
                            accept="image/*"
                            onChange={handleLogoUpload}
                            disabled={isUploadingLogo}
                            className="hidden"
                          />

                          {logo && (
                            <button
                              type="button"
                              onClick={() => setLogo(null)}
                              className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-medium rounded-lg text-red-600 hover:bg-red-50 dark:hover:bg-red-950/30 transition-colors"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                              Hapus Logo
                            </button>
                          )}
                        </div>
                        <p className="text-xs text-gray-500">
                          Format disarankan: PNG, SVG, atau JPG transparan (resolusi minimal 200x200 px, maks 5MB).
                        </p>
                      </div>
                    </div>
                  </div>

                  <div className="pt-4 flex justify-end">
                    <Button
                      type="submit"
                      disabled={savingProfile || isUploadingLogo}
                      className="bg-[#002446] hover:bg-[#001b33] text-white flex items-center gap-2 px-5"
                    >
                      <Save className="w-4 h-4" />
                      {savingProfile ? 'Menyimpan...' : 'Simpan Profil Sekolah'}
                    </Button>
                  </div>
                </form>
              </CardContent>
            </Card>
          </div>

          {/* Live Preview Column */}
          <div className="space-y-6">
            <Card className="border-dashed border-2 border-brand-200 dark:border-brand-900/50 bg-brand-50/20 dark:bg-gray-900/40">
              <CardHeader className="pb-3">
                <CardTitle className="text-sm font-semibold text-gray-700 dark:text-gray-300 flex items-center gap-2">
                  <Sliders className="w-4 h-4 text-[#FF8928]" />
                  Live Preview Branding Aplikasi
                </CardTitle>
                <CardDescription className="text-xs">
                  Simulasi tampilan logo & nama sekolah di navigasi sistem.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                {/* Simulated Sidebar Header */}
                <div className="p-3 bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-800 shadow-sm space-y-2">
                  <div className="text-[11px] font-semibold uppercase tracking-wider text-gray-400">
                    Preview Header Sidebar
                  </div>
                  <div className="flex items-center gap-3 p-2 bg-gray-50 dark:bg-gray-800/60 rounded-lg">
                    <div className="w-10 h-10 rounded-xl bg-brand-500 text-white flex items-center justify-center shadow-sm overflow-hidden flex-shrink-0 bg-white">
                      {logo ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img
                          src={logo}
                          alt="Logo Preview"
                          className="w-8 h-8 object-contain"
                        />
                      ) : (
                        <div className="w-full h-full bg-[#002446] flex items-center justify-center">
                          <GraduationCap className="w-5 h-5 text-white" />
                        </div>
                      )}
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="font-bold text-xs text-gray-900 dark:text-white truncate">
                        {schoolName || 'LenteraBelajar'}
                      </div>
                      <div className="text-[10px] text-gray-500 dark:text-gray-400 font-medium truncate">
                        {schoolCode ? `NPSN: ${schoolCode}` : 'Admin Sekolah'}
                      </div>
                    </div>
                  </div>
                </div>

                {/* Simulated School Identity Card */}
                <div className="p-4 bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-800 shadow-sm space-y-3">
                  <div className="text-[11px] font-semibold uppercase tracking-wider text-gray-400">
                    Kartu Identitas Sekolah
                  </div>
                  <div className="flex items-start gap-3">
                    <div className="w-12 h-12 rounded-lg bg-gray-50 dark:bg-gray-800 border border-gray-100 dark:border-gray-700 flex items-center justify-center p-1 flex-shrink-0">
                      {logo ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img
                          src={logo}
                          alt="Logo"
                          className="max-h-full max-w-full object-contain"
                        />
                      ) : (
                        <Building2 className="w-6 h-6 text-gray-400" />
                      )}
                    </div>
                    <div className="min-w-0">
                      <h4 className="text-sm font-bold text-[#002446] dark:text-white line-clamp-1">
                        {schoolName || 'Nama Sekolah Belum Diatur'}
                      </h4>
                      <p className="text-xs text-gray-500 line-clamp-2 mt-0.5">
                        {address || 'Alamat sekolah belum diatur'}
                      </p>
                    </div>
                  </div>
                  <div className="pt-2 border-t border-gray-100 dark:border-gray-800 text-[11px] text-gray-500 space-y-1">
                    <div>Telepon: {phone || '-'}</div>
                    <div>Email: {email || '-'}</div>
                    <div>Website: {website || '-'}</div>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      )}

      {/* Tab 2: Standar Akademik */}
      {activeTab === 'academic' && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2">
            <Card>
              <CardHeader>
                <CardTitle className="text-lg font-bold text-[#002446] dark:text-white flex items-center gap-2">
                  <GraduationCap className="w-5 h-5 text-[#FF8928]" />
                  Standar Ketuntasan & KKM Sekolah
                </CardTitle>
                <CardDescription>
                  Tetapkan standar Kriteria Ketuntasan Minimal (KKM) sekolah yang akan digunakan sebagai acuan default pada buku nilai dan kuis baru.
                </CardDescription>
              </CardHeader>
              <CardContent>
                <form onSubmit={handleAcademicSubmit} className="space-y-6">
                  <div className="p-4 bg-blue-50/60 dark:bg-blue-950/20 border border-blue-200 dark:border-blue-900/50 rounded-xl space-y-2">
                    <h4 className="text-sm font-semibold text-blue-900 dark:text-blue-200 flex items-center gap-1.5">
                      <HelpCircle className="w-4 h-4 text-blue-600 dark:text-blue-400" />
                      Informasi Ketuntasan Belajar
                    </h4>
                    <p className="text-xs text-blue-800 dark:text-blue-300 leading-relaxed">
                      Nilai KKM ini menjadi tolok ukur standar sekolah untuk menentukan apakah siswa telah lulus kompetensi pada evaluasi atau kuis. Guru dapat tetap menyesuaikan KKM spesifik pada masing-masing mata pelajaran atau kuis jika diperlukan.
                    </p>
                  </div>

                  <div className="max-w-xs space-y-2">
                    <Label htmlFor="passingGrade" className="font-medium">
                      Nilai KKM Standar (0 - 100) <span className="text-red-500">*</span>
                    </Label>
                    <div className="relative">
                      <Input
                        id="passingGrade"
                        type="number"
                        min="0"
                        max="100"
                        step="1"
                        value={passingGrade}
                        onChange={(e) => setPassingGrade(Number(e.target.value))}
                        className="pr-12 text-lg font-bold text-[#002446]"
                        required
                      />
                      <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs font-semibold text-gray-400">
                        / 100
                      </span>
                    </div>
                    <p className="text-xs text-gray-500">
                      Standar KKM rata-rata sekolah di Indonesia umumnya adalah 75.
                    </p>
                  </div>

                  <div className="pt-4 flex justify-end">
                    <Button
                      type="submit"
                      disabled={savingAcademic}
                      className="bg-[#002446] hover:bg-[#001b33] text-white flex items-center gap-2 px-5"
                    >
                      <Save className="w-4 h-4" />
                      {savingAcademic ? 'Menyimpan...' : 'Simpan Standar KKM'}
                    </Button>
                  </div>
                </form>
              </CardContent>
            </Card>
          </div>

          {/* Academic Year Information Card */}
          <div>
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-base font-bold text-[#002446] dark:text-white flex items-center gap-2">
                  <Calendar className="w-4 h-4 text-[#FF8928]" />
                  Tahun Ajaran Aktif
                </CardTitle>
                <CardDescription className="text-xs">
                  Status periode pembelajaran sekolah saat ini.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                {activeAcademicYear ? (
                  <div className="p-4 bg-emerald-50 dark:bg-emerald-950/20 border border-emerald-200 dark:border-emerald-900/50 rounded-xl space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-semibold text-emerald-800 dark:text-emerald-300">
                        Status: Sedang Berjalan
                      </span>
                      <Badge className="bg-emerald-600 text-white hover:bg-emerald-700 text-[10px]">
                        AKTIF
                      </Badge>
                    </div>
                    <div className="text-base font-bold text-emerald-950 dark:text-emerald-100">
                      {activeAcademicYear.name}
                    </div>
                    <div className="text-xs text-emerald-700 dark:text-emerald-400">
                      Periode: {new Date(activeAcademicYear.startDate).toLocaleDateString('id-ID', { dateStyle: 'medium' })} s/d {new Date(activeAcademicYear.endDate).toLocaleDateString('id-ID', { dateStyle: 'medium' })}
                    </div>
                  </div>
                ) : (
                  <div className="p-4 bg-amber-50 dark:bg-amber-950/20 border border-amber-200 dark:border-amber-900/50 rounded-xl text-xs text-amber-800 dark:text-amber-300">
                    Belum ada tahun ajaran aktif. Silakan buat atau aktifkan tahun ajaran pada menu Manajemen Tahun Ajaran.
                  </div>
                )}

                <Link
                  href="/admin/academic-years"
                  className="inline-flex items-center justify-center gap-2 w-full px-4 py-2.5 text-xs font-semibold rounded-lg bg-gray-100 dark:bg-gray-800 hover:bg-gray-200 dark:hover:bg-gray-700 text-gray-700 dark:text-gray-200 transition-colors"
                >
                  <ExternalLink className="w-3.5 h-3.5" />
                  Buka Manajemen Tahun Ajaran
                </Link>
              </CardContent>
            </Card>
          </div>
        </div>
      )}

      {/* Tab 3: Default Keamanan CBT */}
      {activeTab === 'cbt' && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2">
            <Card>
              <CardHeader>
                <CardTitle className="text-lg font-bold text-[#002446] dark:text-white flex items-center gap-2">
                  <ShieldCheck className="w-5 h-5 text-[#FF8928]" />
                  Default Parameter Ujian Online (CBT)
                </CardTitle>
                <CardDescription>
                  Nilai-nilai di bawah ini akan digunakan sebagai nilai bawaan (auto-fill) ketika Guru membuat Kuis / Ujian CBT baru di kelasnya.
                </CardDescription>
              </CardHeader>
              <CardContent>
                <form onSubmit={handleCbtSubmit} className="space-y-6">
                  {/* Lockdown Toggle */}
                  <div className="flex items-start justify-between p-4 rounded-xl border border-gray-200 dark:border-gray-800 hover:bg-gray-50/50 dark:hover:bg-gray-800/30 transition-colors">
                    <div className="space-y-1 pr-4">
                      <div className="font-semibold text-sm text-[#002446] dark:text-white flex items-center gap-2">
                        <span>Aktifkan CBT Lockdown Environment Secara Default</span>
                        <Badge variant="outline" className="text-[10px] text-brand-600 border-brand-200">
                          Keamanan
                        </Badge>
                      </div>
                      <p className="text-xs text-gray-500 leading-relaxed">
                        Memaksa layar ujian fullscreen, menonaktifkan klik kanan, blokir shortcut salin-tempel (Ctrl+C/Ctrl+V), dan memonitor perpindahan jendela/tab aplikasi.
                      </p>
                    </div>
                    <input
                      type="checkbox"
                      checked={cbtLockdown}
                      onChange={(e) => setCbtLockdown(e.target.checked)}
                      className="w-5 h-5 mt-1 accent-[#002446] rounded cursor-pointer"
                    />
                  </div>

                  {/* Max Tab Switches */}
                  <div className="p-4 rounded-xl border border-gray-200 dark:border-gray-800 space-y-3">
                    <div className="flex items-center justify-between">
                      <div className="space-y-0.5">
                        <Label htmlFor="tabSwitches" className="font-semibold text-sm text-[#002446] dark:text-white">
                          Batas Toleransi Pindah Tab / Layar
                        </Label>
                        <p className="text-xs text-gray-500">
                          Jumlah maksimal siswa diizinkan meninggalkan tab ujian sebelum sistem melakukan auto-submit paksa.
                        </p>
                      </div>
                      <div className="w-24">
                        <Input
                          id="tabSwitches"
                          type="number"
                          min="1"
                          max="20"
                          value={maxTabSwitches}
                          onChange={(e) => setMaxTabSwitches(Number(e.target.value))}
                          className="text-center font-bold text-[#002446]"
                        />
                      </div>
                    </div>
                  </div>

                  {/* Token Requirement */}
                  <div className="flex items-start justify-between p-4 rounded-xl border border-gray-200 dark:border-gray-800 hover:bg-gray-50/50 dark:hover:bg-gray-800/30 transition-colors">
                    <div className="space-y-1 pr-4">
                      <div className="font-semibold text-sm text-[#002446] dark:text-white">
                        Wajib Token Masuk Ujian Default
                      </div>
                      <p className="text-xs text-gray-500 leading-relaxed">
                        Siswa harus memasukkan 6 digit token rahasia sebelum dapat memulai pengerjaan soal ujian.
                      </p>
                    </div>
                    <input
                      type="checkbox"
                      checked={requireToken}
                      onChange={(e) => setRequireToken(e.target.checked)}
                      className="w-5 h-5 mt-1 accent-[#002446] rounded cursor-pointer"
                    />
                  </div>

                  {/* Shuffle Questions & Options */}
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="flex items-start justify-between p-4 rounded-xl border border-gray-200 dark:border-gray-800 hover:bg-gray-50/50 dark:hover:bg-gray-800/30 transition-colors">
                      <div className="space-y-1 pr-2">
                        <div className="font-semibold text-xs text-[#002446] dark:text-white">
                          Acak Urutan Soal
                        </div>
                        <p className="text-[11px] text-gray-500">
                          Tiap siswa menerima urutan nomor soal yang berbeda.
                        </p>
                      </div>
                      <input
                        type="checkbox"
                        checked={shuffleQuestions}
                        onChange={(e) => setShuffleQuestions(e.target.checked)}
                        className="w-4 h-4 mt-0.5 accent-[#002446] rounded cursor-pointer"
                      />
                    </div>

                    <div className="flex items-start justify-between p-4 rounded-xl border border-gray-200 dark:border-gray-800 hover:bg-gray-50/50 dark:hover:bg-gray-800/30 transition-colors">
                      <div className="space-y-1 pr-2">
                        <div className="font-semibold text-xs text-[#002446] dark:text-white">
                          Acak Opsi Pilihan Ganda
                        </div>
                        <p className="text-[11px] text-gray-500">
                          Pilihan A, B, C, D diacak posisinya di setiap soal.
                        </p>
                      </div>
                      <input
                        type="checkbox"
                        checked={shuffleOptions}
                        onChange={(e) => setShuffleOptions(e.target.checked)}
                        className="w-4 h-4 mt-0.5 accent-[#002446] rounded cursor-pointer"
                      />
                    </div>
                  </div>

                  <div className="pt-4 flex justify-end">
                    <Button
                      type="submit"
                      disabled={savingCbt}
                      className="bg-[#002446] hover:bg-[#001b33] text-white flex items-center gap-2 px-5"
                    >
                      <Save className="w-4 h-4" />
                      {savingCbt ? 'Menyimpan...' : 'Simpan Default CBT'}
                    </Button>
                  </div>
                </form>
              </CardContent>
            </Card>
          </div>

          <div>
            <Card className="bg-gray-50/60 dark:bg-gray-900/40">
              <CardHeader className="pb-3">
                <CardTitle className="text-sm font-semibold text-gray-800 dark:text-gray-200 flex items-center gap-2">
                  <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                  Fleksibilitas Guru
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3 text-xs text-gray-600 dark:text-gray-400 leading-relaxed">
                <p>
                  Pengaturan ini berfungsi sebagai <strong>rekomendasi & nilai standar</strong> sekolah agar tercipta keseragaman integritas pelaksanaan ujian.
                </p>
                <p>
                  Guru tetap memiliki wewenang untuk mematikan lockdown atau menonaktifkan token jika ujian bersifat kuis latihan harian ringan di kelas.
                </p>
              </CardContent>
            </Card>
          </div>
        </div>
      )}

      {/* Tab 4: Akun Administrator */}
      {activeTab === 'admin' && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Sub-form 1: Profil Admin */}
          <Card>
            <CardHeader>
              <CardTitle className="text-lg font-bold text-[#002446] dark:text-white flex items-center gap-2">
                <UserCog className="w-5 h-5 text-[#FF8928]" />
                Profil Pengguna Administrator
              </CardTitle>
              <CardDescription>
                Perbarui nama tampilan dan email resmi yang terhubung dengan akun admin ini.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <form onSubmit={handleAdminProfileSubmit} className="space-y-4">
                <div className="space-y-1.5">
                  <Label htmlFor="adminName" className="font-medium">
                    Nama Lengkap <span className="text-red-500">*</span>
                  </Label>
                  <Input
                    id="adminName"
                    value={adminName}
                    onChange={(e) => setAdminName(e.target.value)}
                    required
                  />
                </div>

                <div className="space-y-1.5">
                  <Label htmlFor="adminEmail" className="font-medium">
                    Alamat Email <span className="text-red-500">*</span>
                  </Label>
                  <Input
                    id="adminEmail"
                    type="email"
                    value={adminEmail}
                    onChange={(e) => setAdminEmail(e.target.value)}
                    required
                  />
                </div>

                <div className="pt-3 flex justify-end">
                  <Button
                    type="submit"
                    disabled={savingAdminProfile}
                    className="bg-[#002446] hover:bg-[#001b33] text-white flex items-center gap-2"
                  >
                    <Save className="w-4 h-4" />
                    {savingAdminProfile ? 'Menyimpan...' : 'Perbarui Profil Admin'}
                  </Button>
                </div>
              </form>
            </CardContent>
          </Card>

          {/* Sub-form 2: Ganti Password */}
          <Card>
            <CardHeader>
              <CardTitle className="text-lg font-bold text-[#002446] dark:text-white flex items-center gap-2">
                <KeyRound className="w-5 h-5 text-[#FF8928]" />
                Ganti Kata Sandi
              </CardTitle>
              <CardDescription>
                Gunakan kata sandi yang kuat dengan minimal 6 karakter kombinasi huruf dan angka.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <form onSubmit={handlePasswordSubmit} className="space-y-4">
                <div className="space-y-1.5">
                  <Label htmlFor="currentPassword" className="font-medium">
                    Kata Sandi Saat Ini <span className="text-red-500">*</span>
                  </Label>
                  <div className="relative">
                    <Input
                      id="currentPassword"
                      type={showCurrentPassword ? 'text' : 'password'}
                      value={currentPassword}
                      onChange={(e) => setCurrentPassword(e.target.value)}
                      placeholder="Masukkan kata sandi lama Anda"
                      required
                    />
                    <button
                      type="button"
                      onClick={() => setShowCurrentPassword(!showCurrentPassword)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                    >
                      {showCurrentPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                  </div>
                </div>

                <div className="space-y-1.5">
                  <Label htmlFor="newPassword" className="font-medium">
                    Kata Sandi Baru <span className="text-red-500">*</span>
                  </Label>
                  <div className="relative">
                    <Input
                      id="newPassword"
                      type={showNewPassword ? 'text' : 'password'}
                      value={newPassword}
                      onChange={(e) => setNewPassword(e.target.value)}
                      placeholder="Minimal 6 karakter"
                      required
                    />
                    <button
                      type="button"
                      onClick={() => setShowNewPassword(!showNewPassword)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                    >
                      {showNewPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                  </div>
                </div>

                <div className="space-y-1.5">
                  <Label htmlFor="confirmPassword" className="font-medium">
                    Konfirmasi Kata Sandi Baru <span className="text-red-500">*</span>
                  </Label>
                  <Input
                    id="confirmPassword"
                    type="password"
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    placeholder="Ulangi kata sandi baru"
                    required
                  />
                </div>

                <div className="pt-3 flex justify-end">
                  <Button
                    type="submit"
                    disabled={savingPassword}
                    className="bg-[#002446] hover:bg-[#001b33] text-white flex items-center gap-2"
                  >
                    <Lock className="w-4 h-4" />
                    {savingPassword ? 'Mengubah...' : 'Ubah Kata Sandi'}
                  </Button>
                </div>
              </form>
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  );
}
