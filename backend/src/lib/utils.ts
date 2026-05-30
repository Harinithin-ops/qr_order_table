export function generateBillNumber(): string {
  const now = new Date();
  const datePart = now.toISOString().slice(0, 10).replace(/-/g, '');
  const randomPart = Math.random().toString(36).substring(2, 6).toUpperCase();
  return `KH-${datePart}-${randomPart}`;
}

export const TAX_RATE = 0.02; // 2% GST
