'use client';

import { useState } from 'react';
import { signIn } from 'next-auth/react';
import { useRouter } from '@/i18n/navigation';
import { useTranslations } from 'next-intl';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { LanguageSwitcher } from '@/components/layout/language-switcher';
import { getAccountLockoutStatus } from '@/lib/actions/auth-lockout';
import { AlertCircle, Lock, GraduationCap } from 'lucide-react';

interface SchoolBranding {
  name: string | null;
  logo: string | null;
  loginQuote?: string | null;
  loginQuoteAuthor?: string | null;
}

function GeometricPattern() {
  return (
    <svg
      className="absolute left-0 top-0 h-full w-[420px] text-white opacity-[0.08] pointer-events-none select-none"
      viewBox="0 0 380 900"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      preserveAspectRatio="xMinYMid slice"
      aria-hidden="true"
    >
      {/* Repeating architectural arches and structured geometric paths */}
      <rect x="24" y="24" width="90" height="260" rx="45" stroke="currentColor" strokeWidth="20" />
      <rect x="70" y="90" width="130" height="320" rx="65" stroke="currentColor" strokeWidth="20" />
      <path d="M24 300 H180 V450 C180 500 140 540 90 540 C40 540 24 500 24 450 Z" stroke="currentColor" strokeWidth="20" />
      <rect x="24" y="560" width="150" height="280" rx="60" stroke="currentColor" strokeWidth="20" />
      <path d="M140 40 V220 H280 C320 220 340 260 340 300 V460" stroke="currentColor" strokeWidth="20" />
      <circle cx="260" cy="130" r="36" stroke="currentColor" strokeWidth="20" />
      <path d="M190 480 H320 V660 C320 710 275 750 225 750 H180" stroke="currentColor" strokeWidth="20" />
      <line x1="24" y1="460" x2="340" y2="460" stroke="currentColor" strokeWidth="8" strokeDasharray="16 16" />
    </svg>
  );
}

