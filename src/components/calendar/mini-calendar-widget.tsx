'use client';

import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Calendar as CalendarIcon,
  ChevronLeft,
  ChevronRight,
  Clock,
  ArrowRight,
  HelpCircle,
  ClipboardList,
  CalendarCheck,
  Bookmark,
} from 'lucide-react';
import { Link } from '@/i18n/navigation';
import { useTranslations, useLocale } from 'next-intl';
import { CalendarItem, getCalendarEvents } from '@/lib/actions/calendar';
import { EventDetailDialog } from './event-detail-dialog';

export function MiniCalendarWidget() {
  const t = useTranslations('calendarWidget');
  const locale = useLocale();
  const [currentDate, setCurrentDate] = useState(new Date());
  const [selectedDate, setSelectedDate] = useState<Date>(new Date());
  const [events, setEvents] = useState<CalendarItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedEvent, setSelectedEvent] = useState<CalendarItem | null>(null);
  const [detailOpen, setDetailOpen] = useState(false);

  useEffect(() => {
    let isMounted = true;
    setLoading(true);
    getCalendarEvents({
      month: currentDate.getMonth(),
      year: currentDate.getFullYear(),
    })
      .then((data) => {
        if (isMounted) {
          setEvents(data);
          setLoading(false);
        }
      })
      .catch(() => {
        if (isMounted) setLoading(false);
      });

    return () => {
      isMounted = false;
    };
  }, [currentDate.getMonth(), currentDate.getFullYear()]);

  // Calendar math
  const year = currentDate.getFullYear();
  const month = currentDate.getMonth();

  const firstDayIndex = new Date(year, month, 1).getDay(); // 0 = Sun
  const adjustedFirstDay = (firstDayIndex + 6) % 7; // Monday = 0
  const daysInMonth = new Date(year, month + 1, 0).getDate();

  const prevMonth = () => {
    setCurrentDate(new Date(year, month - 1, 1));
  };

  const nextMonth = () => {
    setCurrentDate(new Date(year, month + 1, 1));
  };

  const isToday = (d: number) => {
    const today = new Date();
    return (
      d === today.getDate() &&
      month === today.getMonth() &&
      year === today.getFullYear()
    );
  };

  const isSelected = (d: number) => {
    return (
      d === selectedDate.getDate() &&
      month === selectedDate.getMonth() &&
      year === selectedDate.getFullYear()
    );
  };

  // Check if date has events
  const getEventsForDay = (day: number) => {
    return events.filter((ev) => {
      const evDate = new Date(ev.startDate);
      return (
        evDate.getDate() === day &&
        evDate.getMonth() === month &&
        evDate.getFullYear() === year
      );
    });
  };

  // Filter events for selected date, or upcoming next 3 days
  const selectedDayEvents = events.filter((ev) => {
    const evDate = new Date(ev.startDate);
    return (
      evDate.getDate() === selectedDate.getDate() &&
      evDate.getMonth() === selectedDate.getMonth() &&
      evDate.getFullYear() === selectedDate.getFullYear()
    );
  });

    const dayNames = locale === 'en'
      ? ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun']
      : ['Sen', 'Sel', 'Rab', 'Kam', 'Jum', 'Sab', 'Min'];

    const formattedMonthYear = new Date(year, month, 1).toLocaleDateString(
      locale === 'en' ? 'en-US' : 'id-ID',
      { month: 'long', year: 'numeric' }
    );

    return (
      <Card className="border shadow-xs bg-white dark:bg-gray-900 overflow-hidden">
        <CardHeader className="p-4 pb-3 border-b flex flex-row items-center justify-between">
          <div className="flex items-center gap-2">
            <CalendarIcon className="h-4 w-4 text-[#FF8928]" />
            <CardTitle className="text-xs font-bold text-[#002446] dark:text-gray-100 uppercase tracking-wider">
              {t('title')}
            </CardTitle>
          </div>
          <Link
            href="/calendar"
            className="text-[11px] font-semibold text-blue-600 hover:text-blue-800 flex items-center gap-1"
          >
            {t('viewAll')} <ArrowRight className="h-3 w-3" />
          </Link>
        </CardHeader>

        <CardContent className="p-4 space-y-4">
          {/* Month Navigation */}
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-gray-900 dark:text-gray-100 capitalize">
              {formattedMonthYear}
            </span>
          <div className="flex items-center gap-1">
            <button
              type="button"
              onClick={prevMonth}
              className="p-1 rounded-md hover:bg-gray-100 dark:hover:bg-gray-800 text-gray-500"
              aria-label="Previous month"
            >
              <ChevronLeft className="h-4 w-4" />
            </button>
            <button
              type="button"
              onClick={nextMonth}
              className="p-1 rounded-md hover:bg-gray-100 dark:hover:bg-gray-800 text-gray-500"
              aria-label="Next month"
            >
              <ChevronRight className="h-4 w-4" />
            </button>
          </div>
        </div>

        {/* Days Header */}
        <div className="grid grid-cols-7 gap-1 text-center">
          {dayNames.map((d) => (
            <div key={d} className="text-[10px] font-bold text-gray-400 py-0.5">
              {d}
            </div>
          ))}

          {/* Empty prefix slots */}
          {Array.from({ length: adjustedFirstDay }).map((_, i) => (
            <div key={`empty-${i}`} className="h-7" />
          ))}

          {/* Days */}
          {Array.from({ length: daysInMonth }).map((_, i) => {
            const dayNum = i + 1;
            const dayEvents = getEventsForDay(dayNum);
            const hasEvents = dayEvents.length > 0;
            const today = isToday(dayNum);
            const selected = isSelected(dayNum);

            return (
              <button
                type="button"
                key={`day-${dayNum}`}
                onClick={() => setSelectedDate(new Date(year, month, dayNum))}
                className={`h-7 w-full rounded-md text-xs font-semibold flex flex-col items-center justify-center relative transition-colors ${
                  selected
                    ? 'bg-[#002446] text-white'
                    : today
                    ? 'bg-amber-100 text-amber-900 dark:bg-amber-900/40 dark:text-amber-300 font-black'
                    : 'text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800'
                }`}
              >
                <span>{dayNum}</span>
                {hasEvents && !selected && (
                  <span
                    className="absolute bottom-0.5 h-1 w-1 rounded-full bg-[#FF8928]"
                  />
                )}
              </button>
            );
          })}
        </div>

        {/* Selected Date Agenda Preview */}
        <div className="pt-3 border-t border-gray-100 dark:border-gray-800 space-y-2">
          <div className="flex items-center justify-between text-[11px] text-gray-500">
            <span className="font-semibold">
              {locale === 'en' ? 'Agenda ' : 'Agenda '}
              {selectedDate.toLocaleDateString(locale === 'en' ? 'en-US' : 'id-ID', {
                day: 'numeric',
                month: 'short',
              })}
            </span>
            <span>{selectedDayEvents.length} {locale === 'en' ? 'Events' : 'Kegiatan'}</span>
          </div>

          {selectedDayEvents.length === 0 ? (
            <p className="text-[11px] text-gray-400 italic py-1 text-center">
              {t('noEvents')}
            </p>
          ) : (
            <div className="space-y-1.5 max-h-40 overflow-y-auto">
              {selectedDayEvents.map((ev) => (
                <div
                  key={ev.id}
                  onClick={() => {
                    setSelectedEvent(ev);
                    setDetailOpen(true);
                  }}
                  className="flex items-center justify-between p-2 rounded-lg bg-gray-50 dark:bg-gray-800/60 hover:bg-gray-100 dark:hover:bg-gray-800 cursor-pointer transition-colors text-xs border border-gray-100 dark:border-gray-700/60"
                >
                  <div className="flex items-center gap-2 min-w-0">
                    <span
                      className="w-2 h-2 rounded-full shrink-0"
                      style={{ backgroundColor: ev.color || '#3b82f6' }}
                    />
                    <div className="min-w-0">
                      <p className="font-semibold text-gray-900 dark:text-gray-100 truncate text-[11px]">
                        {ev.title}
                      </p>
                      {ev.courseTitle && (
                        <p className="text-[10px] text-gray-400 truncate">
                          {ev.courseTitle}
                        </p>
                      )}
                    </div>
                  </div>

                  <span className="text-[10px] text-gray-500 shrink-0">
                    {ev.isAllDay
                      ? (locale === 'en' ? 'All Day' : 'Seharian')
                      : new Date(ev.startDate).toLocaleTimeString(locale === 'en' ? 'en-US' : 'id-ID', {
                          hour: '2-digit',
                          minute: '2-digit',
                        })}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>
      </CardContent>

      <EventDetailDialog
        item={selectedEvent}
        open={detailOpen}
        onOpenChange={setDetailOpen}
      />
    </Card>
  );
}
