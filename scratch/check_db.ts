import { PrismaClient } from '@prisma/client';
import { PrismaBetterSqlite3 } from '@prisma/adapter-better-sqlite3';

async function main() {
  const adapter = new PrismaBetterSqlite3({ url: 'file:./dev.db' });
  const prisma = new PrismaClient({ adapter });

  try {
    const categories = await prisma.menuCategory.findMany({
      include: {
        _count: {
          select: { items: true }
        }
      }
    });

    console.log('--- DATABASE CHECK ---');
    console.log('Categories found:', categories.length);
    categories.forEach(c => {
      console.log(`  Folder: ${c.name} (Items: ${(c as any)._count.items})`);
    });

    const items = await prisma.menuItem.count();
    console.log('Total items:', items);
    
    const tables = await prisma.table.count();
    console.log('Total tables:', tables);
  } catch (error) {
    console.error('Check failed:', error);
  } finally {
    await prisma.$disconnect();
  }
}

main();
