import {
  ActionCenterGroup,
  ActionCenterItemKey,
  ActionCenterSeverity,
  AmazonAccountStatus,
  AutoFulfillBlockedReason,
  AutoFulfillStatus,
  BillingInterval,
  BillingLimitKey,
  BillingProvider,
  BillingSubscriptionStatus,
  BillingUsagePeriodStatus,
  BlacklistType,
  BuyerMessageEventType,
  BuyerMessageTemplateKind,
  DashboardChartGranularity,
  DashboardPeriodKey,
  EbayAccountStatus,
  EbayMarketplaceId,
  ListingFailureCode,
  ListingJobKind,
  ListingJobStatus,
  ListingStatus,
  ListingTrackingState,
  OrderCostCaptureStatus,
  OrderFulfillmentState,
  OrderStatus,
  PolicyType,
  ProfitBasis,
  TemplateType,
  TrackingConversionProvider,
  UserRole,
  UserStatus,
  type ActionCenterSummaryDto,
  type AmazonAccountPublicDto,
  type BillingCatalogDto,
  type BillingPlanWithPricingDto,
  type BillingSummaryDto,
  type BuyerMessageTemplate,
  type BuyerMessagingConfig,
  type DashboardChartPoint,
  type DashboardDataDto,
  type DashboardHistoryMonth,
  type EbayBusinessPolicyDto,
  type ListingDto,
  type ListingJobDto,
  type ListingJobItemDto,
  type ListingSettingsGroupResponse,
  type OrderDto,
  type OrderStatsDto,
  type PeriodMetricsDto,
  type ProfileDto,
  type StoreSettingsResponse,
  type UserDto,
} from '@repo/shared';

/* =========================================================================
 * Deterministic sample data for the sign-up-free demo.
 *
 * Everything here is generated from a fixed seed, so every visitor sees the
 * same store and a reload never reshuffles the numbers underneath them. Dates
 * are anchored to "now" so the dashboard reads as a live account rather than a
 * frozen screenshot.
 *
 * The figures are internally consistent on purpose — order profit sums to the
 * period totals, and the confirmed / estimated / unknown split in the dashboard
 * matches the cost-capture status of the orders behind it. A demo that
 * contradicts itself is worse than no demo.
 * ========================================================================= */

const DEMO_CURRENCY = 'USD';
export const DEMO_USER_ID = 'demo-user';
export const DEMO_EBAY_ACCOUNT_ID = 'demo-ebay-1';
export const DEMO_EBAY_ACCOUNT_ID_2 = 'demo-ebay-2';

/** mulberry32 — small, fast, and stable across browsers. */
function seeded(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let x = Math.imul(a ^ (a >>> 15), 1 | a);
    x = (x + Math.imul(x ^ (x >>> 7), 61 | x)) ^ x;
    return ((x ^ (x >>> 14)) >>> 0) / 4294967296;
  };
}

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

/**
 * Demo mode has no product catalog to photograph — the ASINs are invented,
 * so there is no real Amazon image to fetch. Instead every demo product
 * ships a real, freely-licensed (CC0/PDM/CC BY/CC BY-SA) photo of a generic
 * item matching its category, bundled as a static asset under
 * `apps/web/public/demo-products/` — same-origin, no network request at
 * runtime, keeping the demo's "zero external requests" rule (see CLAUDE.md)
 * intact. Attribution for the CC BY / CC BY-SA entries lives in
 * `apps/web/public/demo-products/CREDITS.md`.
 */
function demoProductImage(slug: string): string {
  return `/demo-products/${slug}.jpg`;
}

export function isoDaysAgo(days: number, hourOffset = 0): string {
  const d = new Date();
  d.setDate(d.getDate() - days);
  d.setHours(9 + (hourOffset % 10), (hourOffset * 7) % 60, 0, 0);
  return d.toISOString();
}

function isoHoursAgo(hours: number): string {
  return new Date(Date.now() - hours * 3600000).toISOString();
}

interface DemoProduct {
  asin: string;
  title: string;
  category: string;
  brand: string;
  cost: number;
  price: number;
  /** Filename (sans extension) under `apps/web/public/demo-products/`. */
  slug: string;
}

const PRODUCTS: DemoProduct[] = [
  { asin: 'B0CJ4X2LMN', title: 'Wireless Earbuds Pro, Active Noise Cancelling, 36H Playtime', category: 'Consumer Electronics', brand: 'Aurio', cost: 21.4, price: 39.99, slug: 'wireless-earbuds' },
  { asin: 'B09H7RT4KP', title: 'USB-C Fast Charger 65W GaN, 3-Port Wall Adapter', category: 'Consumer Electronics', brand: 'Voltek', cost: 18.9, price: 34.5, slug: 'usb-c-charger' },
  { asin: 'B08N5WRWNW', title: 'Ergonomic Laptop Stand, Adjustable Aluminium Riser', category: 'Computers/Tablets', brand: 'Deskly', cost: 15.75, price: 29.95, slug: 'laptop-stand' },
  { asin: 'B07QK9ZM3T', title: 'Stainless Steel Insulated Water Bottle 32oz, Wide Mouth', category: 'Home & Garden', brand: 'Northvale', cost: 12.3, price: 24.99, slug: 'water-bottle' },
  { asin: 'B0B3MPT7XL', title: 'LED Desk Lamp with USB Charging Port, 5 Colour Modes', category: 'Home & Garden', brand: 'Lumira', cost: 16.5, price: 32.0, slug: 'desk-lamp' },
  { asin: 'B0C6K9VW21', title: 'Mechanical Keyboard TKL, Hot-Swappable Red Switches', category: 'Computers/Tablets', brand: 'Keyforge', cost: 34.2, price: 62.5, slug: 'mechanical-keyboard' },
  { asin: 'B08XYQ4M6D', title: 'Bluetooth Speaker Waterproof IPX7, 24H Battery', category: 'Consumer Electronics', brand: 'Aurio', cost: 19.8, price: 37.99, slug: 'bluetooth-speaker' },
  { asin: 'B07T5N9YQ2', title: 'Memory Foam Pillow, Cooling Gel Cover, Queen', category: 'Home & Garden', brand: 'Restwell', cost: 17.6, price: 33.5, slug: 'memory-foam-pillow' },
  { asin: 'B00006JSUA', title: 'Cast Iron Skillet 12 inch, Pre-Seasoned', category: 'Home & Garden', brand: 'Ironcraft', cost: 22.0, price: 41.0, slug: 'cast-iron-skillet' },
  { asin: 'B09MTQ8FZ3', title: 'Yoga Mat Non-Slip 6mm, Carrying Strap Included', category: 'Sporting Goods', brand: 'Flexa', cost: 13.4, price: 26.99, slug: 'yoga-mat' },
  { asin: 'B0BV7K2QLM', title: 'Digital Kitchen Scale, 0.1g Precision, Tare Function', category: 'Home & Garden', brand: 'Northvale', cost: 9.6, price: 19.95, slug: 'kitchen-scale' },
  { asin: 'B0C3H8NRQ4', title: 'Air Fryer 5.8QT, Digital Touchscreen, 8 Presets', category: 'Home & Garden', brand: 'Crispa', cost: 48.5, price: 84.99, slug: 'air-fryer' },
  { asin: 'B08RL5T7WQ', title: 'Resistance Bands Set of 5, Latex-Free with Door Anchor', category: 'Sporting Goods', brand: 'Flexa', cost: 8.25, price: 18.5, slug: 'resistance-bands' },
  { asin: 'B09PQ2MJ7X', title: 'Cable Management Box, Bamboo Lid, Large', category: 'Home & Garden', brand: 'Deskly', cost: 14.1, price: 27.5, slug: 'cable-management-box' },
  { asin: 'B0BXQ9L4TV', title: 'Webcam 1080p with Ring Light and Privacy Cover', category: 'Computers/Tablets', brand: 'Clarion', cost: 20.7, price: 38.95, slug: 'webcam' },
  { asin: 'B07YW6K3PZ', title: 'Insulated Lunch Bag, Leakproof, 12L Cooler Tote', category: 'Home & Garden', brand: 'Northvale', cost: 10.9, price: 22.5, slug: 'lunch-bag' },
  { asin: 'B0C9TR5NKD', title: 'Electric Milk Frother, Stainless Steel, 4 Settings', category: 'Home & Garden', brand: 'Crispa', cost: 15.2, price: 29.99, slug: 'milk-frother' },
  { asin: 'B08LM2ZQ7H', title: 'Adjustable Dumbbell 25lb, Quick-Change Weight Plates', category: 'Sporting Goods', brand: 'Ironcraft', cost: 39.9, price: 71.0, slug: 'dumbbell' },
  { asin: 'B0BK7VQ2ML', title: 'Robot Vacuum Filter Pack, 6-Piece Replacement Set', category: 'Home & Garden', brand: 'Purevo', cost: 7.4, price: 16.99, slug: 'vacuum-filter' },
  { asin: 'B0CN4X8TQR', title: 'Standing Desk Converter, 32 inch Height Adjustable', category: 'Business & Industrial', brand: 'Deskly', cost: 62.0, price: 108.5, slug: 'standing-desk-converter' },
];

