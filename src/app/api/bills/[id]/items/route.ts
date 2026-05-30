import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { TAX_RATE } from '@/lib/utils';
import { eventEmitter } from '@/lib/event-emitter';
import { isAuthenticated } from '@/lib/auth';

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  if (!(await isAuthenticated())) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  try {
    const { id } = await params;
    const { menuItemId, quantity, price } = await request.json();

    const bill = await prisma.bill.findUnique({ 
      where: { id }, 
      include: { order: true } 
    });

    if (!bill) {
      return NextResponse.json({ error: 'Bill not found' }, { status: 404 });
    }

    const menuItem = await prisma.menuItem.findUnique({ 
      where: { id: menuItemId } 
    });

    if (!menuItem) {
      return NextResponse.json({ error: 'Menu item not found' }, { status: 404 });
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

    return NextResponse.json(updatedBill);
  } catch (error) {
    console.error('Failed to add extra item:', error);
    return NextResponse.json({ error: 'Failed to add extra item' }, { status: 500 });
  }
}
