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
  ebayOrderId: string;
  createdAt: string;
  isTracked: boolean;

  // Buyer
  buyerName?: string;
  buyerEmail?: string;
  buyerPhone?: string;
  buyerUsername?: string;

  // Status
  status: OrderStatus;
  orderFulfillmentStatus?: string;
  paymentStatus?: string;

  // Product
  product?: {
    title: string;
    asin?: string;
    ebayItemId?: string;
    sku?: string;
    quantity: number;
    imageUrl?: string;
  };

  // Financial - eBay side
  salePrice: number;
  saleShipping: number;
  saleTax: number;
  saleTotal: number;
  ebayEarnings: number;

  // Financial - Amazon side
  purchasePrice: number;
  amazonOrderUrl?: string;
  amazonTrackingUrl?: string;
  amazonTax?: number;
  amazonShipping?: number;

  // Financial - Calculated
  netProfit: number;
  transactionFee: number;
  adFee: number;

  // Shipping
  shippingAddress?: {
    street: string;
    city: string;
    state: string;
    zipCode: string;
    country: string;
  };

  // Detailed breakdown (from eBay order API)
  details?: {
    purchaseSummary?: {
      subtotal?: number;
      shipping?: number;
      tax?: number;
      total?: number;
      paymentMethod?: string;
    };
    ebaySummary?: {
      subtotal?: number;
      shipping?: number;
      tax?: number;
      total?: number;
      earnings?: number;
    };
  };

  // Fee breakdown
  fees?: {
    transactionFee?: number;
    advertisingFee?: number;
  };
}

export interface OrderStatsDto {
  totalSales: number;
  totalProfit: number;
  totalOrders: number;
  activeOrders: number;
  todayOrders: number;
  todayRevenue: number;
  salesGrowth?: number;
  profitGrowth?: number;
  returnRate?: number;
}

export interface OrderFiltersDto {
  search?: string;
  dateFrom?: string;
  dateTo?: string;
  status?: OrderStatus;
  page?: number;
  limit?: number;
  sortBy?: string;
  sortOrder?: 'asc' | 'desc';
}

export interface OrderSyncResponseDto {
  orders: OrderDto[];
  total: number;
  stats: OrderStatsDto;
  message: string;
}
