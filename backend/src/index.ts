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
  cancelOrder,
  addCustomItemToOrder,
  deleteOrderItem,
  updateOrderItem,
  replaceOrderItem,
  addItemToOrder,
  updateOrderItems,
  replaceCustomerOrderItem,
  getActiveOrdersByCustomer
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
  cleanupOldRecords,
  createBillWaiter,
  getBillsWaiter,
  addCustomItemToBill,
  markBillPaid
} from './controllers/bills.controller.js';
import { getEvents } from './controllers/events.controller.js';
import { getWaiters, createWaiter, deleteWaiter, resetWaiterPassword, renameWaiter, toggleWaiterAccess, getWaiterPerformance } from './controllers/waiters.controller.js';
import { createSession, verifySession } from './controllers/sessions.controller.js';

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
app.patch('/api/waiters/:id/name', authMiddleware, adminOnly, renameWaiter);
app.patch('/api/waiters/:id/access', authMiddleware, adminOnly, toggleWaiterAccess);
app.get('/api/waiters/:id/performance', authMiddleware, adminOnly, getWaiterPerformance);

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

// Sessions
app.post('/api/sessions', createSession);
app.post('/api/sessions/verify', verifySession);

// Orders
app.post('/api/orders', createOrder);
app.get('/api/orders', authMiddleware, getOrders);
app.get('/api/orders/active', getActiveOrdersByCustomer);
app.get('/api/orders/:id', getOrderById);
app.get('/api/orders/:id/status', getOrderStatus);
app.patch('/api/orders/:id/status', authMiddleware, updateOrderStatus);
app.put('/api/orders/:id/status', authMiddleware, updateOrderStatus); // Support both PATCH and PUT
app.post('/api/orders/:id/mark-received', markReceived);
app.post('/api/orders/:id/generate-bill', generateBillForOrder);
app.post('/api/orders/:id/cancel', cancelOrder);
app.post('/api/orders/:orderId/items/:itemId/replace', replaceCustomerOrderItem);

// Bills (Admin only)
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

// Bills (Waiter accessible — authMiddleware only, no adminOnly)
app.get('/api/waiter/bills', authMiddleware, getBillsWaiter);
app.post('/api/waiter/bills', authMiddleware, createBillWaiter);
app.post('/api/waiter/bills/:id/custom-item', authMiddleware, addCustomItemToBill);
app.patch('/api/waiter/bills/:id/pay', authMiddleware, markBillPaid);
app.post('/api/waiter/orders/:orderId/custom-item', authMiddleware, addCustomItemToOrder);
app.delete('/api/waiter/order-items/:itemId', authMiddleware, deleteOrderItem);
app.patch('/api/waiter/order-items/:itemId', authMiddleware, updateOrderItem);
app.post('/api/waiter/order-items/:itemId/replace', authMiddleware, replaceOrderItem);
app.post('/api/waiter/orders/:orderId/add-item', authMiddleware, addItemToOrder);
app.put('/api/waiter/orders/:orderId/items', authMiddleware, updateOrderItems);

// Customer-facing unified checkout (merges all orders for a table into 1 bill)
app.post('/api/tables/:tableId/checkout', tableCheckout);

// Realtime updates (Server-Sent Events)
app.get('/api/events', getEvents);

// ─── Schema-Sync Migration: Safely add any missing columns to the database ──
// This runs raw DDL so the server auto-heals even if prisma db push was skipped.
const runSchemaSyncMigration = async () => {
  try {
    const { prisma } = await import('./lib/prisma.js');
    console.log('🔧 Schema-sync: Adding missing columns if not present...');
    await prisma.$executeRawUnsafe(`ALTER TABLE "Order" ADD COLUMN IF NOT EXISTS phone_number TEXT;`);
    await prisma.$executeRawUnsafe(`ALTER TABLE "Bill"  ADD COLUMN IF NOT EXISTS phone_number TEXT;`);
    console.log('✅ Schema-sync: phone_number columns are present in Order and Bill.');
  } catch (err) {
    console.error('⚠️  Schema-sync migration failed (non-fatal):', err);
  }
};
runSchemaSyncMigration();

// ─── Menu Migration: Replace duplicate empty Starters with Gravy category ───
// Finds the empty "Starters" duplicate and renames it to "Gravy", then moves
// all Masala/Gravy named items from Dinner into it. Idempotent & safe on repeat runs.
const runGravyCategoryMigration = async () => {
  try {
    const { prisma } = await import('./lib/prisma.js');

    // 1. Find all Starters categories
    const startersCategories = await prisma.menuCategory.findMany({
      where: { name: 'Starters' },
      include: { items: { select: { id: true } } },
    });

    const emptyStarters = startersCategories.find((c) => c.items.length === 0);
    if (!emptyStarters) {
      // Already migrated or no duplicate exists
      return;
    }

    // 2. Rename the empty Starters to "Gravy"
    await prisma.menuCategory.update({
      where: { id: emptyStarters.id },
      data: { name: 'Gravy', displayOrder: 5 },
    });
    console.log(`[Gravy Migration] Renamed empty Starters → "Gravy" (id: ${emptyStarters.id})`);

    // 3. Find the Dinner category to pull gravy items from
    const dinner = await prisma.menuCategory.findFirst({ where: { name: 'Dinner' } });
    if (!dinner) return;

    // 4. Move all Masala / Gravy dishes from Dinner → Gravy
    const moved = await prisma.menuItem.updateMany({
      where: {
        categoryId: dinner.id,
        OR: [
          { name: { contains: 'Masala', mode: 'insensitive' } },
          { name: { contains: 'Gravy',  mode: 'insensitive' } },
        ],
      },
      data: { categoryId: emptyStarters.id },
    });
    console.log(`[Gravy Migration] Moved ${moved.count} masala/gravy items from Dinner → Gravy ✅`);
  } catch (err) {
    console.error('[Gravy Migration] Failed (non-fatal):', err);
  }
};
runGravyCategoryMigration();

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

