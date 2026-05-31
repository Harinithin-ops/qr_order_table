import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import cookieParser from 'cookie-parser';

import { printTotpSetup } from './utils/totp.js';

// Controllers
import { login, logout, checkAuth, verifyOtp, getMe, updateMe } from './controllers/auth.controller.js';
import { getMenu, updateMenuItem, createMenuItem, deleteMenuItem } from './controllers/menu.controller.js';
import { getTables, callWaiter, dismissWaiter, getTableQR, createTable, deleteTable, assignTables } from './controllers/tables.controller.js';
import {
  createOrder,
  getOrders,
  getOrderById,
  getOrderStatus,
  updateOrderStatus,
  markReceived,
  generateBillForOrder,
  cancelOrder
} from './controllers/orders.controller.js';
import {
  createBill,
  getBills,
  getBillById,
  updateBill,
  payBill,
  addExtraItemToBill,
  mergeBills,
  tableCheckout,
  deleteBill,
  cleanupOldRecords
} from './controllers/bills.controller.js';
import { getEvents } from './controllers/events.controller.js';
import { getWaiters, createWaiter, deleteWaiter, resetWaiterPassword } from './controllers/waiters.controller.js';

// Middleware
import { authMiddleware, adminOnly } from './middleware/auth.middleware.js';

const app = express();
const PORT = process.env.PORT || 5000;

// Enable CORS for frontend development
app.use(cors({
  origin: true, // Allow request origin dynamically in development
  credentials: true,
}));

app.use(express.json());
app.use(cookieParser());

// URL Rewriter middleware to handle Vercel routePrefix
app.use((req, res, next) => {
  if (req.url.startsWith('/_/backend')) {
    req.url = req.url.replace('/_/backend', '');
  }
  next();
});

// Auth
app.post('/api/auth/login', login);
app.post('/api/auth/verify-otp', verifyOtp);
app.post('/api/auth/logout', logout);
app.get('/api/auth/check', authMiddleware, checkAuth);
app.get('/api/auth/me', authMiddleware, getMe);
app.patch('/api/auth/me', authMiddleware, updateMe);

// Waiters (Admin only)
app.get('/api/waiters', authMiddleware, adminOnly, getWaiters);
app.post('/api/waiters', authMiddleware, adminOnly, createWaiter);
app.delete('/api/waiters/:id', authMiddleware, adminOnly, deleteWaiter);
app.patch('/api/waiters/:id/password', authMiddleware, adminOnly, resetWaiterPassword);

// Menu
app.get('/api/menu', getMenu);
app.post('/api/menu', authMiddleware, adminOnly, createMenuItem);
app.patch('/api/menu/:id', authMiddleware, updateMenuItem);
app.delete('/api/menu/:id', authMiddleware, adminOnly, deleteMenuItem);

// Tables
app.get('/api/tables', getTables);
app.post('/api/tables/assign', authMiddleware, assignTables);
app.post('/api/tables', authMiddleware, adminOnly, createTable);
app.delete('/api/tables/:id', authMiddleware, adminOnly, deleteTable);
app.post('/api/tables/:id/call-waiter', callWaiter);
app.delete('/api/tables/:id/call-waiter', dismissWaiter);
app.get('/api/qr/:id', getTableQR);

// Orders
app.post('/api/orders', createOrder);
app.get('/api/orders', authMiddleware, getOrders);
app.get('/api/orders/:id', getOrderById);
app.get('/api/orders/:id/status', getOrderStatus);
app.patch('/api/orders/:id/status', authMiddleware, updateOrderStatus);
app.put('/api/orders/:id/status', authMiddleware, updateOrderStatus); // Support both PATCH and PUT
app.post('/api/orders/:id/mark-received', markReceived);
app.post('/api/orders/:id/generate-bill', generateBillForOrder);
app.post('/api/orders/:id/cancel', cancelOrder);

// Bills
app.post('/api/bills', authMiddleware, adminOnly, createBill);
app.get('/api/bills', authMiddleware, adminOnly, getBills);
// NOTE: static routes must come before :id to avoid 'cleanup' being matched as an id
app.delete('/api/bills/cleanup', authMiddleware, adminOnly, cleanupOldRecords);
app.get('/api/bills/:id', getBillById);
app.patch('/api/bills/:id', authMiddleware, adminOnly, updateBill);
app.delete('/api/bills/:id', authMiddleware, adminOnly, deleteBill);
app.post('/api/bills/:id/pay', payBill);
app.post('/api/bills/:id/items', authMiddleware, adminOnly, addExtraItemToBill);
app.post('/api/bills/merge', authMiddleware, adminOnly, mergeBills);

