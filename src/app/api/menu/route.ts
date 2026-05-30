import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    const categories = await prisma.menuCategory.findMany({
      include: {
        items: true,
      },
      orderBy: {
        displayOrder: 'asc',
      },
    });

    console.log(`[API/Menu] Found ${categories.length} categories`);

    // Parse JSON tags for frontend
    const serializedCategories = categories.map((cat) => ({
      ...cat,
      items: cat.items.map((item) => {
        console.log(`[API/Menu] Processing item: ${item.name}`);
        return {
          ...item,
          tags: JSON.parse(item.tags as string || '[]'),
          suggestedItemIds: JSON.parse(item.suggestedItemIds as string || '[]'),
        };
      }),
    }));

    return NextResponse.json(serializedCategories);
  } catch (error) {
    console.error('Failed to fetch menu:', error);
    return NextResponse.json({ 
      error: 'Failed to fetch menu items', 
      details: error instanceof Error ? error.message : String(error) 
    }, { status: 500 });
  }
}
