import { getUserProfile } from '@/lib/actions/profile';
import { ProfileClient } from './client';

export default async function ProfilePage() {
  const profile = await getUserProfile();

  return (
    <div className="space-y-6">
      <div>
        <div className="text-xs font-semibold text-brand-500 uppercase tracking-wider">
          Pengaturan Akun
        </div>
        <h1 className="text-2xl font-bold text-[#002446] dark:text-white">
          Profil Saya
        </h1>
        <p className="text-sm text-gray-500 dark:text-gray-400">
          Kelola data diri, foto profil, preferensi keamanan, dan lihat ringkasan aktivitas akademik Anda.
        </p>
      </div>

      <ProfileClient initialProfile={profile} />
    </div>
  );
}
