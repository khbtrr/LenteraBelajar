'use client';

import React, { useState, useTransition } from 'react';
import {
  AdminConversationItem,
  AdminMessageDetail,
  getSchoolConversations,
  getConversationMessagesAdmin,
} from '@/lib/actions/message-admin';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  Search,
  ShieldCheck,
  Eye,
  Loader2,
  Calendar,
  MessageSquare,
  AlertTriangle,
} from 'lucide-react';
import { cn } from '@/lib/utils';

interface AdminMessagesClientProps {
  initialConversations: AdminConversationItem[];
  initialTotal: number;
  initialTotalPages: number;
}

export function AdminMessagesClient({
  initialConversations,
  initialTotal,
  initialTotalPages,
}: AdminMessagesClientProps) {
  const [conversations, setConversations] =
    useState<AdminConversationItem[]>(initialConversations);
  const [total, setTotal] = useState(initialTotal);
  const [totalPages, setTotalPages] = useState(initialTotalPages);
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const [isSearching, startSearch] = useTransition();

  // Audit modal state
  const [selectedConvId, setSelectedConvId] = useState<string | null>(null);
  const [auditLoading, setAuditLoading] = useState(false);
  const [auditData, setAuditData] = useState<{
    conversation: {
      id: string;
      createdAt: Date;
      participants: {
        id: string;
        name: string;
        avatar: string | null;
        role: string;
        email: string;
      }[];
    };
    messages: AdminMessageDetail[];
  } | null>(null);

  const handleSearch = (query: string) => {
    setSearch(query);
    setPage(1);
    startSearch(async () => {
      const res = await getSchoolConversations(query, 1);
      setConversations(res.conversations);
      setTotal(res.total);
      setTotalPages(res.totalPages);
    });
  };

  const handlePageChange = async (newPage: number) => {
    setPage(newPage);
    startSearch(async () => {
      const res = await getSchoolConversations(search, newPage);
      setConversations(res.conversations);
      setTotal(res.total);
      setTotalPages(res.totalPages);
    });
  };

  const handleOpenAudit = async (convId: string) => {
    setSelectedConvId(convId);
    setAuditLoading(true);
    try {
      const data = await getConversationMessagesAdmin(convId);
      setAuditData(data);
    } catch (err) {
      console.error('Failed to load audit transcript:', err);
    } finally {
      setAuditLoading(false);
    }
  };

  const getRoleLabel = (role: string) => {
    switch (role) {
      case 'TEACHER':
        return 'Guru';
      case 'STUDENT':
        return 'Siswa';
      case 'ADMIN':
        return 'Admin';
      case 'SUPERVISOR':
        return 'Pengawas';
      case 'SUPER_ADMIN':
        return 'Super Admin';
      default:
        return role;
    }
  };

  const getRoleBadgeVariant = (role: string) => {
    switch (role) {
      case 'TEACHER':
        return 'default' as const;
      case 'STUDENT':
        return 'secondary' as const;
      case 'ADMIN':
      case 'SUPER_ADMIN':
        return 'destructive' as const;
      default:
        return 'outline' as const;
    }
  };

  const getInitials = (name: string) => {
    return name
      .split(' ')
      .map((n) => n[0])
      .slice(0, 2)
      .join('')
      .toUpperCase();
  };

  return (
    <div className="space-y-4">
      {/* Search and summary card */}
      <div className="bg-white dark:bg-gray-900 p-4 rounded-xl border border-gray-200 dark:border-gray-800 flex flex-col sm:flex-row items-center justify-between gap-3 shadow-xs">
        <div className="relative w-full sm:w-80">
          <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
          <Input
            type="text"
            placeholder="Cari nama atau email partisipan..."
            value={search}
            onChange={(e) => handleSearch(e.target.value)}
            className="pl-9 text-xs bg-gray-50 dark:bg-gray-800 border-gray-200 dark:border-gray-700"
          />
        </div>

        <div className="text-xs text-gray-500 dark:text-gray-400 flex items-center gap-1.5 self-end sm:self-auto">
          <ShieldCheck className="w-4 h-4 text-brand-500" />
          <span>
            Total <strong>{total}</strong> percakapan tercatat
          </span>
        </div>
      </div>

      {/* Conversations Table */}
      <div className="bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-800 shadow-xs overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-gray-50 dark:bg-gray-800/80 text-gray-600 dark:text-gray-300 font-semibold border-b border-gray-200 dark:border-gray-800">
              <tr>
                <th className="py-3 px-4">Partisipan</th>
                <th className="py-3 px-4">Pesan Terakhir</th>
                <th className="py-3 px-4 text-center">Jumlah Pesan</th>
                <th className="py-3 px-4">Waktu Terakhir</th>
                <th className="py-3 px-4 text-right">Aksi</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
              {isSearching ? (
                <tr>
                  <td colSpan={5} className="py-12 text-center text-gray-400">
                    <Loader2 className="w-6 h-6 animate-spin mx-auto text-brand-500 mb-1" />
                    <span>Mencari...</span>
                  </td>
                </tr>
              ) : conversations.length === 0 ? (
                <tr>
                  <td colSpan={5} className="py-12 text-center text-gray-400">
                    Tidak ada percakapan yang ditemukan.
                  </td>
                </tr>
              ) : (
                conversations.map((conv) => (
                  <tr
                    key={conv.id}
                    className="hover:bg-gray-50/60 dark:hover:bg-gray-800/40 transition-colors"
                  >
                    <td className="py-3 px-4">
                      <div className="flex flex-col gap-1.5">
                        {conv.participants.map((p) => (
                          <div key={p.id} className="flex items-center gap-2">
                            <Avatar className="w-6 h-6">
                              {p.avatar ? (
                                <AvatarImage src={p.avatar} alt={p.name} />
                              ) : (
                                <AvatarFallback className="text-[10px] bg-brand-100 text-brand-700">
                                  {getInitials(p.name)}
                                </AvatarFallback>
                              )}
                            </Avatar>
                            <span className="font-medium text-gray-900 dark:text-gray-100">
                              {p.name}
                            </span>
                            <Badge
                              variant={getRoleBadgeVariant(p.role)}
                              className="text-[9px] px-1 py-0 h-3.5"
                            >
                              {getRoleLabel(p.role)}
                            </Badge>
                          </div>
                        ))}
                      </div>
                    </td>

                    <td className="py-3 px-4 max-w-xs">
                      {conv.lastMessage ? (
                        <div>
                          <span className="font-medium text-gray-700 dark:text-gray-300">
                            {conv.lastMessage.senderName}:{' '}
                          </span>
                          <span
                            className={cn(
                              'text-gray-500 dark:text-gray-400 truncate block',
                              conv.lastMessage.isDeleted && 'italic text-red-500 dark:text-red-400'
                            )}
                          >
                            {conv.lastMessage.isDeleted
                              ? `[Dihapus] ${conv.lastMessage.content}`
                              : conv.lastMessage.content}
                          </span>
                        </div>
                      ) : (
                        <span className="text-gray-400 italic">Belum ada pesan</span>
                      )}
                    </td>

                    <td className="py-3 px-4 text-center">
                      <span className="inline-flex items-center gap-1 font-semibold text-gray-700 dark:text-gray-300">
                        <MessageSquare className="w-3.5 h-3.5 text-gray-400" />
                        {conv.messageCount}
                      </span>
                    </td>

                    <td className="py-3 px-4 text-gray-500 dark:text-gray-400 whitespace-nowrap">
                      {new Date(conv.lastMessageAt).toLocaleString('id-ID', {
                        day: 'numeric',
                        month: 'short',
                        year: 'numeric',
                        hour: '2-digit',
                        minute: '2-digit',
                      })}
                    </td>

                    <td className="py-3 px-4 text-right">
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => handleOpenAudit(conv.id)}
                        className="h-7 text-xs gap-1 hover:border-brand-500 hover:text-brand-500"
                      >
                        <Eye className="w-3.5 h-3.5" />
                        <span>Audit</span>
                      </Button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination */}
        {totalPages > 1 && (
          <div className="p-3 border-t border-gray-100 dark:border-gray-800 flex items-center justify-between text-xs text-gray-500">
            <span>
              Halaman {page} dari {totalPages}
            </span>
            <div className="flex gap-1">
              <Button
                variant="outline"
                size="sm"
                disabled={page <= 1}
                onClick={() => handlePageChange(page - 1)}
                className="h-7 text-xs"
              >
                Sebelumnya
              </Button>
              <Button
                variant="outline"
                size="sm"
                disabled={page >= totalPages}
                onClick={() => handlePageChange(page + 1)}
                className="h-7 text-xs"
              >
                Selanjutnya
              </Button>
            </div>
          </div>
        )}
      </div>

      {/* Audit Modal Dialog */}
      <Dialog
        open={!!selectedConvId}
        onOpenChange={(open) => {
          if (!open) {
            setSelectedConvId(null);
            setAuditData(null);
          }
        }}
      >
        <DialogContent className="sm:max-w-2xl max-h-[85vh] flex flex-col p-0 overflow-hidden">
          <DialogHeader className="p-5 pb-3 border-b border-gray-100 dark:border-gray-800 bg-gray-50/50 dark:bg-gray-900/50">
            <DialogTitle className="flex items-center gap-2 text-base font-bold text-gray-900 dark:text-white">
              <ShieldCheck className="w-5 h-5 text-brand-500" />
              <span>Transkrip Audit Obrolan (Mode Moderasi)</span>
            </DialogTitle>
            {auditData && (
              <div className="flex items-center gap-2 mt-2 flex-wrap">
                <span className="text-xs text-gray-500">Partisipan:</span>
                {auditData.conversation.participants.map((p) => (
                  <Badge
                    key={p.id}
                    variant="outline"
                    className="text-[11px] gap-1 py-0.5"
                  >
                    <span>{p.name}</span>
                    <span className="text-gray-400">({getRoleLabel(p.role)})</span>
                  </Badge>
                ))}
              </div>
            )}
          </DialogHeader>

          <div className="flex-1 overflow-y-auto p-5 space-y-3">
            {auditLoading ? (
              <div className="py-16 text-center text-xs text-gray-400">
                <Loader2 className="w-8 h-8 animate-spin mx-auto text-brand-500 mb-2" />
                <span>Memuat riwayat pesan...</span>
              </div>
            ) : !auditData || auditData.messages.length === 0 ? (
              <div className="py-16 text-center text-xs text-gray-400">
                Tidak ada pesan dalam obrolan ini.
              </div>
            ) : (
              auditData.messages.map((msg) => (
                <div
                  key={msg.id}
                  className={cn(
                    'p-3 rounded-xl border text-xs space-y-1',
                    msg.isDeleted
                      ? 'bg-red-50/50 dark:bg-red-950/20 border-red-200 dark:border-red-900/40'
                      : 'bg-white dark:bg-gray-800/80 border-gray-200 dark:border-gray-700'
                  )}
                >
                  <div className="flex items-center justify-between gap-2">
                    <div className="flex items-center gap-2">
                      <span className="font-bold text-gray-900 dark:text-white">
                        {msg.sender.name}
                      </span>
                      <Badge
                        variant={getRoleBadgeVariant(msg.sender.role)}
                        className="text-[9px] px-1 py-0 h-3.5"
                      >
                        {getRoleLabel(msg.sender.role)}
                      </Badge>

                      {msg.isDeleted && (
                        <Badge
                          variant="destructive"
                          className="text-[9px] px-1 py-0 h-3.5 gap-0.5 bg-red-600 text-white"
                        >
                          <AlertTriangle className="w-2.5 h-2.5" />
                          <span>Pesan Dihapus Pengguna</span>
                        </Badge>
                      )}
                    </div>

                    <span className="text-[10px] text-gray-400">
                      {new Date(msg.createdAt).toLocaleString('id-ID', {
                        day: 'numeric',
                        month: 'short',
                        year: 'numeric',
                        hour: '2-digit',
                        minute: '2-digit',
                        second: '2-digit',
                      })}
                    </span>
                  </div>

                  <p className="text-gray-800 dark:text-gray-200 whitespace-pre-wrap pl-0.5">
                    {msg.content}
                  </p>
                </div>
              ))
            )}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
