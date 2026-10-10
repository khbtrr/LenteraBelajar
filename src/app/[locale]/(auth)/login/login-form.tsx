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
import { AlertCircle, Lock, Mail, GraduationCap, School } from 'lucide-react';

interface SchoolBranding {
  name: string | null;
  logo: string | null;
  loginQuote?: string | null;
  loginQuoteAuthor?: string | null;
}

/**
 * Modern stylized Lantern of Knowledge illustration ("Lentera Pengetahuan").
 * Symbolizes enlightenment, education, and the spark of learning ("menyalakan api").
 */
function LanternIllustration() {
  return (
    <div className="relative w-full max-w-[280px] sm:max-w-[320px] aspect-square mx-auto flex items-center justify-center my-auto py-2 select-none pointer-events-none">
      <svg
        viewBox="0 0 360 380"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        className="w-full h-full drop-shadow-xl"
        aria-hidden="true"
      >
        <defs>
          {/* Radial aura of knowledge flame */}
          <radialGradient id="lanternGlow" cx="50%" cy="50%" r="50%">
            <stop offset="0%" stopColor="#FF8928" stopOpacity="0.35" />
            <stop offset="50%" stopColor="#ea580c" stopOpacity="0.15" />
            <stop offset="100%" stopColor="#002446" stopOpacity="0" />
          </radialGradient>

          {/* Flame outer and inner gradients */}
          <linearGradient id="flameOuter" x1="0%" y1="0%" x2="0%" y2="100%">
            <stop offset="0%" stopColor="#fef08a" />
            <stop offset="35%" stopColor="#fb923c" />
            <stop offset="100%" stopColor="#ea580c" />
          </linearGradient>

          <linearGradient id="flameInner" x1="0%" y1="0%" x2="0%" y2="100%">
            <stop offset="0%" stopColor="#ffffff" />
            <stop offset="60%" stopColor="#fef08a" />
            <stop offset="100%" stopColor="#f59e0b" />
          </linearGradient>

          {/* Metallic / Glass gradients */}
          <linearGradient id="lanternMetal" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="#cbd5e1" />
            <stop offset="40%" stopColor="#64748b" />
            <stop offset="100%" stopColor="#334155" />
          </linearGradient>

          <linearGradient id="lanternBrass" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="#fed7aa" />
            <stop offset="50%" stopColor="#fb923c" />
            <stop offset="100%" stopColor="#c2410c" />
          </linearGradient>

          <linearGradient id="glassChamber" x1="0%" y1="0%" x2="100%" y2="0%">
            <stop offset="0%" stopColor="#ffffff" stopOpacity="0.15" />
            <stop offset="30%" stopColor="#ffffff" stopOpacity="0.04" />
            <stop offset="70%" stopColor="#ffffff" stopOpacity="0.02" />
            <stop offset="100%" stopColor="#ffffff" stopOpacity="0.12" />
          </linearGradient>

          <radialGradient id="groundShadow" cx="50%" cy="50%" r="50%">
            <stop offset="0%" stopColor="#001428" stopOpacity="0.7" />
            <stop offset="100%" stopColor="#001428" stopOpacity="0" />
          </radialGradient>
        </defs>

        {/* Ambient Ground Shadow */}
        <ellipse cx="180" cy="350" rx="90" ry="14" fill="url(#groundShadow)" />

        {/* Radiating Light Orbits / Illumination Rings */}
        <circle cx="180" cy="225" r="75" stroke="#FF8928" strokeOpacity="0.22" strokeWidth="1" strokeDasharray="4 6" />
        <circle cx="180" cy="225" r="115" stroke="#FF8928" strokeOpacity="0.12" strokeWidth="1" strokeDasharray="6 8" />

        {/* Warm Ambient Glow Aura */}
        <circle cx="180" cy="225" r="95" fill="url(#lanternGlow)" />

        {/* Glass Chamber */}
        <path
          d="M 132 150 L 122 284 H 238 L 228 150 Z"
          fill="url(#glassChamber)"
          stroke="rgba(255,255,255,0.12)"
          strokeWidth="1.5"
        />

        {/* Glass Specular Highlights */}
        <path
          d="M 142 155 L 132 278"
          stroke="rgba(255,255,255,0.25)"
          strokeWidth="3"
          strokeLinecap="round"
        />
        <path
          d="M 148 158 L 140 274"
          stroke="rgba(255,255,255,0.1)"
          strokeWidth="1.5"
          strokeLinecap="round"
        />

        {/* Candle / Oil Pillar Core */}
        <rect x="172" y="252" width="16" height="32" rx="4" fill="url(#lanternMetal)" />
        <line x1="180" y1="252" x2="180" y2="242" stroke="#475569" strokeWidth="2.5" strokeLinecap="round" />

        {/* Outer Warm Flame */}
        <path
          d="M 180 185 C 195 205 201 220 201 230 C 201 242 192 249 180 249 C 168 249 159 242 159 230 C 159 220 165 205 180 185 Z"
          fill="url(#flameOuter)"
          className="filter drop-shadow-[0_0_8px_rgba(255,137,40,0.6)]"
        />

        {/* Inner Bright Flame Core */}
        <path
          d="M 180 204 C 188 217 191 226 191 233 C 191 240 186 245 180 245 C 174 245 169 240 169 233 C 169 226 172 217 180 204 Z"
          fill="url(#flameInner)"
        />

        {/* Rising Luminous Embers */}
        <circle cx="177" cy="172" r="2.2" fill="#fef08a" opacity="0.85" />
        <circle cx="185" cy="160" r="2.8" fill="#fed7aa" opacity="0.9" />
        <circle cx="174" cy="148" r="1.8" fill="#fed7aa" opacity="0.75" />
        <circle cx="184" cy="138" r="2" fill="#fde68a" opacity="0.6" />

        {/* Lantern Vertical Struts / Pillars */}
        <line x1="130" y1="150" x2="120" y2="284" stroke="url(#lanternMetal)" strokeWidth="4.5" strokeLinecap="round" />
        <line x1="230" y1="150" x2="240" y2="284" stroke="url(#lanternMetal)" strokeWidth="4.5" strokeLinecap="round" />
        <line x1="180" y1="150" x2="180" y2="284" stroke="rgba(255,255,255,0.18)" strokeWidth="1.5" strokeDasharray="3 3" />

        {/* Base Pedestal Platform */}
        <path d="M 124 308 L 132 284 H 228 L 236 308 Z" fill="url(#lanternMetal)" />
        <rect x="110" y="308" width="140" height="14" rx="7" fill="url(#lanternMetal)" />
        <rect x="118" y="318" width="124" height="10" rx="5" fill="#1e293b" />
        <rect x="146" y="284" width="68" height="4" rx="2" fill="url(#lanternBrass)" />

        {/* Canopy / Architectural Roof */}
        <path d="M 106 150 L 136 108 H 224 L 254 150 Z" fill="url(#lanternMetal)" />
        <rect x="100" y="146" width="160" height="7" rx="3.5" fill="url(#lanternBrass)" />
        <path d="M 148 108 L 162 82 H 198 L 212 108 Z" fill="#334155" />
        <rect x="144" y="106" width="72" height="4" rx="2" fill="url(#lanternBrass)" />

        {/* Top Finial & Suspension Ring */}
        <circle cx="180" cy="76" r="8" fill="url(#lanternBrass)" />
        <path
          d="M 166 68 C 166 48 194 48 194 68"
          stroke="url(#lanternBrass)"
          strokeWidth="4.5"
          strokeLinecap="round"
          fill="none"
        />
      </svg>
    </div>
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
        const status = await getAccountLockoutStatus(email);
        if (status.isLocked) {
          setIsLocked(true);
          setError(t('accountLocked', { minutes: status.remainingMinutes }));
        } else if (status.failedAttempts > 0) {
          const remaining = Math.max(0, status.maxAttempts - status.failedAttempts);
          setError(t('remainingAttempts', { remaining }));
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
    <div className="min-h-screen bg-[#F0F2F5] dark:bg-gray-950 flex flex-col justify-center items-center p-3 sm:p-6 lg:p-8 selection:bg-[#FF8928]/30">
      {/* Floating Language Switcher in top right */}
      <div className="fixed top-4 right-4 z-40">
        <div className="bg-white/90 dark:bg-gray-900/90 backdrop-blur-xs border border-gray-200 dark:border-gray-800 rounded-xl p-0.5 shadow-xs">
          <LanguageSwitcher />
        </div>
      </div>

      {/* Main Dual-Card Wrapper */}
      <div className="w-full max-w-6xl grid grid-cols-1 lg:grid-cols-12 gap-5 items-stretch my-auto">
        {/* Sisi Kiri: Branding Showcase Card (Deep Navy) */}
        <div className="hidden lg:flex lg:col-span-7 bg-[#002446] rounded-3xl p-8 sm:p-10 text-white relative overflow-hidden flex-col justify-between shadow-sm min-h-[620px]">
          {/* Top: Header Branding & Quote */}
          <div className="relative z-10 space-y-5">
            <div className="flex items-center gap-3.5">
              {school?.logo ? (
                <div className="w-12 h-12 rounded-2xl bg-white/10 backdrop-blur-xs border border-white/20 p-2 flex items-center justify-center shrink-0 shadow-xs overflow-hidden">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={school.logo}
                    alt={school.name || 'Logo'}
                    className="max-h-full max-w-full object-contain"
                  />
                </div>
              ) : (
                <div className="w-12 h-12 rounded-2xl bg-white/15 border border-white/20 flex items-center justify-center shrink-0 shadow-xs">
                  <School className="w-6 h-6 text-white" />
                </div>
              )}
              <div className="min-w-0">
                <span className="text-base font-bold tracking-tight text-white block truncate">
                  {school?.name || 'LenteraBelajar'}
                </span>
                <span className="text-xs text-white/70 block">
                  LMS Portal
                </span>
              </div>
            </div>

            <div className="space-y-2 max-w-lg pt-1">
              <h2 className="text-2xl xl:text-3xl font-semibold tracking-tight leading-snug text-white/95">
                &ldquo;{activeQuote}&rdquo;
              </h2>
              <p className="text-sm font-medium text-white/75 tracking-wide">
                ({activeAuthor})
              </p>
            </div>
          </div>

          {/* Center: Lantern of Knowledge Illustration */}
          <LanternIllustration />

          {/* Bottom Card (Sisi Kiri): Info Pengembang & Platform */}
          <div className="relative z-10 bg-white/10 backdrop-blur-md border border-white/15 rounded-2xl p-4 sm:p-5">
            <p className="text-sm font-semibold tracking-wide text-white/95">
              LenteraBelajar LMS
            </p>
            <p className="text-xs text-white/70 mt-0.5">
              {t('deptTik')}
            </p>
          </div>
        </div>

        {/* Sisi Kanan: Form Card Saja (Card di bawah form dihapus) */}
        <div className="w-full lg:col-span-5 flex flex-col justify-center">
          <div className="bg-white dark:bg-gray-900 rounded-3xl p-8 sm:p-10 shadow-sm border border-gray-200/80 dark:border-gray-800 flex flex-col justify-center min-h-[620px]">
            {/* School Branding / Header */}
            <div className="mb-8">
              <div className="flex items-center gap-3.5 mb-5">
                {school?.logo ? (
                  <div className="w-14 h-14 rounded-2xl bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 p-2 shadow-xs flex items-center justify-center overflow-hidden shrink-0">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={school.logo}
                      alt={school.name || 'Logo Sekolah'}
                      className="max-h-full max-w-full object-contain"
                    />
                  </div>
                ) : (
                  <div className="w-14 h-14 rounded-2xl bg-[#002446] dark:bg-brand-600 flex items-center justify-center shadow-xs shrink-0">
                    <GraduationCap className="h-7 w-7 text-white" />
                  </div>
                )}
                <div>
                  <span className="text-sm font-semibold tracking-tight text-[#002446] dark:text-white block">
                    {school?.name || 'LenteraBelajar'}
                  </span>
                  <span className="text-xs text-gray-500 dark:text-gray-400 block">
                    Portal Akses Pembelajaran
                  </span>
                </div>
              </div>

              <h1 className="text-2xl font-bold tracking-tight text-[#002446] dark:text-white">
                {school?.name ? `${t('loginTo')} ${school.name}` : t('loginTitle')}
              </h1>
              <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
                {t('loginSubtitle')}
              </p>
            </div>

            {/* Form */}
            <form onSubmit={handleSubmit} className="space-y-4">
              {error && (
                <div
                  role="alert"
                  className={`p-3 text-sm rounded-xl flex items-start gap-2.5 ${
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
                <Label htmlFor="email" className="text-sm font-medium text-gray-700 dark:text-gray-300">
                  {t('email')}
                </Label>
                <div className="relative">
                  <Mail className="w-4 h-4 text-gray-400 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
                  <Input
                    id="email"
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="user@sekolah.sch.id"
                    required
                    className="h-11 pl-10 rounded-xl bg-white dark:bg-gray-800/80 border-gray-200 dark:border-gray-700 dark:text-white dark:placeholder:text-gray-500 focus-visible:ring-2 focus-visible:ring-brand-500"
                  />
                </div>
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="password" className="text-sm font-medium text-gray-700 dark:text-gray-300">
                  {t('password')}
                </Label>
                <div className="relative">
                  <Lock className="w-4 h-4 text-gray-400 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
                  <Input
                    id="password"
                    type="password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    required
                    className="h-11 pl-10 rounded-xl bg-white dark:bg-gray-800/80 border-gray-200 dark:border-gray-700 dark:text-white dark:placeholder:text-gray-500 focus-visible:ring-2 focus-visible:ring-brand-500"
                  />
                </div>
              </div>

              <Button
                type="submit"
                className="w-full h-11 font-semibold text-white bg-[#002446] hover:bg-[#022b52] dark:bg-brand-600 dark:hover:bg-brand-700 rounded-xl shadow-xs transition-colors mt-2"
                disabled={loading}
              >
                {loading ? '...' : t('loginButton')}
              </Button>
            </form>

            {/* Mobile Footer Credit (hanya muncul di mobile karena sisi kiri disembunyikan) */}
            <div className="lg:hidden mt-8 pt-6 border-t border-gray-100 dark:border-gray-800 text-center text-xs text-gray-500 dark:text-gray-400">
              <p className="font-semibold text-gray-800 dark:text-gray-300">LenteraBelajar LMS</p>
              <p className="mt-0.5">{t('deptTik')}</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
