'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useSession } from 'next-auth/react';
import { useTranslations } from 'next-intl';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';

export default function ChangePasswordPage() {
  const t = useTranslations('auth');
  const router = useRouter();
  const { update } = useSession();
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (newPassword !== confirmPassword) {
      setError(t('passwordMismatch'));
      return;
    }

    setLoading(true);

    try {
      const res = await fetch('/api/auth/change-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ currentPassword, newPassword }),
      });

      if (!res.ok) {
        const data = await res.json();
        setError(data.error || t('errorOccurred'));
        return;
      }

      await update({ mustChangePassword: false });
      window.location.href = '/';
    } catch {
      setError(t('errorOccurred'));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-[#ECEEF0] dark:bg-gray-950 px-4 transition-colors">
      <Card className="w-full max-w-md shadow-lg border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900">
        <CardHeader className="text-center">
          <CardTitle className="text-2xl font-bold text-[#002446] dark:text-white">
            {t('changePassword')}
          </CardTitle>
          <CardDescription className="dark:text-gray-400">{t('mustChangePassword')}</CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            {error && (
              <div className="p-3 text-sm text-red-600 bg-red-50 dark:bg-red-950/40 dark:text-red-300 dark:border dark:border-red-800 rounded-lg">
                {error}
              </div>
            )}
            <div className="space-y-2">
              <Label htmlFor="currentPassword" className="dark:text-gray-200">{t('currentPassword')}</Label>
              <Input
                id="currentPassword"
                type="password"
                value={currentPassword}
                onChange={(e) => setCurrentPassword(e.target.value)}
                required
                className="bg-white dark:bg-gray-800/60 dark:border-gray-700 dark:text-white dark:placeholder:text-gray-500"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="newPassword" className="dark:text-gray-200">{t('newPassword')}</Label>
              <Input
                id="newPassword"
                type="password"
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                required
                minLength={8}
                className="bg-white dark:bg-gray-800/60 dark:border-gray-700 dark:text-white dark:placeholder:text-gray-500"
              />
              <p className="text-[11px] text-gray-500 dark:text-gray-400">
                {t('passwordPolicyHint')}
              </p>
            </div>
            <div className="space-y-2">
              <Label htmlFor="confirmPassword" className="dark:text-gray-200">{t('confirmPassword')}</Label>
              <Input
                id="confirmPassword"
                type="password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                required
                minLength={8}
                className="bg-white dark:bg-gray-800/60 dark:border-gray-700 dark:text-white dark:placeholder:text-gray-500"
              />
            </div>
            <Button
              type="submit"
              className="w-full bg-[#002446] hover:bg-[#002446]/90 dark:bg-brand-600 dark:hover:bg-brand-700 text-white"
              disabled={loading}
            >
              {loading ? '...' : t('changePassword')}
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
