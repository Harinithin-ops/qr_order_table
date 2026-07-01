import { Request, Response } from 'express';
import { prisma } from '../lib/prisma.js';
import { eventEmitter } from '../lib/event-emitter.js';
import QRCode from 'qrcode';
import { AuthenticatedRequest } from '../middleware/auth.middleware.js';

export async function getTables(req: Request, res: Response) {
  try {
    const tables = await prisma.table.findMany({
      orderBy: {
        tableNumber: 'asc',
      },
      include: {
        assignedWaiter: {
          select: {
            id: true,
            username: true,
            email: true,
          },
        },
      },
    });
    return res.json(tables);
  } catch (error) {
    console.error('Failed to fetch tables:', error);
    return res.status(500).json({ error: 'Failed to fetch tables' });
  }
}

export async function callWaiter(req: Request, res: Response) {
  try {
    const { id } = req.params;
    const table = await prisma.table.update({
      where: { slug: id },
      data: { callingWaiter: true },
    });

    eventEmitter.emit('WAITER_CALL', { tableId: table.id, tableNumber: table.tableNumber });
    return res.json({ success: true });
  } catch (error) {
    console.error('Failed to call waiter:', error);
    return res.status(500).json({ error: 'Failed to call waiter' });
  }
}

export async function dismissWaiter(req: Request, res: Response) {
  try {
    const { id } = req.params;
    let table;
    if (id.includes('table-')) {
      table = await prisma.table.update({
        where: { slug: id },
        data: { callingWaiter: false },
      });
    } else {
      table = await prisma.table.update({
        where: { id },
        data: { callingWaiter: false },
      });
    }

    eventEmitter.emit('WAITER_DISMISS', { tableId: table.id, tableNumber: table.tableNumber });
    return res.json({ success: true });
  } catch (error) {
    console.error('Failed to dismiss waiter call:', error);
    return res.status(500).json({ error: 'Failed to dismiss' });
  }
}

export async function getTableQR(req: Request, res: Response) {
  try {
    const { id } = req.params;
    
    // Construct the menu URL
    const frontendUrl = process.env.FRONTEND_URL || `${req.protocol}://${req.get('host')}`;
    let url = `${frontendUrl}/menu/${id}`;
    if (url.includes('localhost:5000')) {
      url = url.replace('localhost:5000', 'localhost:5173');
    }

    // Generate QR
    const qrBuffer = await QRCode.toBuffer(url, {
      errorCorrectionLevel: 'H',
      margin: 2,
      width: 400,
      color: {
        dark: '#000000',
        light: '#ffffff'
      }
    });

    res.setHeader('Content-Type', 'image/png');
    res.setHeader('Cache-Control', 'public, max-age=86400');
    return res.send(qrBuffer);
  } catch (error) {
    console.error('Failed to generate QR:', error);
    return res.status(500).json({ error: 'Failed to generate QR' });
  }
}

export async function createTable(req: Request, res: Response) {
  try {
    const tableNumber = parseInt(String(req.body.tableNumber), 10);
    
    if (isNaN(tableNumber) || tableNumber <= 0) {
      return res.status(400).json({ error: 'Valid table number is required' });
    }

    // Check if table number already exists
    const existingTable = await prisma.table.findFirst({
      where: { tableNumber }
    });

    if (existingTable) {
      return res.status(400).json({ error: `Table number ${tableNumber} already exists` });
    }

    // Get first branch or create one if none exists
    let branch = await prisma.branch.findFirst();
    if (!branch) {
      branch = await prisma.branch.create({
        data: {
          name: 'Main Branch',
          address: 'No 36, PG Nest, Bus Stop, opp. to Vadavalli, V.N.R.Nagar, Vadavalli, Coimbatore, Tamil Nadu 641041',
          phone: '98430 47471'
        }
      });
    }

    const slug = `table-${tableNumber}`;

    const newTable = await prisma.table.create({
      data: {
        tableNumber,
        slug,
        branchId: branch.id,
        active: true,
        callingWaiter: false
      }
    });

    return res.status(201).json(newTable);
  } catch (error) {
    console.error('Failed to create table:', error);
    return res.status(500).json({ error: 'Failed to create table' });
  }
}

