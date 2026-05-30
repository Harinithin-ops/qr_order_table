import { Request, Response } from 'express';
import { generateToken, AUTH_COOKIE_NAME } from '../middleware/auth.middleware.js';

const ADMIN_USERNAME = process.env.ADMIN_USERNAME || 'admin';
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || 'kavitha2024';

export function login(req: Request, res: Response) {
  const { username, password } = req.body;

  if (username === ADMIN_USERNAME && password === ADMIN_PASSWORD) {
    const token = generateToken(username);
    
    res.cookie(AUTH_COOKIE_NAME, token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      path: '/',
      maxAge: 7 * 24 * 60 * 60 * 1000 // 7 days
    });

    return res.json({ success: true });
  }

  return res.status(401).json({ error: 'Invalid credentials' });
}

export function logout(req: Request, res: Response) {
  res.clearCookie(AUTH_COOKIE_NAME, { path: '/' });
  return res.json({ success: true });
}

export function checkAuth(req: Request, res: Response) {
  return res.json({ authenticated: true });
}
