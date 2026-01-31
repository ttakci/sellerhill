export enum OrderStatus {
  COMPLETED = 'completed',
  SHIPPED = 'shipped',
  PROCESSING = 'processing',
  CANCELLED = 'cancelled',
  PENDING = 'pending',
  WAITING_SHIPMENT = 'waiting_shipment',
}

export interface OrderDto {
  id: string;
  orderNumber: string;
  createdAt: string;
  buyerName: string;
  buyerEmail: string;
  buyerPhone?: string;
  status: OrderStatus;
  salePrice: number;
  purchasePrice: number;
  netProfit: number;
  amazonOrderUrl?: string;
  amazonTrackingUrl?: string;
  amazonTax?: number;
  amazonShipping?: number;
  product?: {
    title: string;
    asin: string;
    ebayItemId: string;
    sku: string;
    quantity: number;
    imageUrl: string;
  };
  shippingAddress?: {
    street: string;
    city: string;
    state: string;
    zipCode: string;
    country: string;
  };
  details?: {
    purchaseSummary: {
      subtotal: number;
      shipping: number;
      tax: number;
      total: number;
      paymentMethod?: string;
    };
    ebaySummary: {
      subtotal: number;
      shipping: number;
      tax: number;
      total: number;
      earnings: number;
    };
  };
  fees?: {
    transactionFee: number;
    advertisingFee: number;
    salesTax: number;
  };
}

export interface OrderStatsDto {
  totalSales: number;
  netProfit: number;
  activeOrders: number;
  returnRate: number;
  salesGrowth: number;
  profitGrowth: number;
}
