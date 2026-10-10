import type { NextAuthConfig } from 'next-auth';
import type { Role } from '@prisma/client';

export const authConfig: NextAuthConfig = {
  trustHost: true,
  providers: [],
  callbacks: {
    async jwt({ token, user, trigger, session }) {
      if (user) {
        token.role = (user as { role: Role }).role;
        token.schoolId = (user as { schoolId: string | null }).schoolId;
        token.mustChangePassword = (user as { mustChangePassword: boolean }).mustChangePassword;
        token.locale = (user as { locale: string }).locale;
        token.sessionVersion = (user as { sessionVersion: number }).sessionVersion;
      }
      return token;
    },
    async session({ session, token }) {
      if (token) {
        session.user.id = token.sub as string;
        session.user.role = token.role as Role;
        session.user.schoolId = (token.schoolId as string | null) ?? null;
        session.user.mustChangePassword = Boolean(token.mustChangePassword);
        session.user.locale = (token.locale as string) || 'id';
        session.user.sessionVersion = token.sessionVersion as number;
      }
      return session;
    },
  },
  pages: {
    signIn: '/login',
  },
  session: {
    strategy: 'jwt',
  },
};
