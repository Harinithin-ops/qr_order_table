import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { TAX_RATE, generateBillNumber } from '@/lib/utils';
import { eventEmitter } from '@/lib/event-emitter';
import { isAuthenticated } from '@/lib/auth';

export async function POST(request: Request) {
  if (!(await isAuthenticated())) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  try {
    const { orderId } = await request.json();

    const order = await prisma.order.findUnique({
      where: { id: orderId },
      include: { items: true },
    });

    if (!order) {
      return NextResponse.json({ error: 'Order not found' }, { status: 404 });
    }
    
    // Check if bill already exists
    const existingBill = await prisma.bill.findUnique({ where: { orderId } });
    if (existingBill) {
      return NextResponse.json(existingBill);
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
        billNumber: generateBillNumber(),
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

    return NextResponse.json(bill);
  } catch (error) {
    console.error('Failed to generate bill:', error);
    return NextResponse.json({ error: 'Failed to generate bill' }, { status: 500 });
  }
}

export const dynamic = 'force-dynamic';

export async function GET() {
  if (!(await isAuthenticated())) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
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

    return NextResponse.json(bills);
  } catch (error) {
    console.error('Failed to fetch bills:', error);
    return NextResponse.json({ error: 'Failed to fetch billing history' }, { status: 500 });
  }
}