/* ── Identity ─────────────────────────────────────────────────────────── */

export const DEMO_USER: UserDto = {
  id: DEMO_USER_ID,
  firstName: 'Demo',
  lastName: 'Seller',
  email: 'demo@sellerhill.com',
  emailVerified: true,
  status: UserStatus.ACTIVE,
  role: UserRole.CUSTOMER,
  sessionVersion: 1,
  locale: 'en',
  hasConnectedAccounts: true,
  createdAt: isoDaysAgo(240),
  updatedAt: isoDaysAgo(1),
};

export const DEMO_EBAY_ACCOUNTS = {
  items: [
    {
      id: DEMO_EBAY_ACCOUNT_ID,
      userId: DEMO_USER_ID,
      sellerId: 'demo_store_us',
      storeName: 'Northvale Supply',
      marketplaceId: EbayMarketplaceId.EBAY_US,
      status: EbayAccountStatus.ACTIVE,
      createdAt: isoDaysAgo(238),
      updatedAt: isoDaysAgo(1),
    },
    {
      id: DEMO_EBAY_ACCOUNT_ID_2,
      userId: DEMO_USER_ID,
      sellerId: 'demo_store_two',
      storeName: 'Deskly Direct',
      marketplaceId: EbayMarketplaceId.EBAY_US,
      status: EbayAccountStatus.ACTIVE,
      createdAt: isoDaysAgo(120),
      updatedAt: isoDaysAgo(2),
    },
  ],
  total: 2,
};

/* ── Listings ─────────────────────────────────────────────────────────── */

function buildListings(): ListingDto[] {
  const rand = seeded(97);
  return PRODUCTS.map((p, i) => {
    const soldCount = Math.floor(rand() * 60) + 2;
    const quantity = i % 9 === 0 ? 0 : Math.floor(rand() * 4) + 1;
    const status = i % 11 === 0 ? ListingStatus.DRAFT : ListingStatus.ACTIVE;
    const profit = round2(p.price * 0.87 - p.cost);
    const daysSinceSale = Math.floor(rand() * 20) + 1;
    return {
      id: `demo-listing-${i + 1}`,
      userId: DEMO_USER_ID,
      asin: p.asin,
      productId: `demo-product-${i + 1}`,
      title: p.title,
      price: p.price,
      currency: DEMO_CURRENCY,
      quantity,
      imageUrls: [demoProductImage(p.slug)],
      ebayListingId: status === ListingStatus.DRAFT ? undefined : `1${(255000000000 + i * 137).toString()}`,
      listingSettingsGroupId: 'demo-group-1',
      listingSettingsGroupName: i % 3 === 0 ? 'High margin' : 'Default strategy',
      paymentPolicyId: 'demo-payment',
      shippingPolicyId: 'demo-shipping',
      returnPolicyId: 'demo-return',
      status,
      trackingState: ListingTrackingState.TRACKED,
      purchasePrice: p.cost,
      estimatedProfit: profit,
      profitMargin: round2((profit / p.price) * 100),
      roi: round2((profit / p.cost) * 100),
      soldCount,
      category: p.category,
      brand: p.brand,
      sourceStock: quantity === 0 ? 0 : quantity + Math.floor(rand() * 8),
      ebayAccountId: i % 4 === 0 ? DEMO_EBAY_ACCOUNT_ID_2 : DEMO_EBAY_ACCOUNT_ID,
      lastSaleAt: status === ListingStatus.DRAFT ? null : isoDaysAgo(daysSinceSale, i),
      createdAt: isoDaysAgo(200 - i * 6, i),
      updatedAt: isoDaysAgo(daysSinceSale, i),
    } satisfies ListingDto;
  });
}

export const DEMO_LISTINGS: ListingDto[] = buildListings();

export const DEMO_LISTING_CATEGORIES: string[] = Array.from(
  new Set(PRODUCTS.map((p) => p.category))
).sort();

/* ── Orders ───────────────────────────────────────────────────────────── */

const BUYER_NAMES = [
  'James Whitfield', 'Maria Delgado', 'Aaron Pike', 'Chloe Bennett', 'Devon Marsh',
  'Priya Raman', 'Tom Ashby', 'Elena Kovac', 'Marcus Lin', 'Sofia Bianchi',
  'Nathan Cole', 'Hannah Brooks', 'Omar Haddad', 'Grace Okafor', 'Liam Sutter',
];

