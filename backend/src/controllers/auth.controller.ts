import { Request, Response } from 'express';
import { AuthenticatedRequest, AUTH_COOKIE_NAME } from '../middleware/auth.middleware.js';
import { verifyTotp, generateCurrentTotp } from '../utils/totp.js';
import { prisma } from '../lib/prisma.js';
import { generateJwt } from '../utils/jwt.js';

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

  // Waiter login: username only (no password required)
  if (!username) {
    return res.status(400).json({ error: 'Username is required to login as Waiter' });
  }

  try {
    const waiter = await prisma.waiter.findFirst({
      where: {
        username: username.trim()
      }
    });

    if (!waiter) {
      return res.status(401).json({ error: 'Invalid waiter username. Please check your username and try again.' });
    }

    // Block disabled waiter accounts
    if (waiter.isDisabled) {
      return res.status(403).json({ error: 'Your account has been temporarily disabled. Please contact the admin.' });
    }

    const token = generateJwt({ id: waiter.id, username: waiter.username, role: 'waiter' });
    const expiresAt = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000); // 30 days
    
    // Create session in the database
    await (prisma as any).userSession.create({
      data: {
        userId: waiter.id,
        role: 'waiter',
        token,
        expiresAt
      }
    });
    
    res.cookie(AUTH_COOKIE_NAME, token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      path: '/',
      maxAge: 30 * 24 * 60 * 60 * 1000 // 30 days
    });

    return res.json({ 
      success: true, 
      token,
      role: 'waiter', 
      username: waiter.username,
      user: {
        id: waiter.id,
        name: waiter.displayName || waiter.username
      },
      waiter: {
        id: waiter.id,
        name: waiter.displayName || waiter.username
      }
    });
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
    const token = generateJwt({ id: 'admin', username: 'admin', role: 'admin' });
    const expiresAt = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000); // 30 days

    // Create session in the database
    await (prisma as any).userSession.create({
      data: {
        userId: 'admin',
        role: 'admin',
        token,
        expiresAt
      }
    });
    
    res.cookie(AUTH_COOKIE_NAME, token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      path: '/',
      maxAge: 30 * 24 * 60 * 60 * 1000 // 30 days
    });

    return res.json({ 
      success: true, 
      token,
      role: 'admin',
      user: {
        id: 'admin',
        name: 'Admin Name'
      },
      admin: {
        id: 'admin',
        name: 'Admin Name'
      }
    });
  }

  return res.status(401).json({ error: 'Invalid or expired verification code' });
}

export async function logout(req: Request, res: Response) {
  let token = req.cookies[AUTH_COOKIE_NAME];
  const authHeader = req.headers['authorization'] || req.headers.authorization;
  
  if (typeof authHeader === 'string' && authHeader.startsWith('Bearer ')) {
    token = authHeader.substring(7);
  }

  if (token) {
    try {
      await (prisma as any).userSession.deleteMany({
        where: { token }
      });
    } catch (err) {
      console.error('Failed to delete session on logout:', err);
    }
  }

  res.clearCookie(AUTH_COOKIE_NAME, { path: '/' });
  return res.json({ success: true });
}

export function checkAuth(req: AuthenticatedRequest, res: Response) {
  return res.json({ 
    authenticated: true, 
    username: req.username,
    role: req.userRole,
    user: {
      id: req.username,
      name: req.username === 'admin' ? 'Admin Name' : req.username
    }
  });
}


export async function getMe(req: AuthenticatedRequest, res: Response) {
  try {
    const { username } = req;
    if (!username) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    if (username === 'admin') {
      return res.json({
        id: 'admin',
        username: 'admin',
        role: 'admin',
        email: 'admin@kavitha.com',
        createdAt: new Date(),
      });
    }

    const waiter = await prisma.waiter.findUnique({
      where: { username },
      select: {
        id: true,
        username: true,
        email: true,
        createdAt: true,
      }
    });

    if (!waiter) {
      return res.status(404).json({ error: 'Waiter profile not found' });
    }

    return res.json({
      id: waiter.id,
      username: waiter.username,
      email: waiter.email,
      createdAt: waiter.createdAt,
      role: 'waiter'
    });
  } catch (error) {
    console.error('Failed to fetch user profile:', error);
    return res.status(500).json({ error: 'Failed to fetch profile' });
  }
}

export async function updateMe(req: AuthenticatedRequest, res: Response) {
  try {
    const { username } = req;
    const { email } = req.body;

    if (!username) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    if (username === 'admin') {
      return res.status(403).json({ error: 'Admin details cannot be modified' });
    }

    if (!email || !email.trim()) {
      return res.status(400).json({ error: 'Email is required' });
    }

    const trimmedEmail = email.trim().toLowerCase();

    // Verify email format
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(trimmedEmail)) {
      return res.status(400).json({ error: 'Invalid email address format' });
    }

    // Assert unique email (but allow if it belongs to the current waiter)
    const existingEmailWaiter = await prisma.waiter.findUnique({
      where: { email: trimmedEmail }
    });

    if (existingEmailWaiter && existingEmailWaiter.username !== username) {
      return res.status(400).json({ error: 'This email address is already registered to another staff member' });
    }

    // Update Waiter
    const updatedWaiter = await prisma.waiter.update({
      where: { username },
      data: { email: trimmedEmail },
    });

    return res.json({
      ...updatedWaiter,
      role: 'waiter'
    });
  } catch (error) {
    console.error('Failed to update user profile:', error);
    return res.status(500).json({ error: 'Failed to update profile' });
  }
}
