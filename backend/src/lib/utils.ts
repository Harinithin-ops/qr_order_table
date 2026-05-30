import { prisma } from './prisma.js';

export async function generateBillNumber(): Promise<string> {
  const bills = await prisma.bill.findMany({
    select: { billNumber: true }
  });

  let maxNum = 0;
  for (const b of bills) {
    const num = parseInt(b.billNumber, 10);
    if (!isNaN(num) && num > maxNum) {
      maxNum = num;
    }
  }

  const nextNum = maxNum + 1;
  return String(nextNum).padStart(3, '0');
}

export const TAX_RATE = 0.02; // 2% GST
