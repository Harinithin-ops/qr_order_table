import { prisma } from './prisma.js';

export async function generateBillNumber(): Promise<string> {
  try {
    const now = new Date();
    
    // Create Date formatter for Asia/Kolkata timezone to get current day parts
    const formatter = new Intl.DateTimeFormat('en-US', {
      timeZone: 'Asia/Kolkata',
      year: 'numeric',
      month: 'numeric',
      day: 'numeric'
    });
    
    const parts = formatter.formatToParts(now);
    const day = parseInt(parts.find(p => p.type === 'day')?.value || '1', 10);
    const month = parseInt(parts.find(p => p.type === 'month')?.value || '1', 10) - 1; // 0-indexed month
    const year = parseInt(parts.find(p => p.type === 'year')?.value || '2026', 10);

    // IST midnight is UTC + 5:30, so UTC time is (IST midnight - 5.5 hours)
    const istMidnightUTC = Date.UTC(year, month, day, 0, 0, 0) - (5.5 * 60 * 60 * 1000);
    const startOfTodayIST = new Date(istMidnightUTC);

    // Find the latest bill created since midnight today IST
    const lastTodayBill = await prisma.bill.findFirst({
      where: {
        createdAt: {
          gte: startOfTodayIST
        }
      },
      orderBy: {
        createdAt: 'desc'
      },
      select: {
        billNumber: true
      }
    });

    let nextSequence = 1;
    if (lastTodayBill) {
      const sequenceNum = parseInt(lastTodayBill.billNumber, 10);
      if (!isNaN(sequenceNum)) {
        nextSequence = sequenceNum + 1;
      }
    }

    return String(nextSequence).padStart(4, '0');
  } catch (error) {
    console.error('Error generating daily sequential bill number:', error);
    // Fallback: get the absolute highest bill number and increment
    try {
      const lastBill = await prisma.bill.findFirst({
        select: { billNumber: true },
        orderBy: { createdAt: 'desc' },
      });
      let maxNum = 0;
      if (lastBill) {
        const num = parseInt(lastBill.billNumber, 10);
        if (!isNaN(num)) maxNum = num;
      }
      return String(maxNum + 1).padStart(4, '0');
    } catch {
      // Final fallback if DB is completely unreachable
      return String(Date.now()).slice(-4);
    }
  }
}



export const TAX_RATE = 0.0; // No GST/tax

export interface TimingSlot {
  start: string;
  end: string;
  label: string;
}

export const CATEGORY_TIMINGS: Record<string, TimingSlot> = {
  breakfast: { start: '06:30', end: '12:30', label: '6:30 AM - 12:30 PM' },
  lunch: { start: '12:30', end: '17:30', label: '12:30 PM - 5:30 PM' },
  meals: { start: '12:30', end: '17:30', label: '12:30 PM - 5:30 PM' },
  dinner: { start: '17:30', end: '23:30', label: '5:30 PM - 11:30 PM' },
  starters: { start: '12:30', end: '23:30', label: '12:30 PM - 11:30 PM' },
  snacks: { start: '12:30', end: '23:30', label: '12:30 PM - 11:30 PM' },
};

export function getCategoryTimingStatus(categoryName: string, date: Date = new Date()) {
  const name = categoryName.toLowerCase().trim();
  const slot = CATEGORY_TIMINGS[name];
  if (!slot) {
    // Category not in timing map → always available
    return { isOpen: true, label: '', slot: null };
  }

  // Get IST time robustly using toLocaleString with en-GB (24h, no ambiguity)
  const istString = date.toLocaleString('en-GB', {
    timeZone: 'Asia/Kolkata',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  });

  // istString is like "13:45" or "09:05"
  const parts = istString.split(':');
  let hours = parseInt(parts[0], 10);
  const minutes = parseInt(parts[1], 10);
  if (hours === 24) hours = 0;

  const currentMinutes = hours * 60 + minutes;

  const [startH, startM] = slot.start.split(':').map(Number);
  const [endH, endM] = slot.end.split(':').map(Number);
  const startMinutes = startH * 60 + startM;
  const endMinutes = endH * 60 + endM;

  const isOpen = currentMinutes >= startMinutes && currentMinutes < endMinutes;
  return { isOpen, label: slot.label, slot };
}

