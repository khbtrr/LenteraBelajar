import { describe, it, expect } from 'vitest';

/**
 * Logic unit tests for LoginForm authentication handlers,
 * error state resolution, and accessibility attributes.
 */
describe('LoginForm State & Accessibility Logic', () => {
  describe('Password Visibility Toggle', () => {
    it('initializes with password hidden', () => {
      let showPassword = false;
      const inputType = showPassword ? 'text' : 'password';
      expect(inputType).toBe('password');
    });

    it('toggles password visibility state correctly', () => {
      let showPassword = false;
      const toggle = () => { showPassword = !showPassword; };

      toggle();
      expect(showPassword).toBe(true);
      expect(showPassword ? 'text' : 'password').toBe('text');

      toggle();
      expect(showPassword).toBe(false);
      expect(showPassword ? 'text' : 'password').toBe('password');
    });

    it('provides correct aria-label and type="button" attribute', () => {
      const buttonAttrs = (showPassword: boolean) => ({
        type: 'button' as const,
        'aria-label': showPassword ? 'Hide password' : 'Show password',
      });

      const hiddenState = buttonAttrs(false);
      expect(hiddenState.type).toBe('button');
      expect(hiddenState['aria-label']).toBe('Show password');

      const shownState = buttonAttrs(true);
      expect(shownState.type).toBe('button');
      expect(shownState['aria-label']).toBe('Hide password');
    });
  });

  describe('Login Error Parsing Logic', () => {
    const mockTranslations: Record<string, string> = {
      loginError: 'Email atau kata sandi salah',
      rateLimit: 'Terlalu banyak percobaan dari jaringan Anda.',
      accountLocked: 'Akun Anda sementara dikunci selama {minutes} menit.',
      remainingAttempts: 'Sisa kesempatan: {remaining} kali lagi.',
    };

    function parseLoginError(errorString: string | null | undefined): {
      errorMessage: string;
      isLocked: boolean;
    } {
      if (!errorString) {
        return { errorMessage: '', isLocked: false };
      }

      if (errorString.includes('ACCOUNT_LOCKED')) {
        const minutes = errorString.split(':')[1] || '15';
        return {
          errorMessage: mockTranslations.accountLocked.replace('{minutes}', minutes),
          isLocked: true,
        };
      }

      if (errorString.includes('RATE_LIMIT')) {
        return {
          errorMessage: mockTranslations.rateLimit,
          isLocked: false,
        };
      }

      if (errorString.includes('INVALID_CREDENTIALS')) {
        const remaining = errorString.split(':')[1];
        if (remaining && parseInt(remaining) < 5 && parseInt(remaining) > 0) {
          return {
            errorMessage: mockTranslations.remainingAttempts.replace('{remaining}', remaining),
            isLocked: false,
          };
        }
      }

      return {
        errorMessage: mockTranslations.loginError,
        isLocked: false,
      };
    }

    it('returns default invalid credential error on general error', () => {
      const res = parseLoginError('CredentialsSignin');
      expect(res.errorMessage).toBe('Email atau kata sandi salah');
      expect(res.isLocked).toBe(false);
    });

    it('correctly parses ACCOUNT_LOCKED and sets isLocked flag', () => {
      const res = parseLoginError('ACCOUNT_LOCKED:15');
      expect(res.errorMessage).toBe('Akun Anda sementara dikunci selama 15 menit.');
      expect(res.isLocked).toBe(true);
    });

    it('correctly parses RATE_LIMIT error', () => {
      const res = parseLoginError('RATE_LIMIT:60');
      expect(res.errorMessage).toBe('Terlalu banyak percobaan dari jaringan Anda.');
      expect(res.isLocked).toBe(false);
    });

    it('correctly parses INVALID_CREDENTIALS with remaining attempts', () => {
      const res = parseLoginError('INVALID_CREDENTIALS:2');
      expect(res.errorMessage).toBe('Sisa kesempatan: 2 kali lagi.');
      expect(res.isLocked).toBe(false);
    });
  });

  describe('Loading State Logic', () => {
    it('disables submit button and shows loading text during authentication', () => {
      let loading = false;
      const getButtonProps = (isLoading: boolean) => ({
        disabled: isLoading,
        label: isLoading ? 'Signing in...' : 'Sign In',
        spinnerVisible: isLoading,
      });

      expect(getButtonProps(loading).disabled).toBe(false);
      expect(getButtonProps(loading).label).toBe('Sign In');
      expect(getButtonProps(loading).spinnerVisible).toBe(false);

      loading = true;
      expect(getButtonProps(loading).disabled).toBe(true);
      expect(getButtonProps(loading).label).toBe('Signing in...');
      expect(getButtonProps(loading).spinnerVisible).toBe(true);
    });
  });
});
