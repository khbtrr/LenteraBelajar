import { requireRole } from '@/lib/auth-utils';
import { getSchoolConversations } from '@/lib/actions/message-admin';
import { AdminMessagesClient } from './client';
import { getTranslations } from 'next-intl/server';

export default async function AdminMessagesPage() {
  await requireRole('ADMIN', 'SUPER_ADMIN');

  const t = await getTranslations('adminMessages');
  const { conversations, total, totalPages } = await getSchoolConversations();

  return (
    <div className="space-y-4">
      <div>
        <div className="text-xs font-semibold text-brand-500 uppercase tracking-wider">
          {t('pageSubtitle')}
        </div>
        <h1 className="text-2xl font-bold text-[#002446] dark:text-white">
          {t('pageTitle')}
        </h1>
        <p className="text-sm text-gray-500 dark:text-gray-400">
          {t('pageDesc')}
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
