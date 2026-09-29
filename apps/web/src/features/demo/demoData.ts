import {
  ActionCenterGroup,
  ActionCenterItemKey,
  ActionCenterSeverity,
  AmazonAccountStatus,
  AmazonMarketplace,
  AutoFulfillBlockedReason,
  AutoFulfillStatus,
  BestSellersListType,
  BILLING_UNLIMITED,
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
  EbayConversationDto,
  EbayConversationStatus,
  EbayConversationThreadDto,
  EbayConversationType,
  EbayMarketplaceId,
  EbayMessageDto,
  EbayUnreadCountDto,
  EntitlementState,
  ListingFailureCode,
  ListingJobKind,
  ListingJobStatus,
  ListingStatus,
  ListingTrackingState,
  OrderCostCaptureStatus,
  OrderFulfillmentState,
  OrderStage,
  OrderStatus,
  deriveOrderStage,
  PolicyType,
  ProfitBasis,
  SourceFetchOutcome,
  SourceStockStatus,
  TemplateType,
  TrackingConversionProvider,
  TrackingConversionScope,
  UserRole,
  UserStatus,
  type ActionCenterSummaryDto,
  type AmazonAccountPublicDto,
  type BestSellersPageDto,
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
  type UserDto, type ListingRevisionWithListingDto,
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
 * ships a public-domain (CC0 / Public Domain Mark) photo of an UNBRANDED item,
 * bundled as a static asset under `apps/web/public/demo-products/` —
 * same-origin, no network request at runtime, keeping the demo's "zero
 * external requests" rule (see CLAUDE.md) intact. These photos also appear on
 * the landing page, so no brand may be visible in them and no license may need
 * attribution — see `apps/web/public/demo-products/CREDITS.md`.
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
  { asin: 'B0SH2L4N8C', title: 'Insulated Lunch Bag, Leakproof Cooler Tote for Work & Picnic', category: 'Home & Garden', brand: 'Unbranded', cost: 9.8, price: 24.99, slug: 'lunch-bag', description: 'Keeps food cold for hours with thick foam insulation and a leakproof, wipe-clean liner. Sized for a full day out, with sturdy carry handles.', features: ['Thermal foam insulation', 'Leakproof, wipe-clean liner', 'Sturdy carry handles'] },
  { asin: 'B0SH7P3K1D', title: 'Portable Shower Speaker, Waterproof, Suction Cup Mount', category: 'Consumer Electronics', brand: 'Unbranded', cost: 8.4, price: 21.99, slug: 'bluetooth-speaker', description: 'Take your music into the shower. A strong suction cup, splash-proof shell and simple button controls make this compact speaker easy to use anywhere.', features: ['Waterproof shell', 'Suction cup mount', 'Built-in microphone'] },
  { asin: 'B0SH5M9R2E', title: 'Memory Foam Pillow, Cooling Gel, Contour Neck Support', category: 'Health & Beauty', brand: 'Unbranded', cost: 18.5, price: 44.99, slug: 'memory-foam-pillow', description: 'Contoured memory foam cradles your head and neck, while a cooling gel layer keeps the surface fresh through the night.', features: ['Ergonomic contour', 'Cooling gel layer', 'Washable cover'] },
  { asin: 'B0SH4Q6T7F', title: 'Wireless Earbuds, Active Noise Cancelling, 40H Battery', category: 'Consumer Electronics', brand: 'Unbranded', cost: 22.0, price: 59.99, slug: 'wireless-earbuds', description: 'Hybrid active noise cancelling, a 40-hour charging case and a low-latency game mode, in earbuds that weigh under 5 grams each.', features: ['Active noise cancelling', '40 hours with the case', 'IPX5 water resistant'] },
  { asin: 'B0SH8V2W5G', title: 'Clip-On LED Ring Light, 3 Color Modes, USB Powered', category: 'Health & Beauty', brand: 'Unbranded', cost: 7.9, price: 19.99, slug: 'desk-lamp', description: 'A flexible clip-on ring light for makeup, reading and video calls. Three color temperatures and ten brightness levels, powered from any USB port.', features: ['3 color modes', 'Flexible gooseneck', 'USB powered'] },
  { asin: 'B0SH3X7Y9H', title: '65W USB-C Wall Charger with 2 Cables and Adapter', category: 'Computers/Tablets', brand: 'Unbranded', cost: 14.2, price: 34.99, slug: 'usb-c-charger', description: 'Fast-charge a laptop, tablet or phone from one compact wall charger. Includes two USB-C cables and a USB-A adapter.', features: ['65W fast charging', 'Foldable plug', 'Cables included'] },
  { asin: 'B0SH6Z1A4J', title: 'Non-Slip Yoga Mat, 6mm Thick, Lightweight', category: 'Sporting Goods', brand: 'Unbranded', cost: 11.5, price: 29.99, slug: 'yoga-mat', description: 'A cushioned 6mm mat with a textured, non-slip surface for yoga, pilates and floor workouts. Light enough to carry to class.', features: ['6mm cushioning', 'Non-slip texture', 'Lightweight'] },
  { asin: 'B0SH9B5C3K', title: 'Handheld Milk Frother, Battery Powered, Stainless Whisk', category: 'Home & Garden', brand: 'Unbranded', cost: 4.6, price: 14.99, slug: 'milk-frother', description: 'Whip up creamy foam for lattes, matcha and hot chocolate in seconds. A stainless steel whisk and a comfortable grip make it quick to use and easy to rinse.', features: ['Stainless steel whisk', 'Battery powered', 'Easy to clean'] },
  { asin: 'B0SH1D8E6L', title: 'Digital Kitchen Scale, 0.1 oz Precision, Stainless Steel', category: 'Home & Garden', brand: 'Unbranded', cost: 9.2, price: 24.99, slug: 'kitchen-scale', description: 'Weigh ingredients to the gram for baking, meal prep and coffee. A bright backlit display and one-touch tare keep measuring fast.', features: ['0.1 oz / 1 g precision', 'Tare function', 'Backlit display'] },
  { asin: 'B0SH4F2G7M', title: 'HD Webcam with Microphone, Clip-On, Plug and Play', category: 'Computers/Tablets', brand: 'Unbranded', cost: 12.8, price: 32.99, slug: 'webcam', description: 'Clear video for calls and streaming with a built-in microphone and a universal clip that fits laptops and monitors. No drivers needed.', features: ['HD video', 'Built-in microphone', 'Universal clip'] },
  { asin: 'B0SH7H6J2N', title: 'Neoprene Dumbbell Pair with Jump Rope, Home Workout Set', category: 'Sporting Goods', brand: 'Unbranded', cost: 13.4, price: 34.99, slug: 'dumbbell', description: 'A pair of soft-coated dumbbells with a matching jump rope for quick home workouts. The neoprene coating is gentle on floors and easy to grip.', features: ['Neoprene coating', 'Non-slip grip', 'Jump rope included'] },
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
      messagingEnabled: true,
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
      messagingEnabled: true,
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
  'B0SH4Q6T7F', // Wireless Earbuds, Active Noise Cancelling
  'B0SH5M9R2E', // Memory Foam Pillow, Cooling Gel
  'B0SH1D8E6L', // Digital Kitchen Scale
  'B0SH8V2W5G', // Clip-On LED Ring Light
  'B0SH7P3K1D', // Portable Shower Speaker
  'B0SH3X7Y9H', // 65W USB-C Wall Charger
  'B0SH9B5C3K', // Handheld Milk Frother
];

