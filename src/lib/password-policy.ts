/**
 * Centralized Password Policy and Validation
 *
 * Rules:
 * - Minimum 8 characters
 * - At least one uppercase letter (A-Z)
 * - At least one lowercase letter (a-z)
 * - At least one digit (0-9)
 */

export interface PasswordValidationResult {
  isValid: boolean;
  error?: string;
}

export function validatePassword(password: string): PasswordValidationResult {
  if (!password) {
    return { isValid: false, error: 'Kata sandi tidak boleh kosong' };
  }

  if (password.length < 8) {
    return { isValid: false, error: 'Kata sandi harus memiliki minimal 8 karakter' };
  }

  if (password.length > 72) {
    return { isValid: false, error: 'Kata sandi tidak boleh melebihi 72 karakter' };
  }

  if (!/[A-Z]/.test(password)) {
    return { isValid: false, error: 'Kata sandi harus mengandung minimal 1 huruf besar (A-Z)' };
  }

  if (!/[a-z]/.test(password)) {
    return { isValid: false, error: 'Kata sandi harus mengandung minimal 1 huruf kecil (a-z)' };
  }

  if (!/[0-9]/.test(password)) {
    return { isValid: false, error: 'Kata sandi harus mengandung minimal 1 angka (0-9)' };
  }

  return { isValid: true };
}

/**
 * Generate a strong default password compliant with the password policy
 * Used for initial user creation and batch imports.
 */
export function generateDefaultPassword(identifier?: string | null): string {
  if (identifier && identifier.trim().length > 0) {
    const cleanId = identifier.trim().replace(/[^a-zA-Z0-9]/g, '');
    return `Lentera${cleanId}!`;
  }
  return 'Lentera2026!';
}

const UPPER = 'ABCDEFGHJKLMNPQRSTUVWXYZ';
const LOWER = 'abcdefghijkmnopqrstuvwxyz';
const DIGITS = '23456789';
const SYMBOLS = '!@#$%*?';
const RANDOM_PASSWORD_LENGTH = 14;

function randomIndex(max: number): number {
  // Rejection sampling avoids modulo bias.
  const limit = Math.floor(0x100000000 / max) * max;
  const buffer = new Uint32Array(1);
  do {
    globalThis.crypto.getRandomValues(buffer);
  } while (buffer[0] >= limit);
  return buffer[0] % max;
}

function pick(chars: string): string {
  return chars[randomIndex(chars.length)];
}

/** One-time password from a CSPRNG that always satisfies validatePassword. */
export function generateRandomPassword(): string {
  const all = UPPER + LOWER + DIGITS + SYMBOLS;
  const chars = [pick(UPPER), pick(LOWER), pick(DIGITS), pick(SYMBOLS)];
  while (chars.length < RANDOM_PASSWORD_LENGTH) chars.push(pick(all));
  for (let i = chars.length - 1; i > 0; i--) {
    const j = randomIndex(i + 1);
    [chars[i], chars[j]] = [chars[j], chars[i]];
  }
  return chars.join('');
}

const PREDICTABLE_PASSWORD_ROLES = new Set(['STUDENT', 'TEACHER']);

export function hasPredictableInitialPassword(role: string, identifier?: string | null): boolean {
  return PREDICTABLE_PASSWORD_ROLES.has(role) && !!identifier && identifier.trim().length > 0;
}

/** `generated` is true when the password is random and must be shown to the admin once. */
export function resolveInitialPassword(
  role: string,
  identifier?: string | null,
): { password: string; generated: boolean } {
  if (hasPredictableInitialPassword(role, identifier)) {
    return { password: generateDefaultPassword(identifier), generated: false };
  }
  return { password: generateRandomPassword(), generated: true };
}

