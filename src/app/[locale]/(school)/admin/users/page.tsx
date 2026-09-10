import { getUsersInSchool } from '@/lib/actions/user';
import { AdminUsersClient } from './client';

export default async function AdminUsersPage() {
  const users = await getUsersInSchool();

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-[#002446]">Manajemen Pengguna</h1>
        <p className="text-sm text-gray-500">
          Kelola data guru, siswa, dan staf sekolah. Anda dapat mendaftarkan siswa secara massal menggunakan file Excel / CSV.
        </p>
      </div>

      <AdminUsersClient initialUsers={users} />
    </div>
  );
}
