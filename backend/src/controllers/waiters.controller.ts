import { Request, Response } from 'express';
import { prisma } from '../lib/prisma.js';
import bcrypt from 'bcryptjs';
import { AuthenticatedRequest } from '../middleware/auth.middleware.js';

export async function getWaiters(req: Request, res: Response) {
  try {
    const waiters = await prisma.waiter.findMany({
      orderBy: { createdAt: 'desc' },
      select: {
        id: true,
        username: true,
        displayName: true,
        email: true,
        isDisabled: true,
        createdAt: true,
        tables: {
          select: {
            id: true,
            tableNumber: true,
            slug: true,
          }
        }
        // Never expose passwordHash to client
      }
    });
    return res.json(waiters);
  } catch (error) {
    console.error('Failed to get waiters:', error);
    return res.status(500).json({ error: 'Failed to fetch waiters' });
  }
}

export async function createWaiter(req: Request, res: Response) {
  try {
    const { username, password } = req.body;

    if (!username) {
      return res.status(400).json({ error: 'Username is required' });
    }

    if (!password || password.length < 6) {
      return res.status(400).json({ error: 'Password must be at least 6 characters' });
    }

    const trimmedUsername = username.trim();

    // Prevent matching the admin username
    if (trimmedUsername.toLowerCase() === 'admin') {
      return res.status(400).json({ error: 'The username "admin" is reserved' });
    }

    // Enforce 40 waiter account limit
    const waiterCount = await prisma.waiter.count();
    if (waiterCount >= 40) {
      return res.status(400).json({ error: 'Limit reached: You can create a maximum of 40 waiter accounts.' });
    }

    // Assert unique username
    const existingUsername = await prisma.waiter.findUnique({
      where: { username: trimmedUsername }
    });
    if (existingUsername) {
      return res.status(400).json({ error: 'A waiter with this username already exists' });
    }

    // Auto-generate a unique placeholder email to satisfy DB non-null uniqueness constraint
    const generatedEmail = `${trimmedUsername.toLowerCase().replace(/\s+/g, '')}@kavitha.com`;

    // Hash the password
    const passwordHash = await bcrypt.hash(password, 10);

    // Create Waiter
    const waiter = await prisma.waiter.create({
      data: {
        username: trimmedUsername,
        email: generatedEmail,
        passwordHash,
      },
      select: {
        id: true,
        username: true,
        displayName: true,
        email: true,
        isDisabled: true,
        createdAt: true,
        tables: {
          select: {
            id: true,
            tableNumber: true,
            slug: true,
          }
        }
      }
    });

    return res.status(201).json(waiter);
  } catch (error) {
    console.error('Failed to create waiter:', error);
    return res.status(500).json({ error: 'Failed to create waiter' });
  }
}

export async function deleteWaiter(req: Request, res: Response) {
  try {
    const { id } = req.params;

    const waiter = await prisma.waiter.findUnique({
      where: { id }
    });

    if (!waiter) {
      return res.status(404).json({ error: 'Waiter not found' });
    }

    await prisma.waiter.delete({
      where: { id }
    });

    return res.json({ success: true, message: 'Waiter profile deleted successfully' });
  } catch (error) {
    console.error('Failed to delete waiter:', error);
    return res.status(500).json({ error: 'Failed to delete waiter' });
  }
}

/** Admin-only: Reset a waiter's password */
export async function resetWaiterPassword(req: AuthenticatedRequest, res: Response) {
  try {
    const { id } = req.params;
    const { newPassword } = req.body;

    if (!newPassword || newPassword.length < 6) {
      return res.status(400).json({ error: 'New password must be at least 6 characters' });
    }

    const waiter = await prisma.waiter.findUnique({ where: { id } });
    if (!waiter) {
      return res.status(404).json({ error: 'Waiter not found' });
    }

    const passwordHash = await bcrypt.hash(newPassword, 10);
    await prisma.waiter.update({
      where: { id },
      data: { passwordHash }
    });

    return res.json({ success: true, message: 'Password reset successfully' });
  } catch (error) {
    console.error('Failed to reset waiter password:', error);
    return res.status(500).json({ error: 'Failed to reset password' });
  }
}

/** Admin-only: Rename a waiter's display name (not the login username) */
export async function renameWaiter(req: AuthenticatedRequest, res: Response) {
  try {
    const { id } = req.params;
    const { displayName } = req.body;

    if (!displayName || !displayName.trim()) {
      return res.status(400).json({ error: 'Display name is required' });
    }

    const waiter = await prisma.waiter.findUnique({ where: { id } });
    if (!waiter) {
      return res.status(404).json({ error: 'Waiter not found' });
    }

    const updated = await prisma.waiter.update({
      where: { id },
      data: { displayName: displayName.trim() },
      select: {
        id: true,
        username: true,
        displayName: true,
        email: true,
        isDisabled: true,
        createdAt: true,
        tables: {
          select: {
            id: true,
            tableNumber: true,
            slug: true,
          }
        }
      }
    });

    return res.json(updated);
  } catch (error) {
    console.error('Failed to rename waiter:', error);
    return res.status(500).json({ error: 'Failed to rename waiter' });
  }
}

/** Admin-only: Enable or disable a waiter's dashboard access */
export async function toggleWaiterAccess(req: AuthenticatedRequest, res: Response) {
  try {
    const { id } = req.params;
    const { isDisabled } = req.body;

    if (typeof isDisabled !== 'boolean') {
      return res.status(400).json({ error: 'isDisabled must be a boolean' });
    }

    const waiter = await prisma.waiter.findUnique({ where: { id } });
    if (!waiter) {
      return res.status(404).json({ error: 'Waiter not found' });
    }

    const updated = await prisma.waiter.update({
      where: { id },
      data: { isDisabled },
      select: {
        id: true,
        username: true,
        displayName: true,
        email: true,
        isDisabled: true,
        createdAt: true,
        tables: {
          select: {
            id: true,
            tableNumber: true,
            slug: true,
          }
        }
      }
    });

    return res.json(updated);
  } catch (error) {
    console.error('Failed to toggle waiter access:', error);
    return res.status(500).json({ error: 'Failed to update waiter access' });
  }
}

