export enum OrderStatus {
  COMPLETED = 'completed',
  SHIPPED = 'shipped',
  PROCESSING = 'processing',
  CANCELLED = 'cancelled',
  PENDING = 'pending',
  WAITING_SHIPMENT = 'waiting_shipment',
}

/**
 * Confidence/state of Amazon cost capture for an order.
 * Drives which profit tier an order belongs to on the dashboard.
 */
export enum OrderCostCaptureStatus {
  PENDING = 'pending', // eBay order in, nothing captured yet, product cost unknown
  LINKED = 'linked', // Amazon costs fully captured (scraped from a real Amazon order) — TRUSTED
  PROVISIONAL = 'provisional', // product/purchase cost known, Amazon tax+shipping not yet captured
  FAILED = 'failed', // Amazon scrape ran but returned no usable data; prior values retained
  UNTRACKED = 'untracked', // no listing match; source cost can never be known
}

/**
 * Basis of the persisted `netProfit` value, derived from `costCaptureStatus`
 * at read time (no DB column). CONFIRMED = LINKED (real Amazon costs);
 * ESTIMATED = PROVISIONAL (purchase price + configured tax rate).
 */
export enum ProfitBasis {
  CONFIRMED = 'confirmed',
  ESTIMATED = 'estimated',
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
  /** Confidence tier of Amazon cost capture (drives dashboard profit aggregation). */
  costCaptureStatus?: OrderCostCaptureStatus;
  /**
   * Basis of the persisted `netProfit` value, derived from `costCaptureStatus`
   * at read time (no DB column). CONFIRMED = LINKED (real Amazon costs);
   * ESTIMATED = PROVISIONAL (purchase price + configured tax rate); else null.
   */
  profitBasis?: ProfitBasis | null;

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
  /** Filter by connected eBay store (ebay_accounts.id). */
  ebayAccountId?: string;
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
