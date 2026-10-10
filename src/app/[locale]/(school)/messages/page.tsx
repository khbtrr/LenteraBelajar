import { getServerSession as auth } from '@/lib/auth-utils';
import { redirect } from 'next/navigation';
import { getConversations } from '@/lib/actions/message';
import { MessagesClient } from './client';

export default async function MessagesPage() {
  const session = await auth();
  if (!session?.user) {
    redirect('/login');
  }

  const initialConversations = await getConversations();

  return <MessagesClient initialConversations={initialConversations} />;
}
