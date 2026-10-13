import NextAuth from 'next-auth';
import Credentials from 'next-auth/providers/credentials';
import { compare } from 'bcryptjs';
import { db } from '@/lib/db';
import { authConfig } from '@/lib/auth.config';
import type { Role } from '@prisma/client';

declare module 'next-auth' {
  interface User {
    role: Role;
    schoolId: string | null;
    mustChangePassword: boolean;
    locale: string;
    sessionVersion: number;
  }
  interface Session {
    user: {
      id: string;
      email: string;
      name: string;
      role: Role;
      schoolId: string | null;
      mustChangePassword: boolean;
      locale: string;
      sessionVersion: number;
    };
  }
}

import { headers } from 'next/headers';
import { getClientIp } from '@/lib/rate-limit';
import { checkSharedRateLimit } from '@/lib/shared-rate-limit';
import { recordFailedPassword } from '@/lib/login-security';
import { recordAuditLog } from '@/lib/audit-log';

export const { handlers, signIn, signOut, auth } = NextAuth({
  ...authConfig,
  callbacks: {
    ...authConfig.callbacks,
    async jwt(args) {
      const shared = authConfig.callbacks?.jwt;
      const token = shared ? await shared(args) : args.token;
      if (!token || args.user) return token;
      if (typeof token.sub !== 'string') return null;
      const account = await db.user.findUnique({ where: { id: token.sub }, select: {
        isActive: true, sessionVersion: true, role: true, schoolId: true, mustChangePassword: true, locale: true,
      } });
      if (!account?.isActive || account.sessionVersion !== token.sessionVersion) return null;
      return { ...token, role: account.role, schoolId: account.schoolId, mustChangePassword: account.mustChangePassword, locale: account.locale };
    },
  },
  providers: [
    Credentials({
      name: 'credentials',
      credentials: {
        email: { label: 'Email', type: 'email' },
        password: { label: 'Password', type: 'password' },
      },
      async authorize(credentials) {
        if (!credentials?.email || !credentials?.password) return null;

        // Extract client IP and user agent for rate limiting and auditing
        let ipAddress = '127.0.0.1';
        let userAgent = '';
        try {
          const reqHeaders = await headers();
          ipAddress = getClientIp(reqHeaders);
          userAgent = reqHeaders.get('user-agent') || '';
        } catch {
          // Fallback if headers context is unavailable
        }

        // 1. IP Rate Limiting: Max 10 requests per minute
        const rateLimit = await checkSharedRateLimit(`login:${ipAddress}`, 10, 60 * 1000);
        if (!rateLimit.success) {
          await recordAuditLog({
            action: 'LOGIN_FAILED',
            userEmail: String(credentials.email),
            ipAddress,
            userAgent,
            details: `Rate limit exceeded. Reset in ${rateLimit.resetInSeconds}s`,
          });
          throw new Error(`RATE_LIMIT:${rateLimit.resetInSeconds}`);
        }

        const email = String(credentials.email).trim().toLowerCase();

        // 1b. Account-level Rate Limiting: Max 10 attempts per minute per email to prevent brute-force via IP rotation
        const accountRateLimit = await checkSharedRateLimit(`login:account:${email}`, 10, 60 * 1000);
        if (!accountRateLimit.success) {
          await recordAuditLog({
            action: 'LOGIN_FAILED',
            userEmail: email,
            ipAddress,
            userAgent,
            details: `Account rate limit exceeded. Reset in ${accountRateLimit.resetInSeconds}s`,
          });
          throw new Error(`RATE_LIMIT:${accountRateLimit.resetInSeconds}`);
        }

        const user = await db.user.findUnique({
          where: { email },
        });

        // Pre-computed constant bcrypt hash (cost factor 12) for constant-time dummy verification
        const DUMMY_HASH = '$2a$12$e8w4GjQ0LgC5l9wE7m7J0.XF4uQvGqJb.o1a2s3d4f5g6h7j8k9l0';

        // 2. User exists & active check (with constant-time dummy bcrypt evaluation)
        if (!user || !user.isActive) {
          await compare(credentials.password as string, DUMMY_HASH).catch(() => false);
          await recordAuditLog({
            action: 'LOGIN_FAILED',
            userEmail: email,
            ipAddress,
            userAgent,
            details: !user ? 'User does not exist' : 'User account is deactivated',
          });
          return null;
        }

        // 3. Account Lockout check
        if (user.lockedUntil && user.lockedUntil > new Date()) {
          const remainingMinutes = Math.max(
            1,
            Math.ceil((user.lockedUntil.getTime() - Date.now()) / (60 * 1000))
          );
          await recordAuditLog({
            action: 'LOGIN_FAILED',
            userId: user.id,
            userEmail: user.email,
            ipAddress,
            userAgent,
            details: `Attempted login on locked account. Remaining: ${remainingMinutes}m`,
          });
          throw new Error(`ACCOUNT_LOCKED:${remainingMinutes}`);
        }

        // 4. Verify password
        const isPasswordValid = await compare(
          credentials.password as string,
          user.passwordHash
        );

        if (!isPasswordValid) {
          const failure = await recordFailedPassword(user.id);
          await recordAuditLog({
            action: failure.lockoutMinutes ? 'ACCOUNT_LOCKED' : 'LOGIN_FAILED',
            userId: user.id, userEmail: user.email, ipAddress, userAgent,
            details: `Invalid password. Attempt ${failure.failed}/5`,
          });
          if (failure.lockoutMinutes) throw new Error(`ACCOUNT_LOCKED:${failure.lockoutMinutes}`);
          throw new Error(`INVALID_CREDENTIALS:${Math.max(0, 5 - failure.failed)}`);
        }

        // 5. Success: Reset failure count and update last login
        await db.user.update({
          where: { id: user.id },
          data: {
            failedLoginAttempts: 0,
            lockoutCount: 0,
            lockedUntil: null,
            lastLoginAt: new Date(),
            lastLoginIp: ipAddress,
          },
        });

        await recordAuditLog({
          action: 'LOGIN_SUCCESS',
          userId: user.id,
          userEmail: user.email,
          ipAddress,
          userAgent,
        });

        return {
          id: user.id,
          email: user.email,
          name: user.name,
          role: user.role,
          schoolId: user.schoolId,
          mustChangePassword: user.mustChangePassword,
          locale: user.locale,
          sessionVersion: user.sessionVersion,
        };
      },
    }),
  ],
});
