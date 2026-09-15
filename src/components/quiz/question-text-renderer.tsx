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
    return `<div class="quiz-media-audio my-3" data-src="${cleanUrl}"${limitAttr}></div>`;
  });

  // Video tag: [Video: url] or [YouTube: url] or [Video: url, maxPlay: 2]
  const videoRegex = /\[(?:Video|YouTube|Tonton):\s*([^,\]]+)(?:,\s*(?:maxPlay|putar):\s*(\d+))?\]/gi;
  processed = processed.replace(videoRegex, (_match, url, maxPlay) => {
    const cleanUrl = url.trim();
    const limitAttr = maxPlay ? ` data-max-play="${maxPlay.trim()}"` : '';
    return `<div class="quiz-media-video my-3" data-src="${cleanUrl}"${limitAttr}></div>`;
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

  // Flexible regex to match any media div placeholder regardless of extra classes (my-3) or self-closing
  const placeholderRegex = /<div\b[^>]*\bclass="[^"]*quiz-media-(audio|video)[^"]*"[^>]*>(?:<\/div>)?/gi;

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
    const fullTag = match[0];

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

    const isAudio = /quiz-media-audio/i.test(fullTag);
    const isVideo = /quiz-media-video/i.test(fullTag);
    const srcMatch = fullTag.match(/data-src=["']([^"']+)["']/i);
    const maxPlayMatch = fullTag.match(/data-max-play=["'](\d+)["']/i);

    const src = srcMatch ? srcMatch[1] : '';
    const maxPlays = maxPlayMatch ? parseInt(maxPlayMatch[1], 10) : null;

    if (src) {
      const cleanSrcHash = src.split('/').pop()?.replace(/[^a-zA-Z0-9]/g, '') || 'media';
      const storageKey = `${attemptId}_${questionId}_${cleanSrcHash}`;

      if (isAudio) {
        elements.push(
          <QuizAudioPlayer
            key={`audio-${partIndex++}`}
            src={src}
            maxPlays={maxPlays}
            storageKey={storageKey}
          />
        );
      } else if (isVideo) {
        elements.push(
          <QuizVideoPlayer
            key={`video-${partIndex++}`}
            src={src}
            maxPlays={maxPlays}
            storageKey={storageKey}
          />
        );
      }
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
