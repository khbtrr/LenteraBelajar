'use client';

import { useState, useEffect, useRef } from 'react';
import { Video, ExternalLink, Play, Lock, AlertCircle } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';

interface QuizVideoPlayerProps {
  src: string;
  title?: string;
  maxPlays?: number | null;
  storageKey?: string;
}

export function QuizVideoPlayer({
  src,
  title = 'Video Soal',
  maxPlays = null,
  storageKey = '',
}: QuizVideoPlayerProps) {
  // Check if YouTube
  const youtubeRegex = /(?:youtube\.com\/(?:[^\/]+\/.+\/|(?:v|e(?:mbed)?|shorts)\/|.*[?&]v=)|youtu\.be\/)([^"&?\/\s]{11})/i;
  const ytMatch = src.match(youtubeRegex);
  const youtubeId = ytMatch ? ytMatch[1] : null;

  // Track play count
  const [playCount, setPlayCount] = useState<number>(() => {
    if (typeof window === 'undefined' || !storageKey) return 0;
    try {
      const saved = localStorage.getItem(`quiz_video_${storageKey}`);
      return saved ? parseInt(saved, 10) : 0;
    } catch {
      return 0;
    }
  });

  const [hasStartedPlaying, setHasStartedPlaying] = useState<boolean>(() => {
    // If no limit, show player immediately
    if (maxPlays === null) return true;
    return false;
  });

  const isQuotaExceeded = maxPlays !== null && playCount >= maxPlays;
  const hasCountedRef = useRef(false);

  // Sync to localStorage
  useEffect(() => {
    if (!storageKey || typeof window === 'undefined') return;
    try {
      localStorage.setItem(`quiz_video_${storageKey}`, String(playCount));
    } catch (e) {
      console.warn('Failed to save video play count to localStorage', e);
    }
  }, [playCount, storageKey]);

  const handleStartVideo = () => {
    if (isQuotaExceeded) return;
    if (maxPlays !== null && !hasCountedRef.current) {
      hasCountedRef.current = true;
      setPlayCount((prev) => prev + 1);
    }
    setHasStartedPlaying(true);
  };

  const handleHtmlVideoPlay = () => {
    if (isQuotaExceeded) return;
    if (maxPlays !== null && !hasCountedRef.current) {
      hasCountedRef.current = true;
      setPlayCount((prev) => prev + 1);
    }
  };

  return (
    <div className="w-full my-3 rounded-xl border border-gray-200 overflow-hidden bg-slate-900 shadow-sm">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-2 bg-slate-800 text-white text-xs flex-wrap gap-2">
        <div className="flex items-center gap-2 font-medium">
          <Video className="w-3.5 h-3.5 text-[#FF8928]" />
          <span>{title}</span>
          {maxPlays !== null && (
            <Badge
              variant="outline"
              className={`text-[10px] px-1.5 py-0.5 border ${
                isQuotaExceeded
                  ? 'bg-red-900/50 text-red-300 border-red-500'
                  : 'bg-amber-950/60 text-amber-300 border-amber-500/50'
              }`}
            >
              {isQuotaExceeded
                ? `Batas Putar Habis (${maxPlays}/${maxPlays})`
                : `Putar: ${playCount}/${maxPlays}x (Sisa ${Math.max(0, maxPlays - playCount)}x)`}
            </Badge>
          )}
        </div>
        {youtubeId && !isQuotaExceeded && (
          <a
            href={src}
            target="_blank"
            rel="noreferrer"
            className="text-[11px] text-gray-300 hover:text-white flex items-center gap-1"
          >
            Buka di YouTube <ExternalLink className="w-3 h-3" />
          </a>
        )}
      </div>

      {/* Video Content */}
      <div className="relative w-full aspect-video bg-black flex items-center justify-center">
        {isQuotaExceeded ? (
          <div className="flex flex-col items-center justify-center p-6 text-center text-gray-400 space-y-2">
            <Lock className="w-10 h-10 text-red-500 mb-1" />
            <p className="text-sm font-semibold text-white">Batas Pemutaran Video Habis</p>
            <p className="text-xs text-gray-400 max-w-sm">
              Anda telah mencapai batas maksimal pemutaran video ({maxPlays}/{maxPlays} kali) untuk soal ini.
            </p>
          </div>
        ) : !hasStartedPlaying && maxPlays !== null ? (
          <div className="flex flex-col items-center justify-center p-6 text-center space-y-3">
            <div className="w-14 h-14 rounded-full bg-[#FF8928]/20 flex items-center justify-center text-[#FF8928]">
              <Video className="w-7 h-7" />
            </div>
            <div className="space-y-1">
              <p className="text-sm font-semibold text-white">Video Soal (Batas Putar: {maxPlays}x)</p>
              <p className="text-xs text-gray-400 max-w-sm">
                Sisa kesempatan memutar: <strong className="text-amber-400">{Math.max(0, maxPlays - playCount)} kali</strong>. Pastikan Anda siap menyimak sebelum memutar.
              </p>
            </div>
            <Button
              type="button"
              onClick={handleStartVideo}
              className="bg-[#FF8928] hover:bg-[#FF8928]/90 text-white text-xs flex items-center gap-1.5 px-4 h-8"
            >
              <Play className="w-3.5 h-3.5 fill-current" /> Putar Video Sekarang ({playCount + 1}/{maxPlays})
            </Button>
          </div>
        ) : youtubeId ? (
          <iframe
            src={`https://www.youtube-nocookie.com/embed/${youtubeId}?rel=0&modestbranding=1&autoplay=1`}
            title={title}
            className="absolute inset-0 w-full h-full border-0"
            allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
            allowFullScreen
          />
        ) : (
          <video
            controls
            controlsList="nodownload"
            preload="metadata"
            onPlay={handleHtmlVideoPlay}
            className="w-full h-full object-contain max-h-[420px]"
          >
            <source src={src} />
            Browser Anda tidak mendukung pemutaran video.
          </video>
        )}
      </div>
    </div>
  );
}
