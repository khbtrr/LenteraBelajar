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
    };
  }
}

import { headers } from 'next/headers';
import { checkRateLimit, getClientIp } from '@/lib/rate-limit';
import { recordAuditLog } from '@/lib/audit-log';

export const { handlers, signIn, signOut, auth } = NextAuth({
  ...authConfig,
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
        const rateLimit = checkRateLimit(`login:${ipAddress}`, 10, 60 * 1000);
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

        const user = await db.user.findUnique({
          where: { email },
        });

        // 2. User exists & active check
        if (!user || !user.isActive) {
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
          const newFailedAttempts = (user.failedLoginAttempts || 0) + 1;
          const shouldLock = newFailedAttempts >= 5;

          if (shouldLock) {
            const currentLockoutCount = (user.lockoutCount || 0) + 1;
            // Progressive lockout: 3rd+ lockout -> 60 minutes, otherwise 15 minutes
            const lockoutMinutes = currentLockoutCount >= 3 ? 60 : 15;
            const lockedUntil = new Date(Date.now() + lockoutMinutes * 60 * 1000);

            await db.user.update({
              where: { id: user.id },
              data: {
                failedLoginAttempts: newFailedAttempts,
                lockoutCount: currentLockoutCount,
                lockedUntil,
              },
            });

            await recordAuditLog({
              action: 'ACCOUNT_LOCKED',
              userId: user.id,
              userEmail: user.email,
              ipAddress,
              userAgent,
              details: `Account locked for ${lockoutMinutes}m after 5 failed attempts (lockout #${currentLockoutCount})`,
            });

            throw new Error(`ACCOUNT_LOCKED:${lockoutMinutes}`);
          } else {
            await db.user.update({
              where: { id: user.id },
              data: {
                failedLoginAttempts: newFailedAttempts,
              },
            });

            await recordAuditLog({
              action: 'LOGIN_FAILED',
              userId: user.id,
              userEmail: user.email,
              ipAddress,
              userAgent,
              details: `Invalid password. Attempt ${newFailedAttempts}/5`,
            });

            const remainingAttempts = 5 - newFailedAttempts;
            throw new Error(`INVALID_CREDENTIALS:${remainingAttempts}`);
          }
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
        };
      },
    }),
  ],
});
