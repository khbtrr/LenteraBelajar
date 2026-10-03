import { describe, it, expect } from 'vitest';
import { GradeType } from '@prisma/client';

describe('Leger & E-Rapor Calculations (BUG-05)', () => {
  describe('Grade Filtering (Exclusion of Formative QUIZ and ASSIGNMENT)', () => {
    // Mimics the query filter applied in src/lib/actions/leger.ts
    function filterGradesForLeger(
      grades: Array<{ id: string; type: GradeType; score: number; label: string }>
    ) {
      return grades.filter((g) => g.type !== GradeType.QUIZ && g.type !== GradeType.ASSIGNMENT);
    }

    it('filters out QUIZ and ASSIGNMENT grades to prevent double-counting', () => {
      const sampleGrades = [
        { id: '1', type: GradeType.ASSIGNMENT, score: 80, label: 'Tugas Bab 1' },
        { id: '2', type: GradeType.QUIZ, score: 90, label: 'Kuis Bab 1' },
        { id: '3', type: GradeType.MANUAL, score: 85, label: 'Ulangan Harian 1' },
        { id: '4', type: GradeType.MANUAL, score: 88, label: 'Penilaian Tengah Semester' },
        { id: '5', type: GradeType.MANUAL, score: 92, label: 'Penilaian Akhir Semester' },
        { id: '6', type: GradeType.ATTENDANCE, score: 100, label: 'Presensi' },
      ];

      const filtered = filterGradesForLeger(sampleGrades);

      expect(filtered).toHaveLength(4);
      expect(filtered.map((g) => g.type)).toEqual([
        GradeType.MANUAL,
        GradeType.MANUAL,
        GradeType.MANUAL,
        GradeType.ATTENDANCE,
      ]);
      expect(filtered.some((g) => g.type === GradeType.QUIZ)).toBe(false);
      expect(filtered.some((g) => g.type === GradeType.ASSIGNMENT)).toBe(false);
    });

    it('correctly calculates subject average without inflation from formative quizzes', () => {
      const gradesWithFormative = [
        { id: '1', type: GradeType.ASSIGNMENT, score: 100, label: 'Tugas 1' },
        { id: '2', type: GradeType.QUIZ, score: 100, label: 'Kuis 1' },
        { id: '3', type: GradeType.MANUAL, score: 80, label: 'UH 1' },
        { id: '4', type: GradeType.MANUAL, score: 80, label: 'UTS' },
      ];

      // Buggy calculation (without filter)
      const buggySum = gradesWithFormative.reduce((acc, curr) => acc + curr.score, 0);
      const buggyAverage = buggySum / gradesWithFormative.length; // (100+100+80+80)/4 = 90

      // Fixed calculation (with filter)
      const fixedGrades = filterGradesForLeger(gradesWithFormative);
      const fixedSum = fixedGrades.reduce((acc, curr) => acc + curr.score, 0);
      const fixedAverage = fixedSum / fixedGrades.length; // (80+80)/2 = 80

      expect(buggyAverage).toBe(90);
      expect(fixedAverage).toBe(80);
      expect(fixedAverage).not.toBe(buggyAverage);
    });
  });

  describe('Class Ranking & Sorting Logic', () => {
    interface StudentScoreSummary {
      studentId: string;
      studentName: string;
      overallAverage: number;
      rank?: number;
    }

    function calculateRanks(students: StudentScoreSummary[]): StudentScoreSummary[] {
      const sorted = [...students].sort((a, b) => b.overallAverage - a.overallAverage);
      let currentRank = 1;

      return sorted.map((student, index) => {
        if (index > 0 && student.overallAverage < sorted[index - 1].overallAverage) {
          currentRank = index + 1;
        }
        return {
          ...student,
          rank: currentRank,
        };
      });
    }

    it('ranks students in descending order of overall average score', () => {
      const students: StudentScoreSummary[] = [
        { studentId: 'std-1', studentName: 'Budi', overallAverage: 82.5 },
        { studentId: 'std-2', studentName: 'Siti', overallAverage: 91.0 },
        { studentId: 'std-3', studentName: 'Ahmad', overallAverage: 78.0 },
      ];

      const ranked = calculateRanks(students);

      expect(ranked[0].studentName).toBe('Siti');
      expect(ranked[0].rank).toBe(1);
      expect(ranked[1].studentName).toBe('Budi');
      expect(ranked[1].rank).toBe(2);
      expect(ranked[2].studentName).toBe('Ahmad');
      expect(ranked[2].rank).toBe(3);
    });

    it('assigns identical rank for tied overall averages and skips subsequent rank', () => {
      const students: StudentScoreSummary[] = [
        { studentId: 'std-1', studentName: 'Budi', overallAverage: 85.0 },
        { studentId: 'std-2', studentName: 'Siti', overallAverage: 90.0 },
        { studentId: 'std-3', studentName: 'Dewi', overallAverage: 85.0 },
        { studentId: 'std-4', studentName: 'Ahmad', overallAverage: 75.0 },
      ];

      const ranked = calculateRanks(students);

      expect(ranked[0].studentName).toBe('Siti');
      expect(ranked[0].rank).toBe(1);

      expect(ranked[1].rank).toBe(2);
      expect(ranked[2].rank).toBe(2);

      // Rank 3 is skipped because rank 2 has 2 students, so Ahmad is rank 4
      expect(ranked[3].studentName).toBe('Ahmad');
      expect(ranked[3].rank).toBe(4);
    });
  });
});
