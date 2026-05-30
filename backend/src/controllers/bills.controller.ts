import { Request, Response } from 'express';
import { prisma } from '../lib/prisma.js';
import { eventEmitter } from '../lib/event-emitter.js';
import { TAX_RATE, generateBillNumber } from '../lib/utils.js';

export async function createBill(req: Request, res: Response) {
  try {
    const { orderId } = req.body;

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
      // Notify customer their bill is ready
      eventEmitter.emit('ORDER_UPDATE', {
        orderId,
        status: 'PENDING',
        tableId: order.tableId,
        billId: bill.id,
      });
    }

    return res.json(bill);
  } catch (error) {
    console.error('Failed to generate bill:', error);
    return res.status(500).json({ error: 'Failed to generate bill' });
  }
}

export async function getBills(req: Request, res: Response) {
  try {
    const bills = await prisma.bill.findMany({
      include: {
        order: {
          include: {
            table: true,
            items: {
              include: {
                menuItem: true
              }
            }
          }
        }
      },
      orderBy: {
        createdAt: 'desc',
      },
    });

    return res.json(bills);
  } catch (error) {
    console.error('Failed to fetch bills:', error);
    return res.status(500).json({ error: 'Failed to fetch billing history' });
  }
}

export async function getBillById(req: Request, res: Response) {
  try {
    const { id } = req.params;
    const bill = await prisma.bill.findUnique({
      where: { id },
      include: {
        order: {
          include: {
            table: true,
            items: {
              include: {
                menuItem: true,
              }
            }
          }
        }
      }
    });

    if (!bill) {
      return res.status(404).json({ error: 'Bill not found' });
    }

    return res.json(bill);
  } catch (error) {
    console.error('Failed to fetch bill:', error);
    return res.status(500).json({ error: 'Failed to fetch bill' });
  }
}

export async function updateBill(req: Request, res: Response) {
  try {
    const { id } = req.params;
    const { paymentMethod, paymentStatus, discount, paymentReference } = req.body;

    const existingBill = await prisma.bill.findUnique({ where: { id } });
    if (!existingBill) {
      return res.status(404).json({ error: 'Bill not found' });
    }

    let updatedData: any = { paymentMethod, paymentStatus };
    if (paymentReference !== undefined) {
      updatedData.paymentReference = paymentReference;
    }
    
    if (discount !== undefined) {
      const discountValue = Math.max(0, Number(discount));
      const maxDiscount = existingBill.subtotal + existingBill.taxAmount;
      const finalDiscount = Math.min(discountValue, maxDiscount);
      
      updatedData.discount = finalDiscount;
      updatedData.total = (existingBill.subtotal + existingBill.taxAmount) - finalDiscount;
    }

    const bill = await prisma.bill.update({
      where: { id },
      data: updatedData,
      include: {
        order: {
          include: {
            table: true,
            items: {
              include: { menuItem: true }
            }
          }
        }
      }
    });

    if (paymentStatus === 'PAID') {
      await prisma.order.update({
        where: { id: bill.orderId },
        data: { status: 'PAID' }
      });
      // Notify customer and dashboard
      eventEmitter.emit('ORDER_UPDATE', {
        orderId: bill.orderId,
        status: 'PAID',
        tableId: bill.order.tableId,
        billId: bill.id,
        tableNumber: bill.order.table.tableNumber,
      });
    }

    return res.json(bill);
  } catch (error) {
    console.error('Failed to update bill:', error);
    return res.status(500).json({ error: 'Failed to update bill' });
  }
}

