import { describe, it, expect } from 'vitest';
import { checkRateLimit, getClientIp } from '@/lib/rate-limit';

describe('Rate Limiting & Client IP Extraction', () => {
  describe('Sliding Window Rate Limiter', () => {
    it('allows requests within specified threshold', () => {
      const key = `test-rate-limit-${Date.now()}-1`;
      const limit = 3;
      const windowMs = 5000;

      const first = checkRateLimit(key, limit, windowMs);
      expect(first.success).toBe(true);
      expect(first.remaining).toBe(2);

      const second = checkRateLimit(key, limit, windowMs);
      expect(second.success).toBe(true);
      expect(second.remaining).toBe(1);

      const third = checkRateLimit(key, limit, windowMs);
      expect(third.success).toBe(true);
      expect(third.remaining).toBe(0);
    });

    it('blocks subsequent requests exceeding limit', () => {
      const key = `test-rate-limit-${Date.now()}-2`;
      const limit = 2;
      const windowMs = 5000;

      checkRateLimit(key, limit, windowMs);
      checkRateLimit(key, limit, windowMs);

      const blocked = checkRateLimit(key, limit, windowMs);
      expect(blocked.success).toBe(false);
      expect(blocked.remaining).toBe(0);
      expect(blocked.resetInSeconds).toBeGreaterThan(0);
    });

    it('isolates counters for different identifier keys', () => {
      const keyA = `user-a-${Date.now()}`;
      const keyB = `user-b-${Date.now()}`;
      const limit = 1;
      const windowMs = 5000;

      const resA1 = checkRateLimit(keyA, limit, windowMs);
      expect(resA1.success).toBe(true);

      const resA2 = checkRateLimit(keyA, limit, windowMs);
      expect(resA2.success).toBe(false);

      // Key B must not be affected by Key A exhaustion
      const resB1 = checkRateLimit(keyB, limit, windowMs);
      expect(resB1.success).toBe(true);
    });
  });

  describe('Client IP Resolution from Headers', () => {
    it('extracts client IP from single x-forwarded-for header', () => {
      const headers = new Headers({ 'x-forwarded-for': '198.51.100.42' });
      expect(getClientIp(headers)).toBe('198.51.100.42');
    });

    it('extracts originating client IP from comma-separated x-forwarded-for proxy chain', () => {
      const headers = new Headers({
        'x-forwarded-for': '203.0.113.195, 70.41.3.18, 150.172.238.178',
      });
      expect(getClientIp(headers)).toBe('203.0.113.195');
    });

    it('falls back to x-real-ip when x-forwarded-for is absent', () => {
      const headers = new Headers({ 'x-real-ip': '192.0.2.10' });
      expect(getClientIp(headers)).toBe('192.0.2.10');
    });

    it('falls back to cf-connecting-ip when other forward headers are absent', () => {
      const headers = new Headers({ 'cf-connecting-ip': '198.18.0.5' });
      expect(getClientIp(headers)).toBe('198.18.0.5');
    });

    it('defaults to 127.0.0.1 when no remote address headers are present', () => {
      const headers = new Headers();
      expect(getClientIp(headers)).toBe('127.0.0.1');
    });
  });
});
