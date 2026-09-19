'use client';

import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Trophy,
  Flame,
  Award,
  Sparkles,
  Lock,
  CheckCircle2,
  Calendar,
  Layers,
  ArrowUpRight,
  TrendingUp,
  History,
} from 'lucide-react';
import { Link } from '@/i18n/navigation';
import { useTranslations, useLocale } from 'next-intl';

interface AchievementBadge {
  code: string;
  name: string;
  description: string;
  category: string;
  icon: string;
  xpReward: number;
  unlocked: boolean;
  unlockedAt: Date | null;
}

interface XpLog {
  id: string;
  amount: number;
  reason: string;
  actionType: string;
  createdAt: Date;
}

interface StudentAchievementsClientProps {
  profile: {
    userId: string;
    name: string;
    avatar: string | null;
    streakDays: number;
    level: number;
    title: string;
    totalXp: number;
    currentLevelXp: number;
    nextLevelRequiredXp: number;
    progressPercent: number;
    recentXpLogs: XpLog[];
    totalAchievementsCount: number;
  };
  allBadges: AchievementBadge[];
}

export function StudentAchievementsClient({
  profile,
  allBadges,
}: StudentAchievementsClientProps) {
  const t = useTranslations('studentAchievements');
  const locale = useLocale();
  const dateLocale = locale === 'id' ? 'id-ID' : 'en-US';

  const [filter, setFilter] = useState<'ALL' | 'UNLOCKED' | 'LOCKED'>('ALL');

  const filteredBadges = allBadges.filter((b) => {
    if (filter === 'UNLOCKED') return b.unlocked;
    if (filter === 'LOCKED') return !b.unlocked;
    return true;
  });

  const unlockedCount = allBadges.filter((b) => b.unlocked).length;

  const getActionTypeLabel = (type: string) => {
    switch (type) {
      case 'QUIZ':
        return { label: t('actQuiz'), color: 'bg-amber-100 text-amber-800 dark:bg-amber-950/40 dark:text-amber-300' };
      case 'ASSIGNMENT':
        return { label: t('actAssignment'), color: 'bg-purple-100 text-purple-800 dark:bg-purple-950/40 dark:text-purple-300' };
      case 'LESSON':
        return { label: t('actLesson'), color: 'bg-blue-100 text-blue-800 dark:bg-blue-950/40 dark:text-blue-300' };
      case 'ATTENDANCE':
        return { label: t('actAttendance'), color: 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-300' };
      case 'FORUM':
        return { label: t('actForum'), color: 'bg-rose-100 text-rose-800 dark:bg-rose-950/40 dark:text-rose-300' };
      default:
        return { label: t('actActivity'), color: 'bg-gray-100 text-gray-800' };
    }
  };

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div>
        <div className="text-xs font-semibold text-[#FF8928] uppercase tracking-wider">
          {t('badgeCategory')}
        </div>
        <h1 className="text-2xl font-bold text-[#002446] dark:text-white flex items-center gap-2.5">
          <Trophy className="h-6 w-6 text-amber-500" />
          {t('pageTitle')}
        </h1>
        <p className="text-sm text-gray-500 dark:text-gray-400">
          {t('pageSubtitle')}
        </p>
      </div>

      {/* Hero Overview Card */}
      <Card className="border-0 bg-linear-to-r from-[#002446] via-[#013567] to-[#0a4886] text-white shadow-lg overflow-hidden">
        <CardContent className="p-6 md:p-8">
          <div className="flex flex-col md:flex-row items-center justify-between gap-6">
            {/* Left: Avatar Level Badge & Info */}
            <div className="flex flex-col sm:flex-row items-center sm:items-start gap-4 text-center sm:text-left">
              <div className="relative">
                <div className="w-20 h-20 rounded-3xl bg-linear-to-tr from-amber-400 to-[#FF8928] flex flex-col items-center justify-center font-black shadow-xl ring-4 ring-white/20">
                  <span className="text-[10px] uppercase tracking-wider opacity-90">{t('levelLabel')}</span>
                  <span className="text-3xl leading-none">{profile.level}</span>
                </div>
                <div className="absolute -bottom-1 -right-1 bg-amber-400 text-amber-950 rounded-full p-1 shadow">
                  <Sparkles className="h-4 w-4" />
                </div>
              </div>

              <div className="space-y-1">
                <div className="flex items-center justify-center sm:justify-start gap-2">
                  <h2 className="text-2xl font-black">{profile.name}</h2>
                </div>
                <div className="inline-flex items-center gap-1.5 px-3 py-0.5 rounded-full bg-amber-400/20 text-amber-300 border border-amber-400/30 text-xs font-bold">
                  <span>{t('titlePrefix')}</span>
                  <span>{profile.title}</span>
                </div>
                <p className="text-xs text-blue-200 mt-1">
                  {t('reachNextLevel')}
                </p>
              </div>
            </div>

            {/* Right: Key Stats Quick Glance */}
            <div className="grid grid-cols-3 gap-3 sm:gap-4 w-full md:w-auto">
              <div className="bg-white/10 backdrop-blur-xs border border-white/10 p-3.5 rounded-2xl text-center min-w-[90px]">
                <div className="flex items-center justify-center text-amber-400 mb-1">
                  <Sparkles className="h-4 w-4" />
                </div>
                <div className="text-lg sm:text-xl font-black">{profile.totalXp.toLocaleString()}</div>
                <div className="text-[10px] text-blue-200 uppercase font-semibold">{t('totalXp')}</div>
              </div>

              <div className="bg-white/10 backdrop-blur-xs border border-white/10 p-3.5 rounded-2xl text-center min-w-[90px]">
                <div className="flex items-center justify-center text-orange-400 mb-1">
                  <Flame className="h-4 w-4 fill-orange-400" />
                </div>
                <div className="text-lg sm:text-xl font-black">{t('streakDays', { days: profile.streakDays })}</div>
                <div className="text-[10px] text-blue-200 uppercase font-semibold">{t('fireStreak')}</div>
              </div>

              <div className="bg-white/10 backdrop-blur-xs border border-white/10 p-3.5 rounded-2xl text-center min-w-[90px]">
                <div className="flex items-center justify-center text-emerald-400 mb-1">
                  <Award className="h-4 w-4" />
                </div>
                <div className="text-lg sm:text-xl font-black">{unlockedCount} / {allBadges.length}</div>
                <div className="text-[10px] text-blue-200 uppercase font-semibold">{t('badges')}</div>
              </div>
            </div>
          </div>

          {/* Level Progress Bar inside Banner */}
          <div className="mt-6 pt-6 border-t border-white/10 space-y-2">
            <div className="flex justify-between text-xs font-semibold text-blue-100">
              <span>{t('progressToLevel', { level: profile.level + 1 })}</span>
              <span className="text-amber-300 font-bold">
                {profile.currentLevelXp} / {profile.nextLevelRequiredXp} XP ({profile.progressPercent}%)
              </span>
            </div>
            <div className="w-full bg-black/30 h-3 rounded-full overflow-hidden p-0.5 border border-white/10">
              <div
                className="bg-linear-to-r from-amber-400 via-[#FF8928] to-emerald-400 h-full rounded-full transition-all duration-700"
                style={{ width: `${profile.progressPercent}%` }}
              />
            </div>
          </div>
        </CardContent>
      </Card>

      {/* SECTION: Lemari Lencana Prestasi */}
      <div className="space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <h3 className="text-lg font-bold text-[#002446] dark:text-gray-100 flex items-center gap-2">
              <Award className="h-5 w-5 text-[#FF8928]" />
              {t('badgesCabinetTitle')}
            </h3>
            <p className="text-xs text-gray-500 dark:text-gray-400">
              {t('badgesCabinetSubtitle')}
            </p>
          </div>

          {/* Filter Pills */}
          <div className="flex items-center gap-1.5 bg-gray-100 dark:bg-gray-800 p-1 rounded-xl border border-gray-200 dark:border-gray-700">
            <Button
              variant={filter === 'ALL' ? 'default' : 'ghost'}
              size="sm"
              onClick={() => setFilter('ALL')}
              className={`text-xs h-7 rounded-lg ${filter === 'ALL' ? 'bg-[#002446] text-white hover:bg-[#002446]/90' : ''}`}
            >
              {t('filterAll', { count: allBadges.length })}
            </Button>
            <Button
              variant={filter === 'UNLOCKED' ? 'default' : 'ghost'}
              size="sm"
              onClick={() => setFilter('UNLOCKED')}
              className={`text-xs h-7 rounded-lg ${filter === 'UNLOCKED' ? 'bg-emerald-600 text-white hover:bg-emerald-700' : ''}`}
            >
              {t('filterUnlocked', { count: unlockedCount })}
            </Button>
            <Button
              variant={filter === 'LOCKED' ? 'default' : 'ghost'}
              size="sm"
              onClick={() => setFilter('LOCKED')}
              className={`text-xs h-7 rounded-lg ${filter === 'LOCKED' ? 'bg-gray-600 text-white hover:bg-gray-700' : ''}`}
            >
              {t('filterLocked', { count: allBadges.length - unlockedCount })}
            </Button>
          </div>
        </div>

        {/* Badges Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {filteredBadges.map((badge) => {
            return (
              <Card
                key={badge.code}
                className={`relative overflow-hidden transition-all duration-300 border ${
                  badge.unlocked
                    ? 'border-amber-300/80 bg-linear-to-b from-amber-50/40 via-white to-white dark:from-amber-950/20 dark:via-gray-900 dark:to-gray-900 shadow-sm hover:shadow-md'
                    : 'border-gray-200 dark:border-gray-800 bg-gray-50/50 dark:bg-gray-900/40 opacity-70 hover:opacity-100'
                }`}
              >
                {/* Top Corner Ribbon / Badge */}
                <div className="absolute top-3 right-3 flex items-center gap-1">
                  {badge.unlocked ? (
                    <Badge className="bg-emerald-100 text-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-300 border-emerald-300 text-[10px] px-1.5 py-0 flex items-center gap-0.5">
                      <CheckCircle2 className="h-3 w-3" /> {t('badgeUnlocked')}
                    </Badge>
                  ) : (
                    <Badge variant="outline" className="text-[10px] text-gray-400 border-gray-300 flex items-center gap-0.5">
                      <Lock className="h-3 w-3" /> {t('badgeLocked')}
                    </Badge>
                  )}
                </div>

                <CardContent className="p-5 flex flex-col items-center text-center space-y-3">
                  {/* Badge Icon */}
                  <div
                    className={`w-16 h-16 rounded-2xl flex items-center justify-center text-3xl transition-transform hover:scale-110 shadow-sm ${
                      badge.unlocked
                        ? 'bg-linear-to-br from-amber-100 to-amber-200 dark:from-amber-900/40 dark:to-amber-800/20 border-2 border-amber-300 ring-2 ring-amber-100'
                        : 'bg-gray-100 dark:bg-gray-800 grayscale border border-gray-300 dark:border-gray-700'
                    }`}
                  >
                    <span>{badge.icon}</span>
                  </div>

                  {/* Badge Title & Description */}
                  <div className="space-y-1">
                    <h4 className="font-bold text-sm text-gray-900 dark:text-gray-100">
                      {badge.name}
                    </h4>
                    <p className="text-xs text-gray-500 dark:text-gray-400 leading-relaxed line-clamp-2">
                      {badge.description}
                    </p>
                  </div>

                  {/* Reward & Date Info */}
                  <div className="w-full pt-2 border-t border-gray-100 dark:border-gray-800 flex items-center justify-between text-[11px]">
                    <span className="font-bold text-amber-600 dark:text-amber-400">
                      +{badge.xpReward} XP
                    </span>
                    <span className="text-gray-400">
                      {badge.unlocked && badge.unlockedAt
                        ? new Date(badge.unlockedAt).toLocaleDateString(dateLocale, {
                            day: 'numeric',
                            month: 'short',
                          })
                        : badge.category}
                    </span>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      </div>

      {/* SECTION: Riwayat Perolehan XP */}
      <Card className="border shadow-xs">
        <CardHeader className="pb-3 border-b flex flex-row items-center justify-between">
          <div className="flex items-center gap-2">
            <History className="h-5 w-5 text-[#002446] dark:text-blue-400" />
            <div>
              <CardTitle className="text-base font-bold text-[#002446] dark:text-gray-100">
                {t('recentXpHistoryTitle')}
              </CardTitle>
              <p className="text-xs text-gray-500 mt-0.5">
                {t('recentXpHistorySubtitle')}
              </p>
            </div>
          </div>
          <Badge variant="outline" className="text-xs">
            {t('lastActivities', { count: profile.recentXpLogs.length })}
          </Badge>
        </CardHeader>

        <CardContent className="p-0 divide-y divide-gray-100 dark:divide-gray-800">
          {profile.recentXpLogs.length === 0 ? (
            <div className="p-8 text-center text-gray-400 text-xs">
              {t('noXpLogs')}
            </div>
          ) : (
            profile.recentXpLogs.map((log) => {
              const act = getActionTypeLabel(log.actionType);
              return (
                <div
                  key={log.id}
                  className="p-3.5 sm:p-4 flex items-center justify-between gap-3 hover:bg-gray-50/50 dark:hover:bg-gray-800/50 transition-colors"
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <Badge className={`text-[10px] shrink-0 font-bold ${act.color}`}>
                      {act.label}
                    </Badge>
                    <div className="min-w-0">
                      <p className="text-xs font-semibold text-gray-900 dark:text-gray-100 truncate">
                        {log.reason}
                      </p>
                      <p className="text-[10px] text-gray-400 mt-0.5">
                        {new Date(log.createdAt).toLocaleString(dateLocale, {
                          day: 'numeric',
                          month: 'short',
                          year: 'numeric',
                          hour: '2-digit',
                          minute: '2-digit',
                        })}
                      </p>
                    </div>
                  </div>

                  <div className="shrink-0 font-black text-xs text-emerald-600 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-950/40 px-2.5 py-1 rounded-full border border-emerald-200 dark:border-emerald-800">
                    +{log.amount} XP
                  </div>
                </div>
              );
            })
          )}
        </CardContent>
      </Card>
    </div>
  );
}

