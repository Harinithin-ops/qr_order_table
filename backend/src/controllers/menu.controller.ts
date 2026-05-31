import { Request, Response } from 'express';
import { prisma } from '../lib/prisma.js';
import { AuthenticatedRequest } from '../middleware/auth.middleware.js';

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
    const authReq = req as AuthenticatedRequest;
    const { id } = req.params;
    const { price, available, name, description, image, categoryId, tags, prepTime } = req.body;

    // Waiter restriction: cannot change price or other main item details
    if (authReq.username !== 'admin') {
      if (
        price !== undefined ||
        name !== undefined ||
        description !== undefined ||
        image !== undefined ||
        categoryId !== undefined ||
        tags !== undefined ||
        prepTime !== undefined
      ) {
        return res.status(403).json({ error: 'Waiters are not allowed to modify menu details other than availability' });
      }
    }

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

    if (name !== undefined) dataToUpdate.name = name;
    if (description !== undefined) dataToUpdate.description = description;
    if (image !== undefined) dataToUpdate.image = image;
    if (categoryId !== undefined) dataToUpdate.categoryId = categoryId;
    if (tags !== undefined) {
      dataToUpdate.tags = JSON.stringify(tags);
    }
    if (prepTime !== undefined) {
      dataToUpdate.prepTime = parseInt(prepTime, 10);
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

    let parsedTags: string[] = [];
    let suggestedItemIds: string[] = [];
    try {
      parsedTags = JSON.parse(updatedItem.tags || '[]');
    } catch { /* ignore */ }
    try {
      suggestedItemIds = JSON.parse(updatedItem.suggestedItemIds || '[]');
    } catch { /* ignore */ }

    return res.json({
      ...updatedItem,
      tags: parsedTags,
      suggestedItemIds
    });
  } catch (error) {
    console.error('Failed to update menu item:', error);
    return res.status(500).json({ error: 'Failed to update menu item' });
  }
}

export async function createMenuItem(req: Request, res: Response) {
  try {
    const { name, description, price, image, categoryId, prepTime, tags } = req.body;

    if (!name || !description || price === undefined || !categoryId) {
      return res.status(400).json({ error: 'Missing required fields: name, description, price, and categoryId are required' });
    }

    const parsedPrice = parseFloat(price);
    if (isNaN(parsedPrice) || parsedPrice < 0) {
      return res.status(400).json({ error: 'Valid price is required' });
    }

    // Check if category exists
    const category = await prisma.menuCategory.findUnique({
      where: { id: categoryId }
    });
    if (!category) {
      return res.status(404).json({ error: 'Menu category not found' });
    }

    const item = await prisma.menuItem.create({
      data: {
        name,
        description,
        price: parsedPrice,
        image: image || null,
        categoryId,
        prepTime: prepTime ? parseInt(prepTime, 10) : 15,
        tags: tags ? JSON.stringify(tags) : '[]',
        suggestedItemIds: '[]',
      }
    });

    let parsedTags: string[] = [];
    let suggestedItemIds: string[] = [];
    try {
      parsedTags = JSON.parse(item.tags || '[]');
    } catch { /* ignore */ }
    try {
      suggestedItemIds = JSON.parse(item.suggestedItemIds || '[]');
    } catch { /* ignore */ }

    return res.status(201).json({
      ...item,
      tags: parsedTags,
      suggestedItemIds
    });
  } catch (error) {
    console.error('Failed to create menu item:', error);
    return res.status(500).json({ error: 'Failed to create menu item' });
  }
}

export async function deleteMenuItem(req: Request, res: Response) {
  try {
    const { id } = req.params;

    // Check if item exists
    const item = await prisma.menuItem.findUnique({
      where: { id }
    });

    if (!item) {
      return res.status(404).json({ error: 'Menu item not found' });
    }

    // Delete associated order items to satisfy foreign key constraints
    await prisma.orderItem.deleteMany({
      where: { menuItemId: id }
    });

    // Delete item
    await prisma.menuItem.delete({
      where: { id }
    });

    return res.json({ success: true, message: 'Menu item deleted successfully' });
  } catch (error) {
    console.error('Failed to delete menu item:', error);
    return res.status(500).json({ error: 'Failed to delete menu item' });
  }
}

