import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { eventEmitter } from '@/lib/event-emitter';

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const { paymentReference, paymentMethod } = await request.json();

    if (paymentMethod === 'UPI' && !paymentReference) {
      return NextResponse.json({ error: 'Payment reference is required for UPI' }, { status: 400 });
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
      return NextResponse.json({ error: 'Bill not found' }, { status: 404 });
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

    return NextResponse.json(bill);
  } catch (error) {
    console.error('Failed to submit payment:', error);
    return NextResponse.json({ error: 'Failed to submit payment' }, { status: 500 });
  }
}
