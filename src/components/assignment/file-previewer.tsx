'use client';

import React, { useState } from 'react';
import {
  FileText,
  Image as ImageIcon,
  FileArchive,
  Download,
  ExternalLink,
  ZoomIn,
  ZoomOut,
  RotateCw,
  RefreshCw,
  AlertCircle,
} from 'lucide-react';
import { Button } from '@/components/ui/button';

interface FilePreviewerProps {
  fileUrl: string;
  fileName: string;
  fileSize?: number;
  className?: string;
}

export function FilePreviewer({
  fileUrl,
  fileName,
  fileSize,
  className = '',
}: FilePreviewerProps) {
  const [zoom, setZoom] = useState(1);
  const [rotation, setRotation] = useState(0);
  const [imageError, setImageError] = useState(false);

  const ext = (fileName.split('.').pop() || '').toLowerCase();
  const isImage = ['jpg', 'jpeg', 'png', 'webp', 'gif', 'svg'].includes(ext);
  const isPdf = ext === 'pdf';
  const isArchive = ['zip', 'rar', '7z', 'tar', 'gz'].includes(ext);
  const isDoc = ['doc', 'docx', 'xls', 'xlsx', 'ppt', 'pptx', 'txt'].includes(ext);

  const formatFileSize = (bytes?: number) => {
    if (!bytes) return '';
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  const handleZoomIn = () => setZoom((prev) => Math.min(prev + 0.25, 3));
  const handleZoomOut = () => setZoom((prev) => Math.max(prev - 0.25, 0.5));
  const handleRotate = () => setRotation((prev) => (prev + 90) % 360);
  const handleReset = () => {
    setZoom(1);
    setRotation(0);
  };

  return (
    <div className={`flex flex-col h-full bg-slate-900 rounded-lg overflow-hidden border border-slate-700 shadow-inner ${className}`}>
      {/* Top Toolbar */}
      <div className="flex items-center justify-between px-4 py-2 bg-slate-800 border-b border-slate-700 text-xs text-slate-200">
        <div className="flex items-center gap-2 truncate max-w-[50%]">
          {isImage ? (
            <ImageIcon className="h-4 w-4 text-emerald-400 shrink-0" />
          ) : isPdf ? (
            <FileText className="h-4 w-4 text-red-400 shrink-0" />
          ) : isArchive ? (
            <FileArchive className="h-4 w-4 text-amber-400 shrink-0" />
          ) : (
            <FileText className="h-4 w-4 text-blue-400 shrink-0" />
          )}
          <span className="font-medium truncate" title={fileName}>
            {fileName}
          </span>
          {fileSize && (
            <span className="text-slate-400 text-[11px] shrink-0">
              ({formatFileSize(fileSize)})
            </span>
          )}
        </div>

        <div className="flex items-center gap-1.5 shrink-0">
          {isImage && (
            <>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={handleZoomOut}
                disabled={zoom <= 0.5}
                className="h-7 w-7 p-0 text-slate-300 hover:text-white hover:bg-slate-700"
                title="Perkecil"
              >
                <ZoomOut className="h-3.5 w-3.5" />
              </Button>
              <span className="text-[11px] text-slate-400 font-mono px-1 select-none">
                {Math.round(zoom * 100)}%
              </span>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={handleZoomIn}
                disabled={zoom >= 3}
                className="h-7 w-7 p-0 text-slate-300 hover:text-white hover:bg-slate-700"
                title="Perbesar"
              >
                <ZoomIn className="h-3.5 w-3.5" />
              </Button>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={handleRotate}
                className="h-7 w-7 p-0 text-slate-300 hover:text-white hover:bg-slate-700"
                title="Putar 90 Derajat"
              >
                <RotateCw className="h-3.5 w-3.5" />
              </Button>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={handleReset}
                className="h-7 w-7 p-0 text-slate-300 hover:text-white hover:bg-slate-700"
                title="Reset Tampilan"
              >
                <RefreshCw className="h-3.5 w-3.5" />
              </Button>
              <div className="w-[1px] h-4 bg-slate-700 mx-1" />
            </>
          )}

          <a
            href={fileUrl}
            target="_blank"
            rel="noreferrer"
            className="inline-flex items-center gap-1 px-2 py-1 rounded text-slate-300 hover:text-white hover:bg-slate-700 transition-colors"
            title="Buka di tab baru"
          >
            <ExternalLink className="h-3.5 w-3.5" />
            <span className="hidden sm:inline text-[11px]">Buka Tab Baru</span>
          </a>

          <a
            href={fileUrl}
            download={fileName}
            className="inline-flex items-center gap-1 px-2 py-1 rounded bg-slate-700 text-white hover:bg-slate-600 transition-colors text-[11px]"
            title="Unduh berkas"
          >
            <Download className="h-3.5 w-3.5" />
            <span className="hidden sm:inline">Unduh</span>
          </a>
        </div>
      </div>

      {/* Main Preview Area */}
      <div className="flex-1 relative overflow-auto flex items-center justify-center p-2 min-h-[360px] bg-slate-950/60">
        {isImage ? (
          imageError ? (
            <div className="text-center p-6 text-slate-400 space-y-2">
              <AlertCircle className="h-10 w-10 text-red-400 mx-auto" />
              <p className="text-sm">Gagal memuat pratinjau gambar.</p>
              <a
                href={fileUrl}
                target="_blank"
                rel="noreferrer"
                className="text-xs text-blue-400 underline block"
              >
                Buka gambar langsung di tab baru
              </a>
            </div>
          ) : (
            <div className="overflow-auto max-h-full max-w-full flex items-center justify-center">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={fileUrl}
                alt={fileName}
                onError={() => setImageError(true)}
                style={{
                  transform: `scale(${zoom}) rotate(${rotation}deg)`,
                  transition: 'transform 0.15s ease-out',
                }}
                className="max-h-[500px] w-auto object-contain rounded shadow-lg select-none"
              />
            </div>
          )
        ) : isPdf ? (
          <iframe
            src={`${fileUrl}#toolbar=1&navpanes=0`}
            title={fileName}
            className="w-full h-full min-h-[520px] rounded border-0 bg-white"
          />
        ) : (
          /* Fallback for Office / Archives / other non-renderable formats */
          <div className="text-center p-8 max-w-md bg-slate-900/90 border border-slate-800 rounded-xl shadow-xl space-y-4">
            <div className="w-16 h-16 rounded-full bg-slate-800 flex items-center justify-center mx-auto text-blue-400">
              {isArchive ? (
                <FileArchive className="h-8 w-8 text-amber-400" />
              ) : isDoc ? (
                <FileText className="h-8 w-8 text-blue-400" />
              ) : (
                <FileText className="h-8 w-8 text-slate-400" />
              )}
            </div>

            <div>
              <h4 className="text-sm font-semibold text-white break-all">{fileName}</h4>
              {fileSize && (
                <p className="text-xs text-slate-400 mt-0.5">{formatFileSize(fileSize)}</p>
              )}
            </div>

            <p className="text-xs text-slate-400 leading-relaxed">
              Berkas berformat <strong>.{ext.toUpperCase()}</strong> tidak dapat dipratinjau langsung di peramban tanpa aplikasi eksternal. Silakan unduh atau buka berkas untuk memeriksanya.
            </p>

            <div className="flex items-center justify-center gap-3 pt-2">
              <a
                href={fileUrl}
                download={fileName}
                className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-[#FF8928] hover:bg-[#FF8928]/90 text-white text-xs font-semibold shadow-md transition-colors"
              >
                <Download className="h-4 w-4" /> Unduh Berkas
              </a>
              <a
                href={fileUrl}
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-medium border border-slate-700 transition-colors"
              >
                <ExternalLink className="h-4 w-4" /> Buka Tab Baru
              </a>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
