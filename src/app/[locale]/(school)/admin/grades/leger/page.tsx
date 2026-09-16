import { getLegerFilterOptions, getCohortLegerData } from '@/lib/actions/leger';
import { AdminLegerClient } from './client';

export default async function AdminLegerPage({
  searchParams,
}: {
  searchParams: Promise<{ cohortId?: string; academicYearId?: string }>;
}) {
  const { cohortId, academicYearId } = await searchParams;
  const { cohorts, academicYears } = await getLegerFilterOptions();

  // Ambil kohort default jika belum ada di query param
  const activeCohortId = cohortId || cohorts[0]?.id || '';
  const activeAcademicYearId = academicYearId || academicYears.find((y) => y.status === 'ACTIVE')?.id || academicYears[0]?.id || '';

  const legerData = activeCohortId
    ? await getCohortLegerData({
        cohortId: activeCohortId,
        academicYearId: activeAcademicYearId || undefined,
      })
    : null;

  return (
    <div className="space-y-6">
      <AdminLegerClient
        cohorts={cohorts}
        academicYears={academicYears}
        initialCohortId={activeCohortId}
        initialAcademicYearId={activeAcademicYearId}
        initialLegerData={legerData}
      />
    </div>
  );
}