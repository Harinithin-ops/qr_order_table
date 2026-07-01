import { prisma } from './lib/prisma.js';

async function main() {
  try {
    console.log("Checking waiter list...");
    const waiters = await prisma.waiter.findMany();
    console.log("Waiters count:", waiters.length);
    if (waiters.length === 0) {
      console.log("No waiters found.");
      return;
    }

    const firstWaiter = waiters[0];
    console.log("Testing getOrders completed query for waiter:", firstWaiter.username);

    // Simulate getOrders completed query
    const whereClause: any = {
      status: {
        in: ['SERVED', 'PENDING', 'PAID']
      },
      table: {
        assignedWaiterId: firstWaiter.id
      }
    };

    console.log("Querying orders with status in (SERVED, PENDING, PAID) and assigned waiter:", firstWaiter.id);
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
        createdAt: 'desc',
      },
    });

    console.log("Query succeeded! Found", orders.length, "orders.");
  } catch (error) {
    console.error("Query failed with error:", error);
  }
}

main();
