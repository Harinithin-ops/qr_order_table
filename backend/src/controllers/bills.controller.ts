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

