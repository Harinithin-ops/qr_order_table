export function formatCurrency(amount: number): string {
  return new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  }).format(amount);
}

export function formatDate(date: string | Date): string {
  return new Intl.DateTimeFormat('en-IN', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    hour12: true,
  }).format(new Date(date));
}

export function generateBillNumber(): string {
  const now = new Date();
  const datePart = now.toISOString().slice(0, 10).replace(/-/g, '');
  const randomPart = Math.random().toString(36).substring(2, 6).toUpperCase();
  return `KH-${datePart}-${randomPart}`;
}

export function cn(...classes: (string | boolean | undefined | null)[]): string {
  return classes.filter(Boolean).join(' ');
}

export function getStatusColor(status: string): string {
  const colors: Record<string, string> = {
    PLACED: 'bg-yellow-500',
    ACCEPTED: 'bg-blue-500',
    PREPARING: 'bg-green-600',
    READY: 'bg-green-500',
    SERVED: 'bg-purple-500',
    PAID: 'bg-emerald-600',
    CANCELLED: 'bg-red-500',
    PENDING: 'bg-yellow-500',
  };
  return colors[status] || 'bg-gray-500';
}

export function getStatusLabel(status: string): string {
  const labels: Record<string, string> = {
    PLACED: 'Order Placed',
    ACCEPTED: 'Accepted',
    PREPARING: 'Preparing',
    READY: 'Ready to Serve',
    SERVED: 'Served',
    PAID: 'Paid',
    CANCELLED: 'Cancelled',
    PENDING: 'Payment Pending',
  };
  return labels[status] || status;
}

export const ORDER_FLOW: string[] = ['PLACED', 'ACCEPTED', 'PREPARING', 'READY', 'SERVED', 'PENDING', 'PAID'];

export const TAX_RATE = 0.02; // 2% GST
export const HOTEL_NAME = 'Kavitha Hotel';
export const HOTEL_ADDRESS = '123 Main Road, City Center';
export const HOTEL_PHONE = '+91 98765 43210';
export const HOTEL_GST = '29ABCDE1234F1Z5';
export const HOTEL_UPI_ID = 'kavithahotel@upi';
