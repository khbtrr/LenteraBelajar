import { describe, expect, it } from 'vitest';
import { gradeAnswers, effectiveQuizScore, normalizeScore, parseSelectedOptions, readSnapshot } from '@/lib/grading-policy';

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
  it.each([null, [], {}, '[]', [null], [{ id: 'q', type: 'ESSAY', points: 0 }],
    [{ id: 'q', type: 'MULTIPLE_CHOICE', points: 1, options: [] }],
    [{ id: 'q', type: 'MULTIPLE_CHOICE', points: 1, options: [{ id: 'a', isCorrect: false }] }],
    [{ id: 'q', type: 'MULTIPLE_CHOICE', points: 1, options: [{ id: 'a', isCorrect: true }, { id: 'b', isCorrect: true }] }],
    [{ id: 'q', type: 'MULTIPLE_CHOICE_COMPLEX', points: 1, options: [{ id: 'a', isCorrect: true }, { id: 'A', isCorrect: false }] }],
  ])('rejects unusable snapshots for review rather than assigning zero (%j)', (snapshot) => {
    expect(() => readSnapshot(snapshot)).toThrow(/LEGACY_SNAPSHOT_REVIEW/);
  });
  it('rejects public options that no longer match the immutable key', () => {
    expect(() => readSnapshot([{ id: 'q', type: 'MULTIPLE_CHOICE', points: 1,
      options: [{ id: 'b' }], _correctData: [{ id: 'a', isCorrect: true }] }])).toThrow(/LEGACY_SNAPSHOT_REVIEW/);
  });
  it('accepts a complete objective snapshot and essay without a key', () => {
    const snapshot = readSnapshot([{ id: 'q', type: 'MULTIPLE_CHOICE', points: 1, options: [{ id: 'a', text: 'A', isCorrect: true }] },
      { id: 'essay', type: 'ESSAY', points: 2, text: 'Explain' }]);
    expect(gradeAnswers(snapshot, [{ questionId: 'q', answer: 'a' }]).isGraded).toBe(false);
  });
});
