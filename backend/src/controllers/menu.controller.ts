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

export async function updateMenuItem(req: Request, res: Response) {
  try {
    const { id } = req.params;
    const { price, available } = req.body;

    const dataToUpdate: Record<string, any> = {};

    if (price !== undefined) {
      const parsedPrice = parseFloat(price);
      if (isNaN(parsedPrice) || parsedPrice < 0) {
        return res.status(400).json({ error: 'Valid price is required' });
      }
      dataToUpdate.price = parsedPrice;
    }

    if (available !== undefined) {
      if (typeof available !== 'boolean') {
        return res.status(400).json({ error: 'Available state must be a boolean' });
      }
      dataToUpdate.available = available;
    }

    if (Object.keys(dataToUpdate).length === 0) {
      return res.status(400).json({ error: 'No fields to update provided' });
    }

    // Check if item exists
    const item = await prisma.menuItem.findUnique({
      where: { id }
    });

    if (!item) {
      return res.status(404).json({ error: 'Menu item not found' });
    }

    const updatedItem = await prisma.menuItem.update({
      where: { id },
      data: dataToUpdate
    });

    let tags: string[] = [];
    let suggestedItemIds: string[] = [];
    try {
      tags = JSON.parse(updatedItem.tags || '[]');
    } catch { /* ignore */ }
    try {
      suggestedItemIds = JSON.parse(updatedItem.suggestedItemIds || '[]');
    } catch { /* ignore */ }

    return res.json({
      ...updatedItem,
      tags,
      suggestedItemIds
    });
  } catch (error) {
    console.error('Failed to update menu item:', error);
    return res.status(500).json({ error: 'Failed to update menu item' });
  }
}