/** An active listing already at quantity 0 (`i % 9 === 0`), shown as unavailable on Amazon. */
const SOURCE_REMOVED_DEMO_INDEX = 9;

/**
 * Which Setting Group a sample listing belongs to. The groups are chosen to
 * show what the feature is FOR — a seasonal campaign and category-specific
 * strategies living side by side in one store — rather than generic
 * "default / high margin" labels, so the settings screen and the landing
 * screenshots taken from it tell the same story.
 */
function demoGroupFor(p: DemoProduct): { id: string; name: string } {
  if (p.category === 'Health & Beauty' || p.category === 'Jewelry & Watches') {
    return { id: 'demo-group-2', name: DEMO_GROUP_NAMES.mothersDay };
  }
  if (p.category === 'Consumer Electronics' || p.category === 'Computers/Tablets') {
    return { id: 'demo-group-3', name: DEMO_GROUP_NAMES.electronics };
  }
  return { id: 'demo-group-1', name: DEMO_GROUP_NAMES.everyday };
}

/**
 * Item specifics as the create path would publish them: a real value for
 * every attribute the source catalogue carries, not a "Does not apply"
 * placeholder. Three pinned products carry a full table (they are the ones
 * the landing screenshots are taken from); every other product still gets a
 * believable handful so no listing detail renders an empty specs card.
 */
const DEMO_RICH_SPECS: Record<string, Record<string, string>> = {
  B0SH4Q6T7F: {
    Brand: 'Unbranded',
    Type: 'In-Ear (Earbud)',
    'Form Factor': 'True Wireless',
    Connectivity: 'Bluetooth 5.3',
    'Noise Control': 'Active Noise Cancellation',
    'Battery Life': '40 Hours',
    'Charging Time': '1.5 Hours',
    'Charging Case': 'USB-C',
    Microphone: 'Built-In',
    'Water Resistance': 'IPX5',
    Color: 'Black',
    Features: 'Touch Controls, Low-Latency Mode, Voice Assistant',
    'Item Weight': '1.9 oz',
    'Included Components': 'Charging Case, USB-C Cable, Ear Tips (3 Sizes)',
  },
  B0SH5M9R2E: {
    Brand: 'Unbranded',
    Type: 'Contour Pillow',
    'Fill Material': 'Memory Foam',
    Size: 'Standard',
    Firmness: 'Medium Firm',
    'Cover Material': 'Polyester Blend',
    'Sleeping Position': 'Back, Side',
    Color: 'White',
    Features: 'Cooling Gel, Removable Cover, Hypoallergenic',
    'Care Instructions': 'Machine Washable Cover',
  },
  B0SH1D8E6L: {
    Brand: 'Unbranded',
    Type: 'Digital Kitchen Scale',
    'Maximum Weight': '11 lb',
    Accuracy: '0.1 oz / 1 g',
    Display: 'Backlit LCD',
    Material: 'Stainless Steel',
    'Power Source': 'Battery',
    Units: 'g, oz, lb, ml',
    Color: 'Silver',
    Features: 'Tare Function, Auto Off, Low Battery Indicator',
  },
};

function demoSpecsFor(p: DemoProduct): Record<string, string> {
  const rich = DEMO_RICH_SPECS[p.asin];
  if (rich) {
    return rich;
  }
  const specs: Record<string, string> = { Brand: p.brand, Type: p.category };
  (p.features ?? []).slice(0, 3).forEach((feature, index) => {
    specs[`Feature ${index + 1}`] = feature;
  });
  return specs;
}

const DEMO_GROUP_NAMES = {
  everyday: 'Everyday essentials',
  mothersDay: "Mother's Day gifts",
  electronics: 'Electronics',
  automotive: 'Automotive',
} as const;

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
      specs: demoSpecsFor(p),
      price: p.price,
      currency: DEMO_CURRENCY,
      quantity,
      imageUrls: [demoProductImage(p.slug)],
      ebayListingId: status === ListingStatus.DRAFT ? undefined : `1${(255000000000 + i * 137).toString()}`,
      listingSettingsGroupId: demoGroupFor(p).id,
      listingSettingsGroupName: demoGroupFor(p).name,
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
      // Amazon often only reports a lower bound ("In Stock" caps at 20, or an
      // order-quantity dropdown caps lower) — every third listing and one
      // low-stock outlier demonstrate the "N+" display; the rest are exact.
      // One live listing (index 9, already at quantity 0) points at a product
      // Amazon answered 404 for, so the "unavailable on Amazon" caption is
      // exercised in the demo too.
      sourceStock:
        i === SOURCE_REMOVED_DEMO_INDEX
          ? 0
          : i === 1 ? 4 : i % 3 === 0 ? 20 : quantity === 0 ? 0 : quantity + Math.floor(rand() * 8),
      sourceStockStatus:
        i === SOURCE_REMOVED_DEMO_INDEX
          ? SourceStockStatus.OUT_OF_STOCK
          : i === 1 || i % 3 === 0 ? SourceStockStatus.AT_LEAST : SourceStockStatus.EXACT,
      sourceRemoved: i === SOURCE_REMOVED_DEMO_INDEX,
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

