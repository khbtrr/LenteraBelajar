import { auth } from '@/lib/auth';
import { redirect } from 'next/navigation';
import {
  getUserGamificationProfile,
  getAllBadgesWithStatus,
} from '@/lib/actions/gamification';
import { StudentAchievementsClient } from './client';

export default async function StudentAchievementsPage() {
  const session = await auth();
  if (!session?.user) {
    redirect('/login');
  }

  const [profile, allBadges] = await Promise.all([
    getUserGamificationProfile(session.user.id),
    getAllBadgesWithStatus(session.user.id),
  ]);

  if (!profile) {
    redirect('/student/dashboard');
  }

  return (
    <StudentAchievementsClient
      profile={profile}
      allBadges={allBadges}
    />
  );
}
