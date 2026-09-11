import mammoth from 'mammoth';

export interface ParsedOption {
  id: string;
  text: string;
  isCorrect: boolean;
}

export interface ParsedQuestion {
  type: 'MULTIPLE_CHOICE' | 'ESSAY';
  text: string;
  points: number;
  options: ParsedOption[];
}

export interface ParseResult {
  questions: ParsedQuestion[];
  warnings: string[];
}

export type ImageHandler = (imageBuffer: Buffer, contentType: string) => Promise<string>;

export async function parseDocxQuestions(
  buffer: Buffer,
  imageHandler?: ImageHandler
): Promise<ParseResult> {
  const options: any = {};

  if (imageHandler) {
    options.convertImage = mammoth.images.imgElement(async (image: any) => {
      const imgBuffer = await image.read();
      const contentType = image.contentType || 'image/png';
      const src = await imageHandler(imgBuffer, contentType);
      return { src };
    });
  } else {
    // Default fallback: base64 data URI so images still show in preview
    options.convertImage = mammoth.images.imgElement(async (image: any) => {
      const imgBuffer = await image.read();
      const contentType = image.contentType || 'image/png';
      return {
        src: `data:${contentType};base64,${imgBuffer.toString('base64')}`,
      };
    });
  }

  const result = await mammoth.convertToHtml({ buffer }, options);
  const html = result.value;

  // Split into paragraphs / top level tags
  const blockRegex = /<p[^>]*>([\s\S]*?)<\/p>|<h[1-6][^>]*>([\s\S]*?)<\/h[1-6]>/gi;
  const blocks: string[] = [];
  let m: RegExpExecArray | null;
  while ((m = blockRegex.exec(html)) !== null) {
    const content = (m[1] !== undefined ? m[1] : m[2]).trim();
    if (content) blocks.push(content);
  }

  const questions: ParsedQuestion[] = [];
  const warnings: string[] = [];

  let currentQuestion: ParsedQuestion | null = null;
  let questionNumber = 0;

  // Track shared reading passages (Wacana / Cerita)
  let activePassage: string | null = null;
  let isInPassageBlock = false;

  for (let i = 0; i < blocks.length; i++) {
    const block = blocks[i];

    // Extract plain text for regex matching (strip html tags)
    const textOnly = block.replace(/<[^>]+>/g, '').trim();

    // Check for story passage tags: [Cerita] or [Wacana]
    if (textOnly.match(/^\[(?:Cerita|Wacana)\]/i)) {
      isInPassageBlock = true;
      const cleanBlock = block.replace(/^\s*(?:<[^>]+>)*\s*\[(?:Cerita|Wacana)\]/i, '').trim();
      activePassage = cleanBlock;
      // Check if closed in same block
      if (textOnly.match(/\[\/(?:Cerita|Wacana)\]/i)) {
        isInPassageBlock = false;
        activePassage = activePassage.replace(/\[\/(?:Cerita|Wacana)\]/gi, '').trim();
      }
      continue;
    }

    if (textOnly.match(/\[\/(?:Cerita|Wacana)\]/i)) {
      isInPassageBlock = false;
      const cleanBlock = block.replace(/\[\/(?:Cerita|Wacana)\]/gi, '').trim();
      if (cleanBlock) {
        activePassage = activePassage ? `${activePassage}<br/>${cleanBlock}` : cleanBlock;
      }
      continue;
    }

    if (isInPassageBlock) {
      activePassage = activePassage ? `${activePassage}<br/>${block}` : block;
      continue;
    }

    // Check if new question: "1. Apa..." or "1. [Essay] Jelaskan..."
    const qMatch = textOnly.match(/^(\d+)\.\s+(.*)/);
    if (qMatch) {
      if (currentQuestion) {
        finalizeQuestion(currentQuestion, questionNumber, warnings, questions);
      }
      questionNumber = parseInt(qMatch[1], 10);
      const isEssay = /\[Essay\]/i.test(qMatch[2]);

      // Strip question number and [Essay] tag from HTML content
      let qHtml = block
        .replace(/^\s*(?:<[^>]+>)*\s*(\d+)\.\s*/i, '')
        .replace(/\[Essay\]/gi, '')
        .trim();

      // If active passage exists, prepend it to question
      let formattedText = qHtml;
      if (activePassage) {
        formattedText = `<div class="story-passage p-3 bg-amber-50/80 border-l-4 border-[#FF8928] rounded mb-3 text-sm text-slate-800">${activePassage}</div>\n${formattedText}`;
      }

      currentQuestion = {
        type: isEssay ? 'ESSAY' : 'MULTIPLE_CHOICE',
        text: formattedText,
        points: isEssay ? 5 : 1,
        options: [],
      };
      continue;
    }

    if (currentQuestion) {
      // Check for points declaration: "Poin: 10"
      const ptMatch = textOnly.match(/^Poin:\s*(\d+(\.\d+)?)/i);
      if (ptMatch) {
        currentQuestion.points = parseFloat(ptMatch[1]);
        continue;
      }

      // Check for option: "A. Option text" or "B. *Correct option text"
      const optMatch = textOnly.match(/^([A-Z])\.\s+(.*)/i);
      if (optMatch && currentQuestion.type === 'MULTIPLE_CHOICE') {
        const id = optMatch[1].toUpperCase();
        let optText = block.replace(/^\s*(?:<[^>]+>)*\s*[A-Z]\.\s+/i, '').trim();
        let isCorrect = false;

        if (optText.startsWith('*') || textOnly.match(/^[A-Z]\.\s+\*/i)) {
          isCorrect = true;
          optText = optText.replace(/^\*/, '').trim();
        }

        // Clean any tags from option text for uniform display
        const cleanOpt = optText.replace(/<[^>]+>/g, '').trim();

        currentQuestion.options.push({
          id,
          text: cleanOpt,
          isCorrect,
        });
        continue;
      }

      // Check if block contains an image: <img ... />
      const imgMatches = block.match(/<img[^>]+src=["'][^"']+["'][^>]*\/?>/gi);
      if (imgMatches && imgMatches.length > 0) {
        // Place image in order: if options haven't started yet, append to question body
        // This naturally places the image above or below the text based on where it appeared in Word!
        if (currentQuestion.options.length === 0) {
          const remainingText = block.replace(/<img[^>]*\/?>/gi, '').replace(/<[^>]+>/g, '').trim();
          currentQuestion.text = `${currentQuestion.text}\n${imgMatches.join('\n')}`.trim();
          if (remainingText) {
            currentQuestion.text += '\n' + remainingText;
          }
        }
        continue;
      }

      // If no other matches, append as text to question body or last option
      if (currentQuestion.options.length === 0) {
        currentQuestion.text += '\n' + textOnly;
      } else {
        const lastOpt = currentQuestion.options[currentQuestion.options.length - 1];
        lastOpt.text += ' ' + textOnly;
      }
    }
  }

  // Push the final question
  if (currentQuestion) {
    finalizeQuestion(currentQuestion, questionNumber, warnings, questions);
  }

  // Include mammoth warnings if any
  if (result.messages && result.messages.length > 0) {
    result.messages.forEach((msg) => warnings.push(`Mammoth: ${msg.message}`));
  }

  return { questions, warnings };
}

function finalizeQuestion(
  q: ParsedQuestion,
  num: number,
  warnings: string[],
  questions: ParsedQuestion[]
) {
  if (q.type === 'MULTIPLE_CHOICE') {
    if (q.options.length < 2) {
      warnings.push(`Soal #${num}: Membutuhkan minimal 2 opsi jawaban, soal dilewati.`);
      return; // Skip malformed question
    }
    const hasCorrect = q.options.some((o) => o.isCorrect);
    if (!hasCorrect) {
      warnings.push(`Soal #${num}: Tidak ada jawaban benar yang ditandai.`);
    }
  }
  questions.push(q);
}
