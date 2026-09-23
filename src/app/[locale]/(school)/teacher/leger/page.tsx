import { getLegerFilterOptions, getCohortLegerData } from '@/lib/actions/leger';
import { requireSchool } from '@/lib/auth-utils';
import { AdminLegerClient } from '@/app/[locale]/(school)/admin/grades/leger/client';

export default async function TeacherLegerPage({
  searchParams,
}: {
  searchParams: Promise<{ cohortId?: string; academicYearId?: string }>;
}) {
  const session = await requireSchool();
  const { cohortId, academicYearId } = await searchParams;
  const { cohorts, academicYears } = await getLegerFilterOptions();

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
        key={session.schoolId}
        cohorts={cohorts}
        academicYears={academicYears}
        initialCohortId={activeCohortId}
        initialAcademicYearId={activeAcademicYearId}
        initialLegerData={legerData}
      />
    </div>
  );
}