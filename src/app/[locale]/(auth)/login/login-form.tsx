'use client';

import { useState } from 'react';
import { signIn } from 'next-auth/react';
import { useRouter } from '@/i18n/navigation';
import { useTranslations } from 'next-intl';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { LanguageSwitcher } from '@/components/layout/language-switcher';

import { getAccountLockoutStatus } from '@/lib/actions/auth-lockout';
import { AlertCircle, Lock, GraduationCap } from 'lucide-react';

interface SchoolBranding {
  name: string | null;
  logo: string | null;
}

export function LoginForm({ school }: { school: SchoolBranding | null }) {
  const t = useTranslations('auth');
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [isLocked, setIsLocked] = useState(false);
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setIsLocked(false);
    setLoading(true);

    try {
      const result = await signIn('credentials', {
        email,
        password,
        redirect: false,
      });

      if (result?.error) {
        // Query lockout and failed attempt details
        const status = await getAccountLockoutStatus(email);
        if (status.isLocked) {
          setIsLocked(true);
          setError(
            t('accountLocked', { minutes: status.remainingMinutes })
          );
        } else if (status.failedAttempts > 0) {
          const remaining = Math.max(0, status.maxAttempts - status.failedAttempts);
          setError(
            t('remainingAttempts', { remaining })
          );
        } else {
          setError(t('loginError'));
        }
      } else {
        router.push('/');
        router.refresh();
      }
    } catch (err: any) {
      if (err?.message?.includes('RATE_LIMIT')) {
        setError(t('rateLimit'));
      } else {
        setError(t('loginError'));
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-[#ECEEF0] dark:bg-gray-950 px-4 transition-colors">
      <div className="absolute top-4 right-4">
        <LanguageSwitcher />
      </div>
      <Card className="w-full max-w-md shadow-lg border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900">
        <CardHeader className="text-center pb-4">
          <div className="mx-auto mb-4 flex items-center justify-center">
            {school?.logo ? (
              <div className="w-16 h-16 rounded-2xl bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 shadow-sm flex items-center justify-center p-2 overflow-hidden">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={school.logo}
                  alt={school.name || 'Logo Sekolah'}
                  className="w-full h-full object-contain"
                />
              </div>
            ) : (
              <div className="w-14 h-14 rounded-2xl bg-brand-500 dark:bg-brand-400 flex items-center justify-center shadow-xs">
                <GraduationCap className="h-8 w-8 text-white" />
              </div>
            )}
          </div>
          <CardTitle className="text-2xl font-bold text-[#002446] dark:text-white">
            {school?.name ? `${t('loginTo')} ${school.name}` : t('loginTitle')}
          </CardTitle>
          <CardDescription className="dark:text-gray-400">
            {t('loginSubtitle')}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            {error && (
              <div
                className={`p-3 text-sm rounded-lg flex items-start gap-2.5 ${
                  isLocked
                    ? 'bg-rose-50 text-rose-800 border border-rose-200 dark:bg-rose-950/40 dark:border-rose-800 dark:text-rose-300'
                    : 'bg-red-50 text-red-700 border border-red-200 dark:bg-red-950/40 dark:border-red-800 dark:text-red-300'
                }`}
              >
                {isLocked ? (
                  <Lock className="w-5 h-5 text-rose-600 dark:text-rose-400 shrink-0 mt-0.5" />
                ) : (
                  <AlertCircle className="w-5 h-5 text-red-500 dark:text-red-400 shrink-0 mt-0.5" />
                )}
                <span className="leading-snug">{error}</span>
              </div>
            )}
            <div className="space-y-2">
              <Label htmlFor="email" className="dark:text-gray-200">{t('email')}</Label>
              <Input
                id="email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="user@sekolah.sch.id"
                required
                className="bg-white dark:bg-gray-800/60 dark:border-gray-700 dark:text-white dark:placeholder:text-gray-500"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="password" className="dark:text-gray-200">{t('password')}</Label>
              <Input
                id="password"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                className="bg-white dark:bg-gray-800/60 dark:border-gray-700 dark:text-white dark:placeholder:text-gray-500"
              />
            </div>
            <Button
              type="submit"
              className="w-full font-semibold"
              disabled={loading}
            >
              {loading ? '...' : t('loginButton')}
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
