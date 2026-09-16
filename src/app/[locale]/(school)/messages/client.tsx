'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { useSearchParams, useRouter, usePathname } from 'next/navigation';
import {
  ConversationSummary,
  getConversations,
} from '@/lib/actions/message';
import { ConversationList } from '@/components/messages/conversation-list';
import { ChatPanel } from '@/components/messages/chat-panel';
import { NewMessageDialog } from '@/components/messages/new-message-dialog';
import { MessageSquare } from 'lucide-react';
import { cn } from '@/lib/utils';

interface MessagesClientProps {
  initialConversations: ConversationSummary[];
}

export function MessagesClient({ initialConversations }: MessagesClientProps) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const conversationParam = searchParams.get('conversation');

  const [conversations, setConversations] =
    useState<ConversationSummary[]>(initialConversations);
  const [selectedId, setSelectedId] = useState<string | null>(conversationParam);
  const [isNewDialogOpen, setIsNewDialogOpen] = useState(false);

  // Sync selectedId with URL parameter
  useEffect(() => {
    if (conversationParam !== selectedId) {
      setSelectedId(conversationParam);
    }
  }, [conversationParam]);

  // Refresh conversations list periodically (every 10s)
  const refreshConversations = useCallback(async () => {
    try {
      const updated = await getConversations();
      setConversations(updated);
    } catch (err) {
      // ignore background polling error
    }
  }, []);

  useEffect(() => {
    const interval = setInterval(refreshConversations, 10000);
    return () => clearInterval(interval);
  }, [refreshConversations]);

  const handleSelectConversation = (id: string) => {
    setSelectedId(id);
    const params = new URLSearchParams(searchParams.toString());
    params.set('conversation', id);
    router.replace(`${pathname}?${params.toString()}`);
  };

  const handleBackToConversations = () => {
    setSelectedId(null);
    const params = new URLSearchParams(searchParams.toString());
    params.delete('conversation');
    router.replace(`${pathname}?${params.toString()}`);
  };

  return (
    <div className="h-[calc(100vh-120px)] min-h-[500px] flex flex-col">
      <div className="flex-1 bg-white dark:bg-gray-900 rounded-2xl border border-gray-200 dark:border-gray-800 shadow-xs overflow-hidden flex">
        {/* Left Panel: Conversation List */}
        <div
          className={cn(
            'h-full w-full md:w-80 lg:w-96 shrink-0 transition-all',
            selectedId ? 'hidden md:flex flex-col' : 'flex flex-col'
          )}
        >
          <ConversationList
            conversations={conversations}
            selectedId={selectedId}
            onSelectConversation={handleSelectConversation}
            onOpenNewMessage={() => setIsNewDialogOpen(true)}
          />
        </div>

        {/* Right Panel: Chat or Empty Placeholder */}
        <div
          className={cn(
            'h-full flex-1 flex flex-col',
            !selectedId ? 'hidden md:flex' : 'flex'
          )}
        >
          {selectedId ? (
            <ChatPanel
              key={selectedId}
              conversationId={selectedId}
              onBack={handleBackToConversations}
              onMessageSent={refreshConversations}
            />
          ) : (
            <div className="h-full flex flex-col items-center justify-center p-8 text-center bg-gray-50/50 dark:bg-gray-950/40">
              <div className="w-16 h-16 rounded-2xl bg-brand-50 dark:bg-brand-950/50 text-brand-500 flex items-center justify-center mb-4 shadow-2xs">
                <MessageSquare className="w-8 h-8" />
              </div>
              <h3 className="text-base font-bold text-gray-800 dark:text-white">
                Pilih Obrolan
              </h3>
              <p className="text-xs text-gray-500 dark:text-gray-400 max-w-sm mt-1">
                Pilih salah satu kontak dari panel sebelah kiri atau klik tombol &quot;Baru&quot; untuk memulai pesan langsung dengan guru atau siswa.
              </p>
            </div>
          )}
        </div>
      </div>

      {/* New Message Dialog */}
      <NewMessageDialog
        open={isNewDialogOpen}
        onOpenChange={setIsNewDialogOpen}
        onSelectConversation={(newConvId) => {
          handleSelectConversation(newConvId);
          refreshConversations();
        }}
      />
    </div>
  );
}