export async function deleteTable(req: Request, res: Response) {
  try {
    const { id } = req.params;

    // Check if table exists
    const table = await prisma.table.findUnique({
      where: { id }
    });

    if (!table) {
      return res.status(404).json({ error: 'Table not found' });
    }

    // Delete table and all its relations (orders, order items, bills) in a transaction
    await prisma.$transaction(async (tx) => {
      // Find all orders for this table
      const orders = await tx.order.findMany({
        where: { tableId: id },
        select: { id: true }
      });

      const orderIds = orders.map(o => o.id);

      if (orderIds.length > 0) {
        // Delete all bills for these orders
        await tx.bill.deleteMany({
          where: { orderId: { in: orderIds } }
        });

        // Delete all order items for these orders
        await tx.orderItem.deleteMany({
          where: { orderId: { in: orderIds } }
        });

        // Delete all orders
        await tx.order.deleteMany({
          where: { tableId: id }
        });
      }

      // Finally, delete the table itself
      await tx.table.delete({
        where: { id }
      });
    });

    return res.json({ success: true, message: 'Table and associated data deleted successfully' });
  } catch (error) {
    console.error('Failed to delete table:', error);
    return res.status(500).json({ error: 'Failed to delete table' });
  }
}

export async function assignTables(req: Request, res: Response) {
  try {
    const authReq = req as AuthenticatedRequest;
    const { tableIds } = req.body; // Array of table IDs

    if (!Array.isArray(tableIds)) {
      return res.status(400).json({ error: 'Invalid tableIds format. Must be an array.' });
    }

    if (tableIds.length > 5) {
      return res.status(400).json({ error: "You shouldn't select more than 5 tables." });
    }

    const username = authReq.username;
    if (!username) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    // Admins don't have waiter profiles — table assignment is for waiters only
    if (username === 'admin') {
      return res.status(403).json({ error: 'Table assignment is for waiter accounts only, not admin.' });
    }

    // Find the waiter by username
    const waiter = await prisma.waiter.findUnique({
      where: { username }
    });

    if (!waiter) {
      return res.status(404).json({ error: 'Waiter profile not found. Please log in as a waiter account.' });
    }

    const waiterId = waiter.id;

    // Verify if any table in tableIds is already assigned to a DIFFERENT waiter
    const assignedElsewhere = await prisma.table.findMany({
      where: {
        id: { in: tableIds },
        assignedWaiterId: {
          not: null,
          notIn: [waiterId]
        }
      },
      include: {
        assignedWaiter: true
      }
    });

    if (assignedElsewhere.length > 0) {
      const numbers = assignedElsewhere.map(t => t.tableNumber).join(', ');
      const names = assignedElsewhere.map(t => t.assignedWaiter?.username || 'another waiter').join(', ');
      return res.status(400).json({
        error: `Table ${numbers} is already assigned to ${names}.`
      });
    }

    // Atomically reassign tables
    await prisma.$transaction(async (tx) => {
      // 1. Release all tables currently assigned to this waiter
      await tx.table.updateMany({
        where: { assignedWaiterId: waiterId },
        data: { assignedWaiterId: null }
      });

      // 2. Assign the new tables
      if (tableIds.length > 0) {
        await tx.table.updateMany({
          where: { id: { in: tableIds } },
          data: { assignedWaiterId: waiterId }
        });
      }
    });

    // Emit TABLES_UPDATE event to alert SSE clients
    eventEmitter.emit('TABLES_UPDATE', { updated: true });

    // Return the updated list of all tables
    const updatedTables = await prisma.table.findMany({
      orderBy: { tableNumber: 'asc' },
      include: {
        assignedWaiter: {
          select: {
            id: true,
            username: true,
            email: true
          }
        }
      }
    });

    return res.json(updatedTables);
  } catch (error) {
    console.error('Failed to assign tables:', error);
    return res.status(500).json({ error: 'Failed to assign tables' });
  }
}

