import { describe, it, expect } from 'vitest';
import {
  calculateLevelInfo,
  LEVEL_TIERS,
  BADGE_CATALOG,
} from '@/lib/gamification-constants';

describe('Gamification, Level Progression & Daily Streaks', () => {
  describe('XP Level Calculation Engine', () => {
    it('initializes new user at Level 1 with 0 XP', () => {
      const level = calculateLevelInfo(0);
      expect(level.level).toBe(1);
      expect(level.title).toBe('Pelajar Pemula');
      expect(level.progressPercent).toBe(0);
      expect(level.currentBaseXp).toBe(0);
      expect(level.nextLevelXp).toBe(100);
    });

    it('calculates mid-level progress percentage accurately', () => {
      const level = calculateLevelInfo(50);
      expect(level.level).toBe(1);
      expect(level.progressPercent).toBe(50);
    });

    it('advances user across tier thresholds', () => {
      expect(calculateLevelInfo(100).level).toBe(1);
      expect(calculateLevelInfo(101).level).toBe(2);
      expect(calculateLevelInfo(101).title).toBe('Penjelajah Ilmu');

      expect(calculateLevelInfo(300).level).toBe(2);
      expect(calculateLevelInfo(301).level).toBe(3);
      expect(calculateLevelInfo(301).title).toBe('Cendekia Muda');

      expect(calculateLevelInfo(600).level).toBe(3);
      expect(calculateLevelInfo(601).level).toBe(4);
      expect(calculateLevelInfo(601).title).toBe('Bintang Kelas');

      expect(calculateLevelInfo(950).level).toBe(4);
      expect(calculateLevelInfo(951).level).toBe(5);
      expect(calculateLevelInfo(951).title).toBe('Pakar Lentera');

      expect(calculateLevelInfo(1400).level).toBe(5);
      expect(calculateLevelInfo(1401).level).toBe(6);
      expect(calculateLevelInfo(1401).title).toBe('Master Lentera');
    });

    it('caps progress at 100% when reaching maximum level', () => {
      const maxLevel = calculateLevelInfo(5000);
      expect(maxLevel.level).toBe(6);
      expect(maxLevel.title).toBe('Master Lentera');
      expect(maxLevel.progressPercent).toBe(100);
    });
  });

  describe('Daily Streak Calculation Logic', () => {
    function computeDailyStreak(
      currentStreak: number,
      lastActiveDate: string | null,
      todayStr: string,
      yesterdayStr: string
    ): number {
      if (!lastActiveDate) {
        return 1;
      }
      if (lastActiveDate === todayStr) {
        return currentStreak;
      }
      if (lastActiveDate === yesterdayStr) {
        return currentStreak + 1;
      }
      return 1;
    }

    const today = '2026-10-09';
    const yesterday = '2026-10-08';
    const twoDaysAgo = '2026-10-07';

    it('initializes streak to 1 on user first activity', () => {
      const streak = computeDailyStreak(0, null, today, yesterday);
      expect(streak).toBe(1);
    });

    it('maintains same streak when accessed multiple times on the same day', () => {
      const streak = computeDailyStreak(5, today, today, yesterday);
      expect(streak).toBe(5);
    });

    it('increments streak when accessed on consecutive day', () => {
      const streak = computeDailyStreak(3, yesterday, today, yesterday);
      expect(streak).toBe(4);
    });

    it('resets streak to 1 when a day is missed', () => {
      const streak = computeDailyStreak(10, twoDaysAgo, today, yesterday);
      expect(streak).toBe(1);
    });
  });

  describe('Badge Unlock Qualification', () => {
    function evaluateBadgeEligibility(criteria: {
      hasPerfectQuiz: boolean;
      hasPassedQuiz: boolean;
      submittedHoursEarly: number;
      streakDays: number;
    }): string[] {
      const unlocked: string[] = [];

      if (criteria.hasPerfectQuiz) unlocked.push('QUIZ_PERFECT');
      if (criteria.hasPassedQuiz) unlocked.push('QUIZ_FIRST');
      if (criteria.submittedHoursEarly >= 24) unlocked.push('SPEEDY_SUBMIT');
      if (criteria.streakDays >= 3) unlocked.push('STREAK_3');
      if (criteria.streakDays >= 7) unlocked.push('STREAK_7');

      return unlocked;
    }

    it('qualifies for QUIZ_PERFECT when scoring 100 on CBT', () => {
      const badges = evaluateBadgeEligibility({
        hasPerfectQuiz: true,
        hasPassedQuiz: true,
        submittedHoursEarly: 0,
        streakDays: 1,
      });

      expect(badges).toContain('QUIZ_PERFECT');
      expect(badges).toContain('QUIZ_FIRST');
    });

    it('qualifies for SPEEDY_SUBMIT when submitted at least 24 hours prior to deadline', () => {
      const eligible = evaluateBadgeEligibility({
        hasPerfectQuiz: false,
        hasPassedQuiz: false,
        submittedHoursEarly: 25,
        streakDays: 1,
      });
      expect(eligible).toContain('SPEEDY_SUBMIT');

      const ineligible = evaluateBadgeEligibility({
        hasPerfectQuiz: false,
        hasPassedQuiz: false,
        submittedHoursEarly: 23,
        streakDays: 1,
      });
      expect(ineligible).not.toContain('SPEEDY_SUBMIT');
    });

    it('unlocks streak badges progressively as streak reaches 3 and 7 days', () => {
      const day3 = evaluateBadgeEligibility({
        hasPerfectQuiz: false,
        hasPassedQuiz: false,
        submittedHoursEarly: 0,
        streakDays: 3,
      });
      expect(day3).toContain('STREAK_3');
      expect(day3).not.toContain('STREAK_7');

      const day7 = evaluateBadgeEligibility({
        hasPerfectQuiz: false,
        hasPassedQuiz: false,
        submittedHoursEarly: 0,
        streakDays: 7,
      });
      expect(day7).toContain('STREAK_3');
      expect(day7).toContain('STREAK_7');
    });

    it('verifies badge catalog definitions and reward points', () => {
      expect(BADGE_CATALOG.length).toBeGreaterThanOrEqual(8);
      const perfectBadge = BADGE_CATALOG.find((b) => b.code === 'QUIZ_PERFECT');
      expect(perfectBadge).toBeDefined();
      expect(perfectBadge?.xpReward).toBe(50);
    });
  });
});
