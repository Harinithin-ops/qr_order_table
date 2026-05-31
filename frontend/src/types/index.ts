export type OrderStatus = 'PLACED' | 'ACCEPTED' | 'PREPARING' | 'READY' | 'SERVED' | 'PENDING' | 'PAID' | 'CANCELLED';

export type PaymentStatus = 'PENDING' | 'PAID' | 'REFUNDED';
export type PaymentMethod = 'CASH' | 'UPI' | 'CARD';

export type FoodTag = 'veg' | 'non-veg' | 'spicy' | 'bestseller';

export interface CartItem {
  menuItemId: string;
  name: string;
  price: number;
  quantity: number;
  image?: string;
  specialInstructions?: string;
}

export interface MenuItem {
  id: string;
  name: string;
  description: string;
  price: number;
  image: string | null;
  available: boolean;
  categoryId: string;
  tags: FoodTag[];
  suggestedItemIds: string[];
}

export interface MenuCategory {
  id: string;
  name: string;
  items: MenuItem[];
}

export interface MenuItemWithCategory extends MenuItem {
  category: {
    id: string;
    name: string;
  };
}

export interface OrderWithItems {
  id: string;
  tableId: string;
  status: OrderStatus;
  total: number;
  notes: string | null;
  createdAt: string;
  updatedAt: string;
  table: {
    id: string;
    tableNumber: number;
    slug: string;
  };
  items: {
    id: string;
    quantity: number;
    price: number;
    specialInstructions: string | null;
    menuItem: {
      id: string;
      name: string;
      image: string | null;
    };
  }[];
  bill?: BillData | null;
}

export interface BillData {
  id: string;
  orderId: string;
  subtotal: number;
  taxAmount: number;
  serviceCharge: number;
  discount: number;
  total: number;
  paymentStatus: string;
  paymentMethod: string | null;
  paymentReference: string | null;
  billNumber: string;
  createdAt: string;
}

/** Payload fields for ORDER_UPDATE (flat on wire; normalized into SSEEvent.data by useEventSource). */
export interface OrderUpdatePayload {
  orderId: string;
  status: string;
  tableId: string;
  billId?: string;
  /** Present when status is PAID (for staff notifications). */
  tableNumber?: number;
}

export interface SSEEvent {
  type: 'NEW_ORDER' | 'ORDER_UPDATE' | 'WAITER_CALL' | 'WAITER_DISMISS' | 'STOCK_UPDATE' | 'BILL_REQUEST' | 'PAYMENT_SUBMITTED' | 'TABLES_UPDATE';
  data: Record<string, unknown>;
  timestamp: string;
}

export interface AnalyticsData {
  topSellingItems: { name: string; count: number; revenue: number }[];
  tableSales: { tableNumber: number; totalOrders: number; totalRevenue: number }[];
  peakHours: { hour: number; orderCount: number }[];
  averageBillAmount: number;
  totalRevenue: number;
  totalOrders: number;
}
