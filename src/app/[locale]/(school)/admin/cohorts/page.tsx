import { getCohorts, getStudentsInSchool } from '@/lib/actions/cohort';
import { CohortsClient } from './client';

export default async function AdminCohortsPage() {
  const [cohorts, students] = await Promise.all([
    getCohorts(),
    getStudentsInSchool(),
  ]);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-[#002446]">Manajemen Grup Kohort</h1>
        <p className="text-sm text-gray-500">
          Kelompokkan siswa ke dalam grup kohort (misal: Kohort-X-MIPA-1-2026) untuk mempermudah pendaftaran massal ke course via Cohort Sync.
        </p>
      </div>

      <CohortsClient initialCohorts={cohorts} availableStudents={students} />
    </div>
  );
}
