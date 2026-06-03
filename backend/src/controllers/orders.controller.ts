import { Request, Response } from 'express';
import { prisma } from '../lib/prisma.js';
import { eventEmitter } from '../lib/event-emitter.js';
import { generateBillNumber, TAX_RATE, getCategoryTimingStatus } from '../lib/utils.js';
import { AuthenticatedRequest } from '../middleware/auth.middleware.js';
import { mergeAndGetTableBill } from './bills.controller.js';

async function syncOrderAndBillTotals(orderId: string, tx?: any) {
  const db = tx || prisma;
  
  const items = await db.orderItem.findMany({
    where: { orderId }
  });
  
  const newTotal = items
    .filter((item: any) => !item.isUnavailable)
    .reduce((sum: number, item: any) => sum + (item.price * item.quantity), 0);
    
  const updatedOrder = await db.order.update({
    where: { id: orderId },
    data: { total: newTotal },
    include: {
      table: true,
      items: {
        include: {
          menuItem: true
        }
      },
      bill: true
    }
  });
  
  if (updatedOrder.bill) {
    const subtotal = newTotal;
    const taxAmount = subtotal * TAX_RATE;
    const total = subtotal + taxAmount;
    
    await db.bill.update({
      where: { id: updatedOrder.bill.id },
      data: {
        subtotal,
        taxAmount,
        total
      }
    });
  }
  
  return updatedOrder;
}

