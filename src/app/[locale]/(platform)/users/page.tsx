import { getPlatformUsers } from '@/lib/actions/platform';
import { PlatformUsersClient } from './client';

export default async function PlatformUsersPage() {
  const data = await getPlatformUsers({ page: 1, limit: 20 });

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-[#002446]">
          Manajemen Pengguna Global
        </h1>
        <p className="text-sm text-gray-500">
          Kelola seluruh akun pengguna lintas institusi sekolah di platform LenteraBelajar, daftarkan Administrator Sekolah baru, serta kelola hak akses dan keamanan akun.
        </p>
      </div>

      <PlatformUsersClient
        initialUsers={data.users}
        initialTotalCount={data.totalCount}
        initialTotalPages={data.totalPages}
        initialCurrentPage={data.currentPage}
        schools={data.schools}
      />
    </div>
  );
}
