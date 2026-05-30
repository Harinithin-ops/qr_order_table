import { cookies } from 'next/headers';

// Simple auth for MVP — credentials stored in env vars
// For production, use NextAuth.js or similar
const ADMIN_USERNAME = process.env.ADMIN_USERNAME || 'admin';
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || 'kavitha2024';
const AUTH_COOKIE_NAME = 'kh_admin_token';
const AUTH_TOKEN_SECRET = process.env.AUTH_SECRET || 'kavitha-hotel-secret-key-change-in-production';

function generateToken(username: string): string {
  // Simple token = base64(username:timestamp:secret)
  const payload = `${username}:${Date.now()}:${AUTH_TOKEN_SECRET}`;
  return Buffer.from(payload).toString('base64');
}

function validateToken(token: string): boolean {
  try {
    const decoded = Buffer.from(token, 'base64').toString('utf-8');
    const parts = decoded.split(':');
    if (parts.length < 3) return false;
    // Check that it contains our secret
    return parts[2] === AUTH_TOKEN_SECRET;
  } catch {
    return false;
  }
}

export function verifyCredentials(username: string, password: string): boolean {
  return username === ADMIN_USERNAME && password === ADMIN_PASSWORD;
}

export function createAuthToken(username: string): string {
  return generateToken(username);
}

export async function isAuthenticated(): Promise<boolean> {
  const cookieStore = await cookies();
  const token = cookieStore.get(AUTH_COOKIE_NAME)?.value;
  if (!token) return false;
  return validateToken(token);
}

export { AUTH_COOKIE_NAME };
