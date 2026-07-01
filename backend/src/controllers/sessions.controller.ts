import { Request, Response } from 'express';
import { prisma } from '../lib/prisma.js';
import { randomUUID } from 'crypto';

// Background cleanup helper — uses raw SQL to avoid Prisma client schema issues
async function cleanupExpiredSessions() {
  try {
    await prisma.$executeRawUnsafe(`DELETE FROM "CustomerSession" WHERE "expiresAt" < NOW();`);
  } catch (err) {
    console.error('Failed to cleanup expired sessions:', err);
  }
}

/**
 * POST /api/sessions
 * Accepts a phone number, name, and table ID, and creates/extends a customer session.
 * Uses raw SQL to avoid dependency on stale Prisma generated client.
 */
export async function createPhoneSession(req: Request, res: Response) {
  try {
    const { phone, tableId, name } = req.body;

    if (!phone || !tableId) {
      return res.status(400).json({ error: 'phone and tableId are required' });
    }

    const cleanedPhone = phone.trim();
    const cleanedName = name ? name.trim() : 'Guest';
    const now = new Date();
    const expiresAt = new Date(now.getTime() + 24 * 60 * 60 * 1000); // 24 hours

    // Trigger cleanup asynchronously
    void cleanupExpiredSessions();

    // Check if an active (non-expired) session already exists for this phone and table
    const existing = await prisma.$queryRawUnsafe(
      `SELECT id, phone, name, "tableId", "expiresAt" FROM "CustomerSession"
       WHERE phone = $1 AND "tableId" = $2 AND "expiresAt" > NOW()
       LIMIT 1`,
      cleanedPhone,
      tableId
    ) as any[];

    if (existing && existing.length > 0) {
      const session = existing[0];
      // Extend the existing session and update name
      await prisma.$executeRawUnsafe(
        `UPDATE "CustomerSession" SET "expiresAt" = $1, name = $2 WHERE id = $3`,
        expiresAt,
        name ? cleanedName : (session.name || 'Guest'),
        session.id
      );
      return res.status(200).json({
        customerId: session.id,
        phone: session.phone,
        name: name ? cleanedName : (session.name || 'Guest'),
        tableId: session.tableId,
        expiresAt,
      });
    }

    // Create a new session
    const newId = randomUUID();
    await prisma.$executeRawUnsafe(
      `INSERT INTO "CustomerSession" (id, phone, name, "tableId", "createdAt", "expiresAt")
       VALUES ($1, $2, $3, $4, NOW(), $5)`,
      newId,
      cleanedPhone,
      cleanedName,
      tableId,
      expiresAt
    );

    return res.status(201).json({
      customerId: newId,
      phone: cleanedPhone,
      name: cleanedName,
      tableId,
      expiresAt,
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

    // Look up session by id and tableId
    const rows = await prisma.$queryRawUnsafe(
      `SELECT id, phone, name, "tableId", "expiresAt" FROM "CustomerSession"
       WHERE id = $1 AND "tableId" = $2 AND "expiresAt" > NOW()
       LIMIT 1`,
      customerId,
      tableId
    ) as any[];

    if (!rows || rows.length === 0) {
      return res.json({ valid: false });
    }

    const session = rows[0];

    // Extend session by another 24 hours
    const extendedExpiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000);
    await prisma.$executeRawUnsafe(
      `UPDATE "CustomerSession" SET "expiresAt" = $1 WHERE id = $2`,
      extendedExpiresAt,
      customerId
    );

    return res.json({
      valid: true,
      session: {
        customerId: session.id,
        phone: session.phone,
        name: session.name || 'Guest',
        tableId: session.tableId,
      },
    });
  } catch (error) {
    console.error('Failed to verify customer session:', error);
    return res.status(500).json({ error: 'Failed to verify session' });
  }
}
