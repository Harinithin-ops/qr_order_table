import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import cookieParser from 'cookie-parser';
import { fork } from 'child_process';

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
  markBillPaid,
  getTableOrders,
  getCustomerBills,
  generateSingleBill,
  mergeBillsManual,
  printBill,
  serveOrder,
  getAuditHistory,
  getDashboardStats
} from './controllers/bills.controller.js';
import { getEvents } from './controllers/events.controller.js';
import { getWaiters, createWaiter, deleteWaiter, resetWaiterPassword, renameWaiter, toggleWaiterAccess, getWaiterPerformance } from './controllers/waiters.controller.js';
import { createPhoneSession, verifySession } from './controllers/sessions.controller.js';

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
app.post('/api/sessions', createPhoneSession);
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
app.post('/api/bills/merge', authMiddleware, mergeBillsManual);
app.get('/api/tables/:tableId/orders', authMiddleware, getTableOrders);
app.get('/api/customers/:mobile/bills', authMiddleware, getCustomerBills);
app.post('/api/bills/generate', authMiddleware, generateSingleBill);
app.post('/api/bills/print', authMiddleware, printBill);
app.post('/api/bills/serve', authMiddleware, serveOrder);
app.get('/api/audit/bill-history', authMiddleware, getAuditHistory);

// Bills (Waiter accessible — authMiddleware only, no adminOnly)
app.get('/api/waiter/bills', authMiddleware, getBillsWaiter);
app.get('/api/waiter/dashboard-stats', authMiddleware, getDashboardStats);
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

