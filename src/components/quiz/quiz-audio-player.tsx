'use client';

import { useState, useRef, useEffect } from 'react';
import { Play, Pause, Volume2, VolumeX, Headphones, AlertCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';

interface QuizAudioPlayerProps {
  src: string;
  maxPlays?: number | null;
  storageKey?: string;
  title?: string;
}

export function QuizAudioPlayer({
  src,
  maxPlays = null,
  storageKey,
  title = 'Audio Soal Listening',
}: QuizAudioPlayerProps) {
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [isMuted, setIsMuted] = useState(false);
  const [hasError, setHasError] = useState(false);

  // Play count tracking
  const [playCount, setPlayCount] = useState<number>(() => {
    if (typeof window !== 'undefined' && storageKey) {
      const saved = localStorage.getItem(`quiz_audio_${storageKey}`);
      if (saved) {
        const parsed = parseInt(saved, 10);
        return isNaN(parsed) ? 0 : parsed;
      }
    }
    return 0;
  });

  const parsedMaxPlays = maxPlays !== null && maxPlays !== undefined && maxPlays > 0 ? Number(maxPlays) : null;
  const remainingPlays = parsedMaxPlays !== null ? Math.max(0, parsedMaxPlays - playCount) : null;
  const isLocked = remainingPlays !== null && remainingPlays <= 0;

  // Sync play count changes to localStorage
  useEffect(() => {
    if (typeof window !== 'undefined' && storageKey) {
      localStorage.setItem(`quiz_audio_${storageKey}`, String(playCount));
    }
  }, [playCount, storageKey]);

  // Audio event listeners
  const handleTimeUpdate = () => {
    if (audioRef.current) {
      setCurrentTime(audioRef.current.currentTime);
    }
  };

  const handleLoadedMetadata = () => {
    if (audioRef.current) {
      setDuration(audioRef.current.duration);
    }
  };

  const handleEnded = () => {
    setIsPlaying(false);
    setCurrentTime(0);
    // When playback ends, record 1 finished play if limit is active
    if (parsedMaxPlays !== null) {
      setPlayCount((prev) => {
        const next = prev + 1;
        if (typeof window !== 'undefined' && storageKey) {
          localStorage.setItem(`quiz_audio_${storageKey}`, String(next));
        }
        return next;
      });
    }
  };

  const handlePlayToggle = () => {
    if (isLocked || !audioRef.current) return;

    if (isPlaying) {
      audioRef.current.pause();
      setIsPlaying(false);
    } else {
      audioRef.current
        .play()
        .then(() => {
          setIsPlaying(true);
        })
        .catch((err) => {
          console.error('Audio play failed:', err);
          setHasError(true);
        });
    }
  };

  const handleSeek = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!audioRef.current || isLocked) return;
    const newTime = parseFloat(e.target.value);
    audioRef.current.currentTime = newTime;
    setCurrentTime(newTime);
  };

  const toggleMute = () => {
    if (!audioRef.current) return;
    audioRef.current.muted = !isMuted;
    setIsMuted(!isMuted);
  };

  const formatSeconds = (sec: number) => {
    if (isNaN(sec) || sec === 0) return '00:00';
    const mins = Math.floor(sec / 60);
    const secs = Math.floor(sec % 60);
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  return (
    <div className="w-full my-3 p-4 rounded-xl border border-brand-200 dark:border-gray-800 bg-brand-25/60 dark:bg-gray-900 shadow-xs">
      <audio
        ref={audioRef}
        src={src}
        preload="metadata"
        onTimeUpdate={handleTimeUpdate}
        onLoadedMetadata={handleLoadedMetadata}
        onEnded={handleEnded}
        onError={() => setHasError(true)}
      />

      {/* Header Info: Title & Play limit badge */}
      <div className="flex flex-wrap items-center justify-between gap-2 mb-3">
        <div className="flex items-center gap-2">
          <div className="p-1.5 rounded-lg bg-brand-500 text-white">
            <Headphones className="w-4 h-4" />
          </div>
          <span className="text-xs sm:text-sm font-semibold text-[#002446] dark:text-white">{title}</span>
        </div>

        <div>
          {parsedMaxPlays !== null ? (
            isLocked ? (
              <Badge variant="destructive" className="text-[11px] px-2.5 py-0.5 font-bold flex items-center gap-1">
                <AlertCircle className="w-3 h-3" /> Batas Putar Habis ({playCount}/{parsedMaxPlays})
              </Badge>
            ) : (
              <Badge className="bg-amber-100 text-amber-900 border border-amber-300 text-[11px] px-2.5 py-0.5 font-semibold">
                Sisa Putar: {remainingPlays}x ({playCount}/{parsedMaxPlays})
              </Badge>
            )
          ) : (
            <Badge variant="outline" className="text-slate-600 bg-white/80 border-slate-300 text-[11px] px-2.5 py-0.5">
              Bebas Putar
            </Badge>
          )}
        </div>
      </div>

      {hasError ? (
        <div className="p-2.5 text-xs text-red-700 bg-red-50 border border-red-200 rounded-lg flex items-center gap-2">
          <AlertCircle className="w-4 h-4 shrink-0" />
          <span>Berkas audio tidak dapat diputar. Periksa format atau koneksi berkas.</span>
        </div>
      ) : (
        /* Player Controls */
        <div className="space-y-2">
          <div className="flex items-center gap-3">
            {/* Play / Pause Button */}
            <Button
              type="button"
              size="icon"
              disabled={isLocked}
              onClick={handlePlayToggle}
              className={`h-10 w-10 shrink-0 rounded-full text-white shadow-sm transition-transform active:scale-95 ${
                isLocked
                  ? 'bg-gray-300 cursor-not-allowed hover:bg-gray-300'
                  : isPlaying
                  ? 'bg-amber-600 hover:bg-amber-700'
                  : 'bg-[#002446] hover:bg-[#002446]/90'
              }`}
            >
              {isPlaying ? <Pause className="w-4 h-4" /> : <Play className="w-4 h-4 ml-0.5" />}
            </Button>

            {/* Slider & Duration */}
            <div className="flex-1 space-y-1">
              <input
                type="range"
                min={0}
                max={duration || 100}
                step={0.1}
                value={currentTime}
                onChange={handleSeek}
                disabled={isLocked || duration === 0}
                className="w-full h-1.5 bg-gray-200 rounded-lg appearance-none cursor-pointer accent-[#002446] disabled:cursor-not-allowed"
              />
              <div className="flex items-center justify-between text-[11px] text-gray-500 font-mono">
                <span>{formatSeconds(currentTime)}</span>
                <span>{formatSeconds(duration)}</span>
              </div>
            </div>

            {/* Mute Button */}
            <Button
              type="button"
              variant="ghost"
              size="icon"
              onClick={toggleMute}
              className="h-8 w-8 text-gray-500 hover:text-[#002446]"
            >
              {isMuted ? <VolumeX className="w-4 h-4" /> : <Volume2 className="w-4 h-4" />}
            </Button>
          </div>

          {isLocked && (
            <p className="text-[11px] text-red-600 italic text-center sm:text-left">
              * Anda telah menggunakan seluruh kuota pemutaran ({parsedMaxPlays}x) untuk audio ini.
            </p>
          )}
        </div>
      )}
    </div>
  );
}
