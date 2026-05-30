import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { AUTH_COOKIE_NAME } from './lib/auth';

// Workaround for validateToken in middleware (can't import bcrypt etc, but we just use base64 check)
function isTokenValid(token: string) {
  try {
    const decoded = atob(token);
    const parts = decoded.split(':');
    return parts.length >= 3; 
  } catch {
    return false;
  }
}

export function proxy(request: NextRequest) {
  const path = request.nextUrl.pathname;
  
  // Define protected routes
  const isProtectedRoute =
    path.startsWith('/dashboard') ||
    path.startsWith('/admin') ||
    path.startsWith('/bill') ||
    path.startsWith('/api/analytics');
  
  if (isProtectedRoute) {
    const token = request.cookies.get(AUTH_COOKIE_NAME)?.value;
    
    if (!token || !isTokenValid(token)) {
      // Redirect to login if unauthenticated
      const url = request.nextUrl.clone();
      url.pathname = '/login';
      return NextResponse.redirect(url);
    }
  }

  // Redirect root to root if authenticated? Not needed, but fine
  return NextResponse.next();
}

export const config = {
  matcher: ['/dashboard/:path*', '/admin/:path*', '/bill/:path*', '/api/analytics/:path*'],
};
