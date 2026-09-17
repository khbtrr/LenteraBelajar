import { auth } from '@/lib/auth.edge';
import createIntlMiddleware from 'next-intl/middleware';
import { NextRequest, NextResponse } from 'next/server';
import { routing } from '@/i18n/routing';

const intlMiddleware = createIntlMiddleware(routing);

const publicPaths = ['/login', '/api/auth'];

function isPublicPath(pathname: string): boolean {
  return publicPaths.some(
    (p) => pathname === p || pathname.startsWith(p + '/')
  );
}

// Remove locale prefix to get the actual path
function stripLocale(pathname: string): string {
  const locales = ['id', 'en'];
  for (const locale of locales) {
    if (pathname.startsWith(`/${locale}/`) || pathname === `/${locale}`) {
      return pathname.slice(`/${locale}`.length) || '/';
    }
  }
  return pathname;
}

const roleHomePaths: Record<string, string> = {
  SUPER_ADMIN: '/platform/dashboard',
  ADMIN: '/admin/dashboard',
  SUPERVISOR: '/supervisor/dashboard',
  TEACHER: '/teacher/dashboard',
  STUDENT: '/student/dashboard',
};

export default async function middleware(request: NextRequest) {
  const pathname = request.nextUrl.pathname;

  // Skip all API routes (auth, upload, files, etc.)
  if (pathname.startsWith('/api')) {
    return NextResponse.next();
  }

  // Apply intl middleware first
  const intlResponse = intlMiddleware(request);

  const strippedPath = stripLocale(pathname);

  // Allow public paths
  if (isPublicPath(strippedPath)) {
    return intlResponse;
  }

  // Check auth
  const session = await auth();

  if (!session?.user) {
    const locale = pathname.split('/')[1] || 'id';
    const loginUrl = new URL(`/${locale}/login`, request.url);
    loginUrl.searchParams.set('callbackUrl', pathname);
    return NextResponse.redirect(loginUrl);
  }

  // Force password change
  if (session.user.mustChangePassword && !strippedPath.startsWith('/change-password')) {
    const locale = pathname.split('/')[1] || 'id';
    return NextResponse.redirect(new URL(`/${locale}/change-password`, request.url));
  }

  // Shared authenticated routes accessible to any logged-in role
  const sharedRoutes = ['/calendar', '/notifications', '/messages', '/profile', '/change-password'];
  const isSharedRoute = sharedRoutes.some(
    (route) => strippedPath === route || strippedPath.startsWith(route + '/')
  );

  if (isSharedRoute) {
    return intlResponse;
  }

  // Role-based route protection
  const role = session.user.role;
  const allowedPrefixes: Record<string, string[]> = {
    SUPER_ADMIN: ['/platform'],
    ADMIN: ['/admin'],
    SUPERVISOR: ['/supervisor'],
    TEACHER: ['/teacher'],
    STUDENT: ['/student'],
  };

  const userPrefixes = allowedPrefixes[role] || [];
  const hasAccess = userPrefixes.some((prefix) => strippedPath.startsWith(prefix));

  // Redirect root to role home
  if (strippedPath === '/' || strippedPath === '') {
    const locale = pathname.split('/')[1] || 'id';
    const homePath = roleHomePaths[role] || '/login';
    return NextResponse.redirect(new URL(`/${locale}${homePath}`, request.url));
  }

  if (!hasAccess) {
    const locale = pathname.split('/')[1] || 'id';
    const homePath = roleHomePaths[role] || '/login';
    return NextResponse.redirect(new URL(`/${locale}${homePath}`, request.url));
  }

  return intlResponse;
}

export const config = {
  matcher: ['/((?!api|_next|favicon.ico|uploads|images|.*\\.).*)'],
};
