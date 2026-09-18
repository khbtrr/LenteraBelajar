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
