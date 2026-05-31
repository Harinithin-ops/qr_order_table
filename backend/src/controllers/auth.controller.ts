import { Request, Response } from 'express';
import { AuthenticatedRequest, generateToken, AUTH_COOKIE_NAME } from '../middleware/auth.middleware.js';
import { verifyTotp, generateCurrentTotp } from '../utils/totp.js';

const ADMIN_USERNAME = process.env.ADMIN_USERNAME || 'admin';

export async function login(req: Request, res: Response) {
  const { username } = req.body;

  if (username === ADMIN_USERNAME) {
    try {
      // Generate current rolling TOTP code and log it in console as fallback
      const totpCode = generateCurrentTotp();

      console.log(`\n\n==================================================`);
      console.log(`🔒 ACTIVE TOTP CODE (Authenticator): [ ${totpCode} ]`);
      console.log(`==================================================\n\n`);
      
      return res.json({ success: true, otpRequired: true });
    } catch (err) {
      console.error('TOTP flow error:', err);
      return res.status(500).json({ error: 'Failed to trigger verification' });
    }
  }

  // Otherwise, it is a waiter login attempting passwordless Username-only login
  if (!username) {
    return res.status(400).json({ error: 'Username is required to login as Waiter' });
  }

  try {
    const { prisma } = await import('../lib/prisma.js');
    const waiter = await prisma.waiter.findFirst({
      where: {
        username: username.trim()
      }
    });

    if (!waiter) {
      return res.status(401).json({ error: 'Invalid waiter username' });
    }

    const token = generateToken(waiter.username);
    
    res.cookie(AUTH_COOKIE_NAME, token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      path: '/',
      maxAge: 7 * 24 * 60 * 60 * 1000 // 7 days
    });

    return res.json({ success: true, role: 'server', username: waiter.username });
  } catch (err) {
    console.error('Waiter login error:', err);
    return res.status(500).json({ error: 'Internal server error during login' });
  }
}

export async function verifyOtp(req: Request, res: Response) {
  const { code } = req.body;

  if (!code) {
    return res.status(400).json({ error: 'Verification code is required' });
  }

  // Verify the submitted code against rolling TOTP (with clock-drift tolerance window)
  const verified = verifyTotp(code);

  if (verified) {
    const token = generateToken('admin');
    
    res.cookie(AUTH_COOKIE_NAME, token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      path: '/',
      maxAge: 7 * 24 * 60 * 60 * 1000 // 7 days
    });

    return res.json({ success: true, role: 'admin' });
  }

  return res.status(401).json({ error: 'Invalid or expired verification code' });
}

export function logout(req: Request, res: Response) {
  res.clearCookie(AUTH_COOKIE_NAME, { path: '/' });
  return res.json({ success: true });
}

export function checkAuth(req: AuthenticatedRequest, res: Response) {
  return res.json({ authenticated: true, username: req.username });
}