export async function payBill(req: Request, res: Response) {
  try {
    const { id } = req.params;
    const { paymentReference, paymentMethod } = req.body;

    if (paymentMethod === 'UPI' && !paymentReference) {
      return res.status(400).json({ error: 'Payment reference is required for UPI' });
    }

    const existingBill = await prisma.bill.findUnique({ 
      where: { id },
      include: {
        order: {
          include: { table: true }
        }
      }
    });

    if (!existingBill) {
      return res.status(404).json({ error: 'Bill not found' });
    }

    const bill = await prisma.bill.update({
      where: { id },
      data: { 
        paymentStatus: 'AWAITING_CONFIRMATION',
        paymentMethod: paymentMethod || 'UPI',
        paymentReference: paymentReference || (paymentMethod === 'CASH' ? 'CASH_REQUEST' : null)
      },
      include: {
        order: {
          include: {
            table: true
          }
        }
      }
    });

    // Notify dashboard
    eventEmitter.emit('ORDER_UPDATE', {
      type: 'PAYMENT_SUBMITTED',
      orderId: bill.orderId,
      status: 'AWAITING_CONFIRMATION',
      tableId: bill.order.tableId,
      tableNumber: bill.order.table.tableNumber,
      billId: bill.id,
      paymentMethod: bill.paymentMethod
    });

    return res.json(bill);
  } catch (error) {
    console.error('Failed to submit payment:', error);
    return res.status(500).json({ error: 'Failed to submit payment' });
  }
}

export async function addExtraItemToBill(req: Request, res: Response) {
  try {
    const { id } = req.params;
    const { menuItemId, quantity, price } = req.body;

    const bill = await prisma.bill.findUnique({ 
      where: { id }, 
      include: { order: true } 
    });

    if (!bill) {
      return res.status(404).json({ error: 'Bill not found' });
    }

    const menuItem = await prisma.menuItem.findUnique({ 
      where: { id: menuItemId } 
    });

    if (!menuItem) {
      return res.status(404).json({ error: 'Menu item not found' });
    }

    // Add new extra item to the order
    await prisma.orderItem.create({
      data: {
        orderId: bill.orderId,
        menuItemId,
        quantity: Number(quantity),
        price: Number(price),
        specialInstructions: 'Added at billing',
      }
    });

    // Recalculate bill totals
    const itemTotal = Number(quantity) * Number(price);
    const newSubtotal = bill.subtotal + itemTotal;
    const newTaxAmount = newSubtotal * TAX_RATE;
    const newTotal = Math.max(0, newSubtotal + newTaxAmount - bill.discount);

    const updatedBill = await prisma.bill.update({
      where: { id },
      data: {
        subtotal: newSubtotal,
        taxAmount: newTaxAmount,
        total: newTotal
      },
      include: {
        order: {
          include: {
            table: true,
            items: {
              include: {
                menuItem: true,
              }
            }
          }
        }
      }
    });

    // Update order total
    await prisma.order.update({
      where: { id: bill.orderId },
      data: {
        total: newSubtotal,
      }
    });

    return res.json(updatedBill);
  } catch (error) {
    console.error('Failed to add extra item:', error);
    return res.status(500).json({ error: 'Failed to add extra item' });
  }
}

/**
 * DELETE /api/bills/:id
 * Deletes a single bill and its associated order + order items.
 * Admin-only.
 */
export async function deleteBill(req: Request, res: Response) {
  try {
    const { id } = req.params;

    const bill = await prisma.bill.findUnique({
      where: { id },
      include: { order: true },
    });

    if (!bill) {
      return res.status(404).json({ error: 'Bill not found' });
    }

    await prisma.$transaction(async (tx) => {
      // Delete order items first (FK constraint)
      await tx.orderItem.deleteMany({ where: { orderId: bill.orderId } });
      // Delete the bill
      await tx.bill.delete({ where: { id } });
      // Delete the order
      await tx.order.delete({ where: { id: bill.orderId } });
    });

    return res.json({ success: true, message: 'Bill and associated order deleted successfully.' });
  } catch (error) {
    console.error('Failed to delete bill:', error);
    return res.status(500).json({ error: 'Failed to delete bill' });
  }
}

/**
 * DELETE /api/bills/cleanup
 * Deletes all bills (and their orders/items) older than 2 days.
 * Admin-only.
 */