export function LoginForm({ school }: { school: SchoolBranding | null }) {
  const t = useTranslations('auth');
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [isLocked, setIsLocked] = useState(false);
  const [loading, setLoading] = useState(false);

  const activeQuote = school?.loginQuote?.trim() || t('defaultQuote');
  const activeAuthor = school?.loginQuoteAuthor?.trim() || t('defaultQuoteAuthor');

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
    <div className="min-h-screen flex w-full relative bg-slate-50 dark:bg-gray-950 font-sans selection:bg-[#FF8928]/30">
      {/* Floating Language Switcher in top right */}
      <div className="fixed top-4 right-4 z-40">
        <div className="bg-white/90 dark:bg-gray-900/90 backdrop-blur-xs border border-gray-200 dark:border-gray-800 rounded-lg p-0.5 shadow-xs">
          <LanguageSwitcher />
        </div>
      </div>

      {/* Left Column: Academic Branding & Identity (hidden on mobile, visible on desktop lg+) */}
      <div className="hidden lg:flex lg:w-7/12 xl:w-2/3 bg-[#002446] relative overflow-hidden flex-col justify-between p-10 xl:p-16 text-white">
        {/* Subtle geometric pattern */}
        <GeometricPattern />

        {/* Top/Header Branding */}
        <div className="relative z-10">
          <div className="flex items-center gap-4">
            {school?.logo ? (
              <div className="w-14 h-14 rounded-2xl bg-white/10 backdrop-blur-xs border border-white/20 p-2 flex items-center justify-center shrink-0 shadow-xs">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={school.logo}
                  alt={school.name || 'Logo'}
                  className="max-h-full max-w-full object-contain"
                />
              </div>
            ) : (
              <div className="w-14 h-14 rounded-2xl bg-white/15 border border-white/20 flex items-center justify-center shrink-0 shadow-xs">
                <GraduationCap className="w-8 h-8 text-white" />
              </div>
            )}

            <div className="flex-1 flex items-center gap-4 min-w-0">
              <span className="text-xl xl:text-2xl font-bold tracking-tight text-white truncate">
                {school?.name || 'LenteraBelajar'}
              </span>
              <div className="h-px bg-white/20 flex-1 hidden sm:block max-w-xs" />
            </div>
          </div>
        </div>

        {/* Center: Inspirational Quote */}
        <div className="relative z-10 my-auto py-12 max-w-xl pl-2 xl:pl-4">
          <blockquote className="text-xl xl:text-2xl font-normal text-white/95 italic leading-relaxed font-serif tracking-wide">
            &ldquo;{activeQuote}&rdquo;
          </blockquote>
          <p className="mt-4 text-sm font-medium text-white/70 tracking-wider">
            {activeAuthor}
          </p>
        </div>

        {/* Bottom: Platform Credit */}
        <div className="relative z-10 pt-6 border-t border-white/10 flex flex-col gap-0.5">
          <span className="text-sm font-semibold tracking-wide text-white/95">
            LenteraBelajar
          </span>
          <span className="text-xs text-white/60">
            {t('deptTik')}
          </span>
        </div>
      </div>

      {/* Right Column: Sign In Form */}
      <div className="w-full lg:w-5/12 xl:w-1/3 flex flex-col justify-center items-center px-6 sm:px-12 py-12 bg-white dark:bg-gray-900 transition-colors">
        <div className="w-full max-w-sm">
          {/* Form Header */}
          <div className="mb-8">
            <div className="mb-5 flex items-center">
              {school?.logo ? (
                <div className="w-14 h-14 rounded-2xl bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 p-2 shadow-xs flex items-center justify-center overflow-hidden">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={school.logo}
                    alt={school.name || 'Logo Sekolah'}
                    className="max-h-full max-w-full object-contain"
                  />
                </div>
              ) : (
                <div className="w-14 h-14 rounded-2xl bg-[#002446] dark:bg-brand-600 flex items-center justify-center shadow-xs">
                  <GraduationCap className="h-8 w-8 text-white" />
                </div>
              )}
            </div>

            <h1 className="text-2xl font-bold tracking-tight text-[#002446] dark:text-white">
              {school?.name ? `${t('loginTo')} ${school.name}` : t('loginTitle')}
            </h1>
            <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
              {t('loginSubtitle')}
            </p>
          </div>

          {/* Form Content */}
          <form onSubmit={handleSubmit} className="space-y-4">
            {error && (
              <div
                role="alert"
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

            <div className="space-y-1.5">
              <Label htmlFor="email" className="text-sm font-medium text-gray-700 dark:text-gray-200">
                {t('email')}
              </Label>
              <Input
                id="email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="user@sekolah.sch.id"
                required
                className="h-11 bg-white dark:bg-gray-800/70 border-gray-200 dark:border-gray-700 dark:text-white dark:placeholder:text-gray-500 focus-visible:ring-2 focus-visible:ring-brand-500"
              />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="password" className="text-sm font-medium text-gray-700 dark:text-gray-200">
                {t('password')}
              </Label>
              <Input
                id="password"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                className="h-11 bg-white dark:bg-gray-800/70 border-gray-200 dark:border-gray-700 dark:text-white dark:placeholder:text-gray-500 focus-visible:ring-2 focus-visible:ring-brand-500"
              />
            </div>

            <Button
              type="submit"
              className="w-full h-11 font-semibold text-white bg-[#002446] hover:bg-[#022b52] dark:bg-brand-600 dark:hover:bg-brand-700 shadow-xs transition-colors"
              disabled={loading}
            >
              {loading ? '...' : t('loginButton')}
            </Button>
          </form>

          {/* Mobile Footer Credit (only on mobile screens where left column is hidden) */}
          <div className="lg:hidden mt-12 text-center text-xs text-gray-400 dark:text-gray-600">
            <p className="font-semibold text-gray-600 dark:text-gray-400">LenteraBelajar</p>
            <p className="mt-0.5">{t('deptTik')}</p>
          </div>
        </div>
      </div>
    </div>
  );
}
