'use server';

import { db } from '@/lib/db';
import { requireAuth } from '@/lib/auth-utils';
import { createNotification } from './notification';
import { revalidatePath } from 'next/cache';

import {
  LEVEL_TIERS,
  calculateLevelInfo,
  BADGE_CATALOG,
  type LevelInfo,
  type BadgeCatalogItem,
} from '@/lib/gamification-constants';

/**
 * Updates user daily streak.
 */
export async function touchDailyStreak(userId: string) {
  const user = await db.user.findUnique({
    where: { id: userId },
    select: { streakDays: true, lastActiveDate: true },
  });
  if (!user) return;

  const now = new Date();
  const todayStr = now.toISOString().split('T')[0];

  if (!user.lastActiveDate) {
    await db.user.update({
      where: { id: userId },
      data: { streakDays: 1, lastActiveDate: now },
    });
    return 1;
  }

  const lastActiveStr = new Date(user.lastActiveDate).toISOString().split('T')[0];

  if (todayStr === lastActiveStr) {
    // Already touched today
    return user.streakDays;
  }

  const yesterday = new Date(now.getTime() - 24 * 60 * 60 * 1000);
  const yesterdayStr = yesterday.toISOString().split('T')[0];

  let newStreak = 1;
  if (lastActiveStr === yesterdayStr) {
    // Yesterday active -> streak increments!
    newStreak = user.streakDays + 1;
  } else {
    // Gap > 1 day -> streak resets to 1
    newStreak = 1;
  }

  await db.user.update({
    where: { id: userId },
    data: { streakDays: newStreak, lastActiveDate: now },
  });

  return newStreak;
}

/**
 * Checks milestone requirements and awards badges.
 */
export async function checkAndUnlockAchievements(userId: string) {
  const user = await db.user.findUnique({
    where: { id: userId },
    include: {
      achievements: true,
      quizAttempts: { where: { submittedAt: { not: null } } },
      assignmentSubmissions: {
        include: { assignment: { select: { deadline: true } } },
      },
      lessonProgresses: true,
      forumThreads: true,
      forumComments: true,
    },
  });
  if (!user) return;

  const unlockedCodes = new Set(user.achievements.map((a) => a.badgeCode));
  const newBadgesToUnlock: typeof BADGE_CATALOG = [];

  // 1. QUIZ_PERFECT
  if (!unlockedCodes.has('QUIZ_PERFECT')) {
    const hasPerfect = user.quizAttempts.some((a) => a.score === 100);
    if (hasPerfect) {
      newBadgesToUnlock.push(BADGE_CATALOG.find((b) => b.code === 'QUIZ_PERFECT')!);
    }
  }

  // 2. QUIZ_FIRST
  if (!unlockedCodes.has('QUIZ_FIRST')) {
    const hasPassed = user.quizAttempts.some((a) => (a.score || 0) >= 75);
    if (hasPassed) {
      newBadgesToUnlock.push(BADGE_CATALOG.find((b) => b.code === 'QUIZ_FIRST')!);
    }
  }

  // 3. SPEEDY_SUBMIT
  if (!unlockedCodes.has('SPEEDY_SUBMIT')) {
    const hasEarlySubmit = user.assignmentSubmissions.some((s) => {
      if (!s.assignment.deadline || !s.submittedAt) return false;
      const diffHours = (new Date(s.assignment.deadline).getTime() - new Date(s.submittedAt).getTime()) / (1000 * 60 * 60);
      return diffHours >= 24;
    });
    if (hasEarlySubmit) {
      newBadgesToUnlock.push(BADGE_CATALOG.find((b) => b.code === 'SPEEDY_SUBMIT')!);
    }
  }

  // 4. STREAK_3
  if (!unlockedCodes.has('STREAK_3') && user.streakDays >= 3) {
    newBadgesToUnlock.push(BADGE_CATALOG.find((b) => b.code === 'STREAK_3')!);
  }

  // 5. STREAK_7
  if (!unlockedCodes.has('STREAK_7') && user.streakDays >= 7) {
    newBadgesToUnlock.push(BADGE_CATALOG.find((b) => b.code === 'STREAK_7')!);
  }

  // 6. BOOKWORM_5
  if (!unlockedCodes.has('BOOKWORM_5') && user.lessonProgresses.length >= 5) {
    newBadgesToUnlock.push(BADGE_CATALOG.find((b) => b.code === 'BOOKWORM_5')!);
  }

  // 7. BOOKWORM_15
  if (!unlockedCodes.has('BOOKWORM_15') && user.lessonProgresses.length >= 15) {
    newBadgesToUnlock.push(BADGE_CATALOG.find((b) => b.code === 'BOOKWORM_15')!);
  }

  // 8. FORUM_ACTIVE
  if (!unlockedCodes.has('FORUM_ACTIVE')) {
    const totalForumPosts = user.forumThreads.length + user.forumComments.length;
    if (totalForumPosts >= 3) {
      newBadgesToUnlock.push(BADGE_CATALOG.find((b) => b.code === 'FORUM_ACTIVE')!);
    }
  }

  // Award each new badge
  for (const badge of newBadgesToUnlock) {
    if (!badge) continue;
    try {
      await db.userAchievement.create({
        data: {
          userId,
          badgeCode: badge.code,
          badgeName: badge.name,
          badgeCategory: badge.category,
          icon: badge.icon,
        },
      });

      // Notify user about badge unlock
      await createNotification({
        userId,
        title: `🏆 Lencana Baru Terbuka: ${badge.name}!`,
        message: `Selamat! Anda berhasil meraih lencana "${badge.name}" (${badge.icon}). ${badge.description}`,
        type: 'ACHIEVEMENT',
        link: '/student/achievements',
      });
    } catch {
      // Ignore if race condition
    }
  }
}

