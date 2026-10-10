import { describe, expect, it } from 'vitest';
import { gradeAnswers, effectiveQuizScore, normalizeScore, parseSelectedOptions } from '@/lib/grading-policy';

describe('shared grading policy', () => {
  it('grades the immutable answer key and keeps essays pending', () => {
    const result = gradeAnswers([
      { id: 'q1', type: 'MULTIPLE_CHOICE', text: 'One', points: 2, options: [], _correctData: [{ id: 'a', text: 'A', isCorrect: true }] },
      { id: 'q2', type: 'ESSAY', text: 'Two', points: 3, options: null, _correctData: null },
    ], [{ questionId: 'q1', answer: 'a' }]);
    expect(result.score).toBeNull();
    expect(result.isGraded).toBe(false);
    expect(result.answers.map((answer) => answer.score)).toEqual([2, null]);
  });
  it('uses one capped remedial value rather than another average component', () => {
    expect(effectiveQuizScore(40, 100, 75)).toBe(75);
    expect(effectiveQuizScore(90, 100, 75)).toBe(90);
    expect(normalizeScore(10, 10)).toBe(100);
  });
  it('parses both accepted complex answer formats', () => {
    expect(parseSelectedOptions('["b","a"]')).toEqual(['A', 'B']);
    expect(parseSelectedOptions('b,a')).toEqual(['A', 'B']);
  });
});
