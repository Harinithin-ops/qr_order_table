import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { eventEmitter } from '@/lib/event-emitter';

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    
    const table = await prisma.table.update({
      where: { slug: id },
      data: { callingWaiter: true },
    });

    eventEmitter.emit('WAITER_CALL', { tableId: table.id, tableNumber: table.tableNumber });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Failed to call waiter:', error);
    return NextResponse.json({ error: 'Failed to call waiter' }, { status: 500 });
  }
}

export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params; // id can be slug or actual id
    
    // Check if it's an integer tableNumber or slug
    let table;
    if (id.includes('table-')) {
        table = await prisma.table.update({
          where: { slug: id },
          data: { callingWaiter: false },
        });
    } else {
        table = await prisma.table.update({
            where: { id },
            data: { callingWaiter: false },
        });
    }
    

    eventEmitter.emit('WAITER_DISMISS', { tableId: table.id, tableNumber: table.tableNumber });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Failed to dismiss waiter call:', error);
    return NextResponse.json({ error: 'Failed to dismiss' }, { status: 500 });
  }
}