const CITIES: [string, string, string][] = [
  ['Austin', 'TX', '78704'],
  ['Portland', 'OR', '97209'],
  ['Columbus', 'OH', '43215'],
  ['Tampa', 'FL', '33602'],
  ['Denver', 'CO', '80202'],
  ['Raleigh', 'NC', '27601'],
];

/**
 * Each order carries a cost-capture status, and that status is what decides
 * whether it contributes confirmed profit, estimated profit or bare revenue.
 * The dashboard totals below are summed from these rows rather than typed in,
 * so the demo can never show a headline the order list contradicts.
 */
function buildOrders(): OrderDto[] {
  const rand = seeded(4211);
  const orders: OrderDto[] = [];

  for (let i = 0; i < 42; i += 1) {
    const p = PRODUCTS[i % PRODUCTS.length];
    const listingIndex = i % PRODUCTS.length;
    const quantity = rand() < 0.85 ? 1 : 2;
    /*
     * The first three orders are pinned to the last few hours and fall through
     * to the fully-captured branch below. Without that, whether the "Today"
     * card shows a real profit depends on where the random dates happen to
     * land — and a demo whose headline card reads $0 on arrival argues against
     * the product on the one screen everyone looks at first.
     */
    const recent = i < 3;
    const daysAgo = recent ? 0 : Math.floor(rand() * 27);
    const salePrice = round2(p.price * quantity);
    const saleShipping = rand() < 0.7 ? 0 : round2(3.99);
    const saleTax = round2(salePrice * 0.07);
    const saleTotal = round2(salePrice + saleShipping + saleTax);
    const transactionFee = round2(salePrice * 0.1235);
    const adFee = rand() < 0.4 ? round2(salePrice * 0.02) : 0;
    const ebayEarnings = round2(salePrice + saleShipping - transactionFee - adFee);
    const purchasePrice = round2(p.cost * quantity);

    // Distribution mirrors a real account: most captured, some provisional,
    // a few still pending, one blocked and one Amazon-cancelled.
    let costCaptureStatus: OrderCostCaptureStatus;
    let fulfillmentState: OrderFulfillmentState;
    let autoFulfillStatus: AutoFulfillStatus | undefined;
    let autoFulfillBlockedReason: AutoFulfillBlockedReason | null = null;
    let amazonCancelledAt: string | null = null;
    let status: OrderStatus;

    if (i === 3) {
      costCaptureStatus = OrderCostCaptureStatus.LINKED;
      fulfillmentState = OrderFulfillmentState.AMAZON_CANCELLED;
      autoFulfillStatus = AutoFulfillStatus.PLACED;
      amazonCancelledAt = isoDaysAgo(daysAgo - 1 < 0 ? 0 : daysAgo - 1, i);
      status = OrderStatus.PROCESSING;
    } else if (i === 7 || i === 19) {
      costCaptureStatus = OrderCostCaptureStatus.PROVISIONAL;
      fulfillmentState = OrderFulfillmentState.ACTION_REQUIRED;
      autoFulfillStatus = AutoFulfillStatus.BLOCKED;
      autoFulfillBlockedReason =
        i === 7 ? AutoFulfillBlockedReason.CAP : AutoFulfillBlockedReason.OUT_OF_STOCK;
      status = OrderStatus.PENDING;
    } else if (i % 9 === 5) {
      costCaptureStatus = OrderCostCaptureStatus.PENDING;
      fulfillmentState = OrderFulfillmentState.IN_PROGRESS;
      autoFulfillStatus = AutoFulfillStatus.RUNNING;
      status = OrderStatus.PENDING;
    } else if (i % 7 === 4) {
      costCaptureStatus = OrderCostCaptureStatus.PROVISIONAL;
      fulfillmentState = OrderFulfillmentState.PURCHASED;
      autoFulfillStatus = AutoFulfillStatus.PLACED;
      status = OrderStatus.WAITING_SHIPMENT;
    } else if (i === 11) {
      costCaptureStatus = OrderCostCaptureStatus.UNTRACKED;
      fulfillmentState = OrderFulfillmentState.NOT_AUTOMATED;
      status = OrderStatus.SHIPPED;
    } else {
      costCaptureStatus = OrderCostCaptureStatus.LINKED;
      fulfillmentState = OrderFulfillmentState.PURCHASED;
      autoFulfillStatus = AutoFulfillStatus.PLACED;
      status = daysAgo > 6 ? OrderStatus.COMPLETED : OrderStatus.SHIPPED;
    }

    const isLinked = costCaptureStatus === OrderCostCaptureStatus.LINKED;
    const isProvisional = costCaptureStatus === OrderCostCaptureStatus.PROVISIONAL;
    const amazonTax = isLinked ? round2(purchasePrice * 0.062) : 0;
    const amazonShipping = isLinked && rand() < 0.25 ? round2(4.99) : 0;

    let netProfit = 0;
    if (isLinked) {
      netProfit = round2(ebayEarnings - purchasePrice - amazonTax - amazonShipping);
    } else if (isProvisional) {
      netProfit = round2(ebayEarnings - purchasePrice - purchasePrice * 0.06);
    }

    const [city, state, zip] = CITIES[i % CITIES.length];
    const buyerName = BUYER_NAMES[i % BUYER_NAMES.length];

    orders.push({
      id: `demo-order-${i + 1}`,
      ebayOrderId: `12-${11000 + i * 13}-${40000 + i * 7}`,
      createdAt: recent ? isoHoursAgo(2 + i * 3) : isoDaysAgo(daysAgo, i),
      isTracked: costCaptureStatus !== OrderCostCaptureStatus.UNTRACKED,
      buyerName,
      buyerUsername: buyerName.toLowerCase().replace(/[^a-z]/g, '_').slice(0, 12),
      status,
      costCaptureStatus,
      profitBasis: isLinked
        ? ProfitBasis.CONFIRMED
        : isProvisional
          ? ProfitBasis.ESTIMATED
          : null,
      autoFulfillStatus,
      autoFulfillBlockedReason,
      amazonCancelledAt,
      fulfillmentState,
      isSimulated: false,
      product: {
        title: p.title,
        asin: p.asin,
        ebayItemId: `1${(255000000000 + listingIndex * 137).toString()}`,
        sku: `${p.asin}-NEW`,
        quantity,
        imageUrl: demoProductImage(p.slug),
      },
      salePrice,
      saleShipping,
      saleTax,
      saleTotal,
      ebayEarnings,
      purchasePrice: costCaptureStatus === OrderCostCaptureStatus.UNTRACKED ? 0 : purchasePrice,
      amazonOrderId: isLinked ? `112-${3000000 + i * 91}-${1000000 + i * 17}` : null,
      amazonTax,
      amazonShipping,
      netProfit,
      transactionFee,
      adFee,
      shippingAddress: {
        fullName: buyerName,
        street: `${120 + i * 3} Maple Street`,
        city,
        state,
        zipCode: zip,
        country: 'US',
      },
      fees: { transactionFee, advertisingFee: adFee },
    });
  }

  return orders.sort((a, b) => b.createdAt.localeCompare(a.createdAt));
}