export async function cleanupOldRecords(req: Request, res: Response) {
  try {
    const twoDaysAgo = new Date(Date.now() - 2 * 24 * 60 * 60 * 1000);

    // Find bills older than 2 days
    const oldBills = await prisma.bill.findMany({
      where: { createdAt: { lt: twoDaysAgo } },
      select: { id: true, orderId: true },
    });

    if (oldBills.length === 0) {
      return res.json({ success: true, deleted: 0, message: 'No records older than 2 days found.' });
    }

    const billIds = oldBills.map((b) => b.id);
    const orderIds = oldBills.map((b) => b.orderId);

    await prisma.$transaction(async (tx) => {
      await tx.orderItem.deleteMany({ where: { orderId: { in: orderIds } } });
      await tx.bill.deleteMany({ where: { id: { in: billIds } } });
      await tx.order.deleteMany({ where: { id: { in: orderIds } } });
    });

    return res.json({
      success: true,
      deleted: oldBills.length,
      message: `Deleted ${oldBills.length} record(s) older than 2 days.`,
    });
  } catch (error) {
    console.error('Failed to cleanup old records:', error);
    return res.status(500).json({ error: 'Failed to cleanup old records' });
  }
}

export async function mergeBills(req: Request, res: Response) {
  try {
    const { sourceBillId, targetBillId } = req.body;

    if (!sourceBillId || !targetBillId || sourceBillId === targetBillId) {
      return res.status(400).json({ error: 'Valid source and target bill IDs are required' });
    }

    // Fetch both bills
    const sourceBill = await prisma.bill.findUnique({
      where: { id: sourceBillId },
      include: { order: { include: { items: true } } }
    });

    const targetBill = await prisma.bill.findUnique({
      where: { id: targetBillId },
      include: { order: { include: { items: true } } }
    });

    if (!sourceBill || !targetBill) {
      return res.status(404).json({ error: 'Source or target bill not found' });
    }

    if (sourceBill.paymentStatus === 'PAID' || targetBill.paymentStatus === 'PAID') {
      return res.status(400).json({ error: 'Cannot merge bills that are already paid' });
    }

    // Merge in a transaction
    const updatedTargetBill = await prisma.$transaction(async (tx) => {
      // 1. Move all order items from source order to target order
      await tx.orderItem.updateMany({
        where: { orderId: sourceBill.orderId },
        data: { orderId: targetBill.orderId }
      });

      // 2. Combine notes
      let combinedNotes = targetBill.order.notes || '';
      if (sourceBill.order.notes) {
        combinedNotes = combinedNotes 
          ? `${combinedNotes} | Merged from: ${sourceBill.order.notes}`
          : `Merged from: ${sourceBill.order.notes}`;
      }

      // 3. Recalculate totals for target order
      const allTargetItems = await tx.orderItem.findMany({
        where: { orderId: targetBill.orderId }
      });

      const newSubtotal = allTargetItems.reduce((sum, item) => sum + (item.price * item.quantity), 0);
      const newTaxAmount = newSubtotal * TAX_RATE;
      const newTotal = newSubtotal + newTaxAmount;

      // Update target order
      await tx.order.update({
        where: { id: targetBill.orderId },
        data: { 
          total: newSubtotal,
          notes: combinedNotes || null
        }
      });

      // Update target bill
      const updatedBill = await tx.bill.update({
        where: { id: targetBillId },
        data: {
          subtotal: newSubtotal,
          taxAmount: newTaxAmount,
          total: newTotal
        },
        include: {
          order: {
            include: {
              table: true,
              items: { include: { menuItem: true } }
            }
          }
        }
      });

      // 4. Delete source bill and source order
      await tx.bill.delete({
        where: { id: sourceBillId }
      });

      await tx.order.delete({
        where: { id: sourceBill.orderId }
      });

      // Notify SSE clients
      eventEmitter.emit('ORDER_UPDATE', {
        orderId: targetBill.orderId,
        status: targetBill.order.status,
        tableId: targetBill.order.tableId,
        billId: targetBill.id,
      });

      return updatedBill;
    });

    return res.json({ 
      success: true, 
      message: 'Bills merged successfully', 
      mergedBill: updatedTargetBill 
    });
  } catch (error) {
    console.error('Failed to merge bills:', error);
    return res.status(500).json({ error: 'Failed to merge bills' });
  }
}

/**
 * Customer-facing unified checkout:
 * Generates bills for all active non-paid orders at a table,
 * then merges them all into a single bill and returns it.
 */
