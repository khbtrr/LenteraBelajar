'use client';

import { useLocale } from 'next-intl';
import { useRouter, usePathname } from '@/i18n/navigation';
import { useSearchParams } from 'next/navigation';
import { updateUserLocale } from '@/lib/actions/profile-locale';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { cn } from '@/lib/utils';
import { Check, ChevronDown, Globe } from 'lucide-react';

const locales = [
  { code: 'id', label: 'Bahasa Indonesia', shortLabel: 'ID', flag: '🇮🇩' },
  { code: 'en', label: 'English', shortLabel: 'EN', flag: '🇺🇸' },
] as const;

interface LanguageSwitcherProps {
  variant?: 'icon' | 'pill';
  className?: string;
}

export function LanguageSwitcher({ variant = 'icon', className }: LanguageSwitcherProps) {
  const locale = useLocale();
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const currentLocale = locales.find((l) => l.code === locale) || locales[0];

  const switchLocale = async (newLocale: string) => {
    const qs = searchParams?.toString();
    const targetPath = qs ? `${pathname}?${qs}` : pathname;
    router.replace(targetPath, { locale: newLocale });

    try {
      await updateUserLocale(newLocale);
    } catch {
      // Ignored for unauthenticated users
    }
  };

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        {variant === 'pill' ? (
          <Button
            variant="outline"
            className={cn(
              'h-9 px-3 gap-2 rounded-xl bg-white/95 dark:bg-gray-900/95 backdrop-blur-xs border-gray-200 dark:border-gray-800 text-xs font-semibold text-gray-700 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-gray-800 shadow-xs transition-colors cursor-pointer',
              className
            )}
            aria-label="Pilih Bahasa / Select Language"
          >
            <Globe className="h-4 w-4 text-brand-600 dark:text-brand-400" />
            <span className="uppercase font-bold tracking-wide">{currentLocale.shortLabel}</span>
            <span className="text-gray-400 dark:text-gray-500 font-normal">({currentLocale.label.split(' ')[0]})</span>
            <ChevronDown className="h-3 w-3 text-gray-400 dark:text-gray-500" />
          </Button>
        ) : (
          <Button
            variant="ghost"
            size="icon"
            className={cn('h-10 w-10 rounded-lg text-gray-500 hover:text-gray-700 hover:bg-gray-100 dark:text-gray-400 dark:hover:text-white dark:hover:bg-gray-800', className)}
            aria-label="Pilih Bahasa / Select Language"
          >
            <Globe className="h-5 w-5 text-gray-600" />
          </Button>
        )}
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-48 rounded-xl shadow-lg border border-gray-200 dark:border-gray-800 p-1">
        {locales.map((l) => (
          <DropdownMenuItem
            key={l.code}
            onClick={() => switchLocale(l.code)}
            className={cn(
              'flex items-center justify-between px-3 py-2 text-xs font-medium rounded-lg cursor-pointer transition-colors',
              locale === l.code
                ? 'bg-brand-50 text-brand-600 dark:bg-brand-500/15 dark:text-brand-300 font-semibold'
                : 'text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800'
            )}
          >
            <span className="flex items-center gap-2.5">
              <span className="text-base">{l.flag}</span>
              <span>{l.label}</span>
            </span>
            {locale === l.code && <Check className="h-3.5 w-3.5 text-brand-600 dark:text-brand-400" />}
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
