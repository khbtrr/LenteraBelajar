'use client';

import { useState, useEffect } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Trophy, Flame, Crown, Sparkles, Loader2 } from 'lucide-react';
import { getCourseLeaderboard } from '@/lib/actions/gamification';

interface LeaderboardModalProps {
  courseId: string;
  triggerButton?: React.ReactNode;
}

export function LeaderboardModal({ courseId, triggerButton }: LeaderboardModalProps) {
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [data, setData] = useState<{
    courseTitle: string;
    totalStudents: number;
    podium: any[];
    rankedStudents: any[];
    currentUserRank: any | null;
  } | null>(null);

  const loadLeaderboard = async () => {
    setLoading(true);
    try {
      const res = await getCourseLeaderboard(courseId);
      setData(res);
    } catch (err) {
      console.error('Failed to load leaderboard:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (open) {
      loadLeaderboard();
    }
  }, [open, courseId]);

  const getInitials = (name: string) => {
    return (name || 'S')
      .split(' ')
      .map((n) => n[0])
      .join('')
      .toUpperCase()
      .slice(0, 2);
  };

  // Reorder podium: [2nd, 1st, 3rd] for display
  const renderPodium = () => {
    if (!data || data.podium.length === 0) return null;

    const first = data.podium[0];
    const second = data.podium[1];
    const third = data.podium[2];

    return (
      <div className="flex items-end justify-center gap-2 sm:gap-4 pt-4 pb-2">
        {/* 2nd Place */}
        {second && (
          <div className="flex flex-col items-center flex-1 max-w-[110px]">
            <div className="relative mb-2">
              <Avatar className="h-12 w-12 border-2 border-slate-300 shadow-md">
                <AvatarImage src={second.avatar || ''} />
                <AvatarFallback className="bg-slate-200 text-slate-700 font-bold text-xs">
                  {getInitials(second.name)}
                </AvatarFallback>
              </Avatar>
              <div className="absolute -bottom-1 -right-1 bg-slate-300 text-slate-800 text-[10px] font-black rounded-full h-5 w-5 flex items-center justify-center shadow">
                2
              </div>
            </div>
            <p className="text-xs font-bold text-gray-800 dark:text-gray-200 truncate w-full text-center">
              {second.name.split(' ')[0]}
            </p>
            <span className="text-[11px] font-semibold text-slate-600 dark:text-slate-400">
              {second.xp.toLocaleString()} XP
            </span>
            <div className="w-full h-16 sm:h-20 bg-linear-to-t from-slate-200 to-slate-100 dark:from-slate-800 dark:to-slate-700 rounded-t-xl mt-2 flex flex-col items-center justify-center border-t-2 border-slate-300">
              <span className="text-xl">🥈</span>
            </div>
          </div>
        )}

        {/* 1st Place (Center, Tallest) */}
        {first && (
          <div className="flex flex-col items-center flex-1 max-w-[130px] z-10">
            <div className="relative mb-2">
              <Crown className="h-6 w-6 text-amber-500 absolute -top-5 left-1/2 -translate-x-1/2 animate-bounce" />
              <Avatar className="h-16 w-16 border-4 border-amber-400 shadow-xl ring-2 ring-amber-200">
                <AvatarImage src={first.avatar || ''} />
                <AvatarFallback className="bg-amber-100 text-amber-900 font-bold text-sm">
                  {getInitials(first.name)}
                </AvatarFallback>
              </Avatar>
              <div className="absolute -bottom-1 -right-1 bg-amber-400 text-amber-950 text-xs font-black rounded-full h-6 w-6 flex items-center justify-center shadow">
                1
              </div>
            </div>
            <p className="text-xs sm:text-sm font-extrabold text-[#002446] dark:text-amber-400 truncate w-full text-center">
              {first.name}
            </p>
            <span className="text-xs font-bold text-[#FF8928]">
              {first.xp.toLocaleString()} XP
            </span>
            <div className="w-full h-24 sm:h-28 bg-linear-to-t from-amber-200 to-amber-100 dark:from-amber-900/50 dark:to-amber-800/30 rounded-t-xl mt-2 flex flex-col items-center justify-center border-t-4 border-amber-400 shadow-xs">
              <span className="text-2xl">🥇</span>
              <span className="text-[10px] font-bold text-amber-800 dark:text-amber-300 uppercase tracking-widest mt-1">
                Juara 1
              </span>
            </div>
          </div>
        )}

        {/* 3rd Place */}
        {third && (
          <div className="flex flex-col items-center flex-1 max-w-[110px]">
            <div className="relative mb-2">
              <Avatar className="h-12 w-12 border-2 border-amber-700/60 shadow-md">
                <AvatarImage src={third.avatar || ''} />
                <AvatarFallback className="bg-amber-800/20 text-amber-900 font-bold text-xs">
                  {getInitials(third.name)}
                </AvatarFallback>
              </Avatar>
              <div className="absolute -bottom-1 -right-1 bg-amber-700 text-white text-[10px] font-black rounded-full h-5 w-5 flex items-center justify-center shadow">
                3
              </div>
            </div>
            <p className="text-xs font-bold text-gray-800 dark:text-gray-200 truncate w-full text-center">
              {third.name.split(' ')[0]}
            </p>
            <span className="text-[11px] font-semibold text-amber-700 dark:text-amber-500">
              {third.xp.toLocaleString()} XP
            </span>
            <div className="w-full h-12 sm:h-16 bg-linear-to-t from-amber-900/20 to-amber-800/10 dark:from-amber-950/40 dark:to-amber-900/20 rounded-t-xl mt-2 flex flex-col items-center justify-center border-t-2 border-amber-700/50">
              <span className="text-lg">🥉</span>
            </div>
          </div>
        )}
      </div>
    );
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        {triggerButton ? (
          triggerButton
        ) : (
          <Button
            variant="outline"
            size="sm"
            className="text-xs flex items-center gap-1.5 border-amber-500 text-amber-700 hover:bg-amber-50 dark:border-amber-600 dark:text-amber-400 dark:hover:bg-amber-950/30"
          >
            <Trophy className="h-4 w-4 text-amber-500" />
            Papan Peringkat
          </Button>
        )}
      </DialogTrigger>

      <DialogContent className="max-w-md sm:max-w-lg p-0 overflow-hidden max-h-[90vh] flex flex-col">
        <DialogHeader className="p-5 pb-3 bg-linear-to-r from-[#002446] to-[#013567] text-white">
          <div className="flex items-center gap-2">
            <Trophy className="h-5 w-5 text-amber-400" />
            <DialogTitle className="text-lg font-bold text-white">
              Papan Peringkat Kelas
            </DialogTitle>
          </div>
          <p className="text-xs text-blue-200">
            {data?.courseTitle || 'Memuat mata pelajaran...'} •{' '}
            {data ? `${data.totalStudents} Siswa Terdaftar` : ''}
          </p>
        </DialogHeader>

        <div className="flex-1 overflow-y-auto px-5 py-3 space-y-4">
          {loading ? (
            <div className="flex flex-col items-center justify-center py-12 gap-3">
              <Loader2 className="h-8 w-8 animate-spin text-[#FF8928]" />
              <p className="text-xs text-gray-500">Memuat peringkat siswa...</p>
            </div>
          ) : !data || data.rankedStudents.length === 0 ? (
            <div className="text-center py-12 text-gray-400 text-sm">
              Belum ada data aktivitas siswa di kelas ini.
            </div>
          ) : (
            <>
              {/* Podium Section for Top 3 */}
              {renderPodium()}

              {/* Ranking List */}
              <div className="space-y-2 pt-2 border-t border-gray-100 dark:border-gray-800">
                <div className="text-[11px] font-bold text-gray-400 uppercase tracking-wider px-1">
                  Semua Siswa
                </div>

                {data.rankedStudents.map((st) => (
                  <div
                    key={st.id}
                    className={`flex items-center justify-between p-2.5 rounded-xl border transition-colors ${
                      st.isCurrentUser
                        ? 'bg-amber-50/80 border-amber-300 dark:bg-amber-950/30 dark:border-amber-700/60 shadow-xs'
                        : 'bg-white dark:bg-gray-800/50 border-gray-100 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-800'
                    }`}
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      {/* Rank Position */}
                      <div
                        className={`w-7 h-7 rounded-full flex items-center justify-center font-bold text-xs shrink-0 ${
                          st.rank === 1
                            ? 'bg-amber-400 text-amber-950'
                            : st.rank === 2
                            ? 'bg-slate-300 text-slate-800'
                            : st.rank === 3
                            ? 'bg-amber-700 text-white'
                            : 'bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300'
                        }`}
                      >
                        {st.rank}
                      </div>

                      {/* Avatar */}
                      <Avatar className="h-8 w-8 shrink-0 border border-gray-200 dark:border-gray-700">
                        <AvatarImage src={st.avatar || ''} />
                        <AvatarFallback className="text-[10px] font-bold bg-brand-50 text-brand-600">
                          {getInitials(st.name)}
                        </AvatarFallback>
                      </Avatar>

                      {/* Name & Title */}
                      <div className="min-w-0">
                        <div className="flex items-center gap-1.5">
                          <p className="text-xs font-bold text-gray-900 dark:text-gray-100 truncate">
                            {st.name}
                          </p>
                          {st.isCurrentUser && (
                            <Badge className="text-[9px] px-1 py-0 bg-[#FF8928] text-white border-0">
                              Anda
                            </Badge>
                          )}
                        </div>
                        <div className="flex items-center gap-2 text-[10px] text-gray-500 dark:text-gray-400">
                          <span>Lv. {st.level} • {st.title}</span>
                          {st.streakDays > 0 && (
                            <span className="flex items-center text-orange-500 font-semibold">
                              <Flame className="h-3 w-3 inline mr-0.5 fill-orange-500" />
                              {st.streakDays}h
                            </span>
                          )}
                        </div>
                      </div>
                    </div>

                    {/* XP Counter */}
                    <div className="text-right shrink-0">
                      <div className="text-xs font-black text-[#002446] dark:text-amber-400">
                        {st.xp.toLocaleString()} XP
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </>
          )}
        </div>

        {/* Current User Bottom Sticky Bar */}
        {data?.currentUserRank && (
          <div className="p-3 bg-amber-500/10 border-t border-amber-200 dark:border-amber-800/60 px-5 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Sparkles className="h-4 w-4 text-[#FF8928]" />
              <span className="text-xs font-semibold text-gray-800 dark:text-gray-200">
                Peringkat Anda:{' '}
                <strong className="text-[#002446] dark:text-amber-400">
                  #{data.currentUserRank.rank}
                </strong>{' '}
                dari {data.totalStudents} siswa
              </span>
            </div>
            <span className="text-xs font-bold text-[#FF8928]">
              {data.currentUserRank.xp.toLocaleString()} XP
            </span>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
