import { auth } from '@/lib/auth';
import { redirect } from 'next/navigation';
import { getTranslations } from 'next-intl/server';
import { getCalendarEvents, getUserCoursesForCalendar } from '@/lib/actions/calendar';
import { CalendarView } from '@/components/calendar/calendar-view';

export default async function CalendarPage() {
  const session = await auth();
  if (!session?.user) {
    redirect('/login');
  }

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
        userRole={session.user.role}
        courses={courses}
        initialEvents={initialEvents}
      />
    </div>
  );
}
