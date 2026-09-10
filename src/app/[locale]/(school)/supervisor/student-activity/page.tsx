import { auth } from '@/lib/auth';
import { getStudentActivityStats } from '@/lib/actions/monitoring';
import { StudentActivityClient } from './client';

export default async function SupervisorStudentActivityPage() {
  const session = await auth();
  if (!session?.user?.schoolId) return null;

  const students = await getStudentActivityStats(session.user.schoolId);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-[#002446]">Monitoring Keaktifan Siswa</h1>
        <p className="text-sm text-gray-500">
          Statistik pengerjaan kuis, pengumpulan tugas, dan enrollment course siswa di sekolah.
        </p>
      </div>

      <StudentActivityClient students={students} />
    </div>
  );
}