export const DEMO_ORDERS: OrderDto[] = buildOrders();

/* ── Dashboard ────────────────────────────────────────────────────────── */

const EMPTY_METRICS: PeriodMetricsDto = {
  sales: 0, orders: 0, units: 0, refunds: 0, grossProfit: 0, netProfit: 0,
  estimatedPayout: 0, margin: 0, avgOrderValue: 0, trend: null, profitTrend: null,
  profitConfirmed: 0, profitProvisional: 0, revenueUncosted: 0,
  ordersPendingCapture: 0, ordersCaptureFailed: 0, ordersUntracked: 0,
  costOfGoods: 0, transactionFees: 0, adFees: 0, amazonShipping: 0, amazonTax: 0,
  roi: 0, refundRate: 0,
};

/** Aggregates real order rows so the cards can never disagree with the list. */
function aggregate(orders: OrderDto[], trend: number | null, profitTrend: number | null): PeriodMetricsDto {
  const m: PeriodMetricsDto = { ...EMPTY_METRICS, trend, profitTrend };

  for (const o of orders) {
    m.sales = round2(m.sales + o.saleTotal);
    m.orders += 1;
    m.units += o.product?.quantity ?? 1;
    m.estimatedPayout = round2(m.estimatedPayout + o.ebayEarnings);
    m.costOfGoods = round2(m.costOfGoods + o.purchasePrice);
    m.transactionFees = round2(m.transactionFees + o.transactionFee);
    m.adFees = round2(m.adFees + o.adFee);
    m.amazonShipping = round2(m.amazonShipping + (o.amazonShipping ?? 0));
    m.amazonTax = round2(m.amazonTax + (o.amazonTax ?? 0));
    m.grossProfit = round2(m.grossProfit + (o.ebayEarnings - o.purchasePrice));

    switch (o.costCaptureStatus) {
      case OrderCostCaptureStatus.LINKED:
        m.profitConfirmed = round2(m.profitConfirmed + o.netProfit);
        break;
      case OrderCostCaptureStatus.PROVISIONAL:
        m.profitProvisional = round2(m.profitProvisional + o.netProfit);
        break;
      case OrderCostCaptureStatus.UNTRACKED:
        m.revenueUncosted = round2(m.revenueUncosted + o.saleTotal);
        m.ordersUntracked += 1;
        break;
      default:
        m.revenueUncosted = round2(m.revenueUncosted + o.saleTotal);
        m.ordersPendingCapture += 1;
    }
  }

  // Headline profit is confirmed-only — the same trust rule the real dashboard applies.
  m.netProfit = m.profitConfirmed;
  m.margin = m.sales > 0 ? round2((m.netProfit / m.sales) * 100) : 0;
  m.avgOrderValue = m.orders > 0 ? round2(m.sales / m.orders) : 0;
  m.roi = m.costOfGoods > 0 ? round2((m.profitConfirmed / m.costOfGoods) * 100) : 0;
  m.refundRate = m.orders + m.refunds > 0 ? round2((m.refunds / (m.orders + m.refunds)) * 100) : 0;
  return m;
}

/**
 * Scales the additive totals of a period and recomputes the ratios from the
 * scaled values, so margin/ROI stay meaningful instead of being multiplied.
 */
function scaleMetrics(base: PeriodMetricsDto, factor: number): PeriodMetricsDto {
  const s = (n: number): number => round2(n * factor);
  const scaled: PeriodMetricsDto = {
    ...base,
    sales: s(base.sales),
    orders: Math.round(base.orders * factor),
    units: Math.round(base.units * factor),
    refunds: Math.round(base.refunds * factor),
    grossProfit: s(base.grossProfit),
    estimatedPayout: s(base.estimatedPayout),
    profitConfirmed: s(base.profitConfirmed),
    profitProvisional: s(base.profitProvisional),
    revenueUncosted: s(base.revenueUncosted),
    ordersPendingCapture: Math.round(base.ordersPendingCapture * factor),
    ordersCaptureFailed: Math.round(base.ordersCaptureFailed * factor),
    ordersUntracked: Math.round(base.ordersUntracked * factor),
    costOfGoods: s(base.costOfGoods),
    transactionFees: s(base.transactionFees),
    adFees: s(base.adFees),
    amazonShipping: s(base.amazonShipping),
    amazonTax: s(base.amazonTax),
    netProfit: s(base.profitConfirmed),
  };
  scaled.margin = scaled.sales > 0 ? round2((scaled.netProfit / scaled.sales) * 100) : 0;
  scaled.avgOrderValue = scaled.orders > 0 ? round2(scaled.sales / scaled.orders) : 0;
  scaled.roi =
    scaled.costOfGoods > 0 ? round2((scaled.profitConfirmed / scaled.costOfGoods) * 100) : 0;
  return scaled;
}

function ordersWithinDays(days: number): OrderDto[] {
  const cutoff = Date.now() - days * 86400000;
  return DEMO_ORDERS.filter((o) => new Date(o.createdAt).getTime() >= cutoff);
}

/** Scales a month's totals off the live 30-day window so history looks plausible. */
function scaleMonth(base: PeriodMetricsDto, factor: number, key: string, from: string, to: string): DashboardHistoryMonth {
  const s = (n: number): number => round2(n * factor);
  const profitConfirmed = s(base.profitConfirmed);
  const purchasePrice = s(base.costOfGoods);
  return {
    key,
    dateFrom: from,
    dateTo: to,
    sales: s(base.sales),
    units: Math.round(base.units * factor),
    orders: Math.round(base.orders * factor),
    refunds: 0,
    adFee: s(base.adFees),
    amazonShipping: s(base.amazonShipping),
    amazonTax: s(base.amazonTax),
    purchasePrice,
    transactionFee: s(base.transactionFees),
    ebayEarnings: s(base.estimatedPayout),
    grossProfit: s(base.grossProfit),
    netProfit: profitConfirmed,
    profitConfirmed,
    profitProvisional: s(base.profitProvisional),
    estimatedPayout: s(base.estimatedPayout),
    margin: base.margin,
    roi: purchasePrice > 0 ? round2((profitConfirmed / purchasePrice) * 100) : 0,
  };
}

