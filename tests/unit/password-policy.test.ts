import { describe, it, expect } from 'vitest';
import { validatePassword, generateDefaultPassword } from '@/lib/password-policy';

describe('Password Policy & Default Generation', () => {
  describe('Password Complexity Validation', () => {
    it('rejects empty or whitespace-only password', () => {
      expect(validatePassword('').isValid).toBe(false);
      expect(validatePassword('').error).toBe('Kata sandi tidak boleh kosong');
    });

    it('rejects passwords shorter than 8 characters', () => {
      const result = validatePassword('Ab1!');
      expect(result.isValid).toBe(false);
      expect(result.error).toBe('Kata sandi harus memiliki minimal 8 karakter');
    });

    it('rejects passwords missing uppercase letters', () => {
      const result = validatePassword('password123');
      expect(result.isValid).toBe(false);
      expect(result.error).toBe('Kata sandi harus mengandung minimal 1 huruf besar (A-Z)');
    });

    it('rejects passwords missing lowercase letters', () => {
      const result = validatePassword('PASSWORD123');
      expect(result.isValid).toBe(false);
      expect(result.error).toBe('Kata sandi harus mengandung minimal 1 huruf kecil (a-z)');
    });

    it('rejects passwords missing numeric digits', () => {
      const result = validatePassword('PasswordTanpaAngka');
      expect(result.isValid).toBe(false);
      expect(result.error).toBe('Kata sandi harus mengandung minimal 1 angka (0-9)');
    });

    it('accepts valid passwords meeting all complexity criteria', () => {
      const validCases = [
        'Lentera2026!',
        'SiswaCerdas#99',
        'GuruPintar123',
        'Abcd1234XYZ',
      ];

      for (const pass of validCases) {
        const result = validatePassword(pass);
        expect(result.isValid).toBe(true);
        expect(result.error).toBeUndefined();
      }
    });
  });

  describe('Default Password Generator', () => {
    it('returns default fallback password when identifier is null or empty', () => {
      expect(generateDefaultPassword(null)).toBe('Lentera2026!');
      expect(generateDefaultPassword(undefined)).toBe('Lentera2026!');
      expect(generateDefaultPassword('')).toBe('Lentera2026!');
      expect(generateDefaultPassword('   ')).toBe('Lentera2026!');
    });

    it('sanitizes special characters from identifier and prefixes with Lentera', () => {
      expect(generateDefaultPassword('NIS-2026/001')).toBe('LenteraNIS2026001!');
      expect(generateDefaultPassword('user@email.com')).toBe('Lenterauseremailcom!');
      expect(generateDefaultPassword('123456')).toBe('Lentera123456!');
    });

    it('ensures generated passwords for valid school identifiers (NIS/NIP) satisfy complexity requirements', () => {
      const testIdentifiers = ['12345', 'NIS-2026-001', 'NIP-19850101', null, ''];
      for (const id of testIdentifiers) {
        const generated = generateDefaultPassword(id);
        const validation = validatePassword(generated);
        expect(validation.isValid).toBe(true);
      }
    });
  });
});
