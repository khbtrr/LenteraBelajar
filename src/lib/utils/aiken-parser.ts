export interface ParsedAikenOption {
  id: string;
  text: string;
  isCorrect: boolean;
}

export interface ParsedAikenQuestion {
  type: 'MULTIPLE_CHOICE' | 'MULTIPLE_CHOICE_COMPLEX' | 'ESSAY';
  text: string;
  points: number;
  options: ParsedAikenOption[];
}

export interface AikenParseResult {
  questions: ParsedAikenQuestion[];
  warnings: string[];
}

/**
 * Parses raw text in Moodle Aiken format into structured questions.
 * Supports:
 * - Standard Aiken single choice: ANSWER: A
 * - Complex multi-choice: ANSWER: A, C or ANSWER: A,C
 * - Indonesian localized keywords: KUNCI: A, JAWABAN: A
 * - Optional points line: POIN: 2, POINTS: 2, BOBOT: 2
 * - Option markers: A. or A)
 */
export function parseAikenText(rawText: string): AikenParseResult {
  const warnings: string[] = [];
  const questions: ParsedAikenQuestion[] = [];

  if (!rawText || !rawText.trim()) {
    return { questions, warnings: ['Teks sumber kosong.'] };
  }

  // Remove Byte Order Mark (BOM) and normalize line breaks
  const cleanText = rawText.replace(/^\uFEFF/, '').replace(/\r\n/g, '\n').replace(/\r/g, '\n');

  const lines = cleanText.split('\n');

  let currentQuestionTextLines: string[] = [];
  let currentOptions: { id: string; text: string }[] = [];
  let currentAnswers: string[] = [];
  let currentPoints = 1;
  let isCollectingOptions = false;
  let questionNumber = 0;

  const flushQuestion = () => {
    const questionText = currentQuestionTextLines.join('\n').trim();
    if (!questionText && currentOptions.length === 0 && currentAnswers.length === 0) {
      resetCurrent();
      return;
    }

    questionNumber++;

    if (!questionText) {
      warnings.push(`Soal #${questionNumber}: Teks pertanyaan tidak ditemukan, soal dilewati.`);
      resetCurrent();
      return;
    }

    // Check if it is an essay question (no options)
    if (currentOptions.length === 0) {
      questions.push({
        type: 'ESSAY',
        text: questionText,
        points: currentPoints,
        options: [],
      });
      resetCurrent();
      return;
    }

    // Multiple choice validation
    if (currentOptions.length < 2) {
      warnings.push(`Soal #${questionNumber} ("${questionText.slice(0, 30)}..."): Membutuhkan minimal 2 opsi jawaban, soal dilewati.`);
      resetCurrent();
      return;
    }

    if (currentAnswers.length === 0) {
      warnings.push(`Soal #${questionNumber} ("${questionText.slice(0, 30)}..."): Baris kunci jawaban (ANSWER:) tidak ditemukan.`);
    }

    // Validate if answers match available option keys
    const validOptionIds = currentOptions.map((o) => o.id.toUpperCase());
    for (const ans of currentAnswers) {
      if (!validOptionIds.includes(ans.toUpperCase())) {
        warnings.push(`Soal #${questionNumber}: Kunci jawaban '${ans}' tidak terdapat pada daftar opsi (${validOptionIds.join(', ')}).`);
      }
    }

    const isComplex = currentAnswers.length > 1;
    const finalType: 'MULTIPLE_CHOICE' | 'MULTIPLE_CHOICE_COMPLEX' = isComplex
      ? 'MULTIPLE_CHOICE_COMPLEX'
      : 'MULTIPLE_CHOICE';

    const normalizedAnswers = currentAnswers.map((a) => a.toUpperCase());

    const optionsWithCorrect: ParsedAikenOption[] = currentOptions.map((opt) => ({
      id: opt.id.toUpperCase(),
      text: opt.text.trim(),
      isCorrect: normalizedAnswers.includes(opt.id.toUpperCase()),
    }));

    questions.push({
      type: finalType,
      text: questionText,
      points: currentPoints,
      options: optionsWithCorrect,
    });

    resetCurrent();
  };

  const resetCurrent = () => {
    currentQuestionTextLines = [];
    currentOptions = [];
    currentAnswers = [];
    currentPoints = 1;
    isCollectingOptions = false;
  };

  for (let i = 0; i < lines.length; i++) {
    const rawLine = lines[i];
    const line = rawLine.trim();

    if (!line) {
      // Empty line signals the end of current question block if we already have options & answer
      if (currentOptions.length > 0 && currentAnswers.length > 0) {
        flushQuestion();
      }
      continue;
    }

    // 1. Check for Points declaration: POINTS: 2, POIN: 2, BOBOT: 2
    const pointsMatch = line.match(/^(?:POINTS?|POIN|BOBOT)\s*:\s*(\d+(?:\.\d+)?)/i);
    if (pointsMatch) {
      currentPoints = parseFloat(pointsMatch[1]);
      continue;
    }

    // 2. Check for Answer line: ANSWER: A or ANSWER: A, C or KUNCI: A
    const answerMatch = line.match(/^(?:ANSWER|JAWABAN|KUNCI)\s*:\s*(.+)$/i);
    if (answerMatch) {
      const ansString = answerMatch[1].trim();
      const rawLetters = ansString
        .split(/[,\s&/]+/)
        .map((s) => s.replace(/[^A-Za-z0-9]/g, '').trim().toUpperCase())
        .filter(Boolean);

      currentAnswers.push(...rawLetters);
      isCollectingOptions = false;
      continue;
    }

    // 3. Check for Option line: A. or A) or A -
    const optionMatch = line.match(/^([A-Za-z0-9])[\.\)\-]\s+(.+)$/);
    if (optionMatch) {
      isCollectingOptions = true;
      currentOptions.push({
        id: optionMatch[1].toUpperCase(),
        text: optionMatch[2],
      });
      continue;
    }

    // 4. Line continuation or Question Text
    if (isCollectingOptions && currentOptions.length > 0) {
      currentOptions[currentOptions.length - 1].text += ' ' + line;
    } else {
      currentQuestionTextLines.push(rawLine);
    }
  }

  // Flush any trailing question
  if (currentQuestionTextLines.length > 0 || currentOptions.length > 0) {
    flushQuestion();
  }

  return { questions, warnings };
}
