import { auth } from '@/lib/auth';
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
