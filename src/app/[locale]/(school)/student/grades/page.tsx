import { auth } from '@/lib/auth';
import { getStudentGradesOverview } from '@/lib/actions/grade';
import { StudentGradesClient } from './client';

export default async function StudentGradesPage() {
  const session = await auth();
  if (!session?.user) return null;

  const courses = await getStudentGradesOverview(session.user.id);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-[#002446]">Riwayat Nilai Saya</h1>
        <p className="text-sm text-gray-500">
          Pantau hasil evaluasi kuis, nilai penugasan, dan catatan feedback dari bapak/ibu guru.
        </p>
      </div>

      <StudentGradesClient courses={courses} />
    </div>
  );
}
