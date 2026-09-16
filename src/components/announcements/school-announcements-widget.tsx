'use client';

import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import { AnnouncementPriority, AnnouncementTarget } from '@prisma/client';
import {
  Megaphone,
  AlertOctagon,
  AlertTriangle,
  Info,
  Pin,
  X,
  ChevronRight,
  ExternalLink,
} from 'lucide-react';

export interface SchoolAnnouncementData {
  id: string;
  title: string;
  content: string;
  targetRole: AnnouncementTarget;
  priority: AnnouncementPriority;
  isPinned: boolean;
  createdAt: Date;
  expiresAt: Date | null;
  author: {
    name: string;
  };
}

export function SchoolAnnouncementsWidget({
  announcements,
}: {
  announcements: SchoolAnnouncementData[];
}) {
  const [selectedItem, setSelectedItem] = useState<SchoolAnnouncementData | null>(null);
  const [dismissedIds, setDismissedIds] = useState<Set<string>>(new Set());
  const [isClient, setIsClient] = useState(false);

  useEffect(() => {
    setIsClient(true);
    // Load dismissed announcements from localStorage
    try {
      const stored = localStorage.getItem('lentera_dismissed_announcements');
      if (stored) {
        setDismissedIds(new Set(JSON.parse(stored)));
      }
    } catch (e) {
      console.error(e);
    }
  }, []);

  const handleDismiss = (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    const updated = new Set(dismissedIds);
    updated.add(id);
    setDismissedIds(updated);
    try {
      localStorage.setItem('lentera_dismissed_announcements', JSON.stringify(Array.from(updated)));
    } catch (e) {
      console.error(e);
    }
  };

  if (!announcements || announcements.length === 0) {
    return null;
  }

  const urgentList = announcements.filter((a) => a.priority === AnnouncementPriority.URGENT);
  const regularList = announcements.filter(
    (a) => a.priority !== AnnouncementPriority.URGENT && (!isClient || !dismissedIds.has(a.id))
  );

  if (urgentList.length === 0 && regularList.length === 0) {
    return null;
  }

  return (
    <div className="space-y-4">
      {/* 1. URGENT Floating Alert Banner */}
      {urgentList.map((item) => (
        <div
          key={item.id}
          onClick={() => setSelectedItem(item)}
          className="relative overflow-hidden p-4 rounded-xl bg-gradient-to-r from-rose-600 to-red-700 text-white shadow-md flex items-center justify-between gap-4 cursor-pointer hover:shadow-lg transition-all group"
        >
          <div className="flex items-center gap-3.5 min-w-0">
            <div className="w-10 h-10 rounded-xl bg-white/20 flex items-center justify-center flex-shrink-0 animate-pulse">
              <AlertOctagon className="w-6 h-6 text-white" />
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <span className="text-[10px] font-bold uppercase tracking-wider bg-white/20 px-2 py-0.5 rounded-full">
                  PENGUMUMAN MENDESAK
                </span>
                <span className="text-xs text-white/80">
                  {new Date(item.createdAt).toLocaleDateString('id-ID', { dateStyle: 'medium' })}
                </span>
              </div>
              <h3 className="font-bold text-sm md:text-base mt-0.5 group-hover:underline truncate">
                {item.title}
              </h3>
            </div>
          </div>

          <div className="flex items-center gap-2 flex-shrink-0">
            <Button
              size="sm"
              variant="secondary"
              className="bg-white text-rose-700 hover:bg-gray-100 font-semibold text-xs h-8 px-3"
            >
              Baca Pengumuman
              <ChevronRight className="w-3.5 h-3.5 ml-1" />
            </Button>
          </div>
        </div>
      ))}

      {/* 2. Regular & Important Announcements Carousel / Card */}
      {regularList.length > 0 && (
        <Card className="border-brand-200 dark:border-gray-800 bg-gradient-to-br from-brand-50/40 to-white dark:from-gray-900 dark:to-gray-900/60 shadow-xs">
          <CardHeader className="pb-3 flex flex-row items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="w-7 h-7 rounded-lg bg-[#002446] text-white flex items-center justify-center">
                <Megaphone className="w-4 h-4 text-[#FF8928]" />
              </div>
              <CardTitle className="text-sm font-bold text-[#002446] dark:text-white">
                Pengumuman Resmi Sekolah
              </CardTitle>
            </div>
            <span className="text-xs text-gray-500 font-medium">
              {regularList.length} Pengumuman
            </span>
          </CardHeader>
          <CardContent className="space-y-2.5">
            {regularList.map((item) => (
              <div
                key={item.id}
                onClick={() => setSelectedItem(item)}
                className={`p-3.5 rounded-xl border transition-all cursor-pointer flex items-start justify-between gap-3 group ${
                  item.priority === AnnouncementPriority.IMPORTANT
                    ? 'bg-amber-50/50 dark:bg-amber-950/20 border-amber-200 dark:border-amber-900/50 hover:bg-amber-50 dark:hover:bg-amber-950/30'
                    : 'bg-white dark:bg-gray-800/60 border-gray-200 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-800'
                }`}
              >
                <div className="space-y-1 min-w-0 flex-1">
                  <div className="flex items-center gap-2 flex-wrap">
                    {item.isPinned && (
                      <Badge className="bg-amber-100 text-amber-800 border-amber-300 text-[10px] flex items-center gap-1">
                        <Pin className="w-3 h-3 fill-amber-700 text-amber-700" />
                        Disematkan
                      </Badge>
                    )}
                    {item.priority === AnnouncementPriority.IMPORTANT && (
                      <Badge className="bg-amber-500 text-white text-[10px] flex items-center gap-1">
                        <AlertTriangle className="w-3 h-3" />
                        Penting
                      </Badge>
                    )}
                    <span className="text-[11px] text-gray-500">
                      {new Date(item.createdAt).toLocaleDateString('id-ID', { dateStyle: 'medium' })}
                    </span>
                    <span className="text-[11px] text-gray-400">• oleh {item.author.name}</span>
                  </div>

                  <h4 className="font-bold text-sm text-[#002446] dark:text-white group-hover:text-brand-600 transition-colors">
                    {item.title}
                  </h4>

                  <div
                    className="text-xs text-gray-600 dark:text-gray-400 line-clamp-1 max-w-xl"
                    dangerouslySetInnerHTML={{
                      __html: item.content.replace(/<[^>]+>/g, ' ').slice(0, 120),
                    }}
                  />
                </div>

                <div className="flex items-center gap-1.5 flex-shrink-0 pt-1">
                  <button
                    type="button"
                    onClick={(e) => handleDismiss(item.id, e)}
                    className="p-1 rounded-md text-gray-400 hover:text-gray-600 hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
                    title="Sembunyikan Pengumuman Ini"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>
              </div>
            ))}
          </CardContent>
        </Card>
      )}

      {/* Detail Modal Dialog */}
      <Dialog open={!!selectedItem} onOpenChange={(open) => !open && setSelectedItem(null)}>
        <DialogContent className="sm:max-w-2xl max-h-[85vh] overflow-y-auto">
          {selectedItem && (
            <div className="space-y-4">
              <DialogHeader>
                <div className="flex items-center gap-2 mb-1.5">
                  {selectedItem.priority === AnnouncementPriority.URGENT ? (
                    <Badge className="bg-rose-600 text-white">Mendesak</Badge>
                  ) : selectedItem.priority === AnnouncementPriority.IMPORTANT ? (
                    <Badge className="bg-amber-500 text-white">Penting</Badge>
                  ) : (
                    <Badge variant="secondary">Informasi</Badge>
                  )}
                  {selectedItem.isPinned && (
                    <Badge variant="outline" className="text-amber-600 border-amber-300">
                      Disematkan
                    </Badge>
                  )}
                </div>
                <DialogTitle className="text-xl font-bold text-[#002446] dark:text-white text-left">
                  {selectedItem.title}
                </DialogTitle>
                <div className="text-xs text-gray-500 text-left">
                  Diterbitkan oleh <strong className="text-gray-700 dark:text-gray-300">{selectedItem.author.name}</strong> pada {new Date(selectedItem.createdAt).toLocaleDateString('id-ID', { dateStyle: 'full' })}
                </div>
              </DialogHeader>

              <div
                className="prose dark:prose-invert max-w-none text-sm leading-relaxed border-t border-b border-gray-100 dark:border-gray-800 py-4"
                dangerouslySetInnerHTML={{ __html: selectedItem.content }}
              />

              <DialogFooter>
                <Button variant="outline" onClick={() => setSelectedItem(null)}>
                  Tutup
                </Button>
              </DialogFooter>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
