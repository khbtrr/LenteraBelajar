import { sanitizeRichText } from '@/lib/rich-text';

export interface SnapshotQuestion {
  id: string;
  type: 'MULTIPLE_CHOICE' | 'MULTIPLE_CHOICE_COMPLEX' | 'ESSAY';
  text: string;
  points: number;
  options: { id: string; text: string }[] | null;
  _correctData: { id: string; text: string; isCorrect: boolean }[] | null;
}
export interface AnswerInput { questionId: string; answer: string }

export function normalizeScore(score: number, maxScore: number): number {
  if (!Number.isFinite(score) || !Number.isFinite(maxScore) || maxScore <= 0) throw new Error('Skala nilai tidak valid');
  return Math.max(0, Math.min(100, score / maxScore * 100));
}

export function effectiveQuizScore(original: number | null, remedial: number | null, kkm: number): number | null {
  if (original === null) return null;
  return remedial === null ? original : Math.max(original, Math.min(remedial, kkm));
}

export function parseSelectedOptions(answer: string): string[] {
  let values: unknown = answer.split(',');
  if (answer.trim().startsWith('[')) {
    try { values = JSON.parse(answer); } catch { return []; }
  }
  if (!Array.isArray(values) || values.some((value) => typeof value !== 'string')) return [];
  return values.map((value: string) => value.trim().toUpperCase()).filter(Boolean).sort();
}

export function readSnapshot(raw: unknown): SnapshotQuestion[] {
  if (!Array.isArray(raw) || raw.length === 0) throw new Error('LEGACY_SNAPSHOT_REVIEW: Snapshot soal perlu ditinjau pengajar');
  const ids = new Set<string>();
  return raw.map((value) => {
    if (!value || typeof value !== 'object' || typeof value.id !== 'string' || !value.id.trim() || ids.has(value.id)
      || !['MULTIPLE_CHOICE', 'MULTIPLE_CHOICE_COMPLEX', 'ESSAY'].includes(value.type)
      || !Number.isFinite(value.points) || value.points <= 0) throw new Error('LEGACY_SNAPSHOT_REVIEW: Snapshot soal tidak valid');
    ids.add(value.id);
    const correct = value._correctData ?? value.options;
    if (value.type !== 'ESSAY' && (!Array.isArray(correct) || !correct.length
      || correct.some((option) => !option || typeof option.id !== 'string' || !option.id.trim() || typeof option.isCorrect !== 'boolean')
      || new Set(correct.map((option) => option.id.trim().toUpperCase())).size !== correct.length
      || !correct.some((option) => option.isCorrect)
      || (value.type === 'MULTIPLE_CHOICE' && correct.filter((option) => option.isCorrect).length !== 1))) {
      throw new Error('LEGACY_SNAPSHOT_REVIEW: Kunci snapshot tidak tersedia');
    }
    if (value.type !== 'ESSAY' && value.options != null && (!Array.isArray(value.options)
      || value.options.length !== correct.length
      || value.options.some((option: { id: string }) => !option || typeof option.id !== 'string'
        || !correct.some((key: { id: string }) => key.id === option.id))
      || new Set(value.options.map((option: { id: string }) => option.id)).size !== value.options.length)) {
      throw new Error('LEGACY_SNAPSHOT_REVIEW: Pilihan snapshot tidak cocok dengan kunci');
    }
    return {
      id: value.id, type: value.type, text: sanitizeRichText(String(value.text ?? '')), points: value.points,
      options: value.type === 'ESSAY' ? null : (value.options ?? correct).map((option: { id: string; text: string }) => ({ id: option.id, text: String(option.text ?? '') })),
      _correctData: value.type === 'ESSAY' ? null : correct.map((option: { id: string; text: string; isCorrect: boolean }) => ({ id: option.id, text: String(option.text ?? ''), isCorrect: option.isCorrect })),
    };
  });
}

export function gradeAnswers(questions: SnapshotQuestion[], inputs: AnswerInput[]) {
  const answersById = new Map(inputs.map((answer) => [answer.questionId, answer.answer]));
  const answers = questions.map((question) => {
    const answer = answersById.get(question.id) ?? '';
    if (question.type === 'ESSAY') return { questionId: question.id, answer, score: null };
    const correct = (question._correctData ?? []).filter((option) => option.isCorrect).map((option) => option.id.trim().toUpperCase()).sort();
    const selected = parseSelectedOptions(answer);
    const matches = correct.length > 0 && selected.length === correct.length && selected.every((id, index) => id === correct[index]);
    return { questionId: question.id, answer, score: matches ? question.points : 0 };
  });
  const isGraded = !questions.some((question) => question.type === 'ESSAY');
  const earned = answers.reduce((sum, answer) => sum + (answer.score ?? 0), 0);
  const possible = questions.reduce((sum, question) => sum + question.points, 0);
  return { answers, isGraded, score: isGraded ? normalizeScore(earned, possible) : null };
}
