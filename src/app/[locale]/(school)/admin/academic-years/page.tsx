import { getAcademicYears } from '@/lib/actions/academic-year';
import { AcademicYearsClient } from './client';

export default async function AcademicYearsPage() {
  const academicYears = await getAcademicYears();

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-[#002446]">Manajemen Tahun Ajaran</h1>
        <p className="text-sm text-gray-500">
          Kelola tahun ajaran aktif dan arsip. Mengarsipkan tahun ajaran akan otomatis mengarsipkan seluruh course di dalamnya.
        </p>
      </div>

      <AcademicYearsClient initialYears={academicYears} />
    </div>
  );
}
