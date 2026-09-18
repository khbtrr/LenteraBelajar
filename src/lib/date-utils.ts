/**
 * Dynamic Date and Time formatting utilities supporting 'id' and 'en' locales
 */

export function formatDate(
  date: Date | string | number,
  options: Intl.DateTimeFormatOptions = { dateStyle: 'medium' },
  locale = 'id'
): string {
  const d = typeof date === 'string' || typeof date === 'number' ? new Date(date) : date;
  if (isNaN(d.getTime())) return '-';
  const resolvedLocale = locale === 'en' ? 'en-US' : 'id-ID';
  return d.toLocaleDateString(resolvedLocale, options);
}

export function formatDateTime(
  date: Date | string | number,
  options: Intl.DateTimeFormatOptions = { dateStyle: 'medium', timeStyle: 'short' },
  locale = 'id'
): string {
  const d = typeof date === 'string' || typeof date === 'number' ? new Date(date) : date;
  if (isNaN(d.getTime())) return '-';
  const resolvedLocale = locale === 'en' ? 'en-US' : 'id-ID';
  return d.toLocaleString(resolvedLocale, options);
}

export function formatTime(
  date: Date | string | number,
  options: Intl.DateTimeFormatOptions = { timeStyle: 'short' },
  locale = 'id'
): string {
  const d = typeof date === 'string' || typeof date === 'number' ? new Date(date) : date;
  if (isNaN(d.getTime())) return '-';
  const resolvedLocale = locale === 'en' ? 'en-US' : 'id-ID';
  return d.toLocaleTimeString(resolvedLocale, options);
}