// ─── Schema-Sync Migration: Safely add any missing columns and tables to the database ──
// This runs raw DDL so the server auto-heals even if prisma db push was skipped.
const runSchemaSyncMigration = async () => {
  try {
    const { prisma } = await import('./lib/prisma.js');
    console.log('🔧 Schema-sync: Adding missing columns and tables if not present...');
    await prisma.$executeRawUnsafe(`ALTER TABLE "Order" ADD COLUMN IF NOT EXISTS phone_number TEXT;`);
    await prisma.$executeRawUnsafe(`ALTER TABLE "Order" ADD COLUMN IF NOT EXISTS customer_email TEXT;`);
    await prisma.$executeRawUnsafe(`ALTER TABLE "Bill"  ADD COLUMN IF NOT EXISTS phone_number TEXT;`);
    await prisma.$executeRawUnsafe(`ALTER TABLE "Bill"  ADD COLUMN IF NOT EXISTS customer_email TEXT;`);
    await prisma.$executeRawUnsafe(`ALTER TABLE "Bill"  ADD COLUMN IF NOT EXISTS is_merged BOOLEAN DEFAULT FALSE;`);
    await prisma.$executeRawUnsafe(`ALTER TABLE "Bill"  ADD COLUMN IF NOT EXISTS merged_bill_id TEXT;`);
    await prisma.$executeRawUnsafe(`ALTER TABLE "Bill"  ADD COLUMN IF NOT EXISTS group_id TEXT;`);
    await prisma.$executeRawUnsafe(`ALTER TABLE "CustomerSession" ADD COLUMN IF NOT EXISTS email TEXT;`);
    await prisma.$executeRawUnsafe(`ALTER TABLE "CustomerSession" ADD COLUMN IF NOT EXISTS name TEXT;`);
    // Add phone column for restored phone-based login
    await prisma.$executeRawUnsafe(`ALTER TABLE "CustomerSession" ADD COLUMN IF NOT EXISTS phone TEXT;`);
    // Make old NOT NULL constraints nullable for transition safety
    await prisma.$executeRawUnsafe(`ALTER TABLE "CustomerSession" ALTER COLUMN phone DROP NOT NULL;`).catch(() => {});
    await prisma.$executeRawUnsafe(`ALTER TABLE "CustomerSession" ALTER COLUMN email DROP NOT NULL;`).catch(() => {});

    // Create new tables
    await prisma.$executeRawUnsafe(`
      CREATE TABLE IF NOT EXISTS bill_groups (
        id TEXT PRIMARY KEY,
        "tableId" TEXT NOT NULL,
        phone_number TEXT,
        customer_email TEXT,
        "createdAt" TIMESTAMP DEFAULT NOW()
      );
    `);

    await prisma.$executeRawUnsafe(`
      CREATE TABLE IF NOT EXISTS merged_bills (
        id TEXT PRIMARY KEY,
        parent_bill_id TEXT NOT NULL,
        child_bill_id TEXT NOT NULL,
        "createdAt" TIMESTAMP DEFAULT NOW()
      );
    `);

    await prisma.$executeRawUnsafe(`
      CREATE TABLE IF NOT EXISTS bill_merge_history (
        merge_id TEXT PRIMARY KEY,
        parent_bill_id TEXT NOT NULL,
        child_bill_id TEXT NOT NULL,
        merged_by TEXT NOT NULL,
        merged_at TIMESTAMP DEFAULT NOW(),
        merge_reason TEXT
      );
    `);

    await prisma.$executeRawUnsafe(`
      CREATE TABLE IF NOT EXISTS audit_logs (
        id TEXT PRIMARY KEY,
        audit_action TEXT NOT NULL,
        audit_timestamp TIMESTAMP DEFAULT NOW(),
        details TEXT
      );
    `);

    await prisma.$executeRawUnsafe(`
      CREATE TABLE IF NOT EXISTS "UserSession" (
        id TEXT PRIMARY KEY,
        "userId" TEXT NOT NULL,
        role TEXT NOT NULL,
        token TEXT UNIQUE NOT NULL,
        "createdAt" TIMESTAMP NOT NULL DEFAULT NOW(),
        "expiresAt" TIMESTAMP NOT NULL,
        "lastActiveAt" TIMESTAMP NOT NULL DEFAULT NOW()
      );
    `);

    console.log('✅ Schema-sync: Columns and tables check completed.');

    // Regenerate Prisma client asynchronously
    const { exec } = await import('child_process');
    console.log('🔧 Regenerating Prisma Client...');
    exec('npx prisma generate', { cwd: 'f:\\ertyu\\hotel\\food_order_system\\backend' }, (err, stdout, stderr) => {
      if (err) {
        console.error('❌ Failed to regenerate Prisma client:', err);
      } else {
        console.log('✅ Prisma client regenerated successfully.');
      }
    });
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

    // Clean up expired user sessions
    try {
      const deletedSessions = await prisma.$executeRawUnsafe(`
        DELETE FROM "UserSession" WHERE "expiresAt" < NOW();
      `);
      if (deletedSessions > 0) {
        console.log(`🧹 Auto-cleanup: removed ${deletedSessions} expired user session(s).`);
      }
    } catch (sessionCleanupErr) {
      // Non-fatal session cleanup failure
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

// Email Backfill Migration: Populate customer_email on existing orders that have a customerId session
const runEmailBackfillMigration = async () => {
  try {
    const { prisma } = await import('./lib/prisma.js');

    // Find orders that have a customerId but no customer_email yet
    const ordersToBackfill = await prisma.order.findMany({
      where: {
        customerId: { not: null },
        customer_email: null,
      },
      include: { bill: true },
    });

    if (ordersToBackfill.length > 0) {
      console.log(`[Email Migration] Found ${ordersToBackfill.length} orders to backfill customer_email.`);
      for (const order of ordersToBackfill) {
        if (!order.customerId) continue;
        try {
          const session = await prisma.customerSession.findUnique({
            where: { id: order.customerId }
          });
          if (session && session.email) {
            await prisma.order.update({
              where: { id: order.id },
              data: { customer_email: session.email }
            });
            if (order.bill && !order.bill.customer_email) {
              await prisma.bill.update({
                where: { id: order.bill.id },
                data: { customer_email: session.email }
              });
            }
          }
        } catch {}
      }
      console.log('[Email Migration] Backfill completed.');
    }
  } catch (err) {
    console.error('[Email Migration] Error during backfill:', err);
  }
};
runEmailBackfillMigration();

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
// Force restart to trigger git push script
// Reload to apply latest bills.controller.ts deleteMany fix
// Reload to apply latest UserSession and JWT auth additions

