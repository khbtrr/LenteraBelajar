import { describe, it, expect } from 'vitest';
import { normalizeText, calculateSimilarity } from '@/lib/erapor-autofill';

describe('e-Rapor Student Matching & Text Normalization', () => {
  describe('Text Normalization for Comparison', () => {
    it('lowercases and trims string', () => {
      expect(normalizeText('  AHMAD FADLI  ')).toBe('ahmad fadli');
    });

    it('strips punctuation symbols and collapses excessive whitespace', () => {
      expect(normalizeText('Dr. Ir. H. Budi, M.Pd.')).toBe('dr ir h budi mpd');
      expect(normalizeText('Siti   Nurhaliza  (Kelas 10)')).toBe('siti nurhaliza kelas 10');
    });

    it('returns empty string for null or empty inputs', () => {
      expect(normalizeText('')).toBe('');
      expect(normalizeText(null as any)).toBe('');
      expect(normalizeText(undefined as any)).toBe('');
    });
  });

  describe('Sorensen-Dice Bigram Similarity Calculation', () => {
    it('returns 1 for exactly identical normalized strings', () => {
      expect(calculateSimilarity('Budi Santoso', 'budi santoso')).toBe(1);
    });

    it('returns 0 when either string is empty', () => {
      expect(calculateSimilarity('', 'Budi Santoso')).toBe(0);
      expect(calculateSimilarity('Budi Santoso', '')).toBe(0);
    });

    it('returns 0.9 for substring containment', () => {
      expect(calculateSimilarity('Muhammad Rizky', 'Rizky')).toBe(0.9);
      expect(calculateSimilarity('Siti', 'Siti Aminah')).toBe(0.9);
    });

    it('yields high similarity score for minor spelling variations and typos', () => {
      const score = calculateSimilarity('Muhammad Rizki', 'Mohammad Rizky');
      expect(score).toBeGreaterThan(0.7);
    });

    it('yields low similarity score for completely distinct names', () => {
      const score = calculateSimilarity('Ahmad Dahlan', 'Dewi Sartika');
      expect(score).toBeLessThan(0.3);
    });
  });
});
