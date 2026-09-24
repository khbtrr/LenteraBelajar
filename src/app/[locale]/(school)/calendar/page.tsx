import { requireAuth } from '@/lib/auth-utils';
import { getTranslations } from 'next-intl/server';
import { getCalendarEvents, getUserCoursesForCalendar } from '@/lib/actions/calendar';
import { CalendarView } from '@/components/calendar/calendar-view';

export default async function CalendarPage() {
  const session = await requireAuth();

  const t = await getTranslations('calendar');

  const [initialEvents, courses] = await Promise.all([
    getCalendarEvents(),
    getUserCoursesForCalendar(),
  ]);

  return (
    <div className="space-y-4">
      <div>
        <div className="text-xs font-semibold text-[#FF8928] uppercase tracking-wider">
          {t('badge')}
        </div>
        <h1 className="text-2xl font-bold text-[#002446] dark:text-white">
          {t('title')}
        </h1>
        <p className="text-sm text-gray-500 dark:text-gray-400">
          {t('subtitle')}
        </p>
      </div>

      <CalendarView
        key={session.user.schoolId || 'calendar'}
        userRole={session.user.role}
        courses={courses}
        initialEvents={initialEvents}
      />
    </div>
  );
}
