import { auth } from '@/lib/auth';
import { redirect } from 'next/navigation';
import { getCalendarEvents, getUserCoursesForCalendar } from '@/lib/actions/calendar';
import { CalendarView } from '@/components/calendar/calendar-view';

export default async function CalendarPage() {
  const session = await auth();
  if (!session?.user) {
    redirect('/login');
  }

  const [initialEvents, courses] = await Promise.all([
    getCalendarEvents(),
    getUserCoursesForCalendar(),
  ]);

  return (
    <div className="space-y-4">
      <div>
        <div className="text-xs font-semibold text-[#FF8928] uppercase tracking-wider">
          Jadwal & Agenda
        </div>
        <h1 className="text-2xl font-bold text-[#002446] dark:text-white">
          Kalender Akademik Terpadu
        </h1>
        <p className="text-sm text-gray-500 dark:text-gray-400">
          Pantau tenggat pengumpulan tugas, jadwal ujian CBT, sesi presensi kelas, dan agenda kegiatan sekolah dalam satu kalender interaktif.
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
