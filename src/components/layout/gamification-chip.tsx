'use client';

import { useState, useEffect } from 'react';
import { Flame, Trophy, Sparkles } from 'lucide-react';
import { Link } from '@/i18n/navigation';
import { getUserGamificationProfile } from '@/lib/actions/gamification';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';

interface GamificationChipProps {
  userRole: string;
}

export function GamificationChip({ userRole }: GamificationChipProps) {
  const [profile, setProfile] = useState<{
    level: number;
    title: string;
    totalXp: number;
    currentLevelXp: number;
    nextLevelRequiredXp: number;
    progressPercent: number;
    streakDays: number;
  } | null>(null);

  // Only relevant for students
  const isStudent =
    userRole.toUpperCase() === 'STUDENT' ||
    userRole.toLowerCase() === 'siswa';

  useEffect(() => {
    if (!isStudent) return;

    let mounted = true;
    getUserGamificationProfile()
      .then((data) => {
        if (mounted && data) {
          setProfile(data);
        }
      })
      .catch(() => {
        // Silently ignore if unauthenticated
      });

    return () => {
      mounted = false;
    };
  }, [isStudent]);

  if (!isStudent || !profile) return null;

  return (
    <TooltipProvider delayDuration={300}>
      <Link
        href="/student/achievements"
        className="flex items-center gap-1.5 sm:gap-2 focus:outline-none"
      >
        {/* Streak Flame Chip */}
        <Tooltip>
          <TooltipTrigger asChild>
            <div className="flex items-center gap-1 px-2.5 py-1 rounded-full bg-orange-500/10 border border-orange-500/30 text-orange-600 dark:text-orange-400 font-extrabold text-xs hover:bg-orange-500/20 transition-all cursor-pointer">
              <Flame className="h-3.5 w-3.5 fill-orange-500 text-orange-500 animate-pulse" />
              <span>{profile.streakDays}</span>
            </div>
          </TooltipTrigger>
          <TooltipContent side="bottom" className="text-xs">
            <p className="font-bold">🔥 Streak Belajar: {profile.streakDays} Hari</p>
            <p className="text-[11px] text-gray-300">
              Belajar setiap hari untuk menjaga api belajarmu tetap menyala!
            </p>
          </TooltipContent>
        </Tooltip>

        {/* Level & XP Chip */}
        <Tooltip>
          <TooltipTrigger asChild>
            <div className="hidden sm:flex items-center gap-1.5 px-3 py-1 rounded-full bg-linear-to-r from-blue-900/10 to-amber-500/10 dark:from-blue-900/40 dark:to-amber-500/20 border border-amber-500/30 text-gray-800 dark:text-gray-100 hover:border-amber-500/60 transition-all cursor-pointer text-xs">
              <span className="font-bold text-[#002446] dark:text-amber-400 flex items-center gap-1">
                <Sparkles className="h-3 w-3 text-amber-500" />
                Lv. {profile.level}
              </span>
              <span className="text-gray-300 dark:text-gray-600">•</span>
              <span className="font-extrabold text-[#FF8928]">
                {profile.totalXp.toLocaleString()} XP
              </span>
            </div>
          </TooltipTrigger>
          <TooltipContent side="bottom" className="text-xs space-y-1">
            <p className="font-bold">
              Tingkat {profile.level}: {profile.title}
            </p>
            <div className="w-36 bg-gray-700 h-1.5 rounded-full overflow-hidden">
              <div
                className="bg-amber-400 h-full rounded-full transition-all"
                style={{ width: `${profile.progressPercent}%` }}
              />
            </div>
            <p className="text-[10px] text-gray-300">
              {profile.currentLevelXp} / {profile.nextLevelRequiredXp} XP menuju level berikutnya
            </p>
          </TooltipContent>
        </Tooltip>
      </Link>
    </TooltipProvider>
  );
}
