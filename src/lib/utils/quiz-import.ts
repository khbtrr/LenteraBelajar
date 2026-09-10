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

export async function parseDocxQuestions(buffer: Buffer): Promise<ParseResult> {
  const result = await mammoth.extractRawText({ buffer });
  const text = result.value;
  const lines = text.split(/\r?\n/);

  const questions: ParsedQuestion[] = [];
  const warnings: string[] = [];

  let currentQuestion: ParsedQuestion | null = null;
  let questionNumber = 0;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trim();
    if (!line) continue;

    // Match new question: "1. Apa..." or "1. [Essay] Jelaskan..."
    const qMatch = line.match(/^(\d+)\.\s+(.*)/);
    if (qMatch) {
      if (currentQuestion) {
        finalizeQuestion(currentQuestion, questionNumber, warnings, questions);
      }
      questionNumber = parseInt(qMatch[1], 10);
      const rawText = qMatch[2];
      const isEssay = /\[Essay\]/i.test(rawText);
      const cleanText = rawText.replace(/\[Essay\]/gi, '').trim();

      currentQuestion = {
        type: isEssay ? 'ESSAY' : 'MULTIPLE_CHOICE',
        text: cleanText,
        points: isEssay ? 5 : 1,
        options: [],
      };
      continue;
    }

    if (currentQuestion) {
      // Check for points declaration
      const ptMatch = line.match(/^Poin:\s*(\d+(\.\d+)?)/i);
      if (ptMatch) {
        currentQuestion.points = parseFloat(ptMatch[1]);
        continue;
      }

      // Check for option: "A. Option text" or "B. *Correct option text"
      const optMatch = line.match(/^([A-Z])\.\s+(.*)/i);
      if (optMatch && currentQuestion.type === 'MULTIPLE_CHOICE') {
        const id = optMatch[1].toUpperCase();
        let optText = optMatch[2].trim();
        let isCorrect = false;

        if (optText.startsWith('*')) {
          isCorrect = true;
          optText = optText.substring(1).trim();
        }

        currentQuestion.options.push({
          id,
          text: optText,
          isCorrect,
        });
        continue;
      }

      // If no other matches, append as text to either the question body or the last option
      if (currentQuestion.options.length === 0) {
        currentQuestion.text += '\n' + line;
      } else {
        const lastOpt = currentQuestion.options[currentQuestion.options.length - 1];
        lastOpt.text += '\n' + line;
      }
    }
  }

  // Push the final question
  if (currentQuestion) {
    finalizeQuestion(currentQuestion, questionNumber, warnings, questions);
  }

  // Also include mammoth warnings if any
  if (result.messages && result.messages.length > 0) {
    result.messages.forEach(msg => warnings.push(`Mammoth: ${msg.message}`));
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
