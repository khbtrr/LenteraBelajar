import { describe, it, expect } from 'vitest';
import { formatDate, formatDateTime, formatTime } from '@/lib/date-utils';

describe('Localized Date & Time Formatting Utilities', () => {
  const testIso = '2026-10-09T07:30:00.000Z';
  const testDate = new Date(testIso);

  describe('formatDate', () => {
    it('formats date using Indonesian locale by default', () => {
      const formatted = formatDate(testDate);
      expect(formatted).toBeDefined();
      expect(formatted).not.toBe('-');
    });

    it('formats date using English locale when specified', () => {
      const formatted = formatDate(testDate, { dateStyle: 'medium' }, 'en');
      expect(formatted).toContain('2026');
    });

    it('returns hyphen for invalid dates', () => {
      expect(formatDate('invalid-date-string')).toBe('-');
      expect(formatDate(NaN)).toBe('-');
    });
  });

  describe('formatDateTime', () => {
    it('formats date and time together', () => {
      const formatted = formatDateTime(testDate);
      expect(formatted).toBeDefined();
      expect(formatted).not.toBe('-');
    });

    it('returns hyphen for invalid date time inputs', () => {
      expect(formatDateTime('not-a-valid-timestamp')).toBe('-');
    });
  });

  describe('formatTime', () => {
    it('formats time component', () => {
      const formatted = formatTime(testDate);
      expect(formatted).toBeDefined();
      expect(formatted).not.toBe('-');
    });

    it('returns hyphen for invalid time inputs', () => {
      expect(formatTime('invalid')).toBe('-');
    });
  });
});
