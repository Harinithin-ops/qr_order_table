import { Request, Response } from 'express';
import { prisma } from '../lib/prisma.js';

// Background cleanup helper
async function cleanupExpiredSessions() {
  try {
    const deleted = await prisma.customerSession.deleteMany({
      where: {
        expiresAt: {
          lt: new Date(),
        },
      },
    });
    if (deleted.count > 0) {
      console.log(`🧹 Cleaned up ${deleted.count} expired customer sessions.`);
    }
  } catch (err) {
    console.error('Failed to cleanup expired sessions:', err);
  }
}

export async function createSession(req: Request, res: Response) {
  try {
    const { name, tableId } = req.body;

    if (!name || !name.trim() || !tableId) {
      return res.status(400).json({ error: 'Name and tableId are required' });
    }

    // Trigger cleanup asynchronously
    void cleanupExpiredSessions();

    const expiresAt = new Date(Date.now() + 2 * 60 * 60 * 1000); // 2 hours from now

    const session = await prisma.customerSession.create({
      data: {
        name: name.trim(),
        tableId,
        expiresAt,
      },
    });

    return res.status(201).json({
      customerId: session.id,
      name: session.name,
      tableId: session.tableId,
      expiresAt: session.expiresAt,
    });
  } catch (error) {
    console.error('Failed to create customer session:', error);
    return res.status(500).json({ error: 'Failed to create session' });
  }
}

export async function verifySession(req: Request, res: Response) {
  try {
    const { customerId, tableId } = req.body;

    if (!customerId || !tableId) {
      return res.status(400).json({ error: 'customerId and tableId are required' });
    }

    // Trigger cleanup asynchronously
    void cleanupExpiredSessions();

    const session = await prisma.customerSession.findFirst({
      where: {
        id: customerId,
        tableId,
        expiresAt: {
          gt: new Date(),
        },
      },
    });

    if (!session) {
      return res.json({ valid: false });
    }

    // Extend session by another 2 hours
    const extendedExpiresAt = new Date(Date.now() + 2 * 60 * 60 * 1000);
    const updated = await prisma.customerSession.update({
      where: { id: customerId },
      data: { expiresAt: extendedExpiresAt },
    });

    return res.json({
      valid: true,
      session: {
        customerId: updated.id,
        name: updated.name,
        tableId: updated.tableId,
      },
    });
  } catch (error) {
    console.error('Failed to verify customer session:', error);
    return res.status(500).json({ error: 'Failed to verify session' });
  }
}