// Customer-facing unified checkout (merges all orders for a table into 1 bill)
app.post('/api/tables/:tableId/checkout', tableCheckout);

// Realtime updates (Server-Sent Events)
app.get('/api/events', getEvents);

// Auto-cleanup: delete all bills/orders older than 2 days every 48 hours
const TWO_DAYS_MS = 2 * 24 * 60 * 60 * 1000;
const runAutoCleanup = async () => {
  try {
    const { prisma } = await import('./lib/prisma.js');
    const twoDaysAgo = new Date(Date.now() - TWO_DAYS_MS);
    
    // Find bills older than 2 days
    const oldBills = await prisma.bill.findMany({
      where: { createdAt: { lt: twoDaysAgo } },
      select: { id: true, orderId: true },
    });

    // Find orders older than 2 days that have NO bills
    const oldOrdersWithoutBills = await prisma.order.findMany({
      where: {
        createdAt: { lt: twoDaysAgo },
        bill: null
      },
      select: { id: true }
    });

    const billIds = oldBills.map((b: any) => b.id);
    const orderIdsWithBills = oldBills.map((b: any) => b.orderId);
    const orderIdsWithoutBills = oldOrdersWithoutBills.map((o: any) => o.id);
    const allOrderIds = [...orderIdsWithBills, ...orderIdsWithoutBills];

    if (billIds.length > 0 || allOrderIds.length > 0) {
      await prisma.$transaction(async (tx: any) => {
        if (allOrderIds.length > 0) {
          await tx.orderItem.deleteMany({ where: { orderId: { in: allOrderIds } } });
        }
        if (billIds.length > 0) {
          await tx.bill.deleteMany({ where: { id: { in: billIds } } });
        }
        if (allOrderIds.length > 0) {
          await tx.order.deleteMany({ where: { id: { in: allOrderIds } } });
        }
      });
      console.log(`🧹 Auto-cleanup: removed ${billIds.length + orderIdsWithoutBills.length} record(s) older than 2 days.`);
    }
  } catch (err) {
    console.error('Auto-cleanup failed:', err);
  }
};
// Run once on startup, then every 48 h
runAutoCleanup();
setInterval(runAutoCleanup, TWO_DAYS_MS);

// Starters Migration: Automatically separate starters/soups from Dinner into a new 'Starters' category
const runStartersMigration = async () => {
  try {
    const { prisma } = await import('./lib/prisma.js');
    let startersCat = await prisma.menuCategory.findFirst({
      where: { name: 'Starters' }
    });
    if (!startersCat) {
      startersCat = await prisma.menuCategory.create({
        data: { name: 'Starters', displayOrder: 4 }
      });
      console.log('✅ Created "Starters" menu category.');
    }

    const dinnerCat = await prisma.menuCategory.findFirst({
      where: { name: 'Dinner' }
    });
    if (dinnerCat) {
      const migrated = await prisma.menuItem.updateMany({
        where: {
          categoryId: dinnerCat.id,
          OR: [
            { name: { contains: '65' } },
            { name: { contains: 'Pepper Fry' } },
            { name: { contains: 'Chilly' } },
            { name: { contains: 'Manchurian' } },
            { name: { contains: 'Soup' } },
            { name: { contains: 'Fries' } },
            { name: { contains: 'Finger' } },
            { name: { contains: 'Lollipop' } },
            { name: { contains: 'Popcorn' } },
            { name: { contains: 'Tikka' } },
            { name: { equals: 'Pallipalayam Mushroom' } },
            { name: { equals: 'Pallipalayam Gobi' } },
            { name: { equals: 'Pallipalayam Paneer' } },
          ]
        },
        data: {
          categoryId: startersCat.id
        }
      });
      if (migrated.count > 0) {
        console.log(`✅ Migrated ${migrated.count} starter item(s) from Dinner to Starters category.`);
      }
    }
  } catch (err) {
    console.error('Starters migration failed:', err);
  }
};
runStartersMigration();

if (!process.env.VERCEL) {
  app.listen(PORT, () => {
    console.log(`🚀 Express server running on port ${PORT}`);
    printTotpSetup();
  });
}

export default app;