export async function tableCheckout(req: Request, res: Response) {
  try {
    const { tableId } = req.params; // can be slug or id

    // Resolve table
    const table = await prisma.table.findFirst({
      where: { OR: [{ id: tableId }, { slug: tableId }] }
    });

    if (!table) {
      return res.status(404).json({ error: 'Table not found' });
    }

    // Fetch all orders for this table that are not yet PAID or CANCELLED
    const orders = await prisma.order.findMany({
      where: {
        tableId: table.id,
        status: { notIn: ['PAID', 'CANCELLED'] }
      },
      include: { items: true, bill: true }
    });

    if (orders.length === 0) {
      return res.status(404).json({ error: 'No active orders found for this table' });
    }

    // Step 1: Generate bills for any orders that don't have one yet
    for (const order of orders) {
      if (!order.bill) {
        const subtotal = order.total;
        const taxAmount = subtotal * TAX_RATE;
        const total = subtotal + taxAmount;

        const bill = await prisma.bill.create({
          data: {
            orderId: order.id,
            subtotal,
            taxAmount,
            total,
            billNumber: await generateBillNumber(),
          }
        });

        // Mark order as PENDING
        await prisma.order.update({
          where: { id: order.id },
          data: { status: 'PENDING' }
        });

        eventEmitter.emit('ORDER_UPDATE', {
          orderId: order.id,
          status: 'PENDING',
          tableId: table.id,
          billId: bill.id,
        });
      } else if (!['PENDING', 'SERVED', 'READY'].includes(order.status) === false) {
        // Ensure order status is PENDING
        if (order.status !== 'PENDING') {
          await prisma.order.update({
            where: { id: order.id },
            data: { status: 'PENDING' }
          });
        }
      }
    }

    // Re-fetch orders with bills
    const ordersWithBills = await prisma.order.findMany({
      where: {
        tableId: table.id,
        status: { notIn: ['PAID', 'CANCELLED'] }
      },
      include: {
        bill: true,
        items: { include: { menuItem: true } }
      }
    });

    const bills = ordersWithBills.map(o => o.bill).filter(Boolean) as any[];

    if (bills.length === 0) {
      return res.status(500).json({ error: 'Failed to generate bills' });
    }

    // Step 2: If only one bill, return it directly
    if (bills.length === 1) {
      const singleBill = await prisma.bill.findUnique({
        where: { id: bills[0].id },
        include: {
          order: {
            include: {
              table: true,
              items: { include: { menuItem: true } }
            }
          }
        }
      });
      return res.json(singleBill);
    }

    // Step 3: Merge all bills into the first one
    const [primaryBill, ...otherBills] = bills;

    const mergedBill = await prisma.$transaction(async (tx) => {
      for (const sourceBill of otherBills) {
        // Move all items from source order to primary order
        await tx.orderItem.updateMany({
          where: { orderId: sourceBill.orderId },
          data: { orderId: primaryBill.orderId }
        });

        // Delete source bill and order
        await tx.bill.delete({ where: { id: sourceBill.id } });
        await tx.order.delete({ where: { id: sourceBill.orderId } });
      }

      // Recalculate totals for primary order
      const allItems = await tx.orderItem.findMany({
        where: { orderId: primaryBill.orderId }
      });

      const newSubtotal = allItems.reduce((sum: number, item: any) => sum + (item.price * item.quantity), 0);
      const newTaxAmount = newSubtotal * TAX_RATE;
      const newTotal = newSubtotal + newTaxAmount;

      // Update primary order total
      await tx.order.update({
        where: { id: primaryBill.orderId },
        data: { total: newSubtotal }
      });

      // Update primary bill totals
      const updated = await tx.bill.update({
        where: { id: primaryBill.id },
        data: {
          subtotal: newSubtotal,
          taxAmount: newTaxAmount,
          total: newTotal
        },
        include: {
          order: {
            include: {
              table: true,
              items: { include: { menuItem: true } }
            }
          }
        }
      });

      eventEmitter.emit('ORDER_UPDATE', {
        orderId: primaryBill.orderId,
        status: 'PENDING',
        tableId: table.id,
        billId: primaryBill.id,
      });

      return updated;
    });

    return res.json(mergedBill);
  } catch (error) {
    console.error('Failed to process table checkout:', error);
    return res.status(500).json({ error: 'Failed to process checkout' });
  }
}
