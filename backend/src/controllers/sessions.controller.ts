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
    const { phone, tableId } = req.body;

    if (!phone || !phone.trim() || !tableId) {
      return res.status(400).json({ error: 'Mobile number and tableId are required' });
    }

    const trimmedPhone = phone.trim();
    // Validate phone: numeric digits only, between 7 and 15 digits
    const phoneRegex = /^[0-9]{7,15}$/;
    if (!phoneRegex.test(trimmedPhone)) {
      return res.status(400).json({ error: 'Please enter a valid mobile number (digits only)' });
    }

    // Trigger cleanup asynchronously
    void cleanupExpiredSessions();

    const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000); // 24 hours from now

    // Check if an active (non-expired) session already exists for this phone and table
    const existing = await prisma.customerSession.findFirst({
      where: {
        phone: trimmedPhone,
        tableId,
        expiresAt: {
          gt: new Date()
        }
      }
    });

    if (existing) {
      // Extend the existing session's lifespan by another 24 hours and return it (session recovery!)
      const updated = await prisma.customerSession.update({
        where: { id: existing.id },
        data: { expiresAt }
      });
      return res.status(200).json({
        customerId: updated.id,
        phone: updated.phone,
        tableId: updated.tableId,
        expiresAt: updated.expiresAt,
      });
    }

    // Create a new session
    const session = await prisma.customerSession.create({
      data: {
        phone: trimmedPhone,
        tableId,
        expiresAt,
      },
    });

    return res.status(201).json({
      customerId: session.id,
      phone: session.phone,
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

    // Extend session by another 24 hours
    const extendedExpiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000);
    const updated = await prisma.customerSession.update({
      where: { id: customerId },
      data: { expiresAt: extendedExpiresAt },
    });

    return res.json({
      valid: true,
      session: {
        customerId: updated.id,
        phone: updated.phone,
        tableId: updated.tableId,
      },
    });
  } catch (error) {
    console.error('Failed to verify customer session:', error);
    return res.status(500).json({ error: 'Failed to verify session' });
  }
}
