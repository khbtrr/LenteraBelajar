'use client';

import React, { useState, useTransition } from 'react';
import { UserProfileData, updateUserProfile } from '@/lib/actions/profile';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import {
  Lock,
  Save,
  Loader2,
  CheckCircle2,
  AlertCircle,
  User,
  Mail,
  Building,
  Hash,
  Calendar,
} from 'lucide-react';

interface AccountTabProps {
  profile: UserProfileData;
  onProfileUpdated?: (newName: string) => void;
}

export function AccountTab({ profile, onProfileUpdated }: AccountTabProps) {
  const [name, setName] = useState(profile.name);
  const [isPending, startTransition] = useTransition();
  const [status, setStatus] = useState<{
    type: 'success' | 'error' | null;
    message: string;
  }>({ type: null, message: '' });

  const hasChanges = name.trim() !== profile.name;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim() || !hasChanges) return;

    setStatus({ type: null, message: '' });

    startTransition(async () => {
      try {
        await updateUserProfile({ name });
        setStatus({
          type: 'success',
          message: 'Nama profil berhasil diperbarui',
        });
        onProfileUpdated?.(name);
      } catch (err: any) {
        setStatus({
          type: 'error',
          message: err?.message || 'Gagal memperbarui profil',
        });
      }
    });
  };

  const getRoleLabel = (role: string) => {
    switch (role) {
      case 'STUDENT':
        return 'Siswa';
      case 'TEACHER':
        return 'Guru';
      case 'ADMIN':
        return 'Administrator';
      case 'SUPERVISOR':
        return 'Pengawas / Kepala Sekolah';
      case 'SUPER_ADMIN':
        return 'Super Admin';
      default:
        return role;
    }
  };

  return (
    <div className="bg-white dark:bg-gray-900 rounded-2xl border border-gray-200 dark:border-gray-800 p-6 shadow-xs">
      <div className="mb-6">
        <h3 className="text-base font-bold text-gray-900 dark:text-white">
          Informasi Akun
        </h3>
        <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
          Perbarui informasi nama tampilan Anda. Kolom identitas resmi dikelola oleh administrator sekolah.
        </p>
      </div>

      {status.type && (
        <div
          className={`mb-6 p-3 rounded-xl flex items-center gap-2.5 text-xs ${
            status.type === 'success'
              ? 'bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800'
              : 'bg-red-50 dark:bg-red-950/40 text-red-700 dark:text-red-300 border border-red-200 dark:border-red-800'
          }`}
        >
          {status.type === 'success' ? (
            <CheckCircle2 className="w-4 h-4 shrink-0 text-emerald-500" />
          ) : (
            <AlertCircle className="w-4 h-4 shrink-0 text-red-500" />
          )}
          <span>{status.message}</span>
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-5">
        {/* Editable Name Field */}
        <div className="space-y-2">
          <Label htmlFor="name" className="text-xs font-semibold text-gray-700 dark:text-gray-300 flex items-center gap-1.5">
            <User className="w-3.5 h-3.5 text-brand-500" />
            <span>Nama Lengkap</span>
            <span className="text-red-500">*</span>
          </Label>
          <Input
            id="name"
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            className="text-sm bg-gray-50/50 dark:bg-gray-800/60 border-gray-200 dark:border-gray-700 focus-visible:ring-brand-500"
            placeholder="Masukkan nama lengkap Anda"
            required
            minLength={2}
            maxLength={100}
          />
          <p className="text-[11px] text-gray-400">
            Nama ini akan ditampilkan pada sertifikat, forum diskusi, pesan, dan aktivitas belajar.
          </p>
        </div>

        {/* Read-only Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-2 border-t border-gray-100 dark:border-gray-800">
          {/* Email */}
          <div className="space-y-1.5">
            <div className="flex items-center justify-between">
              <Label className="text-xs font-semibold text-gray-600 dark:text-gray-400 flex items-center gap-1.5">
                <Mail className="w-3.5 h-3.5 text-gray-400" />
                <span>Alamat Email</span>
              </Label>
              <span className="text-[10px] text-gray-400 flex items-center gap-1">
                <Lock className="w-2.5 h-2.5" /> Terkunci
              </span>
            </div>
            <Input
              value={profile.email}
              readOnly
              disabled
              className="text-xs bg-gray-100/70 dark:bg-gray-800/40 text-gray-600 dark:text-gray-400 border-dashed cursor-not-allowed"
            />
          </div>

          {/* Role */}
          <div className="space-y-1.5">
            <div className="flex items-center justify-between">
              <Label className="text-xs font-semibold text-gray-600 dark:text-gray-400 flex items-center gap-1.5">
                <User className="w-3.5 h-3.5 text-gray-400" />
                <span>Peran Akun</span>
              </Label>
              <span className="text-[10px] text-gray-400 flex items-center gap-1">
                <Lock className="w-2.5 h-2.5" /> Terkunci
              </span>
            </div>
            <Input
              value={getRoleLabel(profile.role)}
              readOnly
              disabled
              className="text-xs bg-gray-100/70 dark:bg-gray-800/40 text-gray-600 dark:text-gray-400 border-dashed cursor-not-allowed"
            />
          </div>

          {/* NIS or NIP */}
          {(profile.nis || profile.nip || profile.role === 'STUDENT' || profile.role === 'TEACHER') && (
            <div className="space-y-1.5">
              <div className="flex items-center justify-between">
                <Label className="text-xs font-semibold text-gray-600 dark:text-gray-400 flex items-center gap-1.5">
                  <Hash className="w-3.5 h-3.5 text-gray-400" />
                  <span>{profile.role === 'STUDENT' ? 'NIS (Nomor Induk Siswa)' : 'NIP (Nomor Induk Pegawai)'}</span>
                </Label>
                <span className="text-[10px] text-gray-400 flex items-center gap-1">
                  <Lock className="w-2.5 h-2.5" /> Terkunci
                </span>
              </div>
              <Input
                value={profile.nis || profile.nip || '- Belum diatur -'}
                readOnly
                disabled
                className="text-xs bg-gray-100/70 dark:bg-gray-800/40 text-gray-600 dark:text-gray-400 border-dashed cursor-not-allowed"
              />
            </div>
          )}

          {/* School Name */}
          <div className="space-y-1.5">
            <div className="flex items-center justify-between">
              <Label className="text-xs font-semibold text-gray-600 dark:text-gray-400 flex items-center gap-1.5">
                <Building className="w-3.5 h-3.5 text-gray-400" />
                <span>Instansi Sekolah</span>
              </Label>
              <span className="text-[10px] text-gray-400 flex items-center gap-1">
                <Lock className="w-2.5 h-2.5" /> Terkunci
              </span>
            </div>
            <Input
              value={profile.school?.name || '- Belum terdaftar -'}
              readOnly
              disabled
              className="text-xs bg-gray-100/70 dark:bg-gray-800/40 text-gray-600 dark:text-gray-400 border-dashed cursor-not-allowed"
            />
          </div>

          {/* Created At */}
          <div className="space-y-1.5">
            <Label className="text-xs font-semibold text-gray-600 dark:text-gray-400 flex items-center gap-1.5">
              <Calendar className="w-3.5 h-3.5 text-gray-400" />
              <span>Bergabung Sejak</span>
            </Label>
            <Input
              value={new Date(profile.createdAt).toLocaleDateString('id-ID', {
                day: 'numeric',
                month: 'long',
                year: 'numeric',
              })}
              readOnly
              disabled
              className="text-xs bg-gray-100/70 dark:bg-gray-800/40 text-gray-600 dark:text-gray-400 border-dashed cursor-not-allowed"
            />
          </div>
        </div>

        {/* Submit Button */}
        <div className="pt-3 flex justify-end">
          <Button
            type="submit"
            disabled={!hasChanges || isPending}
            className="text-xs font-semibold bg-brand-500 hover:bg-brand-600 text-white rounded-xl h-10 px-5 gap-2 shadow-xs"
          >
            {isPending ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <Save className="w-4 h-4" />
            )}
            <span>Simpan Perubahan</span>
          </Button>
        </div>
      </form>
    </div>
  );
}
