import { getTranslations, getLocale } from 'next-intl/server';
import { auth } from '@/lib/auth';
import { db } from '@/lib/db';
import { getStudentUpcomingDeadlines } from '@/lib/actions/notification';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  BookOpen,
  CheckCircle,
  Clock,
  AlertTriangle,
  ArrowRight,
  ClipboardList,
  HelpCircle,
  Calendar,
  Sparkles,
  CheckCircle2,
} from 'lucide-react';
import { Link } from '@/i18n/navigation';
import { getUserGamificationProfile } from '@/lib/actions/gamification';
import { BADGE_CATALOG } from '@/lib/gamification-constants';
import { Flame, Medal, Award } from 'lucide-react';
import { MiniCalendarWidget } from '@/components/calendar/mini-calendar-widget';
import { getActiveSchoolAnnouncementsForUser } from '@/lib/actions/school-announcement';
import { SchoolAnnouncementsWidget } from '@/components/announcements/school-announcements-widget';

export default async function StudentDashboard() {
  const session = await auth();
  const locale = await getLocale();
  const t = await getTranslations('dashboard');
  const tStudent = await getTranslations('studentDashboard');

  if (!session?.user) return null;

  const [enrollments, upcomingDeadlines, gamificationProfile, announcements] = await Promise.all([
    db.enrollment.findMany({
      where: { userId: session.user.id },
      include: {
        course: {
          include: {
            teacher: { select: { id: true, name: true } },
            category: { select: { name: true } },
            academicYear: { select: { name: true } },
            _count: { select: { modules: true } },
          },
        },
      },
      orderBy: { createdAt: 'desc' },
      take: 6,
    }),
    getStudentUpcomingDeadlines(),
    getUserGamificationProfile(session.user.id),
    getActiveSchoolAnnouncementsForUser(),
  ]);

  const enrollmentCount = enrollments.length;
  const urgentCount = upcomingDeadlines.filter((d) => d.isUrgent).length;

  return (
    <div className="space-y-6">
      {/* School Announcements Banner & Widget */}
      <SchoolAnnouncementsWidget announcements={announcements} />

      {/* Welcome Banner */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-linear-to-r from-[#002446] to-[#013567] text-white p-6 rounded-2xl shadow-sm">
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <Sparkles className="h-5 w-5 text-[#FF8928]" />
            <h1 className="text-2xl font-bold">
              {t('welcome', { name: session.user.name })}
            </h1>
          </div>
          <p className="text-xs text-white/80">
            {tStudent('welcomeBanner')}
          </p>
        </div>

        <Link href="/student/my-courses">
          <Button className="bg-[#FF8928] hover:bg-[#ff7b10] text-white font-bold text-xs shrink-0">
            {tStudent('viewAllCourses')}
          </Button>
        </Link>
      </div>

      {/* Gamification Progress Widget */}
      {gamificationProfile && (
        <Card className="border border-amber-200/80 bg-linear-to-r from-amber-50/40 via-white to-orange-50/30 dark:from-gray-900 dark:via-gray-900 dark:to-gray-800 shadow-sm overflow-hidden">
          <CardContent className="p-5">
            <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-5">
              {/* Level & Title */}
              <div className="flex items-center gap-4">
                <div className="w-14 h-14 rounded-2xl bg-linear-to-br from-amber-400 to-[#FF8928] text-white flex flex-col items-center justify-center font-black shadow-md shrink-0">
                  <span className="text-[10px] uppercase tracking-wider font-bold">{tStudent('level')}</span>
                  <span className="text-xl leading-none">{gamificationProfile.level}</span>
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <h2 className="text-lg font-bold text-[#002446] dark:text-gray-100">
                      {gamificationProfile.title}
                    </h2>
                    <Badge className="bg-amber-100 text-amber-900 dark:bg-amber-900/50 dark:text-amber-300 border-amber-300 text-[11px]">
                      {gamificationProfile.totalXp.toLocaleString()} XP
                    </Badge>
                  </div>
                  <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
                    {gamificationProfile.level < 10
                      ? tStudent('xpToNext', { xp: gamificationProfile.nextLevelRequiredXp - gamificationProfile.currentLevelXp })
                      : tStudent('maxLevel')}
                  </p>
                </div>
              </div>

              {/* XP Progress Bar to Next Level */}
              <div className="flex-1 max-w-md space-y-1.5">
                <div className="flex justify-between text-xs font-semibold">
                  <span className="text-gray-600 dark:text-gray-400">
                    {tStudent('level')} {gamificationProfile.level + 1}
                  </span>
                  <span className="text-[#FF8928] font-bold">
                    {gamificationProfile.currentLevelXp} / {gamificationProfile.nextLevelRequiredXp} XP ({gamificationProfile.progressPercent}%)
                  </span>
                </div>
                <div className="w-full bg-gray-100 dark:bg-gray-800 h-2.5 rounded-full overflow-hidden border border-gray-200 dark:border-gray-700">
                  <div
                    className="bg-linear-to-r from-amber-400 to-[#FF8928] h-full rounded-full transition-all duration-500"
                    style={{ width: `${gamificationProfile.progressPercent}%` }}
                  />
                </div>
              </div>

              {/* Streak Flame & Achievements Link */}
              <div className="flex items-center gap-3 shrink-0">
                <div className="flex items-center gap-2 px-3.5 py-2 rounded-xl bg-orange-500/10 border border-orange-500/20 text-orange-600 dark:text-orange-400">
                  <Flame className="h-5 w-5 fill-orange-500 text-orange-500 animate-pulse" />
                  <div>
                    <div className="text-xs font-black leading-none">{tStudent('days', { count: gamificationProfile.streakDays })}</div>
                    <div className="text-[10px] text-gray-500 dark:text-gray-400">{tStudent('learningStreak')}</div>
                  </div>
                </div>

                <Link href="/student/achievements">
                  <Button
                    variant="outline"
                    size="sm"
                    className="text-xs border-[#002446] text-[#002446] hover:bg-blue-50 dark:border-blue-400 dark:text-blue-300 dark:hover:bg-gray-800 flex items-center gap-1.5"
                  >
                    <Award className="h-4 w-4 text-amber-500" />
                    {tStudent('badgesEarned')} ({gamificationProfile.totalAchievementsCount})
                  </Button>
                </Link>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Summary Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <Card className="bg-white border shadow-xs">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-xs font-semibold text-gray-500 uppercase tracking-wider">
              {t('totalCourses')}
            </CardTitle>
            <BookOpen className="h-4 w-4 text-[#002446]" />
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-black text-[#002446]">{enrollmentCount}</p>
            <p className="text-[11px] text-gray-400 mt-0.5">{tStudent('enrolledCourses')}</p>
          </CardContent>
        </Card>

        <Card className="bg-white border shadow-xs">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-xs font-semibold text-gray-500 uppercase tracking-wider">
              {tStudent('upcomingDeadlines')}
            </CardTitle>
            <Clock className="h-4 w-4 text-amber-600" />
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-black text-amber-600">{upcomingDeadlines.length}</p>
            <p className="text-[11px] text-gray-400 mt-0.5">{tStudent('upcomingDeadlines')}</p>
          </CardContent>
        </Card>

        <Card className="bg-white border shadow-xs">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-xs font-semibold text-gray-500 uppercase tracking-wider">
              {tStudent('urgent')} (&le; 24 Jam)
            </CardTitle>
            <AlertTriangle className="h-4 w-4 text-rose-600" />
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-black text-rose-600">{urgentCount}</p>
            <p className="text-[11px] text-gray-400 mt-0.5">{tStudent('urgent')}</p>
          </CardContent>
        </Card>
      </div>

      {/* WIDGET: UPCOMING DEADLINES (< 48 JAM) */}
      {upcomingDeadlines.length > 0 && (
        <Card className="border-2 border-amber-300/80 bg-linear-to-b from-amber-50/40 to-white shadow-sm overflow-hidden">
          <CardHeader className="pb-3 border-b bg-amber-50/60 flex flex-row items-center justify-between">
            <div className="flex items-center gap-2">
              <Clock className="h-5 w-5 text-amber-600 animate-pulse" />
              <div>
                <CardTitle className="text-base font-bold text-[#002446]">
                  {tStudent('upcomingDeadlines')}
                </CardTitle>
                <p className="text-xs text-gray-600 mt-0.5">
                  {tStudent('emptyDeadlinesDesc')}
                </p>
              </div>
            </div>
            <Badge className="bg-amber-600 text-white text-xs font-bold px-2.5 py-0.5">
              {upcomingDeadlines.length}
            </Badge>
          </CardHeader>

          <CardContent className="p-0 divide-y divide-gray-100">
            {upcomingDeadlines.map((item) => {
              const isQuiz = item.type === 'QUIZ';

              return (
                <div
                  key={`${item.type}-${item.id}`}
                  className="p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3 hover:bg-amber-50/30 transition-colors"
                >
                  <div className="flex items-start gap-3 flex-1">
                    <div
                      className={`w-9 h-9 rounded-xl flex items-center justify-center shrink-0 ${
                        isQuiz ? 'bg-orange-100 text-[#FF8928]' : 'bg-purple-100 text-purple-700'
                      }`}
                    >
                      {isQuiz ? <HelpCircle className="h-5 w-5" /> : <ClipboardList className="h-5 w-5" />}
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="font-bold text-sm text-gray-900">{item.title}</span>
                        <Badge
                          variant="outline"
                          className={`text-[10px] ${
                            isQuiz
                              ? 'border-orange-300 text-orange-700 bg-orange-50'
                              : 'border-purple-300 text-purple-700 bg-purple-50'
                          }`}
                        >
                          {isQuiz ? tStudent('quizDeadline') : tStudent('assignmentDeadline')}
                        </Badge>
                      </div>
                      <p className="text-xs text-gray-500 mt-0.5">
                        {item.courseTitle} •{' '}
                        {new Date(item.deadline).toLocaleString(locale === 'en' ? 'en-US' : 'id-ID', {
                          weekday: 'short',
                          day: 'numeric',
                          month: 'short',
                          hour: '2-digit',
                          minute: '2-digit',
                        })}
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center gap-3 self-end sm:self-center shrink-0">
                    <Badge
                      className={`text-xs font-bold px-2 py-1 ${
                        item.isUrgent
                          ? 'bg-rose-100 text-rose-800 border border-rose-300'
                          : 'bg-amber-100 text-amber-800 border border-amber-300'
                      }`}
                    >
                      {item.hoursLeft <= 1 ? '< 1h' : `${item.hoursLeft}h`}
                    </Badge>

                    <Link href={item.link}>
                      <Button
                        size="sm"
                        className={`text-xs font-bold text-white flex items-center gap-1.5 ${
                          item.isUrgent
                            ? 'bg-rose-600 hover:bg-rose-700'
                            : 'bg-[#FF8928] hover:bg-[#ff7b10]'
                        }`}
                      >
                        <span>{tStudent('startLearning')}</span>
                        <ArrowRight className="h-3.5 w-3.5" />
                      </Button>
                    </Link>
                  </div>
                </div>
              );
            })}
          </CardContent>
        </Card>
      )}

      {/* Content Layout: Courses (Left 2 cols) & Mini Calendar Widget (Right 1 col) */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 items-start">
        {/* Courses Grid */}
        <div className="lg:col-span-2 space-y-3">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-bold text-[#002446]">{tStudent('enrolledCourses')}</h2>
            <Link href="/student/my-courses">
              <Button variant="ghost" size="sm" className="text-xs text-blue-700 hover:text-blue-900">
                {tStudent('viewAllCourses')} ({enrollmentCount}) &rarr;
              </Button>
            </Link>
          </div>

          {enrollments.length === 0 ? (
            <Card className="p-8 text-center text-gray-400">
              <BookOpen className="h-10 w-10 mx-auto text-gray-300 mb-2" />
              <p className="text-sm">{tStudent('emptyCoursesTitle')}</p>
              <p className="text-xs text-gray-400 mt-1">{tStudent('emptyCoursesDesc')}</p>
            </Card>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {enrollments.map((enr) => {
                const c = enr.course;
                return (
                  <Card key={c.id} className="hover:shadow-md transition-all border flex flex-col justify-between">
                    <CardHeader className="p-4 pb-2 space-y-1">
                      <span className="text-[11px] font-semibold text-[#FF8928] uppercase">
                        {c.category?.name || '-'}
                      </span>
                      <CardTitle className="text-base font-bold text-[#002446] line-clamp-1">
                        {c.title}
                      </CardTitle>
                      <p className="text-xs text-gray-500">
                        {tStudent('teacher')}: <strong>{c.teacher.name}</strong>
                      </p>
                    </CardHeader>

                    <CardContent className="p-4 pt-0">
                      <div className="flex items-center justify-between text-xs text-gray-500 pt-3 border-t">
                        <span>{c._count.modules} Modul</span>
                        <span>{c.academicYear?.name}</span>
                      </div>
                    </CardContent>

                    <div className="p-4 pt-0">
                      <Link href={`/student/course/${c.id}/modules`}>
                        <Button
                          variant="outline"
                          size="sm"
                          className="w-full text-xs border-[#002446]/30 text-[#002446] hover:bg-[#002446] hover:text-white font-semibold flex items-center justify-center gap-1"
                        >
                          <span>{tStudent('startLearning')}</span>
                          <ArrowRight className="h-3.5 w-3.5" />
                        </Button>
                      </Link>
                    </div>
                  </Card>
                );
              })}
            </div>
          )}
        </div>

        {/* Sidebar Mini Calendar */}
        <div className="space-y-4">
          <MiniCalendarWidget />
        </div>
      </div>
    </div>
  );
}
