import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import cookieParser from 'cookie-parser';

// Controllers
import { login, logout, checkAuth } from './controllers/auth.controller.js';
import { getMenu, updateMenuItem } from './controllers/menu.controller.js';
import { getTables, callWaiter, dismissWaiter, getTableQR, createTable, deleteTable } from './controllers/tables.controller.js';
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
  mergeBills
} from './controllers/bills.controller.js';
import { getEvents } from './controllers/events.controller.js';

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
app.post('/api/auth/logout', logout);
app.get('/api/auth/check', authMiddleware, checkAuth);

// Menu
app.get('/api/menu', getMenu);
app.patch('/api/menu/:id', authMiddleware, adminOnly, updateMenuItem);

// Tables
app.get('/api/tables', getTables);
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
app.get('/api/bills/:id', getBillById);
app.patch('/api/bills/:id', authMiddleware, adminOnly, updateBill);
app.post('/api/bills/:id/pay', payBill);
app.post('/api/bills/:id/items', authMiddleware, adminOnly, addExtraItemToBill);
app.post('/api/bills/merge', authMiddleware, adminOnly, mergeBills);

// Realtime updates (Server-Sent Events)
app.get('/api/events', getEvents);

if (!process.env.VERCEL) {
  app.listen(PORT, () => {
    console.log(`🚀 Express server running on port ${PORT}`);
  });
}

export default app;
