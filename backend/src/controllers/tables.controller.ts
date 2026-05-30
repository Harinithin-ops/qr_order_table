import { Request, Response } from 'express';
import { prisma } from '../lib/prisma.js';
import { eventEmitter } from '../lib/event-emitter.js';
import QRCode from 'qrcode';

export async function getTables(req: Request, res: Response) {
  try {
    const tables = await prisma.table.findMany({
      orderBy: {
        tableNumber: 'asc',
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
    const { tableNumber } = req.body;
    
    if (!tableNumber || typeof tableNumber !== 'number' || tableNumber <= 0) {
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
          address: '123 Main Road',
          phone: '9876543210'
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

