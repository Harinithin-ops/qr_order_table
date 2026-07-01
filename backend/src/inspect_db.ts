import { prisma } from './lib/prisma.js';

async function main() {
  console.log('--- FETCHING ACTIVE ORDERS ---');
  const activeOrders = await prisma.order.findMany({
    where: {
      status: { notIn: ['PAID', 'CANCELLED'] }
    },
    include: {
      table: true
    }
  });

  console.log(`Found ${activeOrders.length} active orders.`);
  for (const order of activeOrders) {
    console.log(`Order ID: ${order.id}`);
    console.log(`  Table: ${order.table.tableNumber}`);
    console.log(`  Status: ${order.status}`);
    console.log(`  Phone Number field: ${order.phone_number}`);
    console.log(`  Notes field: ${order.notes}`);
    console.log(`  CustomerId field: ${order.customerId}`);
    
    // Check if there is a session
    if (order.customerId) {
      const session = await prisma.customerSession.findUnique({
        where: { id: order.customerId }
      });
      console.log(`  Session details:`, session);
    }
    console.log('-----------------------------------');
  }
}

main()
  .catch(e => console.error(e))
  .finally(async () => {
    await prisma.$disconnect();
  });