/* ── Amazon Best Sellers ──────────────────────────────────────────────── */

/** Amazon's own alias grammar (`electronics`, `home-garden`) for a demo category name. */
function demoCategoryAlias(name: string): string {
  return name
    .toLowerCase()
    .replace(/&/g, 'and')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

const DEMO_BEST_SELLERS_TITLES: Record<BestSellersListType, string> = {
  [BestSellersListType.BEST_SELLERS]: 'Amazon Best Sellers',
  [BestSellersListType.NEW_RELEASES]: 'Amazon Hot New Releases',
  [BestSellersListType.MOVERS_AND_SHAKERS]: 'Amazon Movers & Shakers',
  [BestSellersListType.MOST_WISHED_FOR]: 'Amazon Most Wished For',
  [BestSellersListType.MOST_GIFTED]: 'Amazon Most Gifted',
};

/** Demo ratings are deterministic per product, so a reload never reshuffles them. */
function demoRating(index: number): { average: number; count: number } {
  const rand = seeded(311 + index);
  return {
    average: round2(4.1 + rand() * 0.8),
    count: Math.floor(rand() * 40_000) + 500,
  };
}

/** Best Sellers products viewed this period by the demo account, against Growth's allowance. */
const DEMO_BEST_SELLERS_USED = 1240;
const DEMO_BEST_SELLERS_LIMIT = 15_000;

/**
 * The Best Sellers page in demo mode: the same eleven sample products, ranked,
 * under whichever list and category the visitor picks. The category tree is
 * derived from the products' own categories; a sub-category narrows the list
 * to its products so the picker visibly does something. Every list type and
 * every page answers — the demo must never show the "Amazon did not answer"
 * screen, since nothing here ever asks Amazon.
 */
export function buildDemoBestSellers(listType: BestSellersListType, category: string, page: number): BestSellersPageDto {
  const isRoot = category === '';
  const matching = isRoot ? PRODUCTS : PRODUCTS.filter((p) => demoCategoryAlias(p.category) === category);
  // Movers & Shakers reads best with a different order than the plain ranking.
  const ordered = listType === BestSellersListType.MOVERS_AND_SHAKERS ? [...matching].reverse() : matching;
  const selectedName = matching[0]?.category ?? null;

  const items = ordered.map((p, i) => {
    const rating = demoRating(PRODUCTS.indexOf(p));
    return {
      rank: i + 1,
      asin: p.asin,
      title: p.title,
      link: `https://www.amazon.com/dp/${p.asin}`,
      image: demoProductImage(p.slug),
      rating,
      price: { amount: p.cost, currency: DEMO_CURRENCY },
      priceText: `$${p.cost.toFixed(2)}`,
      rankChangePercent: listType === BestSellersListType.MOVERS_AND_SHAKERS ? (11 - i) * 35 : null,
      previousRank: listType === BestSellersListType.MOVERS_AND_SHAKERS ? i + 12 : null,
      salesRank: null,
    };
  });

  return {
    outcome: SourceFetchOutcome.FOUND,
    list: {
      title: DEMO_BEST_SELLERS_TITLES[listType],
      category: isRoot ? null : selectedName,
      listType,
      link: 'https://www.amazon.com/gp/bestsellers',
      items: page === 1 ? items : [],
      // Root answers the full department list (the tree's level-1 rows); a
      // department page answers only its own breadcrumb echo — this demo's
      // eleven products carry one category each, so there is no real
      // sub-category data to invent under a department, same as a genuinely
      // leaf-level department on Amazon itself.
      categories: isRoot
        ? [
            { name: 'Any Department', path: null, link: 'https://www.amazon.com/gp/bestsellers', isSelected: true, isRoot: true },
            ...DEMO_LISTING_CATEGORIES.map((name) => ({
              name,
              path: demoCategoryAlias(name),
              link: `https://www.amazon.com/gp/bestsellers/${demoCategoryAlias(name)}`,
              isSelected: false,
              isRoot: false,
            })),
          ]
        : [
            {
              name: selectedName ?? category,
              path: category,
              link: `https://www.amazon.com/gp/bestsellers/${category}`,
              isSelected: true,
              isRoot: false,
            },
          ],
      relatedLists: [],
      pagination: { page, itemsPerPage: 50, totalPages: 1, totalCount: items.length },
    },
    cachedAt: isoHoursAgo(2),
    fetchedAt: isoHoursAgo(2),
    // The Growth demo account, mid-period: the same figures as the billing
    // summary's Best Sellers quota, so the meter here and the ring on the
    // billing page can never disagree. Nothing is locked — the demo never
    // withholds a product.
    allowance: {
      used: DEMO_BEST_SELLERS_USED,
      limit: DEMO_BEST_SELLERS_LIMIT,
      remaining: DEMO_BEST_SELLERS_LIMIT - DEMO_BEST_SELLERS_USED,
      creditValue: 0,
    },
    lockedCount: 0,
  };
}

/** Hours between two price/stock checks (four a day). */
const REFRESH_STEP_HOURS = 6;

/* ── Listing price/stock revision history ─────────────────────────────────
 * The revisions feature (drawer + `GET /listings/:id/revisions`) exists in
 * full; without fixtures the demo listing detail page just never shows the
 * "revisions" action because the preview count is zero. This makes every
 * ACTIVE demo listing look like it has been price/stock-tracked for a couple
 * of months.
 *
 * Generated per listing from a fixed seed, anchored to "now", newest-first —
 * same discipline as every other fixture here. Real revisions are written
 * only when a value actually moves; price moves on every row below, so each
 * one is a legitimate change. Drafts get none — the refresh pipeline never
 * touches a draft.
 */
export function demoListingRevisions(listingId: string): {
  id: string;
  previousPrice: number;
  newPrice: number;
  previousQuantity: number;
  newQuantity: number;
  recordedAt: string;
}[] {
  const listing = DEMO_LISTINGS.find((l) => l.id === listingId);
  if (!listing || listing.status === ListingStatus.DRAFT) {
    return [];
  }

  const idx = Number(listingId.replace('demo-listing-', '')) || 1;
  const rand = seeded(9200 + idx);

  // Roughly one recorded change every ~2 days the listing has existed — so an
  // old listing has hundreds of rows and exercises the "load more" paging,
  // while a freshly added one has only a handful.
  const daysListed = Math.max(
    3,
    Math.round((Date.now() - new Date(listing.createdAt).getTime()) / 86_400_000)
  );
  // Floor of 24 so even a week-old listing spills past one page and shows the
  // "load more" control; an old listing climbs toward hundreds of rows.
  const rowCount = Math.min(240, Math.max(24, Math.round(daysListed * 0.9)));
  const avgStepDays = Math.max(0.5, daysListed / rowCount);

  const rows: ReturnType<typeof demoListingRevisions> = [];

  // Walk backwards from the listing's live values: the newest row lands on
  // exactly today's price/quantity so the drawer's "previous → current"
  // column reads consistently, and each older row's `newX` is the next
  // (older) row's `previousX`.
  let newPrice = listing.price;
  let newQuantity = listing.quantity;
  // Changes land on the refresh schedule — four checks a day, one every six
  // hours — so the history reads like the cadence the product runs on. A check
  // that found nothing to change writes no row, which is why rows skip slots.
  const now = new Date();
  const sinceLastCheck = (now.getUTCHours() % REFRESH_STEP_HOURS) + now.getUTCMinutes() / 60 - 0.05;
  let hoursAgo = sinceLastCheck + REFRESH_STEP_HOURS * Math.floor(rand() * 3);

  for (let i = 0; i < rowCount; i += 1) {
    // Mostly small repricer nudges tracking a competitor; the occasional
    // larger correction.
    const isJump = rand() < 0.18;
    const magnitude = isJump ? 0.05 + rand() * 0.09 : 0.008 + rand() * 0.025;
    const direction = rand() < 0.5 ? -1 : 1;
    let previousPrice = round2(newPrice * (1 - direction * magnitude));
    if (previousPrice <= 1) {
      previousPrice = round2(newPrice + 1);
    }

    // Stock drifts within the buffer band and dips toward 0 now and then.
    let previousQuantity = newQuantity;
    const qRoll = rand();
    if (qRoll < 0.35) {
      previousQuantity = newQuantity + 1 + Math.floor(rand() * 3);
    } else if (qRoll < 0.5) {
      previousQuantity = Math.max(0, newQuantity - 1);
    }

    rows.push({
      id: `demo-rev-${idx}-${i + 1}`,
      previousPrice,
      newPrice,
      previousQuantity,
      newQuantity,
      recordedAt: isoHoursAgo(hoursAgo),
    });

    newPrice = previousPrice;
    newQuantity = previousQuantity;
    const slots = Math.max(1, Math.round((avgStepDays * (0.5 + rand()) * 24) / REFRESH_STEP_HOURS));
    hoursAgo += slots * REFRESH_STEP_HOURS;
  }

  return rows; // newest-first
}

/**
 * The cross-listing feed behind "Revizyon Geçmişi" (`GET /listings/revisions`)
 * — every {@link demoListingRevisions} row, across every non-draft listing,
 * merged and sorted newest-first, with the product/store context the
 * per-listing endpoint leaves to its caller (that one already has a listing
 * page around it). Search matches the ASIN only, same as the real query.
 */
export function demoAllListingRevisions(params: {
  page?: number;
  limit?: number;
  search?: string;
  ebayAccountId?: string;
}): { items: ListingRevisionWithListingDto[]; total: number; page: number; limit: number } {
  const storeByAccountId = new Map(DEMO_EBAY_ACCOUNTS.items.map((acc) => [acc.id, acc]));

  let merged: ListingRevisionWithListingDto[] = [];
  for (const listing of DEMO_LISTINGS) {
    if (listing.status === ListingStatus.DRAFT) {
      continue;
    }
    const store = listing.ebayAccountId ? storeByAccountId.get(listing.ebayAccountId) : undefined;
    for (const revision of demoListingRevisions(listing.id)) {
      merged.push({
        ...revision,
        listingId: listing.id,
        asin: listing.asin,
        title: listing.title,
        imageUrl: listing.imageUrls[0],
        ebayAccountId: listing.ebayAccountId,
        storeName: store?.storeName,
        currency: DEMO_CURRENCY,
      });
    }
  }

  const search = params.search?.trim().toLowerCase();
  if (search) {
    merged = merged.filter((r) => r.asin.toLowerCase().includes(search));
  }
  if (params.ebayAccountId) {
    merged = merged.filter((r) => r.ebayAccountId === params.ebayAccountId);
  }
  merged.sort((a, b) => new Date(b.recordedAt).getTime() - new Date(a.recordedAt).getTime());

  const page = Math.max(1, params.page ?? 1);
  const limit = Math.max(1, params.limit ?? 20);
  const start = (page - 1) * limit;
  return { items: merged.slice(start, start + limit), total: merged.length, page, limit };
}

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
    // Amazon observed "shipped" but nothing reached eBay yet — the tracking
    // conversion is HELD (raw numbers are never pushed). One inside the 12 h
    // grace (amber), one past it (red) so the demo shows both alarm colours.
    let shippedDetectedAt: string | null = null;
    let isSimulated = false;

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
    } else if (i === 13 || i === 17) {
      costCaptureStatus = OrderCostCaptureStatus.LINKED;
      fulfillmentState = OrderFulfillmentState.PURCHASED;
      autoFulfillStatus = AutoFulfillStatus.PLACED;
      status = OrderStatus.WAITING_SHIPMENT;
      shippedDetectedAt = isoHoursAgo(i === 13 ? 2 : 20);
    } else if (i === 21) {
      // Sold but not yet paid on eBay — nothing to buy until the payment lands.
      costCaptureStatus = OrderCostCaptureStatus.PROVISIONAL;
      fulfillmentState = OrderFulfillmentState.NOT_AUTOMATED;
      status = OrderStatus.PENDING;
    } else if (i === 24) {
      // Automation off for this store: the seller buys this one by hand.
      costCaptureStatus = OrderCostCaptureStatus.PROVISIONAL;
      fulfillmentState = OrderFulfillmentState.NOT_AUTOMATED;
      status = OrderStatus.WAITING_SHIPMENT;
    } else if (i === 26) {
      // A dry run: the checkout walked to Place Order and stopped — nothing bought.
      costCaptureStatus = OrderCostCaptureStatus.PROVISIONAL;
      fulfillmentState = OrderFulfillmentState.SIMULATED;
      autoFulfillStatus = AutoFulfillStatus.DRY_RUN;
      status = OrderStatus.WAITING_SHIPMENT;
      isSimulated = true;
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

    /*
     * Tracking conversion, as it looks once a shipped order has been through
     * the Aquiline path: `amazonTrackingNumber` is the raw Amazon Logistics
     * number, `convertedTrackingNumber` the `AQUA…YQ` number the eBay buyer
     * actually sees, and `ebayTrackingPushedNumber` equals it because
     * `mayPushToEbay(CONVERTED)` sends the converted number. Only orders that
     * are actually shipped/completed AND auto-purchased get it. `i === 1` (a
     * recent SHIPPED order) is left source-only so the "Convert tracking"
     * action still has something to act on in the demo.
     */
    const isShippedOrder = status === OrderStatus.SHIPPED || status === OrderStatus.COMPLETED;
    const hasTracking = isShippedOrder && autoFulfillStatus === AutoFulfillStatus.PLACED && isLinked;
    const amazonTrackingNumber = hasTracking ? `TBA${915_000_000_000 + i * 3607}` : null;
    const trackRng = seeded(5100 + i);
    const aquaBody = Array.from(
      { length: 9 },
      () => 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'[Math.floor(trackRng() * 31)]
    ).join('');
    const convertedTrackingNumber = hasTracking && i !== 1 ? `AQUA${aquaBody}YQ` : null;
    // A placed purchase always has its Amazon order id (onPlaced writes both), whatever
    // the cost-capture status says; a dry run gets the SIM- id the real code writes.
    const amazonOrderId = isSimulated
      ? `SIM-112-${3000000 + i * 91}-${1000000 + i * 17}`
      : isLinked || autoFulfillStatus === AutoFulfillStatus.PLACED
        ? `112-${3000000 + i * 91}-${1000000 + i * 17}`
        : null;
    // A shipped/completed fixture was observed shipped by Amazon before its
    // tracking reached eBay — the same two stamps the API derives the stage from.
    const shippedDetectedAtResolved = isShippedOrder ? isoDaysAgo(daysAgo, i + 3) : shippedDetectedAt;
    const ebayTrackingPushedAt = isShippedOrder ? isoDaysAgo(daysAgo, i + 4) : null;

    orders.push({
      id: `demo-order-${i + 1}`,
      ebayOrderId: `12-${11000 + i * 13}-${40000 + i * 7}`,
      createdAt: recent ? isoHoursAgo(2 + i * 3) : isoDaysAgo(daysAgo, i),
      isTracked: costCaptureStatus !== OrderCostCaptureStatus.UNTRACKED,
      buyerName,
      buyerUsername: buyerName
        .toLowerCase()
        .replace(/[^a-z]/g, '_')
        .slice(0, 12),
      status,
      costCaptureStatus,
      profitBasis: isLinked ? ProfitBasis.CONFIRMED : isProvisional ? ProfitBasis.ESTIMATED : null,
      autoFulfillStatus,
      autoFulfillBlockedReason,
      amazonCancelledAt,
      fulfillmentState,
      isSimulated,
      stage: deriveOrderStage({
        status,
        autoFulfillStatus,
        amazonOrderId,
        amazonCancelledAt,
        shippedDetectedAt: shippedDetectedAtResolved,
        ebayTrackingPushedAt,
      }),
      shippedDetectedAt: shippedDetectedAtResolved,
      ebayTrackingPushedAt,
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
      amazonOrderId,
      amazonTrackingNumber,
      convertedTrackingNumber,
      ebayTrackingPushedNumber: convertedTrackingNumber,
      amazonTrackingUrl: amazonTrackingNumber
        ? `https://www.amazon.com/progress-tracker/package/ref=demo?itemId=${amazonTrackingNumber}`
        : undefined,
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
    // Mirrors the API: an untracked order (no SellerHill listing) is excluded
    // from every figure and only counted, so the card can say it was left out.
    if (o.costCaptureStatus === OrderCostCaptureStatus.UNTRACKED) {
      m.ordersUntracked += 1;
      continue;
    }
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
  const cancelled = DEMO_ORDERS.filter((o) => o.stage === OrderStage.AMAZON_CANCELLED).length;
  const blocked = DEMO_ORDERS.filter((o) => o.stage === OrderStage.PURCHASE_BLOCKED);
  const held = DEMO_ORDERS.filter((o) => o.stage === OrderStage.TRACKING_HELD).length;
  const untracked = DEMO_ORDERS.filter((o) => o.costCaptureStatus === OrderCostCaptureStatus.UNTRACKED).length;
  const outOfStock = DEMO_LISTINGS.filter((l) => l.status === ListingStatus.ACTIVE && l.quantity === 0).length;
  const drafts = DEMO_LISTINGS.filter((l) => l.status === ListingStatus.DRAFT).length;

  const orderItems = [
    cancelled > 0 && {
      key: ActionCenterItemKey.ORDER_AMAZON_CANCELLED,
      group: ActionCenterGroup.ORDERS,
      severity: ActionCenterSeverity.CRITICAL,
      count: cancelled,
      actionPath: `/orders?stage=${OrderStage.AMAZON_CANCELLED}`,
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
      actionPath: `/orders?stage=${OrderStage.PURCHASE_BLOCKED}`,
    },
    held > 0 && {
      key: ActionCenterItemKey.ORDER_TRACKING_CONVERSION_HELD,
      group: ActionCenterGroup.ORDERS,
      severity: ActionCenterSeverity.CRITICAL,
      count: held,
      actionPath: `/orders?stage=${OrderStage.TRACKING_HELD}`,
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
    // A blacklist hit is the seller's own rule working as intended — the
    // listing was stopped before a banned word reached a buyer — so the demo
    // shows it the way a real account would see it: something to review.
    {
      key: ActionCenterItemKey.LISTING_JOB_FAILURES,
      group: ActionCenterGroup.LISTINGS,
      severity: ActionCenterSeverity.WARNING,
      count: 3,
      breakdown: [
        { code: ListingFailureCode.BLACKLISTED_KEYWORD, count: 2 },
        { code: ListingFailureCode.ZERO_STOCK, count: 1 },
      ],
      context: { days: 7 },
      actionPath: '/listings/jobs',
    },
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

/* ── eBay Messages ────────────────────────────────────────────────────── */

/**
 * One demo seller identity for every outbound message — matches
 * `DEMO_EBAY_ACCOUNTS.items[0].sellerId`, which is what `useMessagesInbox`'s
 * `isMine` check compares a sender against when no `ebayUsername` is set.
 */
const STORE_SELLER_USERNAME = DEMO_EBAY_ACCOUNTS.items[0].sellerId;

function demoMessage(
  id: string,
  senderUsername: string,
  body: string,
  daysAgo: number,
  hourOffset: number,
  read: boolean
): EbayMessageDto {
  return {
    messageId: id,
    subject: null,
    body,
    senderUsername,
    recipientUsername: senderUsername === STORE_SELLER_USERNAME ? 'buyer' : STORE_SELLER_USERNAME,
    read,
    createdAt: isoDaysAgo(daysAgo, hourOffset),
    media: [],
  };
}

/** Turns an invented buyer name into an eBay-style handle — no real accounts, no real brands. */
function buyerHandle(name: string, suffix: number): string {
  return `${name.toLowerCase().replace(/[^a-z]/g, '_').slice(0, 12)}${suffix}`;
}

/** The two listings a pre-sale question links back to, via their real eBay item id. */
const EARBUDS_ITEM_ID = DEMO_LISTINGS[3].ebayListingId ?? null; // Wireless Earbuds
const PILLOW_ITEM_ID = DEMO_LISTINGS[2].ebayListingId ?? null; // Memory Foam Pillow

/**
 * Eight conversations: six buyer↔seller (`FROM_MEMBERS` — two unread, one
 * archived, two carrying a `referenceId` back to a real demo listing) and two
 * eBay-to-seller system notices (`FROM_EBAY`, always read — eBay does not
 * report an unread system notice as something to action).
 */
const CONVERSATION_SEEDS: Array<{
  conversationId: string;
  type: EbayConversationType;
  status: EbayConversationStatus;
  title: string | null;
  referenceId: string | null;
  otherPartyUsername: string | null;
  messages: EbayMessageDto[];
}> = [
  {
    conversationId: 'demo-conv-1',
    type: EbayConversationType.FROM_MEMBERS,
    status: EbayConversationStatus.ACTIVE,
    title: 'Question about my order',
    referenceId: null,
    otherPartyUsername: buyerHandle('Aaron Pike', 47),
    messages: [
      demoMessage(
        'demo-msg-1-1',
        buyerHandle('Aaron Pike', 47),
        'Hi, just checking — has my order shipped yet?',
        4,
        2,
        true
      ),
      demoMessage(
        'demo-msg-1-2',
        STORE_SELLER_USERNAME,
        'Thanks for reaching out! It ships within one business day and you will get tracking automatically.',
        4,
        3,
        true
      ),
      demoMessage(
        'demo-msg-1-3',
        buyerHandle('Aaron Pike', 47),
        'Great, appreciate the quick reply!',
        0,
        1,
        false
      ),
    ],
  },
  {
    conversationId: 'demo-conv-2',
    type: EbayConversationType.FROM_MEMBERS,
    status: EbayConversationStatus.ACTIVE,
    title: 'Shipping to a different address',
    referenceId: null,
    otherPartyUsername: buyerHandle('Chloe Bennett', 12),
    messages: [
      demoMessage(
        'demo-msg-2-1',
        buyerHandle('Chloe Bennett', 12),
        'I moved recently — can you ship this to a new address instead of the one on file?',
        1,
        4,
        false
      ),
      demoMessage(
        'demo-msg-2-2',
        buyerHandle('Chloe Bennett', 12),
        'Let me know if you need the new zip code too.',
        0,
        5,
        false
      ),
    ],
  },
  {
    conversationId: 'demo-conv-3',
    type: EbayConversationType.FROM_MEMBERS,
    status: EbayConversationStatus.ARCHIVE,
    title: 'Thanks for the fast shipping',
    referenceId: null,
    otherPartyUsername: buyerHandle('Grace Okafor', 8),
    messages: [
      demoMessage(
        'demo-msg-3-1',
        buyerHandle('Grace Okafor', 8),
        'Item arrived a day early, thank you!',
        18,
        2,
        true
      ),
      demoMessage(
        'demo-msg-3-2',
        STORE_SELLER_USERNAME,
        'So glad it arrived safely — thanks for shopping with us!',
        18,
        3,
        true
      ),
      demoMessage(
        'demo-msg-3-3',
        buyerHandle('Grace Okafor', 8),
        'Will definitely buy from you again.',
        17,
        6,
        true
      ),
    ],
  },
  {
    conversationId: 'demo-conv-4',
    type: EbayConversationType.FROM_MEMBERS,
    status: EbayConversationStatus.ACTIVE,
    title: 'Battery life question',
    referenceId: EARBUDS_ITEM_ID,
    otherPartyUsername: buyerHandle('Marcus Lin', 3),
    messages: [
      demoMessage(
        'demo-msg-4-1',
        buyerHandle('Marcus Lin', 3),
        'Does the battery life hold up with noise cancelling on the whole time?',
        6,
        1,
        true
      ),
      demoMessage(
        'demo-msg-4-2',
        STORE_SELLER_USERNAME,
        'Yes — the 40-hour figure already includes the case, with ANC on throughout.',
        6,
        2,
        true
      ),
    ],
  },
  {
    conversationId: 'demo-conv-5',
    type: EbayConversationType.FROM_MEMBERS,
    status: EbayConversationStatus.ACTIVE,
    title: 'Is the cover machine washable?',
    referenceId: PILLOW_ITEM_ID,
    otherPartyUsername: buyerHandle('Sofia Bianchi', 21),
    messages: [
      demoMessage(
        'demo-msg-5-1',
        buyerHandle('Sofia Bianchi', 21),
        'Is the cover removable and machine washable?',
        9,
        1,
        true
      ),
      demoMessage(
        'demo-msg-5-2',
        STORE_SELLER_USERNAME,
        'Yes, the cover zips off and is machine washable on a cold, gentle cycle.',
        9,
        2,
        true
      ),
      demoMessage(
        'demo-msg-5-3',
        buyerHandle('Sofia Bianchi', 21),
        'Perfect, ordering one now.',
        9,
        3,
        true
      ),
    ],
  },
  {
    conversationId: 'demo-conv-6',
    type: EbayConversationType.FROM_MEMBERS,
    status: EbayConversationStatus.ACTIVE,
    title: 'Left you five stars',
    referenceId: null,
    otherPartyUsername: buyerHandle('Devon Marsh', 5),
    messages: [
      demoMessage(
        'demo-msg-6-1',
        buyerHandle('Devon Marsh', 5),
        'Exactly as described, fast delivery. Left five-star feedback.',
        13,
        4,
        true
      ),
      demoMessage(
        'demo-msg-6-2',
        STORE_SELLER_USERNAME,
        'Thank you so much for the kind words and the feedback!',
        13,
        5,
        true
      ),
    ],
  },
  {
    conversationId: 'demo-conv-7',
    type: EbayConversationType.FROM_EBAY,
    status: EbayConversationStatus.ACTIVE,
    title: 'Reminder: keep your business policies current',
    referenceId: null,
    otherPartyUsername: 'eBay',
    messages: [
      demoMessage(
        'demo-msg-7-1',
        'eBay',
        'We recommend reviewing your payment, shipping and return policies before the next peak season.',
        22,
        0,
        true
      ),
      demoMessage(
        'demo-msg-7-2',
        'eBay',
        'No action is required if your policies already reflect your current handling times.',
        22,
        1,
        true
      ),
    ],
  },
  {
    conversationId: 'demo-conv-8',
    type: EbayConversationType.FROM_EBAY,
    status: EbayConversationStatus.ACTIVE,
    title: 'Your listing template meets our picture policy',
    referenceId: null,
    otherPartyUsername: 'eBay',
    messages: [
      demoMessage(
        'demo-msg-8-1',
        'eBay',
        'A recent scan of your active listings found no picture policy issues.',
        29,
        0,
        true
      ),
    ],
  },
];

export const DEMO_CONVERSATIONS: EbayConversationDto[] = CONVERSATION_SEEDS.map((seed) => {
  const latestMessage = seed.messages[seed.messages.length - 1] ?? null;
  const unreadCount = seed.messages.filter(
    (message) => !message.read && message.senderUsername !== STORE_SELLER_USERNAME
  ).length;
  return {
    conversationId: seed.conversationId,
    type: seed.type,
    status: seed.status,
    title: seed.title,
    unreadCount,
    referenceType: seed.referenceId ? 'ITEM' : null,
    referenceId: seed.referenceId,
    createdAt: seed.messages[0]?.createdAt ?? isoDaysAgo(1),
    latestMessage,
    otherPartyUsername: seed.otherPartyUsername,
  } satisfies EbayConversationDto;
});

/** `GET .../conversations/:id` — the full thread, or `null` for an unknown id. */
export function demoThread(conversationId: string): EbayConversationThreadDto | null {
  const seed = CONVERSATION_SEEDS.find((s) => s.conversationId === conversationId);
  if (!seed) {
    return null;
  }
  return {
    conversationId: seed.conversationId,
    type: seed.type,
    status: seed.status,
    title: seed.title,
    messages: seed.messages,
    total: seed.messages.length,
    page: 1,
    limit: seed.messages.length,
  };
}

/** `GET /ebay/messages/unread-count` — the sidebar badge, summed from the fixtures above. */
export function buildDemoUnread(): EbayUnreadCountDto {
  const total = DEMO_CONVERSATIONS.reduce((sum, c) => sum + c.unreadCount, 0);
  return {
    total,
    byAccount: [
      { ebayAccountId: DEMO_EBAY_ACCOUNT_ID, unread: total },
      { ebayAccountId: DEMO_EBAY_ACCOUNT_ID_2, unread: 0 },
    ],
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
    trackingConversionProvider: TrackingConversionProvider.AQUILINE,
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
    DEMO_GROUP_NAMES.everyday,
    'Home and kitchen staples. Margin tapers as price climbs.',
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
    DEMO_GROUP_NAMES.mothersDay,
    'Seasonal campaign: gift-ready template, higher margin until mid-May.',
    [
      { min: 0, max: 100, pct: 30 },
      { min: 100, max: 500, pct: 22 },
    ],
    2,
    1,
    'demo-tpl-ds-beauty-health',
    { strip: true, aiTitle: true, aiDesc: true }
  ),
  group(
    'demo-group-3',
    DEMO_GROUP_NAMES.electronics,
    'Spec-heavy template, larger stock buffer for fast-moving tech.',
    [
      { min: 0, max: 150, pct: 16 },
      { min: 150, max: 1000, pct: 11 },
    ],
    4,
    3,
    'demo-tpl-ds-tech-gadgets',
    { strip: true, aiTitle: true, aiDesc: false }
  ),
  group(
    'demo-group-4',
    DEMO_GROUP_NAMES.automotive,
    'Car parts and accessories only: fitment-focused template.',
    [{ min: 0, max: 500, pct: 20 }],
    2,
    2,
    'demo-tpl-ds-auto-parts',
    { strip: true, aiTitle: false, aiDesc: false }
  ),
];

export const DEMO_PREDEFINED_TEMPLATES = [
  { slug: 'ds-general-store', name: 'General Store' },
  { slug: 'ds-minimalist', name: 'Minimalist' },
  { slug: 'ds-tech-gadgets', name: 'Tech Gadgets' },
  { slug: 'ds-home-decor', name: 'Home Decor' },
  { slug: 'ds-auto-parts', name: 'Auto Parts' },
  { slug: 'ds-apparel-fashion', name: 'Apparel Fashion' },
  { slug: 'ds-beauty-health', name: 'Beauty Health' },
  { slug: 'ds-pet-supplies', name: 'Pet Supplies' },
  { slug: 'ds-fitness-sports', name: 'Fitness Sports' },
  { slug: 'ds-outdoor-survival', name: 'Outdoor Survival' },
  { slug: 'ds-toys-kids', name: 'Toys Kids' },
  { slug: 'ds-kitchen-dining', name: 'Kitchen Dining' },
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
  'B0SJ2A7C4D', 'B0SJ5E1F8G', 'B0SJ9H3K2L', 'B0SJ4M6N1P',
  'B0SJ7Q2R5S', 'B0SJ1T8V3W', 'B0SJ6X4Y9Z', 'B0SJ3A5B7C',
  'B0SJ8D2E6F', 'B0SJ2G9H4K', 'B0SJ5L1M8N', 'B0SJ7P3Q2R',
];

/** Failures cycled through a demo job's failed items — includes the seller-fixable blacklist case. */
const JOB_FAILURE_ROTATION: readonly ListingFailureCode[] = [
  ListingFailureCode.ZERO_STOCK,
  ListingFailureCode.BLACKLISTED_KEYWORD,
  ListingFailureCode.INVALID_IDENTIFIER,
  ListingFailureCode.BLACKLISTED_KEYWORD,
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
      failureCode: failed ? JOB_FAILURE_ROTATION[i % JOB_FAILURE_ROTATION.length] : undefined,
      failureDetails: failed
        ? {
            correlationId: `req_demo-${jobId}-${i}`,
            ...(JOB_FAILURE_ROTATION[i % JOB_FAILURE_ROTATION.length] === ListingFailureCode.BLACKLISTED_KEYWORD
              ? { blacklistedKeyword: 'refurbished' }
              : {}),
          }
        : undefined,
    } satisfies ListingJobItemDto;
  });
}

/* ── Billing ──────────────────────────────────────────────────────────── */

const MICROS = 1_000_000;

/**
 * One demo catalog plan. Automatic orders are UNLIMITED on every plan (operator
 * decision 2026-09-29), so that limit is written as `BILLING_UNLIMITED` rather
 * than passed in; the Best Sellers browsing allowance (products viewable per
 * billing period) is the fourth metered dimension.
 */
function plan(
  slug: string,
  name: string,
  description: string,
  monthly: number,
  listings: number,
  conversions: number,
  bestSellers: number,
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
      [BillingLimitKey.BEST_SELLERS_PRODUCTS_PER_MONTH]: {
        id: `${id}-l4`, planId: id, limitKey: BillingLimitKey.BEST_SELLERS_PRODUCTS_PER_MONTH,
        limitValue: bestSellers, unit: 'products', createdAt: stamp, updatedAt: stamp,
      },
      [BillingLimitKey.AMAZON_ORDERS_PER_MONTH]: {
        id: `${id}-l2`, planId: id, limitKey: BillingLimitKey.AMAZON_ORDERS_PER_MONTH,
        limitValue: BILLING_UNLIMITED, unit: 'orders', createdAt: stamp, updatedAt: stamp,
      },
    },
  };
}

