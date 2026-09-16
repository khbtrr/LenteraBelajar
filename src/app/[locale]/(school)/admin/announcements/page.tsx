import { getSchoolAnnouncements } from '@/lib/actions/school-announcement';
import { AdminAnnouncementsClient } from './client';

export default async function AdminAnnouncementsPage() {
  const announcements = await getSchoolAnnouncements();

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-[#002446] dark:text-white">
          Pusat Pengumuman & Broadcast Sekolah
        </h1>
        <p className="text-sm text-gray-500 dark:text-gray-400">
          Buat dan siarkan pengumuman resmi ke seluruh civitas akademika (Guru, Siswa, atau Keduanya).
        </p>
      </div>

      <AdminAnnouncementsClient initialAnnouncements={announcements} />
    </div>
  );
}