/**
 * Awards XP to user and handles level-up notifications.
 */
export async function awardXp(
  userId: string,
  amount: number,
  reason: string,
  actionType: 'QUIZ' | 'ASSIGNMENT' | 'LESSON' | 'ATTENDANCE' | 'FORUM',
  courseId?: string
) {
  if (amount <= 0) return;

  const user = await db.user.findUnique({
    where: { id: userId },
    select: { id: true, xp: true, level: true },
  });
  if (!user) return;

  const oldTotalXp = user.xp;
  const newTotalXp = oldTotalXp + amount;
  const oldLevelInfo = calculateLevelInfo(oldTotalXp);
  const newLevelInfo = calculateLevelInfo(newTotalXp);

  // Update user XP & level
  await db.user.update({
    where: { id: userId },
    data: {
      xp: newTotalXp,
      level: newLevelInfo.level,
    },
  });

  // Create XP log
  await db.xpLog.create({
    data: {
      userId,
      amount,
      reason,
      actionType,
      courseId,
    },
  });

  // Touch daily streak
  await touchDailyStreak(userId);

  // Notify if user levelled up!
  if (newLevelInfo.level > oldLevelInfo.level) {
    await createNotification({
      userId,
      title: `🎉 Naik Level! Selamat Datang di Level ${newLevelInfo.level}!`,
      message: `Hebat! Anda sekarang menyandang gelar "${newLevelInfo.title}". Terus tingkatkan prestasi belajar Anda!`,
      type: 'LEVEL_UP',
      link: '/student/achievements',
    });
  }

  // Check milestone achievements
  await checkAndUnlockAchievements(userId);

  revalidatePath('/', 'layout');
}

/**
 * Records student lesson completion and awards +10 XP.
 */
export async function markLessonCompleted(contentId: string, courseId: string) {
  const session = await requireAuth();

  const existing = await db.lessonProgress.findUnique({
    where: {
      userId_contentId: {
        userId: session.user.id,
        contentId,
      },
    },
  });

  if (existing) {
    return { success: true, alreadyCompleted: true };
  }

  await db.lessonProgress.create({
    data: {
      userId: session.user.id,
      contentId,
      courseId,
    },
  });

  // Award 10 XP
  await awardXp(
    session.user.id,
    10,
    'Menyelesaikan Materi Pembelajaran',
    'LESSON',
    courseId
  );

  return { success: true, alreadyCompleted: false, awardedXp: 10 };
}

/**
 * Gets user's gamification profile (XP, Level, Streak, recent achievements).
 */
export async function getUserGamificationProfile(userId?: string) {
  const session = await requireAuth();
  const targetId = userId || session.user.id;

  const user = await db.user.findUnique({
    where: { id: targetId },
    include: {
      achievements: {
        orderBy: { unlockedAt: 'desc' },
        take: 6,
      },
      xpLogs: {
        orderBy: { createdAt: 'desc' },
        take: 10,
      },
    },
  });

  if (!user) return null;

  const levelInfo = calculateLevelInfo(user.xp);

  return {
    userId: user.id,
    name: user.name,
    avatar: user.avatar,
    streakDays: user.streakDays,
    lastActiveDate: user.lastActiveDate,
    ...levelInfo,
    recentAchievements: user.achievements,
    recentXpLogs: user.xpLogs,
    totalAchievementsCount: user.achievements.length,
  };
}

/**
 * Retrieves all catalog badges with unlock status for student.
 */
export async function getAllBadgesWithStatus(userId?: string) {
  const session = await requireAuth();
  const targetId = userId || session.user.id;

  const userAchievements = await db.userAchievement.findMany({
    where: { userId: targetId },
  });

  const achievementMap = new Map(userAchievements.map((a) => [a.badgeCode, a]));

  return BADGE_CATALOG.map((badge) => {
    const userAch = achievementMap.get(badge.code);
    return {
      ...badge,
      unlocked: !!userAch,
      unlockedAt: userAch?.unlockedAt || null,
    };
  });
}

/**
 * Retrieves class leaderboard for a course with top 3 podium and user rank.
 */
export async function getCourseLeaderboard(courseId: string) {
  const session = await requireAuth();

  const course = await db.course.findUnique({
    where: { id: courseId },
    include: {
      enrollments: {
        include: {
          user: {
            select: {
              id: true,
              name: true,
              nis: true,
              avatar: true,
              xp: true,
              level: true,
              streakDays: true,
            },
          },
        },
      },
    },
  });

  if (!course) throw new Error('Kursus tidak ditemukan');

  // Sort enrolled students by XP descending
  const sortedStudents = course.enrollments
    .map((enr) => {
      const u = enr.user;
      const levelInfo = calculateLevelInfo(u.xp);
      return {
        id: u.id,
        name: u.name,
        nis: u.nis,
        avatar: u.avatar,
        xp: u.xp,
        level: levelInfo.level,
        title: levelInfo.title,
        streakDays: u.streakDays,
      };
    })
    .sort((a, b) => b.xp - a.xp);

  // Assign ranks
  const rankedStudents = sortedStudents.map((s, index) => ({
    ...s,
    rank: index + 1,
    isCurrentUser: s.id === session.user.id,
  }));

  const podium = rankedStudents.slice(0, 3);
  const currentUserRank = rankedStudents.find((s) => s.isCurrentUser) || null;

  return {
    courseTitle: course.title,
    totalStudents: rankedStudents.length,
    podium,
    rankedStudents,
    currentUserRank,
  };
}
