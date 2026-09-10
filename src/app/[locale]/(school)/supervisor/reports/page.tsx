import { auth } from '@/lib/auth';
import { getSchoolReportsOverview } from '@/lib/actions/monitoring';
import { getAcademicYears } from '@/lib/actions/academic-year';
import { SupervisorReportsClient } from './client';

export default async function SupervisorReportsPage() {
  const session = await auth();
  if (!session?.user?.schoolId) return null;

  const [reports, academicYears] = await Promise.all([
    getSchoolReportsOverview(session.user.schoolId),
    getAcademicYears(),
  ]);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-[#002446]">Laporan & Rekapitulasi Nilai Sekolah</h1>
        <p className="text-sm text-gray-500">
          Ringkasan ketercapaian nilai seluruh mata pelajaran untuk evaluasi kepala sekolah dan kurikulum.
        </p>
      </div>

      <SupervisorReportsClient initialReports={reports} academicYears={academicYears} />
    </div>
  );
}
