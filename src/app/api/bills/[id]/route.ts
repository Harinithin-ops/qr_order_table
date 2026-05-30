import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { eventEmitter } from '@/lib/event-emitter';
import { isAuthenticated } from '@/lib/auth';

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
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
      return NextResponse.json({ error: 'Bill not found' }, { status: 404 });
    }

    return NextResponse.json(bill);
  } catch (error) {
    return NextResponse.json({ error: 'Failed to fetch bill' }, { status: 500 });
  }
}

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  if (!(await isAuthenticated())) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  try {
    const { id } = await params;
    const { paymentMethod, paymentStatus, discount, paymentReference } = await request.json();

    const existingBill = await prisma.bill.findUnique({ where: { id } });
    if (!existingBill) {
      return NextResponse.json({ error: 'Bill not found' }, { status: 404 });
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

    return NextResponse.json(bill);
  } catch (error) {
    return NextResponse.json({ error: 'Failed to update bill' }, { status: 500 });
  }
}
