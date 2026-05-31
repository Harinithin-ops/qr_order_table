import { Request, Response } from 'express';
import { prisma } from '../lib/prisma.js';
import { eventEmitter } from '../lib/event-emitter.js';
import { generateBillNumber, TAX_RATE, getCategoryTimingStatus } from '../lib/utils.js';
import { AuthenticatedRequest } from '../middleware/auth.middleware.js';

export async function createOrder(req: Request, res: Response) {
  try {
    const { tableId, items, notes } = req.body;

    if (!tableId || !items || items.length === 0) {
      return res.status(400).json({ error: 'Invalid request data' });
    }

    const table = await prisma.table.findFirst({
      where: {
        OR: [
          { id: tableId },
          { slug: tableId }
        ]
      }
    });

    if (!table) {
      return res.status(404).json({ error: 'Table not found' });
    }

    // Validate if any ordered items belong to a category that is currently locked
    const menuItemIds = items.map((item: any) => item.menuItemId);
    const dbMenuItems = await prisma.menuItem.findMany({
      where: {
        id: { in: menuItemIds }
      },
      include: {
        category: true
      }
    });

    for (const dbItem of dbMenuItems) {
      const { isOpen, label } = getCategoryTimingStatus(dbItem.category.name);
      if (!isOpen) {
        return res.status(400).json({
          error: `Sorry, '${dbItem.name}' is a ${dbItem.category.name} item and can only be ordered between ${label}.`
        });
      }
    }

    const total = items.reduce((acc: number, item: any) => acc + item.price * item.quantity, 0);

    const order = await prisma.order.create({
      data: {
        tableId: table.id,
        total,
        notes,
        items: {
          create: items.map((item: any) => ({
            menuItemId: item.menuItemId,
            quantity: item.quantity,
            price: item.price,
            specialInstructions: item.specialInstructions,
          })),
        },
      },
      include: {
        table: true,
        items: {
          include: {
            menuItem: true,
          },
        },
      },
    });

    // Emit event for dashboard
    eventEmitter.emit('NEW_ORDER', { orderId: order.id, tableId: order.tableId });

    return res.status(201).json(order);
  } catch (error) {
    console.error('Failed to create order:', error);
    return res.status(500).json({ error: 'Failed to create order' });
  }
}

export async function getOrders(req: Request, res: Response) {
  try {
    const authReq = req as AuthenticatedRequest;
    const { status } = req.query;

    let whereClause: any = {
      status: {
        notIn: ['PAID', 'CANCELLED']
      }
    };

    if (status === 'completed') {
      whereClause = {
        status: {
          in: ['SERVED', 'PENDING', 'PAID']
        }
      };
    }

    const orders = await prisma.order.findMany({
      where: whereClause,
      include: {
        table: true,
        bill: true,
        items: {
          include: {
            menuItem: true,
          },
        },
      },
      orderBy: {
        createdAt: status === 'completed' ? 'desc' : 'asc',
      },
    });

    if (authReq.username !== 'admin') {
      const sanitizedOrders = orders.map(order => ({
        ...order,
        total: 0,
        bill: null,
        items: order.items.map(item => ({
          ...item,
          price: 0,
          menuItem: {
            ...item.menuItem,
            price: 0
          }
        }))
      }));
      return res.json(sanitizedOrders);
    }

    return res.json(orders);
  } catch (error) {
    console.error('Failed to fetch orders:', error);
    return res.status(500).json({ error: 'Failed to fetch orders' });
  }
}

export async function getOrderById(req: Request, res: Response) {
  try {
    const { id } = req.params;
    const authReq = req as AuthenticatedRequest;

    const order = await prisma.order.findUnique({
      where: { id },
      include: {
        table: true,
        bill: true,
        items: {
          include: {
            menuItem: true,
          },
        },
      },
    });

    if (!order) {
      return res.status(404).json({ error: 'Order not found' });
    }

    return res.json(order);
  } catch (error) {
    console.error('Failed to fetch order:', error);
    return res.status(500).json({ error: 'Failed to fetch order' });
  }
}

export async function getOrderStatus(req: Request, res: Response) {
  try {
    const { id } = req.params;
    const order = await prisma.order.findUnique({
      where: { id },
      select: {
        id: true,
        status: true,
        total: true,
      },
    });

    if (!order) {
      return res.status(404).json({ error: 'Order not found' });
    }

    return res.json(order);
  } catch (error) {
    console.error('Failed to fetch order status:', error);
    return res.status(500).json({ error: 'Failed to fetch status' });
  }
}

