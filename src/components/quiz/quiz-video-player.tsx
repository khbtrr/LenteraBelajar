'use client';

import { Video, ExternalLink } from 'lucide-react';

interface QuizVideoPlayerProps {
  src: string;
  title?: string;
}

export function QuizVideoPlayer({ src, title = 'Video Soal' }: QuizVideoPlayerProps) {
  // Check if YouTube
  const youtubeRegex = /(?:youtube\.com\/(?:[^\/]+\/.+\/|(?:v|e(?:mbed)?|shorts)\/|.*[?&]v=)|youtu\.be\/)([^"&?\/\s]{11})/i;
  const ytMatch = src.match(youtubeRegex);
  const youtubeId = ytMatch ? ytMatch[1] : null;

  return (
    <div className="w-full my-3 rounded-xl border border-gray-200 overflow-hidden bg-slate-900 shadow-sm">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-2 bg-slate-800 text-white text-xs">
        <div className="flex items-center gap-2 font-medium">
          <Video className="w-3.5 h-3.5 text-[#FF8928]" />
          <span>{title}</span>
        </div>
        {youtubeId && (
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
        {youtubeId ? (
          <iframe
            src={`https://www.youtube-nocookie.com/embed/${youtubeId}?rel=0&modestbranding=1`}
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
