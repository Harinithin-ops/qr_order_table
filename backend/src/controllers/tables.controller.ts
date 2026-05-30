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