export async function updateOrderStatus(req: Request, res: Response) {
  try {
    const { id } = req.params;
    const { status } = req.body;

    if (!status) {
      return res.status(400).json({ error: 'Status is required' });
    }

    const order = await prisma.order.update({
      where: { id },
      data: { status },
      select: {
        id: true,
        status: true,
        tableId: true,
      }
    });

    // Notify customer
    eventEmitter.emit('ORDER_UPDATE', { orderId: order.id, status: order.status, tableId: order.tableId });

    return res.json(order);
  } catch (error) {
    console.error('Failed to update order status:', error);
    return res.status(500).json({ error: 'Failed to update status' });
  }
}

export async function markReceived(req: Request, res: Response) {
  try {
    const { id: orderId } = req.params;
    const { tableId } = req.body as { tableId?: string };

    if (!tableId) {
      return res.status(400).json({ error: 'tableId is required' });
    }

    const table = await prisma.table.findFirst({
      where: { OR: [{ id: tableId }, { slug: tableId }] },
    });
    if (!table) {
      return res.status(404).json({ error: 'Table not found' });
    }

    const order = await prisma.order.findUnique({
      where: { id: orderId },
      select: { id: true, status: true, tableId: true },
    });
    if (!order) {
      return res.status(404).json({ error: 'Order not found' });
    }
    if (order.tableId !== table.id) {
      return res.status(403).json({ error: 'Order does not belong to this table' });
    }
    if (order.status !== 'READY') {
      const msg =
        order.status === 'SERVED'
          ? 'Already marked as received'
          : 'You can confirm only when the order is ready for serve';
      return res.status(400).json({ error: msg });
    }

    const updated = await prisma.order.update({
      where: { id: orderId },
      data: { status: 'SERVED' },
      select: { id: true, status: true, tableId: true },
    });

    eventEmitter.emit('ORDER_UPDATE', {
      orderId: updated.id,
      status: updated.status,
      tableId: updated.tableId,
    });

    return res.json(updated);
  } catch (error) {
    console.error('Failed to mark received:', error);
    return res.status(500).json({ error: 'Failed to update order' });
  }
}

export async function generateBillForOrder(req: Request, res: Response) {
  try {
    const { id: orderId } = req.params;

    const order = await prisma.order.findUnique({
      where: { id: orderId },
      include: { items: true },
    });

    if (!order) {
      return res.status(404).json({ error: 'Order not found' });
    }
    
    // Check if bill already exists
    const existingBill = await prisma.bill.findUnique({ where: { orderId } });
    if (existingBill) {
      return res.json(existingBill);
    }

    const subtotal = order.total;
    const taxAmount = subtotal * TAX_RATE;
    const total = subtotal + taxAmount;

    const bill = await prisma.bill.create({
      data: {
        orderId,
        subtotal,
        taxAmount,
        total,
        billNumber: await generateBillNumber(),
      },
    });
    
    // Update order status if not paid
    if (order.status !== 'PAID') {
      await prisma.order.update({
        where: { id: orderId },
        data: { status: 'PENDING' } // Pending payment
      });
      // Notify dashboard and others that bill is ready
      eventEmitter.emit('ORDER_UPDATE', {
        orderId,
        status: 'PENDING',
        tableId: order.tableId,
        billId: bill.id,
      });
    }

    return res.json(bill);
  } catch (error) {
    console.error('Failed to generate customer bill:', error);
    return res.status(500).json({ error: 'Failed to generate bill' });
  }
}

export async function cancelOrder(req: Request, res: Response) {
  try {
    const { id } = req.params;

    const order = await prisma.order.findUnique({
      where: { id },
    });

    if (!order) {
      return res.status(404).json({ error: 'Order not found' });
    }

    // Only allow cancelling if the order is still PLACED
    if (order.status !== 'PLACED') {
      return res.status(400).json({ error: 'Order cannot be cancelled at this stage' });
    }

    const updatedOrder = await prisma.order.update({
      where: { id },
      data: { status: 'CANCELLED' },
    });

    // Notify dashboard
    eventEmitter.emit('ORDER_UPDATE', { 
      orderId: id, 
      status: 'CANCELLED',
      tableId: order.tableId
    });

    return res.json(updatedOrder);
  } catch (error) {
    console.error('Failed to cancel order:', error);
    return res.status(500).json({ error: 'Failed to cancel order' });
  }
}
