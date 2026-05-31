import { Request, Response } from 'express';
import { prisma } from '../lib/prisma.js';

export async function getWaiters(req: Request, res: Response) {
  try {
    const waiters = await prisma.waiter.findMany({
      orderBy: { createdAt: 'desc' }
    });
    return res.json(waiters);
  } catch (error) {
    console.error('Failed to get waiters:', error);
    return res.status(500).json({ error: 'Failed to fetch waiters' });
  }
}

export async function createWaiter(req: Request, res: Response) {
  try {
    const { username } = req.body;

    if (!username) {
      return res.status(400).json({ error: 'Username is required' });
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

    // Create Waiter
    const waiter = await prisma.waiter.create({
      data: {
        username: trimmedUsername,
        email: generatedEmail
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
