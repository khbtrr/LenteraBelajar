import { getCourseRequests } from '@/lib/actions/course';
import { CourseRequestsClient } from './client';

export default async function AdminCourseRequestsPage() {
  const requests = await getCourseRequests();

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-[#002446] dark:text-white">Persetujuan Pengajuan Course</h1>
        <p className="text-sm text-gray-500 dark:text-gray-400">
          Tinjau dan setujui pengajuan pembuatan course baru yang diajukan oleh para guru.
        </p>
      </div>

      <CourseRequestsClient initialRequests={requests} />
    </div>
  );
}