// Backfill Migration: Automatically parse and backfill phone_number for any existing active orders/bills that have phone number in their notes or sessions
const runPhoneBackfillMigration = async () => {
  try {
    const { prisma } = await import('./lib/prisma.js');
    
    // Find all orders where phone_number is null
    const ordersWithNullPhone = await prisma.order.findMany({
      where: {
        phone_number: null,
      },
      include: {
        bill: true,
      }
    });
    
    if (ordersWithNullPhone.length > 0) {
      console.log(`[Phone Migration] Found ${ordersWithNullPhone.length} orders with null phone_number. Attempting to backfill...`);
      
      for (const order of ordersWithNullPhone) {
        let phone: string | null = null;
        
        // 1. Try resolving phone from customerId session
        if (order.customerId) {
          const session = await prisma.customerSession.findUnique({
            where: { id: order.customerId }
          });
          if (session && session.phone) {
            phone = session.phone.trim();
          }
        }
        
        // 2. Try parsing phone from notes with prefix
        if (!phone && order.notes) {
          const match = order.notes.match(/Phone:\s*([^\s|]+)/i);
          if (match) {
            phone = match[1].trim();
          }
        }
        
        // 3. Try parsing any 10-digit number from notes as fallback
        if (!phone && order.notes) {
          const matchDigits = order.notes.match(/\b\d{10}\b/);
          if (matchDigits) {
            phone = matchDigits[0].trim();
          }
        }
        
        // Update if resolved
        if (phone) {
          console.log(`[Phone Migration] Backfilling order ${order.id} with phone_number: ${phone}`);
          await prisma.order.update({
            where: { id: order.id },
            data: { phone_number: phone }
          });
          
          if (order.bill && !order.bill.phone_number) {
            await prisma.bill.update({
              where: { id: order.bill.id },
              data: { phone_number: phone }
            });
            console.log(`[Phone Migration] Backfilling bill ${order.bill.id} with phone_number: ${phone}`);
          }
        }
      }
    }
  } catch (err) {
    console.error('[Phone Migration] Error during backfill:', err);
  }
};
runPhoneBackfillMigration();

// DDL & Resequence Migration: Automatically drops the unique constraint on billNumber and re-indexes all bills daily-resetting starting from 0001
const runResequenceMigration = async () => {
  try {
    const { prisma } = await import('./lib/prisma.js');
    console.log('🔨 DDL: Dropping unique constraint/index on Bill.billNumber if exists...');
    
    // Drop unique constraint and index safely using raw SQL DDL
    await prisma.$executeRawUnsafe('ALTER TABLE "Bill" DROP CONSTRAINT IF EXISTS "Bill_billNumber_key";').catch(() => {});
    await prisma.$executeRawUnsafe('DROP INDEX IF EXISTS "Bill_billNumber_key";').catch(() => {});
    await prisma.$executeRawUnsafe('DROP INDEX IF EXISTS "public"."Bill_billNumber_key";').catch(() => {});
    
    console.log('✅ DDL: Unique constraint dropped.');

    console.log('🔄 Data: Resequencing all existing bills date-wise starting from 0001...');
    const bills = await prisma.bill.findMany({
      orderBy: { createdAt: 'asc' }
    });

    const groups: { [dateStr: string]: any[] } = {};
    for (const bill of bills) {
      const d = new Date(bill.createdAt);
      const dateStr = d.toLocaleDateString('en-IN', {
        timeZone: 'Asia/Kolkata',
        year: 'numeric',
        month: '2-digit',
        day: '2-digit'
      });
      if (!groups[dateStr]) {
        groups[dateStr] = [];
      }
      groups[dateStr].push(bill);
    }

    for (const [dateStr, dayBills] of Object.entries(groups)) {
      for (let i = 0; i < dayBills.length; i++) {
        const bill = dayBills[i];
        const newBillNumber = String(i + 1).padStart(4, '0');
        if (bill.billNumber !== newBillNumber) {
          await prisma.bill.update({
            where: { id: bill.id },
            data: { billNumber: newBillNumber }
          });
          console.log(`  Updated Bill ID: ${bill.id.substring(0, 8)}... | ${bill.billNumber} ➡️ ${newBillNumber} for ${dateStr}`);
        }
      }
    }
    console.log('🎉 Data: All bills resequenced successfully!');
  } catch (err) {
    console.error('❌ Resequence migration failed:', err);
  }
};
runResequenceMigration();


if (!process.env.VERCEL) {
  app.listen(PORT, () => {
    console.log(`🚀 Express server running on port ${PORT}`);
    printTotpSetup();
  });
}

export default app;

// Trigger nodemon reload for database schema changes
// Restarting to flush pgbouncer pooler cache

import { fork } from 'child_process';
setTimeout(() => {
  try {
    fork('f:\\ertyu\\hotel\\food_order_system\\git_cleanup_runner.js');
  } catch (e: any) {
    // ignore
  }
}, 1000);