/*
 * Mirrors the real catalog (2026-09-29 prices): twelve monthly tiers, no
 * annual interval, unlimited automatic orders everywhere, and a Best Sellers
 * browsing allowance per tier. The demo once showed the retired three-plan
 * catalog at its old prices, so a visitor was quoted figures the product no
 * longer sells — keep this list aligned with the live catalog.
 *
 * Names and descriptions come from the `billing` i18n namespace at render time,
 * exactly as the live catalog's do, so the strings here are only fallbacks.
 */
export const DEMO_BILLING_PLANS: BillingPlanWithPricingDto[] = [
  plan('lite', 'Lite', 'For sellers just getting started with a small catalog.', 24.99, 200, 25, 1_500, 1),
  plan('nano', 'Nano', 'For testing the waters with a focused product set.', 29.99, 500, 50, 2_500, 2),
  plan('micro', 'Micro', 'For solo sellers running a compact catalog.', 34.99, 1000, 100, 5_000, 3),
  plan('starter', 'Starter', 'For sellers with a growing catalog and steady order flow.', 44.99, 2000, 150, 7_500, 4),
  plan('basic', 'Basic', 'For established sellers scaling past a few thousand listings.', 54.99, 3000, 200, 10_000, 5),
  plan('plus', 'Plus', 'For sellers running a broad catalog across multiple niches.', 64.99, 4000, 250, 12_500, 6),
  plan('growth', 'Growth', 'For high-volume sellers with a five-thousand-listing catalog.', 89.99, 5000, 300, 15_000, 7),
  plan('advanced', 'Advanced', 'For power sellers managing a large, actively repriced catalog.', 129.99, 7500, 350, 20_000, 8),
  plan('pro', 'Pro', 'For professional operations running ten thousand listings.', 164.99, 10000, 500, 25_000, 9),
  plan('elite', 'Elite', 'For large operations with a fifteen-thousand-listing catalog.', 229.99, 15000, 600, 35_000, 10),
  plan('business', 'Business', 'For multi-store businesses at twenty thousand listings.', 284.99, 20000, 700, 50_000, 11),
  plan('enterprise', 'Enterprise', 'For the largest catalogs, with priority support.', 339.99, 25000, 800, 75_000, 12),
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
        limitValueSnapshot: BILLING_UNLIMITED,
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
        limitKey: BillingLimitKey.BEST_SELLERS_PRODUCTS_PER_MONTH,
        used: DEMO_BEST_SELLERS_USED,
        creditValue: 0,
        limitValue: DEMO_BEST_SELLERS_LIMIT,
      },
      {
        limitKey: BillingLimitKey.AMAZON_ORDERS_PER_MONTH,
        used: 291,
        creditValue: 0,
        limitValue: BILLING_UNLIMITED,
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