export function buildDemoDashboard(granularity: DashboardChartGranularity): DashboardDataDto {
  const today = aggregate(ordersWithinDays(1), 8.2, 6.4);
  const week = aggregate(ordersWithinDays(7), 11.5, 9.1);
  const month = aggregate(ordersWithinDays(31), 12.4, 14.7);
  // A trading year is more than the 42 sample orders, so the year card scales
  // the whole sample up. Ratios are recomputed rather than scaled — a margin
  // multiplied by 8.5 would be nonsense.
  const year = scaleMetrics(aggregate(DEMO_ORDERS, 41.3, 38.9), 8.5);

  const rand = seeded(773);
  const points: DashboardChartPoint[] = [];
  const bucketCount = granularity === DashboardChartGranularity.DAY ? 30 : 12;

  for (let i = bucketCount - 1; i >= 0; i -= 1) {
    const d = new Date();
    if (granularity === DashboardChartGranularity.DAY) {
      d.setDate(d.getDate() - i);
    } else if (granularity === DashboardChartGranularity.WEEK) {
      d.setDate(d.getDate() - i * 7);
    } else {
      d.setMonth(d.getMonth() - i);
      d.setDate(1);
    }
    const scale = granularity === DashboardChartGranularity.DAY ? 1 : granularity === DashboardChartGranularity.WEEK ? 7 : 30;
    const wobble = 0.65 + rand() * 0.7;
    const sales = round2((month.sales / 31) * scale * wobble);
    const netProfit = round2((month.profitConfirmed / 31) * scale * wobble);
    points.push({
      period: d.toISOString().slice(0, 10),
      sales,
      units: Math.max(1, Math.round((month.units / 31) * scale * wobble)),
      orders: Math.max(1, Math.round((month.orders / 31) * scale * wobble)),
      netProfit,
      grossProfit: round2(netProfit * 1.18),
      refunds: rand() < 0.12 ? 1 : 0,
    });
  }

  const months: DashboardHistoryMonth[] = [];
  for (let i = 11; i >= 0; i -= 1) {
    const start = new Date();
    start.setMonth(start.getMonth() - i, 1);
    const end = new Date(start.getFullYear(), start.getMonth() + 1, 0);
    const isCurrent = i === 0;
    const factor = isCurrent ? 1 : 0.55 + (11 - i) * 0.045 + (i % 3) * 0.05;
    months.push(
      scaleMonth(
        month,
        factor,
        isCurrent ? 'current' : `${start.getFullYear()}-${String(start.getMonth() + 1).padStart(2, '0')}`,
        start.toISOString().slice(0, 10),
        end.toISOString().slice(0, 10)
      )
    );
  }

  return {
    metrics: {
      [DashboardPeriodKey.TODAY]: today,
      [DashboardPeriodKey.THIS_WEEK]: week,
      [DashboardPeriodKey.THIS_MONTH]: month,
      [DashboardPeriodKey.THIS_YEAR]: year,
    },
    chart: { granularity, points, summary: month },
    history: { months },
  };
}

export function buildDemoOrderStats(): OrderStatsDto {
  const month = aggregate(ordersWithinDays(31), null, null);
  const today = aggregate(ordersWithinDays(1), null, null);
  return {
    totalSales: month.sales,
    totalProfit: month.profitConfirmed,
    totalOrders: DEMO_ORDERS.length,
    activeOrders: DEMO_ORDERS.filter(
      (o) => o.status !== OrderStatus.COMPLETED && o.status !== OrderStatus.CANCELLED
    ).length,
    todayOrders: today.orders,
    todayRevenue: today.sales,
    salesGrowth: 12.4,
    profitGrowth: 14.7,
    returnRate: 0,
  };
}

/* ── Action Center ────────────────────────────────────────────────────── */

/**
 * Built from the same order and listing rows the pages render, so the sidebar
 * badge, this page and the linked filtered lists all agree.
 */
export function buildDemoActionCenter(): ActionCenterSummaryDto {
  const cancelled = DEMO_ORDERS.filter((o) => o.fulfillmentState === OrderFulfillmentState.AMAZON_CANCELLED).length;
  const blocked = DEMO_ORDERS.filter((o) => o.fulfillmentState === OrderFulfillmentState.ACTION_REQUIRED);
  const untracked = DEMO_ORDERS.filter((o) => o.costCaptureStatus === OrderCostCaptureStatus.UNTRACKED).length;
  const outOfStock = DEMO_LISTINGS.filter(
    (l) => l.status === ListingStatus.ACTIVE && l.quantity === 0
  ).length;
  const drafts = DEMO_LISTINGS.filter((l) => l.status === ListingStatus.DRAFT).length;

  const orderItems = [
    cancelled > 0 && {
      key: ActionCenterItemKey.ORDER_AMAZON_CANCELLED,
      group: ActionCenterGroup.ORDERS,
      severity: ActionCenterSeverity.CRITICAL,
      count: cancelled,
      actionPath: `/orders?fulfillmentState=${OrderFulfillmentState.AMAZON_CANCELLED}`,
    },
    blocked.length > 0 && {
      key: ActionCenterItemKey.ORDER_FULFILLMENT_BLOCKED,
      group: ActionCenterGroup.ORDERS,
      severity: ActionCenterSeverity.CRITICAL,
      count: blocked.length,
      breakdown: [
        { code: AutoFulfillBlockedReason.CAP, count: 1 },
        { code: AutoFulfillBlockedReason.OUT_OF_STOCK, count: 1 },
      ],
      actionPath: `/orders?fulfillmentState=${OrderFulfillmentState.ACTION_REQUIRED}`,
    },
    untracked > 0 && {
      key: ActionCenterItemKey.ORDER_UNTRACKED,
      group: ActionCenterGroup.ORDERS,
      severity: ActionCenterSeverity.WARNING,
      count: untracked,
      actionPath: '/orders',
    },
  ].filter(Boolean) as ActionCenterSummaryDto['groups'][number]['items'];

  const listingItems = [
    outOfStock > 0 && {
      key: ActionCenterItemKey.LISTING_OUT_OF_STOCK,
      group: ActionCenterGroup.LISTINGS,
      severity: ActionCenterSeverity.WARNING,
      count: outOfStock,
      actionPath: '/listings/all?quantityMax=0',
    },
    drafts > 0 && {
      key: ActionCenterItemKey.LISTING_DRAFTS_PENDING,
      group: ActionCenterGroup.LISTINGS,
      severity: ActionCenterSeverity.INFO,
      count: drafts,
      actionPath: `/listings/all?status=${ListingStatus.DRAFT}`,
    },
  ].filter(Boolean) as ActionCenterSummaryDto['groups'][number]['items'];

  const groups = [
    {
      key: ActionCenterGroup.ORDERS,
      severity: ActionCenterSeverity.CRITICAL,
      itemCount: orderItems.length,
      items: orderItems,
    },
    {
      key: ActionCenterGroup.LISTINGS,
      severity: ActionCenterSeverity.WARNING,
      itemCount: listingItems.length,
      items: listingItems,
    },
  ].filter((g) => g.itemCount > 0);

  const all = groups.flatMap((g) => g.items);
  return {
    totalCount: all.length,
    criticalCount: all.filter((i) => i.severity === ActionCenterSeverity.CRITICAL).length,
    warningCount: all.filter((i) => i.severity === ActionCenterSeverity.WARNING).length,
    infoCount: all.filter((i) => i.severity === ActionCenterSeverity.INFO).length,
    groups,
    generatedAt: new Date().toISOString(),
  };
}

