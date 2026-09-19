'use client';

import { useState, useEffect } from 'react';
import { useTranslations, useLocale } from 'next-intl';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Calendar as CalendarIcon,
  ChevronLeft,
  ChevronRight,
  Plus,
  Download,
  Clock,
  MapPin,
  HelpCircle,
  ClipboardList,
  CalendarCheck,
  Filter,
  Loader2,
  CalendarDays,
  List,
} from 'lucide-react';
import {
  CalendarItem,
  getCalendarEvents,
  deleteCalendarEvent,
  exportCalendarIcs,
} from '@/lib/actions/calendar';
import { EventDialog } from './event-dialog';
import { EventDetailDialog } from './event-detail-dialog';

interface CalendarViewProps {
  userRole: string;
  courses: Array<{ id: string; title: string }>;
  initialEvents?: CalendarItem[];
}

export function CalendarView({
  userRole,
  courses,
  initialEvents = [],
}: CalendarViewProps) {
  const t = useTranslations('calendar');
  const locale = useLocale();
  const dateLocale = locale === 'id' ? 'id-ID' : 'en-US';

  const [currentDate, setCurrentDate] = useState(new Date());
  const [viewMode, setViewMode] = useState<'MONTH' | 'WEEK' | 'AGENDA'>('MONTH');
  const [categoryFilter, setCategoryFilter] = useState('ALL');
  const [courseFilter, setCourseFilter] = useState('ALL');
  const [events, setEvents] = useState<CalendarItem[]>(initialEvents);
  const [loading, setLoading] = useState(false);

  // Dialog states
  const [eventDialogOpen, setEventDialogOpen] = useState(false);
  const [editingItem, setEditingItem] = useState<CalendarItem | null>(null);
  const [detailDialogOpen, setDetailDialogOpen] = useState(false);
  const [selectedItem, setSelectedItem] = useState<CalendarItem | null>(null);
  const [clickedDate, setClickedDate] = useState<Date | null>(null);

  // Dynamic day names Mon -> Sun
  const dayNames = Array.from({ length: 7 }, (_, i) => {
    const d = new Date(2026, 0, 5 + i);
    return d.toLocaleDateString(dateLocale, { weekday: 'long' });
  });

  const shortDayNames = Array.from({ length: 7 }, (_, i) => {
    const d = new Date(2026, 0, 5 + i);
    return d.toLocaleDateString(dateLocale, { weekday: 'short' });
  });

  const loadEvents = async () => {
    setLoading(true);
    try {
      const data = await getCalendarEvents({
        month: currentDate.getMonth(),
        year: currentDate.getFullYear(),
        courseId: courseFilter,
        category: categoryFilter,
      });
      setEvents(data);
    } catch (err) {
      console.error('Failed to load events:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadEvents();
  }, [currentDate.getMonth(), currentDate.getFullYear(), courseFilter, categoryFilter]);

  // Default to AGENDA view on mobile screens (< 768px)
  useEffect(() => {
    if (typeof window !== 'undefined' && window.innerWidth < 768) {
      setViewMode('AGENDA');
    }
  }, []);

  // Calendar calculations
  const year = currentDate.getFullYear();
  const month = currentDate.getMonth();

  const prevMonth = () => {
    setCurrentDate(new Date(year, month - 1, 1));
  };

  const nextMonth = () => {
    setCurrentDate(new Date(year, month + 1, 1));
  };

  const goToToday = () => {
    setCurrentDate(new Date());
  };

  const prevWeek = () => {
    const d = new Date(currentDate);
    d.setDate(d.getDate() - 7);
    setCurrentDate(d);
  };

  const nextWeek = () => {
    const d = new Date(currentDate);
    d.setDate(d.getDate() + 7);
    setCurrentDate(d);
  };

  // Month grid dates
  const firstDayOfMonth = new Date(year, month, 1).getDay(); // 0 = Sun
  const adjustedFirstDay = (firstDayOfMonth + 6) % 7; // Mon = 0
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const daysInPrevMonth = new Date(year, month, 0).getDate();

  // Export to iCal (.ics)
  const handleExportIcs = async () => {
    try {
      const icsString = await exportCalendarIcs(events);
      const blob = new Blob([icsString], { type: 'text/calendar;charset=utf-8' });
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', `lenterabelajar-kalender-${year}-${month + 1}.ics`);
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    } catch (err) {
      console.error('Failed to export iCal:', err);
    }
  };

  const handleDeleteEvent = async (id: string) => {
    try {
      await deleteCalendarEvent(id);
      loadEvents();
    } catch (err) {
      console.error('Failed to delete event:', err);
    }
  };

  // Helper to check if dates match
  const isSameDay = (d1: Date, d2: Date) => {
    return (
      d1.getDate() === d2.getDate() &&
      d1.getMonth() === d2.getMonth() &&
      d1.getFullYear() === d2.getFullYear()
    );
  };

  // Events on specific day
  const getEventsForDay = (targetDate: Date) => {
    return events.filter((ev) => {
      const evDate = new Date(ev.startDate);
      return isSameDay(evDate, targetDate);
    });
  };

  // Week View calculation (Monday to Sunday)
  const getWeekDays = () => {
    const current = new Date(currentDate);
    const day = current.getDay();
    const diffToMonday = current.getDate() - day + (day === 0 ? -6 : 1);
    const monday = new Date(current.setDate(diffToMonday));

    const weekDays: Date[] = [];
    for (let i = 0; i < 7; i++) {
      const d = new Date(monday);
      d.setDate(monday.getDate() + i);
      weekDays.push(d);
    }
    return weekDays;
  };

  // Group events by date for Agenda View
  const groupedAgendaEvents = events.reduce((acc, ev) => {
    const d = new Date(ev.startDate).toDateString();
    if (!acc[d]) acc[d] = [];
    acc[d].push(ev);
    return acc;
  }, {} as Record<string, CalendarItem[]>);

  const sortedAgendaDates = Object.keys(groupedAgendaEvents).sort(
    (a, b) => new Date(a).getTime() - new Date(b).getTime()
  );

  return (
    <div className="space-y-4">
      {/* Header Controls & Filter Bar */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 bg-white dark:bg-gray-900 p-4 rounded-xl border border-gray-200 dark:border-gray-800 shadow-xs">
        {/* Left: Month / Week Navigation */}
        <div className="flex items-center gap-2">
          <div className="flex items-center border border-gray-200 dark:border-gray-700 rounded-lg p-0.5 bg-gray-50 dark:bg-gray-800">
            <button
              type="button"
              onClick={viewMode === 'WEEK' ? prevWeek : prevMonth}
              className="p-1.5 rounded-md hover:bg-white dark:hover:bg-gray-700 text-gray-600 dark:text-gray-300"
              aria-label="Previous"
            >
              <ChevronLeft className="h-4 w-4" />
            </button>
            <button
              type="button"
              onClick={viewMode === 'WEEK' ? nextWeek : nextMonth}
              className="p-1.5 rounded-md hover:bg-white dark:hover:bg-gray-700 text-gray-600 dark:text-gray-300"
              aria-label="Next"
            >
              <ChevronRight className="h-4 w-4" />
            </button>
          </div>

          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={goToToday}
            className="text-xs h-8"
          >
            {t('today')}
          </Button>

          <h2 className="text-base sm:text-lg font-bold text-[#002446] dark:text-white ml-2">
            {new Date(year, month, 1).toLocaleDateString(dateLocale, { month: 'long' })} {year}
          </h2>
          {loading && <Loader2 className="h-4 w-4 animate-spin text-[#FF8928]" />}
        </div>

        {/* Right: View Switcher & Action Buttons */}
        <div className="flex flex-wrap items-center gap-2">
          {/* View Mode Switcher */}
          <div className="flex items-center p-1 bg-gray-100 dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700">
            <button
              type="button"
              onClick={() => setViewMode('MONTH')}
              className={`px-2.5 py-1 rounded-md text-xs font-semibold transition-all ${
                viewMode === 'MONTH'
                  ? 'bg-white dark:bg-gray-900 text-[#002446] dark:text-white shadow-xs'
                  : 'text-gray-500 hover:text-gray-800'
              }`}
            >
              {t('month')}
            </button>
            <button
              type="button"
              onClick={() => setViewMode('WEEK')}
              className={`px-2.5 py-1 rounded-md text-xs font-semibold transition-all ${
                viewMode === 'WEEK'
                  ? 'bg-white dark:bg-gray-900 text-[#002446] dark:text-white shadow-xs'
                  : 'text-gray-500 hover:text-gray-800'
              }`}
            >
              {t('week')}
            </button>
            <button
              type="button"
              onClick={() => setViewMode('AGENDA')}
              className={`px-2.5 py-1 rounded-md text-xs font-semibold transition-all ${
                viewMode === 'AGENDA'
                  ? 'bg-white dark:bg-gray-900 text-[#002446] dark:text-white shadow-xs'
                  : 'text-gray-500 hover:text-gray-800'
              }`}
            >
              {t('agenda')}
            </button>
          </div>

          {/* Export iCal */}
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={handleExportIcs}
            className="text-xs h-8 border-gray-300 text-gray-700 dark:text-gray-200 flex items-center gap-1.5"
            title={t('exportIcalTooltip')}
          >
            <Download className="h-3.5 w-3.5 text-gray-500" />
            <span className="hidden sm:inline">{t('exportIcal')}</span>
          </Button>

          {/* Add Custom Event */}
          <Button
            type="button"
            size="sm"
            onClick={() => {
              setEditingItem(null);
              setClickedDate(new Date());
              setEventDialogOpen(true);
            }}
            className="bg-[#FF8928] hover:bg-[#ff7b10] text-white font-bold text-xs h-8 flex items-center gap-1.5 shadow-xs"
          >
            <Plus className="h-4 w-4" />
            {t('addEvent')}
          </Button>
        </div>
      </div>

      {/* Filter Row */}
      <div className="flex flex-wrap items-center justify-between gap-3 bg-white dark:bg-gray-900 px-4 py-3 rounded-xl border border-gray-200 dark:border-gray-800">
        {/* Category Pills */}
        <div className="flex flex-wrap items-center gap-1.5">
          <span className="text-xs font-semibold text-gray-500 flex items-center gap-1 mr-1">
            <Filter className="h-3.5 w-3.5 text-gray-400" /> Filter:
          </span>
          {[
            { id: 'ALL', label: t('allCategories') },
            { id: 'KUIS', label: t('catQuiz') },
            { id: 'TUGAS', label: t('catAssignment') },
            { id: 'PRESENSI', label: t('catAttendance') },
            { id: 'SEKOLAH', label: t('catSchool') },
            { id: 'KELAS', label: t('catClass') },
            { id: 'PRIBADI', label: t('catPersonal') },
          ].map((cat) => (
            <button
              type="button"
              key={cat.id}
              onClick={() => setCategoryFilter(cat.id)}
              className={`px-2.5 py-1 rounded-full text-xs font-medium transition-all ${
                categoryFilter === cat.id
                  ? 'bg-[#002446] text-white'
                  : 'bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-300 hover:bg-gray-200'
              }`}
            >
              {cat.label}
            </button>
          ))}
        </div>

        {/* Course Filter Dropdown */}
        {courses.length > 0 && (
          <div className="w-full sm:w-auto min-w-[200px]">
            <Select value={courseFilter} onValueChange={setCourseFilter}>
              <SelectTrigger className="text-xs h-8">
                <SelectValue placeholder={t('allCourses')} />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="ALL">{t('allCourses')}</SelectItem>
                {courses.map((c) => (
                  <SelectItem key={c.id} value={c.id}>
                    {c.title}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        )}
      </div>

      {/* 1. MONTH VIEW */}
      {viewMode === 'MONTH' && (
        <Card className="border shadow-xs bg-white dark:bg-gray-900 overflow-hidden">
          {/* Days Header */}
          <div className="grid grid-cols-7 border-b border-gray-200 dark:border-gray-800 bg-gray-50/75 dark:bg-gray-800/50">
            {dayNames.map((d) => (
              <div
                key={d}
                className="py-2.5 text-center text-xs font-bold text-[#002446] dark:text-gray-200 uppercase tracking-wider"
              >
                <span className="hidden sm:inline">{d}</span>
                <span className="sm:hidden">{d.slice(0, 3)}</span>
              </div>
            ))}
          </div>

          {/* Days Grid */}
          <div className="grid grid-cols-7 divide-x divide-y divide-gray-200 dark:divide-gray-800">
            {/* Previous month empty days */}
            {Array.from({ length: adjustedFirstDay }).map((_, i) => {
              const dayNum = daysInPrevMonth - adjustedFirstDay + i + 1;
              return (
                <div
                  key={`prev-${i}`}
                  className="min-h-[100px] sm:min-h-[120px] p-1.5 bg-gray-50/30 dark:bg-gray-950/20 text-gray-300 dark:text-gray-700 text-xs font-semibold"
                >
                  {dayNum}
                </div>
              );
            })}

            {/* Current month days */}
            {Array.from({ length: daysInMonth }).map((_, i) => {
              const dayNum = i + 1;
              const cellDate = new Date(year, month, dayNum);
              const dayEvents = getEventsForDay(cellDate);
              const today = isSameDay(cellDate, new Date());

              return (
                <div
                  key={`cur-${dayNum}`}
                  onClick={() => {
                    setClickedDate(cellDate);
                  }}
                  className={`min-h-[100px] sm:min-h-[120px] p-1.5 flex flex-col justify-between transition-colors hover:bg-blue-50/20 dark:hover:bg-gray-800/40 ${
                    today ? 'bg-amber-50/30 dark:bg-amber-950/10' : ''
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <span
                      className={`h-6 w-6 rounded-full flex items-center justify-center text-xs font-bold ${
                        today
                          ? 'bg-[#FF8928] text-white shadow-xs'
                          : 'text-gray-700 dark:text-gray-200'
                      }`}
                    >
                      {dayNum}
                    </span>

                    {/* Quick add on hover */}
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        setEditingItem(null);
                        setClickedDate(cellDate);
                        setEventDialogOpen(true);
                      }}
                      className="opacity-0 hover:opacity-100 p-0.5 text-gray-400 hover:text-blue-600 rounded"
                      title={t('quickAddTitle')}
                    >
                      <Plus className="h-3.5 w-3.5" />
                    </button>
                  </div>

                  {/* Events list in cell */}
                  <div className="space-y-1 my-1 overflow-hidden flex-1">
                    {dayEvents.slice(0, 3).map((ev) => (
                      <div
                        key={ev.id}
                        onClick={(e) => {
                          e.stopPropagation();
                          setSelectedItem(ev);
                          setDetailDialogOpen(true);
                        }}
                        className="px-1.5 py-0.5 rounded text-[11px] font-medium truncate cursor-pointer transition-all hover:opacity-80 flex items-center gap-1 shadow-2xs"
                        style={{
                          backgroundColor: `${ev.color || '#3b82f6'}18`,
                          borderLeft: `3px solid ${ev.color || '#3b82f6'}`,
                          color: ev.color || '#3b82f6',
                        }}
                      >
                        <span className="truncate">{ev.title}</span>
                      </div>
                    ))}
                    {dayEvents.length > 3 && (
                      <span
                        onClick={() => {
                          setClickedDate(cellDate);
                          setViewMode('AGENDA');
                        }}
                        className="text-[10px] font-bold text-gray-500 hover:text-blue-600 cursor-pointer block pl-1"
                      >
                        {t('moreEvents', { count: dayEvents.length - 3 })}
                      </span>
                    )}
                  </div>
                </div>
              );
            })}

            {/* Next month filling */}
            {Array.from({
              length: (7 - ((adjustedFirstDay + daysInMonth) % 7)) % 7,
            }).map((_, i) => (
              <div
                key={`next-${i}`}
                className="min-h-[100px] sm:min-h-[120px] p-1.5 bg-gray-50/30 dark:bg-gray-950/20 text-gray-300 dark:text-gray-700 text-xs font-semibold"
              >
                {i + 1}
              </div>
            ))}
          </div>
        </Card>
      )}

      {/* 2. WEEK VIEW */}
      {viewMode === 'WEEK' && (
        <Card className="border shadow-xs bg-white dark:bg-gray-900 overflow-hidden">
          <div className="grid grid-cols-1 md:grid-cols-7 divide-y md:divide-y-0 md:divide-x divide-gray-200 dark:divide-gray-800">
            {getWeekDays().map((d, index) => {
              const dayEvents = getEventsForDay(d);
              const today = isSameDay(d, new Date());

              return (
                <div key={d.toISOString()} className="min-h-[300px] flex flex-col">
                  {/* Day Column Header */}
                  <div
                    className={`p-3 border-b text-center ${
                      today
                        ? 'bg-amber-100 dark:bg-amber-950/40 text-amber-900 dark:text-amber-300 font-bold'
                        : 'bg-gray-50 dark:bg-gray-800/40 text-gray-700 dark:text-gray-300'
                    }`}
                  >
                    <div className="text-[11px] uppercase tracking-wider font-semibold">
                      {shortDayNames[index]}
                    </div>
                    <div className="text-lg font-black">{d.getDate()}</div>
                  </div>

                  {/* Day Events */}
                  <div className="p-2 space-y-2 flex-1">
                    {dayEvents.length === 0 ? (
                      <p className="text-[11px] text-gray-300 dark:text-gray-600 text-center pt-8">
                        {t('emptyDay')}
                      </p>
                    ) : (
                      dayEvents.map((ev) => (
                        <div
                          key={ev.id}
                          onClick={() => {
                            setSelectedItem(ev);
                            setDetailDialogOpen(true);
                          }}
                          className="p-2.5 rounded-lg border text-xs cursor-pointer hover:shadow-xs transition-all space-y-1"
                          style={{
                            borderLeft: `4px solid ${ev.color || '#3b82f6'}`,
                            backgroundColor: `${ev.color || '#3b82f6'}08`,
                          }}
                        >
                          <div className="font-bold text-gray-900 dark:text-gray-100 leading-tight">
                            {ev.title}
                          </div>
                          {ev.courseTitle && (
                            <div className="text-[10px] text-gray-500 truncate">
                              {ev.courseTitle}
                            </div>
                          )}
                          <div className="text-[10px] text-gray-400 flex items-center gap-1">
                            <Clock className="h-3 w-3" />
                            {ev.isAllDay
                              ? t('allDay')
                              : new Date(ev.startDate).toLocaleTimeString(dateLocale, {
                                  hour: '2-digit',
                                  minute: '2-digit',
                                })}
                          </div>
                        </div>
                      ))
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </Card>
      )}

      {/* 3. AGENDA / LIST VIEW (Mobile-friendly) */}
      {viewMode === 'AGENDA' && (
        <div className="space-y-4">
          {sortedAgendaDates.length === 0 ? (
            <Card className="p-8 text-center text-gray-400 text-xs">
              {t('noEventsFound')}
            </Card>
          ) : (
            sortedAgendaDates.map((dateStr) => {
              const dayEvents = groupedAgendaEvents[dateStr];
              const dateObj = new Date(dateStr);
              const today = isSameDay(dateObj, new Date());

              return (
                <div key={dateStr} className="space-y-2">
                  {/* Date Header */}
                  <div className="flex items-center gap-2">
                    <span
                      className={`text-xs font-black uppercase px-2.5 py-0.5 rounded-full ${
                        today
                          ? 'bg-[#FF8928] text-white'
                          : 'bg-[#002446] text-white'
                      }`}
                    >
                      {dateObj.toLocaleDateString(dateLocale, {
                        weekday: 'long',
                        day: 'numeric',
                        month: 'long',
                        year: 'numeric',
                      })}
                    </span>
                    <span className="text-xs text-gray-400">
                      {t('eventsCount', { count: dayEvents.length })}
                    </span>
                  </div>

                  {/* List of Events */}
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    {dayEvents.map((ev) => (
                      <Card
                        key={ev.id}
                        onClick={() => {
                          setSelectedItem(ev);
                          setDetailDialogOpen(true);
                        }}
                        className="border hover:border-blue-300 transition-all cursor-pointer shadow-2xs hover:shadow-sm"
                        style={{ borderLeft: `4px solid ${ev.color || '#3b82f6'}` }}
                      >
                        <CardContent className="p-3.5 space-y-2">
                          <div className="flex items-start justify-between gap-2">
                            <h4 className="text-xs font-bold text-gray-900 dark:text-gray-100 line-clamp-1">
                              {ev.title}
                            </h4>
                            <Badge variant="outline" className="text-[10px] shrink-0">
                              {ev.category}
                            </Badge>
                          </div>

                          <div className="flex items-center gap-3 text-[11px] text-gray-500">
                            <span className="flex items-center gap-1">
                              <Clock className="h-3.5 w-3.5 text-amber-500" />
                              {ev.isAllDay
                                ? t('allDay')
                                : new Date(ev.startDate).toLocaleTimeString(dateLocale, {
                                    hour: '2-digit',
                                    minute: '2-digit',
                                  })}
                            </span>

                            {ev.courseTitle && (
                              <span className="truncate">{ev.courseTitle}</span>
                            )}
                          </div>

                          {ev.description && (
                            <p className="text-[11px] text-gray-600 dark:text-gray-400 line-clamp-2">
                              {ev.description}
                            </p>
                          )}
                        </CardContent>
                      </Card>
                    ))}
                  </div>
                </div>
              );
            })
          )}
        </div>
      )}

      {/* Dialogs */}
      <EventDialog
        open={eventDialogOpen}
        onOpenChange={setEventDialogOpen}
        userRole={userRole}
        courses={courses}
        defaultDate={clickedDate}
        editItem={editingItem}
        onSuccess={loadEvents}
      />

      <EventDetailDialog
        item={selectedItem}
        open={detailDialogOpen}
        onOpenChange={setDetailDialogOpen}
        onEdit={(item) => {
          setEditingItem(item);
          setEventDialogOpen(true);
        }}
        onDelete={handleDeleteEvent}
      />
    </div>
  );
}
