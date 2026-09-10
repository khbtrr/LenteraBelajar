import { auth } from '@/lib/auth';
import { getTeacherActivityStats } from '@/lib/actions/monitoring';
import { TeacherActivityClient } from './client';

export default async function SupervisorTeacherActivityPage() {
  const session = await auth();
  if (!session?.user?.schoolId) return null;

  const teachers = await getTeacherActivityStats(session.user.schoolId);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-[#002446]">Monitoring Keaktifan Guru</h1>
        <p className="text-sm text-gray-500">
          Statistik pembuatan materi, modul pembelajaran, kuis, dan penugasan oleh seluruh dewan guru.
        </p>
      </div>

      <TeacherActivityClient teachers={teachers} />
    </div>
  );
}