/* =========================================================================
 * Account-level sample data — the settings, billing and configuration a
 * seller three months into using SellerHill would already have filled in.
 *
 * The listing/order fixtures in `demoData.ts` cover what the business DID;
 * this file covers how it is SET UP, so every screen in the shell has
 * something real to render instead of an empty state. A demo where half the
 * navigation lands on "nothing here yet" reads as an unfinished product.
 * ========================================================================= */

const ACCOUNT_AGE_DAYS = 96;

/* ── Profile ──────────────────────────────────────────────────────────── */

export const DEMO_PROFILE: ProfileDto = {
  id: DEMO_USER_ID,
  email: 'demo@sellerhill.com',
  firstName: 'Demo',
  lastName: 'Seller',
  phoneNumber: '+1 512 555 0148',
  jobTitle: 'Store owner',
  bio: 'Running two eBay stores sourced from Amazon.',
  country: 'US',
  cityState: 'Austin, TX',
  postalCode: '78704',
  emailVerified: true,
  createdAt: isoDaysAgo(ACCOUNT_AGE_DAYS),
  updatedAt: isoDaysAgo(4),
};

/* ── Amazon buyer accounts ────────────────────────────────────────────── */

export const DEMO_AMAZON_ACCOUNTS: AmazonAccountPublicDto[] = [
  {
    id: 'demo-amz-1',
    userId: DEMO_USER_ID,
    label: 'Primary buyer',
    email: 'buyer.primary@example.com',
    status: AmazonAccountStatus.ACTIVE,
    hasTwoFactor: true,
    lastVerificationError: null,
    lastVerifiedAt: isoDaysAgo(1, 2),
    lastUsedAt: isoDaysAgo(0, 4),
    createdAt: isoDaysAgo(ACCOUNT_AGE_DAYS - 2),
    updatedAt: isoDaysAgo(1),
    autoFulfillEnabled: true,
    autoFulfillCapTotal: 120,
    autoFulfillDryRun: false,
  },
  {
    id: 'demo-amz-2',
    userId: DEMO_USER_ID,
    label: 'Backup buyer',
    email: 'buyer.backup@example.com',
    status: AmazonAccountStatus.ACTIVE,
    hasTwoFactor: true,
    lastVerificationError: null,
    lastVerifiedAt: isoDaysAgo(3, 5),
    lastUsedAt: isoDaysAgo(2, 6),
    createdAt: isoDaysAgo(54),
    updatedAt: isoDaysAgo(3),
    autoFulfillEnabled: true,
    autoFulfillCapTotal: 80,
    autoFulfillDryRun: false,
  },
];

/* ── Store settings (global + one per store) ──────────────────────────── */

const BUYER_MESSAGING: BuyerMessagingConfig = {
  enabled: true,
  events: {
    [BuyerMessageEventType.ORDER_RECEIVED]: {
      enabled: true,
      template: { kind: BuyerMessageTemplateKind.CUSTOM, id: 'demo-tpl-1' },
    },
    [BuyerMessageEventType.SHIPPED]: {
      enabled: true,
      template: { kind: BuyerMessageTemplateKind.CUSTOM, id: 'demo-tpl-2' },
    },
    [BuyerMessageEventType.DELIVERED]: {
      enabled: false,
      template: { kind: BuyerMessageTemplateKind.CUSTOM, id: 'demo-tpl-3' },
    },
    [BuyerMessageEventType.FEEDBACK_REQUEST]: {
      enabled: true,
      template: { kind: BuyerMessageTemplateKind.CUSTOM, id: 'demo-tpl-4' },
      delayDays: 3,
    },
  },
};

function storeSettings(
  id: string,
  storeId: string | undefined,
  isGlobal: boolean
): StoreSettingsResponse {
  return {
    id,
    storeId,
    isGlobal,
    country: 'US',
    state: 'TX',
    zipCode: '78704',
    checkBlacklist: true,
    blacklist: [
      { id: 'demo-bl-1', keyword: 'refurbished', types: [BlacklistType.TITLE, BlacklistType.DESCRIPTION] },
      { id: 'demo-bl-2', keyword: 'counterfeit', types: [BlacklistType.TITLE] },
      { id: 'demo-bl-3', keyword: 'replica', types: [BlacklistType.TITLE, BlacklistType.BRAND_MANUFACTURER] },
    ],
    amazonTaxRate: 6,
    autoFulfillEnabled: true,
    trackingConversionProvider: TrackingConversionProvider.LOCAL,
    buyerMessaging: BUYER_MESSAGING,
    createdAt: new Date(isoDaysAgo(ACCOUNT_AGE_DAYS - 1)),
    updatedAt: new Date(isoDaysAgo(6)),
  };
}

export const DEMO_STORE_SETTINGS_GLOBAL = storeSettings('demo-ss-global', undefined, true);

export const DEMO_STORE_SETTINGS_ALL: StoreSettingsResponse[] = [
  DEMO_STORE_SETTINGS_GLOBAL,
  storeSettings('demo-ss-1', DEMO_EBAY_ACCOUNT_ID, false),
  storeSettings('demo-ss-2', DEMO_EBAY_ACCOUNT_ID_2, false),
];

export function demoStoreSettingsFor(storeId?: string): StoreSettingsResponse {
  if (!storeId) {
    return DEMO_STORE_SETTINGS_GLOBAL;
  }
  return DEMO_STORE_SETTINGS_ALL.find((s) => s.storeId === storeId) ?? DEMO_STORE_SETTINGS_GLOBAL;
}

/* ── Buyer message templates ──────────────────────────────────────────── */

function template(
  id: string,
  eventType: BuyerMessageEventType,
  name: string,
  body: string,
  isDefault: boolean
): BuyerMessageTemplate {
  return {
    id,
    userId: DEMO_USER_ID,
    eventType,
    name,
    body,
    locale: 'en',
    isDefault,
    createdAt: isoDaysAgo(ACCOUNT_AGE_DAYS - 3),
    updatedAt: isoDaysAgo(isDefault ? 40 : 9),
  };
}

