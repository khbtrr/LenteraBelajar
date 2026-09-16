import { getSchoolSettings } from '@/lib/actions/school-settings';
import { AdminSettingsClient } from './client';

export default async function AdminSettingsPage() {
  const { school, activeAcademicYear, adminUser } = await getSchoolSettings();

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-[#002446] dark:text-white">
          Pengaturan Sekolah & Sistem
        </h1>
        <p className="text-sm text-gray-500 dark:text-gray-400">
          Kelola profil sekolah, identitas branding, standar akademik KKM, parameter default CBT, serta akun administrator.
        </p>
      </div>

      <AdminSettingsClient
        initialSchool={school}
        activeAcademicYear={activeAcademicYear}
        adminUser={adminUser}
      />
    </div>
  );
}
