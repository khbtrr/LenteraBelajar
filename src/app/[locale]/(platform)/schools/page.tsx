import { getSchools } from '@/lib/actions/school';
import { PlatformSchoolsClient } from './client';

export default async function PlatformSchoolsPage() {
  const schools = await getSchools();

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-[#002446]">Manajemen Sekolah (Tenants)</h1>
        <p className="text-sm text-gray-500">
          Kelola seluruh institusi sekolah yang terdaftar di platform LenteraBelajar.
        </p>
      </div>

      <PlatformSchoolsClient initialSchools={schools} />
    </div>
  );
}
