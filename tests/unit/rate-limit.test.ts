import { afterEach, beforeEach, describe, it, expect } from 'vitest';
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
    const originalHops = process.env.TRUSTED_PROXY_HOPS;
    const originalHeader = process.env.TRUSTED_CLIENT_IP_HEADER;

    beforeEach(() => {
      delete process.env.TRUSTED_PROXY_HOPS;
      delete process.env.TRUSTED_CLIENT_IP_HEADER;
    });

    afterEach(() => {
      if (originalHops === undefined) delete process.env.TRUSTED_PROXY_HOPS;
      else process.env.TRUSTED_PROXY_HOPS = originalHops;
      if (originalHeader === undefined) delete process.env.TRUSTED_CLIENT_IP_HEADER;
      else process.env.TRUSTED_CLIENT_IP_HEADER = originalHeader;
    });

    it('extracts client IP from single x-forwarded-for header', () => {
      const headers = new Headers({ 'x-forwarded-for': '198.51.100.42' });
      expect(getClientIp(headers)).toBe('198.51.100.42');
    });

    it('ignores client-prepended entries and takes the one added by the single trusted proxy', () => {
      const headers = new Headers({ 'x-forwarded-for': '203.0.113.9, 198.51.100.42' });
      expect(getClientIp(headers)).toBe('198.51.100.42');
    });

    it('does not let a rotating spoofed leftmost entry change the resolved IP', () => {
      const resolved = new Set(
        ['1.1.1.1', '2.2.2.2', '3.3.3.3'].map((fake) =>
          getClientIp(new Headers({ 'x-forwarded-for': `${fake}, 198.51.100.42` }))
        )
      );
      expect([...resolved]).toEqual(['198.51.100.42']);
    });

    it('counts TRUSTED_PROXY_HOPS entries from the right', () => {
      process.env.TRUSTED_PROXY_HOPS = '2';
      const headers = new Headers({ 'x-forwarded-for': '203.0.113.9, 198.51.100.42, 10.0.0.2' });
      expect(getClientIp(headers)).toBe('198.51.100.42');
    });

    it('uses the leftmost entry when the chain is shorter than the configured hops', () => {
      process.env.TRUSTED_PROXY_HOPS = '3';
      const headers = new Headers({ 'x-forwarded-for': '198.51.100.42' });
      expect(getClientIp(headers)).toBe('198.51.100.42');
    });

    it('ignores x-real-ip and cf-connecting-ip unless a trusted header is configured', () => {
      const headers = new Headers({ 'x-real-ip': '192.0.2.10', 'cf-connecting-ip': '198.18.0.5' });
      expect(getClientIp(headers)).toBe('127.0.0.1');
    });

    it('reads the configured trusted header ahead of x-forwarded-for', () => {
      process.env.TRUSTED_CLIENT_IP_HEADER = 'CF-Connecting-IP';
      const headers = new Headers({ 'cf-connecting-ip': '198.18.0.5', 'x-forwarded-for': '203.0.113.9' });
      expect(getClientIp(headers)).toBe('198.18.0.5');
    });

    it('ignores every forwarded header when TRUSTED_PROXY_HOPS is 0', () => {
      process.env.TRUSTED_PROXY_HOPS = '0';
      process.env.TRUSTED_CLIENT_IP_HEADER = 'x-real-ip';
      const headers = new Headers({ 'x-forwarded-for': '203.0.113.9', 'x-real-ip': '192.0.2.10' });
      expect(getClientIp(headers)).toBe('127.0.0.1');
    });

    it('falls back to one hop when TRUSTED_PROXY_HOPS is invalid', () => {
      process.env.TRUSTED_PROXY_HOPS = 'abc';
      const headers = new Headers({ 'x-forwarded-for': '203.0.113.9, 198.51.100.42' });
      expect(getClientIp(headers)).toBe('198.51.100.42');
    });

    it('defaults to 127.0.0.1 when no remote address headers are present', () => {
      const headers = new Headers();
      expect(getClientIp(headers)).toBe('127.0.0.1');
    });
  });
});
