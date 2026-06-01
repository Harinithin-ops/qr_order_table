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

    // Server-Side Same-Name Order Merging
    // Check if the new order specifies a customer name
    const match = notes ? notes.match(/^Name:\s*([^|]+)/) : null;
    const customerName = match ? match[1].trim() : null;

    if (customerName) {
      // Find active orders at this table (status not PAID or CANCELLED)
      const activeOrders = await prisma.order.findMany({
        where: {
          tableId: table.id,
          status: {
            notIn: ['PAID', 'CANCELLED']
          }
        },
        include: {
          items: true
        }
      });

      // Find an order where the notes start with "Name: [customerName]" (case-insensitive)
      const existingOrder = activeOrders.find(o => {
        const existingNotes = o.notes || '';
        const m = existingNotes.match(/^Name:\s*([^|]+)/);
        if (m) {
          return m[1].trim().toLowerCase() === customerName.toLowerCase();
        }
        return false;
      });

      if (existingOrder) {
        // Perform order merge inside a transaction
        const mergedOrder = await prisma.$transaction(async (tx) => {
          // 1. Process items
          for (const item of items) {
            // Find duplicate item in existing order with the same special instructions
            const existingItem = existingOrder.items.find(
              ei => ei.menuItemId === item.menuItemId && 
                    (ei.specialInstructions || '').trim().toLowerCase() === (item.specialInstructions || '').trim().toLowerCase()
            );

            if (existingItem) {
              // Increment quantity of existing item
              await tx.orderItem.update({
                where: { id: existingItem.id },
                data: {
                  quantity: existingItem.quantity + item.quantity
                }
              });
            } else {
              // Add new item to the existing order
              await tx.orderItem.create({
                data: {
                  orderId: existingOrder.id,
                  menuItemId: item.menuItemId,
                  quantity: item.quantity,
                  price: item.price,
                  specialInstructions: item.specialInstructions
                }
              });
            }
          }

          // 2. Concatenate notes suffix elegantly
          let mergedNotes = existingOrder.notes || '';
          const newNotesMatch = notes ? notes.match(/\|\s*Notes:\s*(.+)$/) : null;
          const newNotesContent = newNotesMatch ? newNotesMatch[1].trim() : null;

          if (newNotesContent) {
            const existingNotesMatch = (existingOrder.notes || '').match(/\|\s*Notes:\s*(.+)$/);
            const existingNotesContent = existingNotesMatch ? existingNotesMatch[1].trim() : null;

            if (existingNotesContent) {
              if (!existingNotesContent.toLowerCase().includes(newNotesContent.toLowerCase())) {
                mergedNotes = `Name: ${customerName} | Notes: ${existingNotesContent}; ${newNotesContent}`;
              }
            } else {
              mergedNotes = `Name: ${customerName} | Notes: ${newNotesContent}`;
            }
          }

          // 3. Recalculate total price
          const updatedItems = await tx.orderItem.findMany({
            where: { orderId: existingOrder.id }
          });
          const newTotal = updatedItems.reduce((acc, item) => acc + item.price * item.quantity, 0);

          // 4. Update the order with the new total, merged notes, and reset status if needed
          let newStatus = existingOrder.status;
          if (['READY', 'SERVED'].includes(existingOrder.status)) {
            newStatus = 'PLACED';
          }

          const updated = await tx.order.update({
            where: { id: existingOrder.id },
            data: {
              total: newTotal,
              notes: mergedNotes,
              status: newStatus
            },
            include: {
              table: true,
              items: {
                include: {
                  menuItem: true
                }
              }
            }
          });

          return updated;
        });

        // Emit update event to sync dashboard
        eventEmitter.emit('ORDER_UPDATE', { 
          orderId: mergedOrder.id, 
          status: mergedOrder.status, 
          tableId: mergedOrder.tableId 
        });

        return res.status(200).json(mergedOrder);
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

    if (authReq.username !== 'admin') {
      const waiter = await prisma.waiter.findUnique({
        where: { username: authReq.username }
      });
      if (waiter) {
        whereClause.table = {
          assignedWaiterId: waiter.id
        };
      } else {
        return res.json([]);
      }
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
        bill: order.bill ? {
          id: order.bill.id,
          billNumber: order.bill.billNumber,
          paymentStatus: order.bill.paymentStatus,
          paymentMethod: order.bill.paymentMethod,
          paymentReference: order.bill.paymentReference,
        } : null,
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

    const tableBill = await prisma.bill.findFirst({
      where: {
        order: {
          tableId: order.tableId,
          status: { notIn: ['PAID', 'CANCELLED'] }
        }
      }
    });

    const responsePayload = {
      ...order,
      tableHasBill: !!tableBill
    };

    if (authReq.username !== 'admin') {
      // Return order with prices zeroed out if not admin/waiter
      // Wait, is there a price zeroing check in getOrderById?
      // Let's verify if there is any price zeroing. No, getOrderById originally returned the raw order:
      // return res.json(order);
    }

    return res.json(responsePayload);
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

export async function addCustomItemToOrder(req: Request, res: Response) {
  try {
    const { orderId } = req.params;
    const { name, price, quantity = 1 } = req.body;

    if (!name || !name.trim()) {
      return res.status(400).json({ error: 'Item name is required' });
    }
    const parsedPrice = Number(price);
    const parsedQty = Math.max(1, Number(quantity));
    if (isNaN(parsedPrice) || parsedPrice <= 0) {
      return res.status(400).json({ error: 'Valid price is required' });
    }

    const order = await prisma.order.findUnique({
      where: { id: orderId },
      include: { bill: true }
    });
    if (!order) return res.status(404).json({ error: 'Order not found' });

    if (order.bill) {
      return res.status(400).json({ error: 'Bill already generated for this order.' });
    }

    // Find the first category in MenuCategory
    const firstCategory = await prisma.menuCategory.findFirst();
    if (!firstCategory) {
      return res.status(500).json({ error: 'No menu categories found' });
    }

    // Create a MenuItem on the fly (available: false)
    const customItem = await prisma.menuItem.create({
      data: {
        name: name.trim(),
        description: 'Extra item added by waiter',
        price: parsedPrice,
        categoryId: firstCategory.id,
        available: false,
      }
    });

    // Create OrderItem
    await prisma.orderItem.create({
      data: {
        orderId,
        menuItemId: customItem.id,
        quantity: parsedQty,
        price: parsedPrice,
      }
    });

    // Recalculate total for the order
    const allItems = await prisma.orderItem.findMany({ where: { orderId } });
    const newTotal = allItems.reduce((sum, item) => sum + (item.price * item.quantity), 0);

    const updatedOrder = await prisma.order.update({
      where: { id: orderId },
      data: { total: newTotal },
      include: {
        table: true,
        items: { include: { menuItem: true } }
      }
    });

    eventEmitter.emit('ORDER_UPDATE', {
      orderId,
      tableId: order.tableId,
    });

    return res.json(updatedOrder);
  } catch (error) {
    console.error('Failed to add custom item to order:', error);
    return res.status(500).json({ error: 'Failed to add item to order' });
  }
}

export async function deleteOrderItem(req: Request, res: Response) {
  try {
    const { itemId } = req.params;

    const orderItem = await prisma.orderItem.findUnique({
      where: { id: itemId },
      include: { order: true }
    });

    if (!orderItem) {
      return res.status(404).json({ error: 'Order item not found' });
    }

    if (orderItem.order.status === 'PAID') {
      return res.status(400).json({ error: 'Cannot modify a completed order' });
    }

    // Check if order has a bill
    const orderWithBill = await prisma.order.findUnique({
      where: { id: orderItem.orderId },
      include: { bill: true }
    });
    if (orderWithBill?.bill) {
      return res.status(400).json({ error: 'Bill already generated.' });
    }

    // Delete the OrderItem
    await prisma.orderItem.delete({
      where: { id: itemId }
    });

    // Find remaining items
    const remainingItems = await prisma.orderItem.findMany({
      where: { orderId: orderItem.orderId }
    });

    if (remainingItems.length === 0) {
      // If no items left, cancel the order
      await prisma.order.update({
        where: { id: orderItem.orderId },
        data: { status: 'CANCELLED', total: 0 }
      });
    } else {
      // Recalculate totals
      const newTotal = remainingItems.reduce((sum, item) => sum + (item.price * item.quantity), 0);
      await prisma.order.update({
        where: { id: orderItem.orderId },
        data: { total: newTotal }
      });
    }

    eventEmitter.emit('ORDER_UPDATE', {
      orderId: orderItem.orderId,
      tableId: orderItem.order.tableId,
    });

    return res.json({ success: true });
  } catch (error) {
    console.error('Failed to delete order item:', error);
    return res.status(500).json({ error: 'Failed to delete order item' });
  }
}
