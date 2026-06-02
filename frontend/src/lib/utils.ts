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
  const randomPart = Math.floor(1000 + Math.random() * 9000);
  return String(randomPart);
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
export const HOTEL_NAME = 'Hotel kavitha';
export const HOTEL_ADDRESS = '123 Main Road, City Center';
export const HOTEL_PHONE = '+91 98765 43210';
export const HOTEL_GST = '29ABCDE1234F1Z5';
export const HOTEL_UPI_ID = 'kavithahotel47471-1@oksbi';

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

