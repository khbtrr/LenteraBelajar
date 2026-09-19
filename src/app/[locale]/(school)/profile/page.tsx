import { getUserProfile } from '@/lib/actions/profile';
import { getTranslations } from 'next-intl/server';
import { ProfileClient } from './client';

export default async function ProfilePage() {
  const t = await getTranslations('profile');
  const profile = await getUserProfile();

  return (
    <div className="space-y-6">
      <div>
        <div className="text-xs font-semibold text-brand-500 uppercase tracking-wider">
          {t('badge')}
        </div>
        <h1 className="text-2xl font-bold text-[#002446] dark:text-white">
          {t('title')}
        </h1>
        <p className="text-sm text-gray-500 dark:text-gray-400">
          {t('subtitle')}
        </p>
      </div>

      <ProfileClient initialProfile={profile} />
    </div>
  );
}
