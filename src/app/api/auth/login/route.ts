import { NextResponse } from 'next/server';
import { verifyCredentials, createAuthToken, AUTH_COOKIE_NAME } from '@/lib/auth';

export async function POST(request: Request) {
  try {
    const { username, password } = await request.json();
    console.log(`[API/Login] Attempting login for: ${username}`);

    if (verifyCredentials(username, password)) {
      console.log(`[API/Login] Success for: ${username}`);
      const token = createAuthToken(username);
      
      const response = NextResponse.json({ success: true });
      response.cookies.set(AUTH_COOKIE_NAME, token, {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'lax',
        path: '/',
        maxAge: 60 * 60 * 24, // 1 day
      });
      
      return response;
    }

    console.warn(`[API/Login] Failed for: ${username}`);
    return NextResponse.json({ error: 'Invalid credentials' }, { status: 401 });
  } catch (error) {
    console.error('[API/Login] Error:', error);
    return NextResponse.json({ error: 'Authentication failed' }, { status: 500 });
  }
}
