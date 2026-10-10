'use server';

import * as gamification from '@/lib/gamification';

export async function markLessonCompleted(contentId: string, courseId: string) {
  return gamification.markLessonCompleted(contentId, courseId);
}
export async function getUserGamificationProfile(userId?: string) {
  return gamification.getUserGamificationProfile(userId);
}
export async function getAllBadgesWithStatus(userId?: string) {
  return gamification.getAllBadgesWithStatus(userId);
}
export async function getCourseLeaderboard(courseId: string) {
  return gamification.getCourseLeaderboard(courseId);
}
