import { Request, Response } from 'express';
import { AuthenticatedRequest, generateToken, AUTH_COOKIE_NAME } from '../middleware/auth.middleware.js';
import { verifyTotp, generateCurrentTotp } from '../utils/totp.js';
import bcrypt from 'bcryptjs';

const ADMIN_USERNAME = process.env.ADMIN_USERNAME || 'admin';

export async function login(req: Request, res: Response) {
  const { username, password } = req.body;

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

  // Waiter login: requires username + password
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
      return res.status(401).json({ error: 'Invalid username or password' });
    }

    // If the waiter account has a password set, verify it
    if (waiter.passwordHash) {
      if (!password) {
        return res.status(401).json({ error: 'Password is required' });
      }
      const passwordMatch = await bcrypt.compare(password, waiter.passwordHash);
      if (!passwordMatch) {
        return res.status(401).json({ error: 'Invalid username or password' });
      }
    }
    // If no passwordHash (legacy account with no password set), allow login but prompt to set password
    // This covers the migration case for existing accounts created before the password field was added.

    const token = generateToken(waiter.username);
    
    res.cookie(AUTH_COOKIE_NAME, token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      path: '/',
      maxAge: 7 * 24 * 60 * 60 * 1000 // 7 days
    });

    return res.json({ 
      success: true, 
      role: 'server', 
      username: waiter.username,
      hasPassword: !!waiter.passwordHash
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
    const token = generateToken('admin');
    
    res.cookie(AUTH_COOKIE_NAME, token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      path: '/',
      maxAge: 12 * 60 * 60 * 1000 // 12 hours
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

    const { prisma } = await import('../lib/prisma.js');
    const waiter = await prisma.waiter.findUnique({
      where: { username },
      select: {
        id: true,
        username: true,
        email: true,
        createdAt: true,
        passwordHash: true,
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
      hasPassword: !!waiter.passwordHash,
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
    const { email, currentPassword, newPassword } = req.body;

    if (!username) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    if (username === 'admin') {
      return res.status(403).json({ error: 'Admin details cannot be modified' });
    }

    const { prisma } = await import('../lib/prisma.js');

    const waiter = await prisma.waiter.findUnique({
      where: { username }
    });

    if (!waiter) {
      return res.status(404).json({ error: 'Waiter profile not found' });
    }

    const updateData: Record<string, string> = {};

    // Handle email update
    if (email !== undefined) {
      const trimmedEmail = (email || '').trim().toLowerCase();
      if (!trimmedEmail) {
        return res.status(400).json({ error: 'Email is required' });
      }
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
      updateData.email = trimmedEmail;
    }

    // Handle password change
    if (newPassword !== undefined) {
      if (!newPassword || newPassword.length < 6) {
        return res.status(400).json({ error: 'New password must be at least 6 characters' });
      }

      // If the account already has a password, verify the current one
      if (waiter.passwordHash) {
        if (!currentPassword) {
          return res.status(400).json({ error: 'Current password is required to set a new password' });
        }
        const passwordMatch = await bcrypt.compare(currentPassword, waiter.passwordHash);
        if (!passwordMatch) {
          return res.status(401).json({ error: 'Current password is incorrect' });
        }
      }

      updateData.passwordHash = await bcrypt.hash(newPassword, 10);
    }

    if (Object.keys(updateData).length === 0) {
      return res.status(400).json({ error: 'No fields to update' });
    }

    // Update Waiter
    const updatedWaiter = await prisma.waiter.update({
      where: { username },
      data: updateData,
      select: {
        id: true,
        username: true,
        email: true,
        createdAt: true,
        passwordHash: true,
      }
    });

    return res.json({
      id: updatedWaiter.id,
      username: updatedWaiter.username,
      email: updatedWaiter.email,
      createdAt: updatedWaiter.createdAt,
      hasPassword: !!updatedWaiter.passwordHash,
      role: 'waiter'
    });
  } catch (error) {
    console.error('Failed to update user profile:', error);
    return res.status(500).json({ error: 'Failed to update profile' });
  }
}