export const DEMO_BUYER_MESSAGE_TEMPLATES: BuyerMessageTemplate[] = [
  template(
    'demo-tpl-1',
    BuyerMessageEventType.ORDER_RECEIVED,
    'Thanks for your order',
    'Hi {{buyer_name}},\n\nThanks for your order! We are getting {{item_title}} ready and will send tracking as soon as it ships.\n\n— {{store_name}}',
    true
  ),
  template(
    'demo-tpl-2',
    BuyerMessageEventType.SHIPPED,
    'On its way',
    'Hi {{buyer_name}},\n\nGood news — {{item_title}} has shipped. You can follow it with tracking number {{tracking_number}}.\n\n— {{store_name}}',
    true
  ),
  template(
    'demo-tpl-3',
    BuyerMessageEventType.DELIVERED,
    'Delivered',
    'Hi {{buyer_name}},\n\n{{item_title}} shows as delivered. If anything is not right, just reply here and we will sort it out.\n\n— {{store_name}}',
    true
  ),
  template(
    'demo-tpl-4',
    BuyerMessageEventType.FEEDBACK_REQUEST,
    'How did we do?',
    'Hi {{buyer_name}},\n\nHope {{item_title}} is working out. If you have a moment, feedback helps our small store a lot.\n\n— {{store_name}}',
    true
  ),
  template(
    'demo-tpl-5',
    BuyerMessageEventType.SHIPPED,
    'Shipped — short version',
    'Your order is on the way. Tracking: {{tracking_number}}',
    false
  ),
];

/* ── Listing settings groups ──────────────────────────────────────────── */

function group(
  id: string,
  name: string,
  description: string,
  ranges: { min: number; max: number; pct: number }[],
  defaultQuantity: number,
  stockBuffer: number,
  templateSlugId: string,
  content: { strip: boolean; aiTitle: boolean; aiDesc: boolean }
): ListingSettingsGroupResponse {
  return {
    id,
    name,
    description,
    repricingStrategy: ranges.map((r, i) => ({
      id: `${id}-range-${i + 1}`,
      minPrice: r.min,
      maxPrice: r.max,
      profitMarginPercent: r.pct,
    })),
    stock: { defaultQuantity, stockBuffer },
    fees: { ebayFeePercent: 12.35, fixedFeeAmount: 0.3 },
    templates: { type: TemplateType.PREDEFINED, predefinedTemplateId: templateSlugId },
    content: {
      stripBrandFromTitle: content.strip,
      aiTitleEnabled: content.aiTitle,
      aiDescriptionEnabled: content.aiDesc,
    },
    createdAt: new Date(isoDaysAgo(ACCOUNT_AGE_DAYS - 4)),
    updatedAt: new Date(isoDaysAgo(11)),
    createdBy: DEMO_USER_ID,
    updatedBy: DEMO_USER_ID,
  };
}

export const DEMO_LISTING_GROUPS: ListingSettingsGroupResponse[] = [
  group(
    'demo-group-1',
    'Default strategy',
    'Everyday products. Margin tapers as price climbs.',
    [
      { min: 0, max: 25, pct: 25 },
      { min: 25, max: 60, pct: 18 },
      { min: 60, max: 500, pct: 14 },
    ],
    3,
    1,
    'demo-tpl-modern-professional',
    { strip: true, aiTitle: true, aiDesc: false }
  ),
  group(
    'demo-group-2',
    'High margin',
    'Slower-moving items where margin matters more than volume.',
    [
      { min: 0, max: 40, pct: 32 },
      { min: 40, max: 500, pct: 24 },
    ],
    2,
    1,
    'demo-tpl-elite-trust',
    { strip: true, aiTitle: true, aiDesc: true }
  ),
  group(
    'demo-group-3',
    'Fast movers',
    'Thin margin, higher quantity, no AI rewrite.',
    [{ min: 0, max: 500, pct: 11 }],
    5,
    2,
    'demo-tpl-compact-mobile',
    { strip: false, aiTitle: false, aiDesc: false }
  ),
];

export const DEMO_PREDEFINED_TEMPLATES = [
  { slug: 'modern-professional', name: 'Modern Professional' },
  { slug: 'elite-trust', name: 'Elite Trust' },
  { slug: 'spec-sheet', name: 'Spec Sheet' },
  { slug: 'gallery-grid', name: 'Gallery Grid' },
  { slug: 'minimal-mono', name: 'Minimal Mono' },
  { slug: 'boutique-card', name: 'Boutique Card' },
  { slug: 'compact-mobile', name: 'Compact Mobile' },
  { slug: 'brand-story', name: 'Brand Story' },
].map((t, i) => ({
  id: `demo-tpl-${t.slug}`,
  slug: t.slug,
  name: t.name,
  description: `${t.name} listing layout.`,
  htmlContent: `<div class="zd-${t.slug}"><h2>{{title}}</h2>{{{product_description}}}</div>`,
  sampleData: {} as Record<string, string | string[]>,
  createdAt: new Date(isoDaysAgo(ACCOUNT_AGE_DAYS + i)),
}));

/* ── eBay business policies ───────────────────────────────────────────── */

export const DEMO_BUSINESS_POLICIES: EbayBusinessPolicyDto[] = [
  { id: 'demo-pay-1', name: 'Standard payment', description: 'Immediate payment required', type: PolicyType.PAYMENT },
  { id: 'demo-ship-1', name: 'Free 3-day shipping', description: 'Free economy shipping, 3-5 days', type: PolicyType.SHIPPING },
  { id: 'demo-ship-2', name: 'Expedited shipping', description: 'Buyer pays, 1-2 days', type: PolicyType.SHIPPING },
  { id: 'demo-ret-1', name: '30-day returns', description: 'Buyer pays return shipping', type: PolicyType.RETURN },
];

/* ── Listing jobs ─────────────────────────────────────────────────────── */

/**
 * A believable job history: mostly clean runs, one with a couple of failures
 * and one still processing, so the jobs list and the detail page both have
 * something worth opening.
 */
export const DEMO_LISTING_JOBS: ListingJobDto[] = [
  {
    id: 'demo-job-1',
    userId: DEMO_USER_ID,
    totalAsins: 6,
    processedCount: 4,
    successCount: 4,
    failedCount: 0,
    status: ListingJobStatus.PROCESSING,
    kind: ListingJobKind.CREATE,
    createdAt: isoDaysAgo(0, 1),
    updatedAt: isoDaysAgo(0, 2),
  },
  {
    id: 'demo-job-2',
    userId: DEMO_USER_ID,
    totalAsins: 12,
    processedCount: 12,
    successCount: 10,
    failedCount: 2,
    status: ListingJobStatus.COMPLETED,
    kind: ListingJobKind.CREATE,
    createdAt: isoDaysAgo(3, 3),
    updatedAt: isoDaysAgo(3, 5),
  },
  {
    id: 'demo-job-3',
    userId: DEMO_USER_ID,
    totalAsins: 40,
    processedCount: 40,
    successCount: 40,
    failedCount: 0,
    status: ListingJobStatus.COMPLETED,
    kind: ListingJobKind.EXISTING_IMPORT,
    createdAt: isoDaysAgo(21, 2),
    updatedAt: isoDaysAgo(21, 4),
  },
  {
    id: 'demo-job-4',
    userId: DEMO_USER_ID,
    totalAsins: 8,
    processedCount: 8,
    successCount: 8,
    failedCount: 0,
    status: ListingJobStatus.COMPLETED,
    kind: ListingJobKind.CREATE,
    createdAt: isoDaysAgo(37, 1),
    updatedAt: isoDaysAgo(37, 2),
  },
];

