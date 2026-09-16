import { requireRole } from '@/lib/auth-utils';
import { getSchoolConversations } from '@/lib/actions/message-admin';
import { AdminMessagesClient } from './client';

export default async function AdminMessagesPage() {
  await requireRole('ADMIN', 'SUPERVISOR', 'SUPER_ADMIN');

  const { conversations, total, totalPages } = await getSchoolConversations();

  return (
    <div className="space-y-4">
      <div>
        <div className="text-xs font-semibold text-brand-500 uppercase tracking-wider">
          Keamanan & Moderasi
        </div>
        <h1 className="text-2xl font-bold text-[#002446] dark:text-white">
          Moderasi Pesan Langsung (DM)
        </h1>
        <p className="text-sm text-gray-500 dark:text-gray-400">
          Pantau aktivitas komunikasi siswa dan guru untuk memastikan keamanan lingkungan belajar digital sekolah.
        </p>
      </div>

      <AdminMessagesClient
        initialConversations={conversations}
        initialTotal={total}
        initialTotalPages={totalPages}
      />
    </div>
  );
}
