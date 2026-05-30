import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { eventEmitter } from '@/lib/event-emitter';

export const dynamic = 'force-dynamic';

/** Customer confirms food was brought to the table (READY → SERVED). Requires matching tableId. */
export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: orderId } = await params;
    const body = await request.json();
    const { tableId } = body as { tableId?: string };

    if (!tableId) {
      return NextResponse.json({ error: 'tableId is required' }, { status: 400 });
    }

    const table = await prisma.table.findFirst({
      where: { OR: [{ id: tableId }, { slug: tableId }] },
    });
    if (!table) {
      return NextResponse.json({ error: 'Table not found' }, { status: 404 });
    }

    const order = await prisma.order.findUnique({
      where: { id: orderId },
      select: { id: true, status: true, tableId: true },
    });
    if (!order) {
      return NextResponse.json({ error: 'Order not found' }, { status: 404 });
    }
    if (order.tableId !== table.id) {
      return NextResponse.json({ error: 'Order does not belong to this table' }, { status: 403 });
    }
    if (order.status !== 'READY') {
      const msg =
        order.status === 'SERVED'
          ? 'Already marked as received'
          : 'You can confirm only when the order is ready for pickup';
      return NextResponse.json({ error: msg }, { status: 400 });
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

    return NextResponse.json(updated);
  } catch (error) {
    console.error('Failed to mark received:', error);
    return NextResponse.json({ error: 'Failed to update order' }, { status: 500 });
  }
}