const JOB_ASINS = [
  'B0CJ4X2LMN', 'B09H7RT4KP', 'B08N5WRWNW', 'B07QK9ZM3T',
  'B0B3MPT7XL', 'B0C6K9VW21', 'B08XYQ4M6D', 'B07T5N9YQ2',
  'B00006JSUA', 'B09MTQ8FZ3', 'B0BV7K2QLM', 'B0C3H8NRQ4',
];

export function demoJobItems(jobId: string): ListingJobItemDto[] {
  const job = DEMO_LISTING_JOBS.find((j) => j.id === jobId);
  if (!job) {
    return [];
  }
  return Array.from({ length: job.totalAsins }, (_, i) => {
    const processed = i < job.processedCount;
    const failed = processed && i >= job.successCount;
    return {
      id: `${jobId}-item-${i + 1}`,
      jobId,
      asin: JOB_ASINS[i % JOB_ASINS.length],
      productId: `demo-product-${(i % 20) + 1}`,
      listingId: !processed || failed ? undefined : `demo-listing-${(i % 20) + 1}`,
      status: failed
        ? ListingStatus.ERROR
        : processed
          ? ListingStatus.ACTIVE
          : ListingStatus.DRAFT,
      ebayItemId: !processed || failed ? undefined : `1${(255000000000 + i * 137).toString()}`,
      createdAt: job.createdAt,
      updatedAt: job.updatedAt,
      failureCode: failed
        ? i % 2 === 0
          ? ListingFailureCode.ZERO_STOCK
          : ListingFailureCode.INVALID_IDENTIFIER
        : undefined,
      failureDetails: failed ? { correlationId: `req_demo-${jobId}-${i}` } : undefined,
    } satisfies ListingJobItemDto;
  });
}

/* ── Billing ──────────────────────────────────────────────────────────── */

const MICROS = 1_000_000;

function plan(
  slug: string,
  name: string,
  description: string,
  monthly: number,
  annual: number,
  listings: number,
  orders: number,
  order: number
): BillingPlanWithPricingDto {
  const id = `demo-plan-${slug}`;
  const stamp = isoDaysAgo(200);
  return {
    id,
    slug,
    name,
    description,
    isActive: true,
    displayOrder: order,
    providerProductId: null,
    createdAt: stamp,
    updatedAt: stamp,
    prices: {
      [BillingInterval.MONTHLY]: {
        id: `${id}-m`, planId: id, interval: BillingInterval.MONTHLY,
        amountMicros: monthly * MICROS, currency: 'USD',
        effectiveFrom: stamp, effectiveTo: null, providerPriceId: null,
        createdAt: stamp, updatedAt: stamp,
      },
      [BillingInterval.ANNUAL]: {
        id: `${id}-a`, planId: id, interval: BillingInterval.ANNUAL,
        amountMicros: annual * MICROS, currency: 'USD',
        effectiveFrom: stamp, effectiveTo: null, providerPriceId: null,
        createdAt: stamp, updatedAt: stamp,
      },
    },
    limits: {
      [BillingLimitKey.LISTINGS_PER_MONTH]: {
        id: `${id}-l1`, planId: id, limitKey: BillingLimitKey.LISTINGS_PER_MONTH,
        limitValue: listings, unit: 'listings', createdAt: stamp, updatedAt: stamp,
      },
      [BillingLimitKey.AMAZON_ORDERS_PER_MONTH]: {
        id: `${id}-l2`, planId: id, limitKey: BillingLimitKey.AMAZON_ORDERS_PER_MONTH,
        limitValue: orders, unit: 'orders', createdAt: stamp, updatedAt: stamp,
      },
    },
  };
}

export const DEMO_BILLING_PLANS: BillingPlanWithPricingDto[] = [
  plan('starter', 'Starter', 'For a solo seller putting their first catalogue on autopilot.', 39, 390, 1500, 150, 1),
  plan('growth', 'Growth', 'For a seller adding listings faster than they can watch them.', 55, 550, 2500, 250, 2),
  plan('scale', 'Scale', 'For an operation running several stores and buyer accounts at once.', 75, 750, 4500, 450, 3),
];

export const DEMO_BILLING_CATALOG: BillingCatalogDto = {
  plans: DEMO_BILLING_PLANS,
  currency: 'USD',
  enforcementEnabled: true,
  provider: BillingProvider.PADDLE,
};

/** The demo account is a paying Growth customer, mid-period. */
export function buildDemoBillingSummary(): BillingSummaryDto {
  const growth = DEMO_BILLING_PLANS[1];
  const now = new Date();
  const periodStart = new Date(now.getFullYear(), now.getMonth(), 1).toISOString();
  const periodEnd = new Date(now.getFullYear(), now.getMonth() + 1, 0).toISOString();

  return {
    subscription: {
      id: 'demo-sub-1',
      customerId: 'demo-cust-1',
      planId: growth.id,
      status: BillingSubscriptionStatus.ACTIVE,
      interval: BillingInterval.MONTHLY,
      currentPeriodStart: periodStart,
      currentPeriodEnd: periodEnd,
      canceledAt: null,
      endedAt: null,
      trialEndsAt: null,
      providerSubscriptionId: null,
      metadata: {},
      createdAt: isoDaysAgo(ACCOUNT_AGE_DAYS),
      updatedAt: isoDaysAgo(12),
    },
    plan: growth,
    usagePeriods: [
      {
        id: 'demo-usage-1',
        subscriptionId: 'demo-sub-1',
        limitKey: BillingLimitKey.LISTINGS_PER_MONTH,
        periodStart,
        periodEnd,
        usedQty: 1840,
        limitValueSnapshot: 2500,
        status: BillingUsagePeriodStatus.OPEN,
        closedAt: null,
        createdAt: periodStart,
        updatedAt: isoDaysAgo(0, 3),
      },
      {
        id: 'demo-usage-2',
        subscriptionId: 'demo-sub-1',
        limitKey: BillingLimitKey.AMAZON_ORDERS_PER_MONTH,
        periodStart,
        periodEnd,
        usedQty: 168,
        limitValueSnapshot: 250,
        status: BillingUsagePeriodStatus.OPEN,
        closedAt: null,
        createdAt: periodStart,
        updatedAt: isoDaysAgo(0, 3),
      },
    ],
    enforcementEnabled: true,
    provider: BillingProvider.PADDLE,
    transition: 'active',
  };
}
