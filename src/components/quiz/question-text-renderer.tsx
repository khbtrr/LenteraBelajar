'use client';

import React from 'react';
import { QuizAudioPlayer } from './quiz-audio-player';
import { QuizVideoPlayer } from './quiz-video-player';

interface QuestionTextRendererProps {
  text: string;
  questionId: string;
  attemptId?: string;
  className?: string;
}

/**
 * Preprocesses text containing [Audio: url] or [Video: url] tags into standard data-placeholders
 */
export function preprocessQuestionMedia(text: string): string {
  if (!text) return '';

  // Audio tag: [Audio: url] or [Audio: url, maxPlay: 2] or [Suara: url, putar: 1]
  const audioRegex = /\[(?:Audio|Suara):\s*([^,\]]+)(?:,\s*(?:maxPlay|putar):\s*(\d+))?\]/gi;
  let processed = text.replace(audioRegex, (_match, url, maxPlay) => {
    const cleanUrl = url.trim();
    const limitAttr = maxPlay ? ` data-max-play="${maxPlay.trim()}"` : '';
    return `<div class="quiz-media-audio" data-src="${cleanUrl}"${limitAttr}></div>`;
  });

  // Video tag: [Video: url] or [YouTube: url]
  const videoRegex = /\[(?:Video|YouTube|Tonton):\s*([^\]]+)\]/gi;
  processed = processed.replace(videoRegex, (_match, url) => {
    const cleanUrl = url.trim();
    return `<div class="quiz-media-video" data-src="${cleanUrl}"></div>`;
  });

  return processed;
}

export function QuestionTextRenderer({
  text,
  questionId,
  attemptId = 'direct',
  className = '',
}: QuestionTextRendererProps) {
  const processedText = preprocessQuestionMedia(text);

  // Check if there are any media placeholders
  const placeholderRegex = /<div class="quiz-media-(audio|video)"\s+data-src="([^"]+)"(?:\s+data-max-play="(\d+)")?\s*><\/div>/gi;

  if (!placeholderRegex.test(processedText)) {
    // Fast path: No custom media placeholders, render regular HTML
    return (
      <div
        className={className}
        dangerouslySetInnerHTML={{ __html: processedText }}
      />
    );
  }

  // Reset regex index
  placeholderRegex.lastIndex = 0;

  const elements: React.ReactNode[] = [];
  let lastIndex = 0;
  let match: RegExpExecArray | null;
  let partIndex = 0;

  while ((match = placeholderRegex.exec(processedText)) !== null) {
    const matchStart = match.index;
    const matchEnd = placeholderRegex.lastIndex;

    // HTML before placeholder
    if (matchStart > lastIndex) {
      const htmlChunk = processedText.substring(lastIndex, matchStart);
      if (htmlChunk.trim()) {
        elements.push(
          <div
            key={`chunk-${partIndex++}`}
            className="leading-relaxed"
            dangerouslySetInnerHTML={{ __html: htmlChunk }}
          />
        );
      }
    }

    const mediaType = match[1];
    const src = match[2];
    const maxPlayStr = match[3];
    const maxPlays = maxPlayStr ? parseInt(maxPlayStr, 10) : null;

    if (mediaType === 'audio') {
      // Create unique hash based on src and question to track playback counts
      const cleanSrcHash = src.split('/').pop()?.replace(/[^a-zA-Z0-9]/g, '') || 'audio';
      const storageKey = `${attemptId}_${questionId}_${cleanSrcHash}`;

      elements.push(
        <QuizAudioPlayer
          key={`audio-${partIndex++}`}
          src={src}
          maxPlays={maxPlays}
          storageKey={storageKey}
        />
      );
    } else if (mediaType === 'video') {
      elements.push(
        <QuizVideoPlayer
          key={`video-${partIndex++}`}
          src={src}
        />
      );
    }

    lastIndex = matchEnd;
  }

  // Remaining HTML after last match
  if (lastIndex < processedText.length) {
    const htmlChunk = processedText.substring(lastIndex);
    if (htmlChunk.trim()) {
      elements.push(
        <div
          key={`chunk-${partIndex++}`}
          className="leading-relaxed"
          dangerouslySetInnerHTML={{ __html: htmlChunk }}
        />
      );
    }
  }

  return <div className={`space-y-2 ${className}`}>{elements}</div>;
}
