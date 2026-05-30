import { Request, Response } from 'express';
import { prisma } from '../lib/prisma.js';

export async function getMenu(req: Request, res: Response) {
  try {
    const categories = await prisma.menuCategory.findMany({
      include: {
        items: true,
      },
      orderBy: {
        displayOrder: 'asc',
      },
    });

    // Parse JSON tags for frontend
    const serializedCategories = categories.map((cat) => ({
      ...cat,
      items: cat.items.map((item) => {
        let tags: string[] = [];
        let suggestedItemIds: string[] = [];
        try {
          tags = JSON.parse(item.tags || '[]');
        } catch {
          // ignore
        }
        try {
          suggestedItemIds = JSON.parse(item.suggestedItemIds || '[]');
        } catch {
          // ignore
        }

        return {
          ...item,
          tags,
          suggestedItemIds,
        };
      }),
    }));

    return res.json(serializedCategories);
  } catch (error) {
    console.error('Failed to fetch menu:', error);
    return res.status(500).json({ 
      error: 'Failed to fetch menu items', 
      details: error instanceof Error ? error.message : String(error) 
    });
  }
}
