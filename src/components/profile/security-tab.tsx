'use client';

import React, { useState, useTransition } from 'react';
import { changeUserPassword } from '@/lib/actions/profile';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import {
  KeyRound,
  Eye,
  EyeOff,
  ShieldCheck,
  CheckCircle2,
  AlertCircle,
  Loader2,
  Lock,
} from 'lucide-react';

export function SecurityTab() {
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');

  const [showCurrent, setShowCurrent] = useState(false);
  const [showNew, setShowNew] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);

  const [isPending, startTransition] = useTransition();
  const [status, setStatus] = useState<{
    type: 'success' | 'error' | null;
    message: string;
  }>({ type: null, message: '' });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setStatus({ type: null, message: '' });

    if (!currentPassword || !newPassword || !confirmPassword) {
      setStatus({
        type: 'error',
        message: 'Seluruh kolom kata sandi wajib diisi.',
      });
      return;
    }

    if (newPassword.length < 8) {
      setStatus({
        type: 'error',
        message: 'Kata sandi baru harus memiliki panjang minimal 8 karakter.',
      });
      return;
    }

    if (newPassword !== confirmPassword) {
      setStatus({
        type: 'error',
        message: 'Konfirmasi kata sandi baru tidak cocok.',
      });
      return;
    }

    startTransition(async () => {
      try {
        await changeUserPassword({ currentPassword, newPassword });
        setStatus({
          type: 'success',
          message: 'Kata sandi berhasil diperbarui. Silakan gunakan kata sandi baru untuk login berikutnya.',
        });
        setCurrentPassword('');
        setNewPassword('');
        setConfirmPassword('');
      } catch (err: any) {
        setStatus({
          type: 'error',
          message: err?.message || 'Gagal mengubah kata sandi',
        });
      }
    });
  };

  return (
    <div className="bg-white dark:bg-gray-900 rounded-2xl border border-gray-200 dark:border-gray-800 p-6 shadow-xs">
      <div className="mb-6">
        <h3 className="text-base font-bold text-gray-900 dark:text-white flex items-center gap-2">
          <ShieldCheck className="w-5 h-5 text-brand-500" />
          <span>Keamanan & Kata Sandi</span>
        </h3>
        <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
          Kelola kata sandi akun Anda untuk menjaga keamanan akses sistem pembelajaran.
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

      <form onSubmit={handleSubmit} className="space-y-4 max-w-lg">
        {/* Current Password */}
        <div className="space-y-1.5">
          <Label
            htmlFor="currentPassword"
            className="text-xs font-semibold text-gray-700 dark:text-gray-300"
          >
            Kata Sandi Saat Ini
          </Label>
          <div className="relative">
            <Input
              id="currentPassword"
              type={showCurrent ? 'text' : 'password'}
              value={currentPassword}
              onChange={(e) => setCurrentPassword(e.target.value)}
              placeholder="Masukkan kata sandi saat ini"
              required
              className="pr-10 text-sm bg-gray-50/50 dark:bg-gray-800/60 border-gray-200 dark:border-gray-700"
            />
            <button
              type="button"
              onClick={() => setShowCurrent(!showCurrent)}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 dark:hover:text-gray-200"
            >
              {showCurrent ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
            </button>
          </div>
        </div>

        {/* New Password */}
        <div className="space-y-1.5">
          <Label
            htmlFor="newPassword"
            className="text-xs font-semibold text-gray-700 dark:text-gray-300"
          >
            Kata Sandi Baru
          </Label>
          <div className="relative">
            <Input
              id="newPassword"
              type={showNew ? 'text' : 'password'}
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              placeholder="Minimal 8 karakter"
              required
              minLength={8}
              className="pr-10 text-sm bg-gray-50/50 dark:bg-gray-800/60 border-gray-200 dark:border-gray-700"
            />
            <button
              type="button"
              onClick={() => setShowNew(!showNew)}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 dark:hover:text-gray-200"
            >
              {showNew ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
            </button>
          </div>
        </div>

        {/* Confirm New Password */}
        <div className="space-y-1.5">
          <Label
            htmlFor="confirmPassword"
            className="text-xs font-semibold text-gray-700 dark:text-gray-300"
          >
            Konfirmasi Kata Sandi Baru
          </Label>
          <div className="relative">
            <Input
              id="confirmPassword"
              type={showConfirm ? 'text' : 'password'}
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              placeholder="Ulangi kata sandi baru"
              required
              minLength={8}
              className="pr-10 text-sm bg-gray-50/50 dark:bg-gray-800/60 border-gray-200 dark:border-gray-700"
            />
            <button
              type="button"
              onClick={() => setShowConfirm(!showConfirm)}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 dark:hover:text-gray-200"
            >
              {showConfirm ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
            </button>
          </div>
        </div>

        {/* Password Tips */}
        <div className="p-3 rounded-xl bg-gray-50 dark:bg-gray-800/60 border border-gray-100 dark:border-gray-800 text-[11px] text-gray-500 dark:text-gray-400 space-y-1">
          <p className="font-semibold text-gray-700 dark:text-gray-300 flex items-center gap-1">
            <Lock className="w-3 h-3 text-brand-500" />
            Petunjuk Keamanan:
          </p>
          <ul className="list-disc list-inside space-y-0.5 pl-1">
            <li>Gunakan kombinasi huruf besar, huruf kecil, dan angka.</li>
            <li>Minimal panjang kata sandi adalah 8 karakter.</li>
            <li>Hindari menggunakan tanggal lahir atau nomor HP pribadi.</li>
          </ul>
        </div>

        {/* Submit */}
        <div className="pt-2">
          <Button
            type="submit"
            disabled={isPending || !currentPassword || !newPassword || !confirmPassword}
            className="text-xs font-semibold bg-brand-500 hover:bg-brand-600 text-white rounded-xl h-10 px-5 gap-2 shadow-xs"
          >
            {isPending ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <KeyRound className="w-4 h-4" />
            )}
            <span>Perbarui Kata Sandi</span>
          </Button>
        </div>
      </form>
    </div>
  );
}