export async function createOrder(req: Request, res: Response) {
  try {
    const { tableId, items, notes, customerId } = req.body;

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

    // Server-Side same customer-session order merging
    let phone_number: string | null = null;
    if (customerId) {
      const session = await prisma.customerSession.findUnique({
        where: { id: customerId }
      });
      if (session) {
        phone_number = session.phone;
      }
    }
    if (!phone_number && notes) {
      const match = notes.match(/Phone:\s*([^\s|]+)/i);
      if (match) {
        phone_number = match[1].trim();
      } else {
        const matchDigits = notes.match(/\b\d{10}\b/);
        if (matchDigits) {
          phone_number = matchDigits[0].trim();
        }
      }
    }
    if (!phone_number && req.body.phone_number) {
      phone_number = String(req.body.phone_number).trim();
    }

    let existingOrder = null;
    if (phone_number) {
      existingOrder = await prisma.order.findFirst({
        where: {
          phone_number,
          status: { notIn: ['PAID', 'CANCELLED'] }
        },
        include: {
          items: true
        }
      });
    } else {
      // Fallback same-name or same-phone matching (case-insensitive) for waiters or legacy endpoints
      const match = notes ? notes.match(/^(?:Name|Phone):\s*([^|]+)/i) : null;
      const customerIdentifier = match ? match[1].trim() : null;

      if (customerIdentifier) {
        const activeOrders = await prisma.order.findMany({
          where: {
            tableId: table.id,
            status: { notIn: ['PAID', 'CANCELLED'] }
          },
          include: {
            items: true
          }
        });

        existingOrder = activeOrders.find(o => {
          const existingNotes = o.notes || '';
          const m = existingNotes.match(/^(?:Name|Phone):\s*([^|]+)/i);
          if (m) {
            return m[1].trim().toLowerCase() === customerIdentifier.toLowerCase();
          }
          return false;
        });
      }
    }

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
              // Extract name or phone prefix
              const idMatch = existingOrder.notes?.match(/^(?:Name|Phone):\s*([^|]+)/i);
              const prefixType = idMatch && existingOrder.notes?.startsWith('Phone') ? 'Phone' : 'Name';
              const idValue = idMatch ? idMatch[1].trim() : 'Guest';
              mergedNotes = `${prefixType}: ${idValue} | Notes: ${existingNotesContent}; ${newNotesContent}`;
            }
          } else {
            const idMatch = existingOrder.notes?.match(/^(?:Name|Phone):\s*([^|]+)/i);
            const prefixType = idMatch && existingOrder.notes?.startsWith('Phone') ? 'Phone' : 'Name';
            const idValue = idMatch ? idMatch[1].trim() : 'Guest';
            mergedNotes = `${prefixType}: ${idValue} | Notes: ${newNotesContent}`;
          }
        }

        // 3. Update order status and tableId if changed
        let newStatus = existingOrder.status;
        if (['READY', 'SERVED'].includes(existingOrder.status)) {
          newStatus = 'PLACED';
        }

        const updateData: any = {
          notes: mergedNotes,
          status: newStatus
        };
        if (table.id !== existingOrder.tableId) {
          updateData.tableId = table.id;
        }

        await tx.order.update({
          where: { id: existingOrder.id },
          data: updateData
        });

        // 4. Sync totals and recalculate
        const updated = await syncOrderAndBillTotals(existingOrder.id, tx);
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

    const total = items.reduce((acc: number, item: any) => acc + item.price * item.quantity, 0);

    const order = await prisma.order.create({
      data: {
        tableId: table.id,
        total,
        notes,
        customerId: customerId || null,
        phone_number: phone_number || null,
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
      where: { id: orderId }
    });

    if (!order) {
      return res.status(404).json({ error: 'Order not found' });
    }

    const bill = await mergeAndGetTableBill(order.tableId);
    return res.json(bill);
  } catch (error: any) {
    console.error('Failed to generate customer bill:', error);
    return res.status(500).json({ error: error.message || 'Failed to generate bill' });
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

    // Recalculate total and sync bill
    const updatedOrder = await syncOrderAndBillTotals(orderId);

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

    // Delete the OrderItem
    await prisma.orderItem.delete({
      where: { id: itemId }
    });

    // Recalculate totals and sync bill
    const updatedOrder = await syncOrderAndBillTotals(orderItem.orderId);

    if (updatedOrder.items.length === 0) {
      // If no items left, cancel the order
      await prisma.order.update({
        where: { id: orderItem.orderId },
        data: { status: 'CANCELLED' }
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

export async function updateOrderItem(req: Request, res: Response) {
  try {
    const { itemId } = req.params;
    const { quantity, isUnavailable } = req.body;

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

    const data: any = {};
    if (quantity !== undefined) {
      data.quantity = Math.max(1, Number(quantity));
    }
    if (isUnavailable !== undefined) {
      data.isUnavailable = Boolean(isUnavailable);
    }

    const updatedItem = await prisma.orderItem.update({
      where: { id: itemId },
      data,
      include: { menuItem: true }
    });

    // Recalculate totals and sync bill
    await syncOrderAndBillTotals(orderItem.orderId);

    eventEmitter.emit('ORDER_UPDATE', {
      orderId: orderItem.orderId,
      tableId: orderItem.order.tableId,
    });

    return res.json(updatedItem);
  } catch (error) {
    console.error('Failed to update order item:', error);
    return res.status(500).json({ error: 'Failed to update order item' });
  }
}

export async function replaceOrderItem(req: Request, res: Response) {
  try {
    const { itemId } = req.params;
    const { menuItemId, quantity } = req.body;

    if (!menuItemId) {
      return res.status(400).json({ error: 'menuItemId is required for replacement' });
    }

    const orderItem = await prisma.orderItem.findUnique({
      where: { id: itemId },
      include: { order: true, menuItem: true }
    });

    if (!orderItem) {
      return res.status(404).json({ error: 'Order item not found' });
    }

    if (orderItem.order.status === 'PAID') {
      return res.status(400).json({ error: 'Cannot modify a completed order' });
    }

    const newMenuItem = await prisma.menuItem.findUnique({
      where: { id: menuItemId }
    });

    if (!newMenuItem) {
      return res.status(404).json({ error: 'Replacement menu item not found' });
    }

    const targetQty = quantity !== undefined ? Math.max(1, Number(quantity)) : orderItem.quantity;

    const updatedItem = await prisma.orderItem.update({
      where: { id: itemId },
      data: {
        menuItemId: newMenuItem.id,
        price: newMenuItem.price,
        quantity: targetQty,
        isUnavailable: false
      },
      include: { menuItem: true }
    });

    // Recalculate totals and sync bill
    await syncOrderAndBillTotals(orderItem.orderId);

    eventEmitter.emit('ORDER_UPDATE', {
      orderId: orderItem.orderId,
      tableId: orderItem.order.tableId,
      replacedItemName: orderItem.menuItem?.name || 'Item',
      newItemName: newMenuItem.name
    });

    return res.json(updatedItem);
  } catch (error) {
    console.error('Failed to replace order item:', error);
    return res.status(500).json({ error: 'Failed to replace order item' });
  }
}

export async function addItemToOrder(req: Request, res: Response) {
  try {
    const { orderId } = req.params;
    const { menuItemId, quantity = 1, specialInstructions } = req.body;

    if (!menuItemId) {
      return res.status(400).json({ error: 'menuItemId is required' });
    }

    const order = await prisma.order.findUnique({
      where: { id: orderId }
    });

    if (!order) {
      return res.status(404).json({ error: 'Order not found' });
    }

    if (order.status === 'PAID') {
      return res.status(400).json({ error: 'Cannot modify a completed order' });
    }

    const menuItem = await prisma.menuItem.findUnique({
      where: { id: menuItemId }
    });

    if (!menuItem) {
      return res.status(404).json({ error: 'Menu item not found' });
    }

    const existingItem = await prisma.orderItem.findFirst({
      where: {
        orderId,
        menuItemId,
        specialInstructions: specialInstructions || null
      }
    });

    let resultItem;
    if (existingItem) {
      resultItem = await prisma.orderItem.update({
        where: { id: existingItem.id },
        data: {
          quantity: existingItem.quantity + Math.max(1, Number(quantity)),
          isUnavailable: false
        },
        include: { menuItem: true }
      });
    } else {
      resultItem = await prisma.orderItem.create({
        data: {
          orderId,
          menuItemId,
          quantity: Math.max(1, Number(quantity)),
          price: menuItem.price,
          specialInstructions: specialInstructions || null,
          isUnavailable: false
        },
        include: { menuItem: true }
      });
    }

    // Recalculate totals and sync bill
    await syncOrderAndBillTotals(orderId);

    eventEmitter.emit('ORDER_UPDATE', {
      orderId,
      tableId: order.tableId,
    });

    return res.json(resultItem);
  } catch (error) {
    console.error('Failed to add item to order:', error);
    return res.status(500).json({ error: 'Failed to add item to order' });
  }
}

export async function updateOrderItems(req: Request, res: Response) {
  try {
    const { orderId } = req.params;
    const { items } = req.body; // array of { menuItemId, quantity, price, isUnavailable, specialInstructions }

    if (!items) {
      return res.status(400).json({ error: 'Items list is required' });
    }

    const order = await prisma.order.findUnique({
      where: { id: orderId },
      include: { bill: true }
    });

    if (!order) {
      return res.status(404).json({ error: 'Order not found' });
    }

    if (order.status === 'PAID') {
      return res.status(400).json({ error: 'Cannot modify a completed order' });
    }

    const updatedOrder = await prisma.$transaction(async (tx) => {
      // 1. Delete all existing items
      await tx.orderItem.deleteMany({
        where: { orderId }
      });

      // 2. If new items is empty, cancel the order
      if (items.length === 0) {
        const cancelledOrder = await tx.order.update({
          where: { id: orderId },
          data: { status: 'CANCELLED', total: 0 },
          include: { table: true, items: { include: { menuItem: true } }, bill: true }
        });
        if (cancelledOrder.bill) {
          await tx.bill.update({
            where: { id: cancelledOrder.bill.id },
            data: { subtotal: 0, taxAmount: 0, total: 0 }
          });
        }
        return cancelledOrder;
      }

      // 3. Create the new items
      await tx.orderItem.createMany({
        data: items.map((item: any) => ({
          orderId,
          menuItemId: item.menuItemId,
          quantity: Math.max(1, Number(item.quantity)),
          price: Number(item.price),
          isUnavailable: Boolean(item.isUnavailable),
          specialInstructions: item.specialInstructions || null
        }))
      });

      // 4. Recalculate order total, excluding unavailable items
      const newTotal = items
        .filter((item: any) => !item.isUnavailable)
        .reduce((sum: number, item: any) => sum + (Number(item.price) * Math.max(1, Number(item.quantity))), 0);

      const orderUpdate = await tx.order.update({
        where: { id: orderId },
        data: { total: newTotal },
        include: {
          table: true,
          items: {
            include: { menuItem: true }
          },
          bill: true
        }
      });

      if (orderUpdate.bill) {
        const subtotal = newTotal;
        const taxAmount = subtotal * TAX_RATE;
        const total = subtotal + taxAmount;
        await tx.bill.update({
          where: { id: orderUpdate.bill.id },
          data: { subtotal, taxAmount, total }
        });
      }

      return orderUpdate;
    });

    eventEmitter.emit('ORDER_UPDATE', {
      orderId: updatedOrder.id,
      tableId: updatedOrder.tableId,
      status: updatedOrder.status
    });

    return res.json(updatedOrder);
  } catch (error) {
    console.error('Failed to update order items:', error);
    return res.status(500).json({ error: 'Failed to update order items' });
  }
}

export async function replaceCustomerOrderItem(req: Request, res: Response) {
  try {
    const { orderId, itemId } = req.params;
    const { menuItemId } = req.body;

    if (!menuItemId) {
      return res.status(400).json({ error: 'menuItemId is required' });
    }

    const order = await prisma.order.findUnique({
      where: { id: orderId },
      include: { bill: true }
    });

    if (!order) {
      return res.status(404).json({ error: 'Order not found' });
    }

    if (order.status === 'PAID') {
      return res.status(400).json({ error: 'Cannot modify a completed order' });
    }

    const orderItem = await prisma.orderItem.findUnique({
      where: { id: itemId }
    });

    if (!orderItem || orderItem.orderId !== orderId) {
      return res.status(404).json({ error: 'Order item not found in this order' });
    }

    const newMenuItem = await prisma.menuItem.findUnique({
      where: { id: menuItemId }
    });

    if (!newMenuItem || !newMenuItem.available) {
      return res.status(404).json({ error: 'Replacement menu item not found or unavailable' });
    }

    const updatedItem = await prisma.orderItem.update({
      where: { id: itemId },
      data: {
        menuItemId: newMenuItem.id,
        price: newMenuItem.price,
        isUnavailable: false
      },
      include: { menuItem: true }
    });

    // Recalculate totals and sync bill
    await syncOrderAndBillTotals(orderId);

    eventEmitter.emit('ORDER_UPDATE', {
      orderId,
      tableId: order.tableId,
      status: order.status
    });

    return res.json(updatedItem);
  } catch (error) {
    console.error('Failed to replace customer order item:', error);
    return res.status(500).json({ error: 'Failed to replace item' });
  }
}

export async function getActiveOrdersByCustomer(req: Request, res: Response) {
  try {
    const { tableId, customerId } = req.query;

    if (!customerId) {
      return res.status(400).json({ error: 'customerId is required' });
    }

    const session = await prisma.customerSession.findUnique({
      where: { id: String(customerId) }
    });

    let whereClause: any = {
      status: {
        notIn: ['PAID', 'CANCELLED']
      }
    };

    if (session) {
      whereClause.phone_number = session.phone;
    } else {
      whereClause.customerId = String(customerId);
    }

    const orders = await prisma.order.findMany({
      where: whereClause,
      include: {
        table: true,
        items: {
          include: {
            menuItem: true
          }
        },
        bill: true
      },
      orderBy: {
        createdAt: 'asc'
      }
    });

    return res.json(orders);
  } catch (error) {
    console.error('Failed to get active customer orders:', error);
    return res.status(500).json({ error: 'Failed to fetch customer orders' });
  }
}



