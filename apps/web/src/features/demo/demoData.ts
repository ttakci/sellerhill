import {
  ActionCenterGroup,
  ActionCenterItemKey,
  ActionCenterSeverity,
  AmazonAccountStatus,
  AmazonMarketplace,
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
  EntitlementState,
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
  TrackingConversionScope,
  UserRole,
  UserStatus,
  type ActionCenterSummaryDto,
  type AmazonAccountPublicDto,
  type BillingCatalogDto,
  type BillingDetailsDto,
  type BillingInvoiceListDto,
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
  description?: string;
  features?: string[];
}

const PRODUCTS: DemoProduct[] = [
  { asin: 'B0C6K9VW20', title: 'VR Headset, Advanced All-In-One Virtual Reality', category: 'Consumer Electronics', brand: 'Meta', cost: 210.0, price: 399.0, slug: 'vr-headset', description: 'Immerse yourself in a virtual world with this advanced all-in-one VR headset. Enjoy high-resolution displays, built-in spatial audio, and an extensive library of games and apps without needing a PC or console.', features: ['High-resolution displays', 'Built-in spatial audio', 'Extensive app library'] },
  { asin: 'B0C3H8NRQ0', title: 'Luxury Eau de Parfum, 50ml, Floral & Woody', category: 'Health & Beauty', brand: 'Tom Ford', cost: 85.0, price: 175.0, slug: 'luxury-perfume', description: 'Experience the ultimate luxury with this exquisite eau de parfum. Featuring a captivating blend of floral and woody notes, this long-lasting fragrance is perfect for any occasion.', features: ['50ml spray bottle', 'Floral & Woody notes', 'Long-lasting'] },
  { asin: 'B08XYQ4M6E', title: 'Mechanical Gaming Keyboard, RGB, Cherry MX Switches', category: 'Computers/Tablets', brand: 'Keychron', cost: 55.2, price: 119.95, slug: 'mechanical-keyboard', description: 'Dominate your games with this mechanical keyboard featuring authentic Cherry MX switches. Customizable RGB lighting and a durable aluminum frame make it a must-have for any gamer or typist.', features: ['Cherry MX Switches', 'Customizable RGB lighting', 'Durable aluminum frame'] },
  { asin: 'B08N5WRWN1', title: 'Active Noise Cancelling Headphones, Over-Ear', category: 'Consumer Electronics', brand: 'Sony', cost: 145.0, price: 298.0, slug: 'anc-headphones', description: 'Enjoy pure audio bliss with these over-ear headphones featuring industry-leading active noise cancellation. Up to 30 hours of battery life and touch controls for seamless operation.', features: ['Active Noise Cancelling', '30 hours battery life', 'Touch controls'] },
  { asin: 'B0B3MPT7X1', title: 'Minimalist Automatic Watch, Sapphire Crystal', category: 'Jewelry & Watches', brand: 'Seiko', cost: 110.0, price: 249.99, slug: 'luxury-watch', description: 'Elevate your style with this minimalist automatic watch. Featuring a durable sapphire crystal, precise automatic movement, and a premium leather strap for timeless elegance.', features: ['Sapphire crystal', 'Automatic movement', 'Premium leather strap'] },
  { asin: 'B07QK9ZM31', title: 'Professional Blender 1500W, Auto-iQ Technology', category: 'Home & Garden', brand: 'Ninja', cost: 75.0, price: 159.99, slug: 'professional-blender', description: 'Blend smoothies, crush ice, and puree ingredients with this powerful 1500W professional blender. Auto-iQ technology ensures perfect results with a single touch.', features: ['1500W power', 'Auto-iQ technology', 'Crushes ice'] },
  { asin: 'B0CJ4X2LM0', title: '4K Camera Drone, 3-Axis Gimbal, 60 Min Flight Time', category: 'Consumer Electronics', brand: 'DJI', cost: 320.0, price: 599.0, slug: 'camera-drone', description: 'Capture stunning aerial photography in 4K resolution. This drone features a 3-axis gimbal for ultra-smooth video, intelligent flight modes, and an impressive 60-minute flight time.', features: ['4K resolution', '3-axis gimbal', '60 Min Flight Time'] },
  { asin: 'B0C9M8N7P6', title: 'Smart Home Thermostat, Wi-Fi Enabled, Energy Saving', category: 'Home & Garden', brand: 'Nest', cost: 95.0, price: 189.0, slug: 'smart-thermostat', description: 'Save energy and stay comfortable with this smart Wi-Fi thermostat. Learns your habits and programs itself, while allowing you to control the temperature from anywhere using your phone.', features: ['Wi-Fi enabled', 'Energy saving', 'Learns your habits'] },
  { asin: 'B09H7RT4K0', title: 'Ergonomic Office Chair with Lumbar Support', category: 'Home & Garden', brand: 'Herman Miller', cost: 350.0, price: 799.0, slug: 'ergonomic-chair', description: 'Work in comfort all day with this premium ergonomic office chair. Features adjustable lumbar support, breathable mesh material, and customizable armrests for perfect posture.', features: ['Adjustable lumbar support', 'Breathable mesh', 'Customizable armrests'] },
  { asin: 'B07T5N9YQ0', title: 'Smart Security Camera, 1080p, 2-Way Audio', category: 'Consumer Electronics', brand: 'Ring', cost: 42.0, price: 89.95, slug: 'security-camera', description: 'Keep your home safe with this 1080p smart security camera. Features motion detection, night vision, and two-way audio to let you see, hear, and speak to visitors from anywhere.', features: ['1080p resolution', '2-Way Audio', 'Motion detection'] },
  { asin: 'B00006JSU0', title: 'Robot Vacuum and Mop Combo, Lidar Navigation', category: 'Home & Garden', brand: 'Roborock', cost: 280.0, price: 549.99, slug: 'robot-vacuum', description: 'Effortlessly clean your floors with this advanced robot vacuum and mop combo. Lidar navigation creates accurate maps for efficient cleaning, while strong suction handles dirt and pet hair.', features: ['Lidar navigation', 'Mop combo', 'Strong suction'] },
  { asin: 'B08RL5T7W0', title: 'Professional Percussion Massage Gun, Deep Tissue', category: 'Health & Beauty', brand: 'Theragun', cost: 120.0, price: 249.0, slug: 'massage-gun', description: 'Relieve muscle tension and accelerate recovery with this professional deep tissue massage gun. Features multiple speed settings, interchangeable attachments, and a quiet motor.', features: ['Deep tissue massage', 'Multiple speed settings', 'Interchangeable attachments'] },
  { asin: 'B0BXQ9L4T0', title: 'Polarized Aviator Sunglasses, UV400 Protection', category: 'Apparel & Accessories', brand: 'Ray-Ban', cost: 65.0, price: 145.0, slug: 'aviator-sunglasses', description: 'Protect your eyes in style with these classic aviator sunglasses. Polarized lenses reduce glare and provide 100% UV400 protection against harmful rays.', features: ['Polarized lenses', 'UV400 protection', 'Classic aviator style'] },
  { asin: 'B0C9TR5NK0', title: 'Adjustable Smart Dumbbells Set, App Connected', category: 'Sporting Goods', brand: 'Bowflex', cost: 210.0, price: 399.0, slug: 'smart-dumbbells', description: 'Transform your home gym with these adjustable smart dumbbells. Easily change weights with a simple turn, and connect to the fitness app to track your workouts and progress.', features: ['Adjustable weights', 'App connected', 'Space-saving'] },
  { asin: 'B08LM2ZQ70', title: 'Premium Conical Burr Coffee Grinder, 40 Settings', category: 'Home & Garden', brand: 'Baratza', cost: 85.0, price: 169.95, slug: 'coffee-grinder', description: 'Unlock the full flavor of your coffee beans with this conical burr grinder. Offers 40 precise grind settings from espresso to French press, ensuring a perfect cup every time.', features: ['Conical burr grinder', '40 grind settings', 'Precise dosing'] },
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

/**
 * Listings pinned to the top of the default `/listings` view. That view sorts by
 * `createdAt` desc (see `useListingsFilters`), so giving these ASINs the most
 * recent timestamps — in this exact order — floats them to the front as the
 * first 3 and next 4 cards, without reordering `PRODUCTS` (which would shift
 * every index-derived field: eBay ids, store split, sample-order sampling, RNG
 * sequence). All other listings keep their 100+‑day spread and stay below.
 */
const PINNED_LISTING_ASINS: readonly string[] = [
  'B08N5WRWN1', // Active Noise Cancelling Headphones, Over-Ear — Sony
  'B08XYQ4M6E', // Mechanical Gaming Keyboard, RGB, Cherry MX Switches — Keychron
  'B0C3H8NRQ0', // Luxury Eau de Parfum, 50ml, Floral & Woody — Tom Ford
  'B0C9M8N7P6', // Smart Home Thermostat, Wi-Fi Enabled, Energy Saving — Nest
  'B0CJ4X2LM0', // 4K Camera Drone, 3-Axis Gimbal, 60 Min Flight Time — DJI
  'B07QK9ZM31', // Professional Blender 1500W, Auto-iQ Technology — Ninja
  'B0B3MPT7X1', // Minimalist Automatic Watch, Sapphire Crystal — Seiko
];

function buildListings(): ListingDto[] {
  const rand = seeded(97);
  return PRODUCTS.map((p, i) => {
    const soldCount = Math.floor(rand() * 60) + 2;
    const quantity = i % 9 === 0 ? 0 : Math.floor(rand() * 4) + 1;
    const status = i % 11 === 0 ? ListingStatus.DRAFT : ListingStatus.ACTIVE;
    const profit = round2(p.price * 0.87 - p.cost);
    const daysSinceSale = Math.floor(rand() * 20) + 1;
    const pinnedRank = PINNED_LISTING_ASINS.indexOf(p.asin);
    // Pinned listings: created 1–7 days ago in pin order (newest-first sort puts
    // rank 0 on top). Everyone else keeps `200 − i·6` days, always far older.
    const createdAt = pinnedRank === -1 ? isoDaysAgo(200 - i * 6, i) : isoDaysAgo(pinnedRank + 1, i);
    return {
      id: `demo-listing-${i + 1}`,
      userId: DEMO_USER_ID,
      asin: p.asin,
      productId: `demo-product-${i + 1}`,
      title: p.title,
      description: p.description,
      features: p.features,
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
      lastSaleAt:
        status === ListingStatus.DRAFT
          ? null
          : isoDaysAgo(pinnedRank === -1 ? daysSinceSale : Math.min(daysSinceSale, pinnedRank + 1), i),
      createdAt,
      updatedAt:
        pinnedRank === -1
          ? isoDaysAgo(daysSinceSale, i)
          : isoDaysAgo(Math.min(daysSinceSale, pinnedRank + 1), i),
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
    marketplace: AmazonMarketplace.AMAZON_US,
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
    proxyEnabled: false,
    proxyConnectionType: null,
    proxyHost: null,
    proxyPort: null,
    proxyUsername: null,
    hasProxyPassword: false,
  },
  {
    id: 'demo-amz-2',
    userId: DEMO_USER_ID,
    label: 'Backup buyer',
    email: 'buyer.backup@example.com',
    marketplace: AmazonMarketplace.AMAZON_US,
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
    proxyEnabled: false,
    proxyConnectionType: null,
    proxyHost: null,
    proxyPort: null,
    proxyUsername: null,
    hasProxyPassword: false,
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
    trackingConversionScope: TrackingConversionScope.AMAZON_LOGISTICS_ONLY,
    trackingConvertManualOrders: true,
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
    'demo-tpl-ds-general-store',
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
    'demo-tpl-ds-minimalist',
    { strip: true, aiTitle: true, aiDesc: true }
  ),
  group(
    'demo-group-3',
    'Fast movers',
    'Thin margin, higher quantity, no AI rewrite.',
    [{ min: 0, max: 500, pct: 11 }],
    5,
    2,
    'demo-tpl-ds-tech-gadgets',
    { strip: false, aiTitle: false, aiDesc: false }
  ),
];

export const DEMO_PREDEFINED_TEMPLATES = [
  { slug: 'ds-general-store', name: 'DS General Store' },
  { slug: 'ds-minimalist', name: 'DS Minimalist' },
  { slug: 'ds-tech-gadgets', name: 'DS Tech Gadgets' },
  { slug: 'ds-home-decor', name: 'DS Home Decor' },
  { slug: 'ds-auto-parts', name: 'DS Auto Parts' },
  { slug: 'ds-apparel-fashion', name: 'DS Apparel Fashion' },
  { slug: 'ds-beauty-health', name: 'DS Beauty Health' },
  { slug: 'ds-pet-supplies', name: 'DS Pet Supplies' },
  { slug: 'ds-fitness-sports', name: 'DS Fitness Sports' },
  { slug: 'ds-outdoor-survival', name: 'DS Outdoor Survival' },
  { slug: 'ds-kids-toys', name: 'DS Kids Toys' },
  { slug: 'ds-kitchen-dining', name: 'DS Kitchen Dining' },
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

/**
 * One demo catalog plan. The automatic-order ceiling is DERIVED as 2x the
 * conversion quota rather than passed in, for the same reason migration 085
 * derives it in SQL: two numbers that must stay in a fixed ratio should not be
 * two places to get it wrong.
 */
function plan(
  slug: string,
  name: string,
  description: string,
  monthly: number,
  listings: number,
  conversions: number,
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
    },
    limits: {
      [BillingLimitKey.LISTINGS_PER_MONTH]: {
        id: `${id}-l1`, planId: id, limitKey: BillingLimitKey.LISTINGS_PER_MONTH,
        limitValue: listings, unit: 'listings', createdAt: stamp, updatedAt: stamp,
      },
      [BillingLimitKey.TRACKING_CONVERSIONS_PER_MONTH]: {
        id: `${id}-l3`, planId: id, limitKey: BillingLimitKey.TRACKING_CONVERSIONS_PER_MONTH,
        limitValue: conversions, unit: 'conversions', createdAt: stamp, updatedAt: stamp,
      },
      [BillingLimitKey.AMAZON_ORDERS_PER_MONTH]: {
        id: `${id}-l2`, planId: id, limitKey: BillingLimitKey.AMAZON_ORDERS_PER_MONTH,
        limitValue: conversions * 2, unit: 'orders', createdAt: stamp, updatedAt: stamp,
      },
    },
  };
}

/*
 * Mirrors the real catalog (migrations 083 + 085): twelve monthly tiers, no
 * annual interval, and the automatic-order ceiling derived as 2x the
 * conversion quota. The demo showed the retired three-plan catalog at its old
 * prices, so a visitor was quoted figures the product no longer sells.
 *
 * Names and descriptions come from the `billing` i18n namespace at render time,
 * exactly as the live catalog's do, so the strings here are only fallbacks.
 */
export const DEMO_BILLING_PLANS: BillingPlanWithPricingDto[] = [
  plan('lite', 'Lite', 'For sellers just getting started with a small catalog.', 19.99, 200, 25, 1),
  plan('nano', 'Nano', 'For testing the waters with a focused product set.', 24.99, 500, 50, 2),
  plan('micro', 'Micro', 'For solo sellers running a compact catalog.', 29.99, 1000, 100, 3),
  plan('starter', 'Starter', 'For sellers with a growing catalog and steady order flow.', 44.99, 2000, 150, 4),
  plan('basic', 'Basic', 'For established sellers scaling past a few thousand listings.', 59.99, 3000, 200, 5),
  plan('plus', 'Plus', 'For sellers running a broad catalog across multiple niches.', 84.99, 4000, 250, 6),
  plan('growth', 'Growth', 'For high-volume sellers with a five-thousand-listing catalog.', 104.99, 5000, 300, 7),
  plan('advanced', 'Advanced', 'For power sellers managing a large, actively repriced catalog.', 159.99, 7500, 350, 8),
  plan('pro', 'Pro', 'For professional operations running ten thousand listings.', 179.99, 10000, 500, 9),
  plan('elite', 'Elite', 'For large operations with a fifteen-thousand-listing catalog.', 319.99, 15000, 600, 10),
  plan('business', 'Business', 'For multi-store businesses at twenty thousand listings.', 429.99, 20000, 700, 11),
  plan('enterprise', 'Enterprise', 'For the largest catalogs, with priority support.', 529.99, 25000, 800, 12),
];

export const DEMO_BILLING_CATALOG: BillingCatalogDto = {
  plans: DEMO_BILLING_PLANS,
  currency: 'USD',
  enforcementEnabled: true,
  provider: BillingProvider.STRIPE,
};

/** The demo account is a paying Growth customer, mid-period. */
export function buildDemoBillingSummary(): BillingSummaryDto {
  // By slug, not by index. The index silently pointed at a different plan the
  // moment the catalog grew a cheaper tier at the front — the demo then showed
  // "Nano" above Growth's quotas.
  const growth =
    DEMO_BILLING_PLANS.find((candidate) => candidate.slug === 'growth') ?? DEMO_BILLING_PLANS[0];
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
    // The demo account is on a paid plan, so choosing another plan switches it
    // in place rather than starting a second subscription.
    hasProviderSubscription: true,
    // No top-up offer: the demo account is comfortably inside every limit, and
    // packs are only offered to a seller who has actually hit one.
    quotaAddons: [],
    // What the billing screen actually renders. Kept consistent with the
    // period rows above so the demo never shows two different numbers for the
    // same quota — the conversion count is deliberately well below the order
    // count, which is what a seller converting only TBA numbers looks like.
    quotas: [
      {
        limitKey: BillingLimitKey.LISTINGS_PER_MONTH,
        used: 1840,
        creditValue: 0,
        limitValue: 5000,
      },
      {
        limitKey: BillingLimitKey.TRACKING_CONVERSIONS_PER_MONTH,
        used: 168,
        creditValue: 0,
        limitValue: 300,
      },
      {
        limitKey: BillingLimitKey.AMAZON_ORDERS_PER_MONTH,
        used: 291,
        creditValue: 0,
        limitValue: 600,
      },
    ],
    enforcementEnabled: true,
    provider: BillingProvider.STRIPE,
    transition: 'active',
    entitlement: EntitlementState.ACTIVE,
  };
}

/**
 * Live-from-Stripe billing detail for the demo account.
 *
 * The real endpoint (`GET /billing/details`) calls Stripe on every load; in
 * demo mode nothing may leave the browser, so this is a pure fixture. It must
 * not contradict `buildDemoBillingSummary` — the account is an ACTIVE Growth
 * customer that is NOT set to cancel, so:
 *   - a card is on file,
 *   - the next charge is Growth's monthly price at the period boundary,
 *   - nothing is scheduled and `cancelAtPeriodEnd` is false.
 *
 * `hostedUrl`/`pdfUrl`-style external links are deliberately absent from the
 * details shape; the sibling invoice fixture keeps them null for the same
 * "nothing external in demo" reason `/billing/portal` returns an empty URL.
 */
export function buildDemoBillingDetails(): BillingDetailsDto {
  const growth =
    DEMO_BILLING_PLANS.find((candidate) => candidate.slug === 'growth') ?? DEMO_BILLING_PLANS[0];
  const now = new Date();
  const periodEnd = new Date(now.getFullYear(), now.getMonth() + 1, 0).toISOString();
  const monthlyMicros = growth.prices[BillingInterval.MONTHLY]?.amountMicros ?? 0;

  return {
    paymentMethod: {
      brand: 'visa',
      last4: '4242',
      expMonth: 11,
      expYear: now.getFullYear() + 2,
      expiringSoon: false,
    },
    nextChargeAmountMicros: monthlyMicros,
    nextChargeCurrency: 'USD',
    nextChargeAt: periodEnd,
    scheduledChange: null,
    cancelAtPeriodEnd: false,
    cancelAt: null,
  };
}

/**
 * The demo account's invoice history (`GET /billing/invoices`).
 *
 * Deliberately empty. The real endpoint reads invoices live from Stripe; demo
 * mode has no Stripe, and a fabricated invoice row would carry a fake amount
 * and a dead "Pay now" / download link. `InvoiceHistoryCard` renders its own
 * empty state for this, so the screen is still complete without inventing
 * financial records.
 *
 * To populate it later, return `BillingInvoiceDto` rows (see
 * `packages/shared/src/domain/billing/billing.wire.ts`): all `status: 'paid'`
 * (the summary says the account owes nothing), `amountMicros` = Growth's
 * monthly price, `currency: 'USD'`, `issuedAt` anchored via `isoDaysAgo(...)`
 * newest-first, and `hostedUrl`/`pdfUrl` left `null`.
 */
export function buildDemoBillingInvoices(): BillingInvoiceListDto {
  return { items: [], hasMore: false, nextCursor: null };
}
