import { EBAY_ASPECT_VALUE_MAX_LENGTH, KeepaStockStatus, type ProductIdentifiers } from '@repo/shared';

import { isValidGtin, normalizeGtin } from '../../common/utils/gtin';

/**
 * Pure normalization helpers for raw Keepa /product responses.
 *
 * Ground truth (verified against live Keepa responses, 2026-07-28):
 * - Keepa price fields use integer cents; sentinels are negative:
 *   `-1` = no data, `-2` = no Buy Box / suppressed. Neither is a real price.
 * - `images` is now an array of `{ l, m, ... }` filename objects; the legacy
 *   `imagesCSV` string can be null on the same product. Both must be supported.
 * - With `offers=N&stock=1`, each live offer may carry `stockCSV`
 *   (`[keepaTime, qty, keepaTime, qty, ...]` — last pair = latest observation).
 * - `liveOffersOrder` lists indices into `offers` ranked like Amazon's offer
 *   page; null when Keepa has no live-offer data.
 * - `stats.buyBoxSellerId === 'ATVPDKIKX0DER'` means Amazon itself holds the
 *   Buy Box. `stats.stockBuyBox` / `stats.stockAmazon` cap at 1000 (Amazon
 *   reports "≥1000" as 1000).
 * - `offersSuccessful` (boolean) reports whether the live offer retrieval
 *   succeeded; when false/absent the offer-derived data may be stale.
 * - `tokensConsumed` is conditional (0 when offers were cached <1h, 6/page
 *   when refreshed, +2 for fresh stock) — accounting must always use the
 *   reported value, never a per-ASIN estimate.
 */

export const AMAZON_SELLER_ID = 'ATVPDKIKX0DER';

/** Keepa csv/current indices actually consumed by Zonds. */
export enum KeepaCsvIndex {
  AMAZON = 0,
  NEW = 1,
  BUY_BOX_SHIPPING = 18,
}

export interface KeepaRawOffer {
  sellerId?: string;
  isPrime?: boolean;
  isFBA?: boolean;
  isAmazon?: boolean;
  condition?: number;
  lastSeen?: number;
  /** [keepaTime, qty, keepaTime, qty, ...] */
  stockCSV?: number[];
  offerCSV?: number[];
}

export interface KeepaRawImage {
  l?: string;
  m?: string;
}

export interface KeepaRawVariationAttribute {
  dimension?: string;
  value?: string;
}

export interface KeepaRawVariation {
  asin?: string;
  attributes?: KeepaRawVariationAttribute[];
}

/** Keepa's `unitCount` object (NOT a plain number). */
export interface KeepaRawUnitCount {
  unitValue?: number;
  unitType?: string;
  eachUnitCount?: number;
}

export interface KeepaRawHazardousMaterial {
  aspect?: string;
  value?: string;
}

/**
 * Field names mirror the official Keepa product schema
 * (keepacom/api_backend Product.java). Fields that do NOT exist there must not
 * be added: an earlier version read `flavor`, `department`, `genre`, `platform`
 * and `variationAttributes`, none of which Keepa ever sends, while ignoring
 * ~15 attributes it does — which is why published listings carried a handful of
 * item specifics where competitors carry thirty.
 */
export interface KeepaRawProduct {
  asin?: string;
  title?: string;
  description?: string;
  shortDescription?: string;
  itemHighlights?: string;
  brand?: string;
  manufacturer?: string;
  model?: string;
  /** Manufacturer part number. */
  partNumber?: string;
  type?: string;
  color?: string;
  size?: string;
  pattern?: string;
  style?: string;
  scent?: string;
  itemForm?: string;
  itemTypeKeyword?: string;
  targetAudienceKeyword?: string;
  audienceRating?: string;
  /** Keepa: `materials` is the array; the singular `material` is deprecated. */
  materials?: string[];
  includedComponents?: string;
  recommendedUsesForProduct?: string;
  specificUsesForProduct?: string[];
  specialFeatures?: string[];
  ingredients?: string;
  activeIngredients?: string;
  specialIngredients?: string;
  safetyWarning?: string;
  productBenefit?: string;
  batteriesRequired?: boolean | null;
  batteriesIncluded?: boolean | null;
  edition?: string;
  format?: string;
  binding?: string;
  productGroup?: string;
  /** Keepa numeric attributes use -1 (or 0) for "unknown". */
  numberOfItems?: number;
  packageQuantity?: number;
  numberOfPages?: number;
  publicationDate?: number;
  releaseDate?: number;
  /** Millimetres. */
  itemLength?: number;
  itemWidth?: number;
  itemHeight?: number;
  packageLength?: number;
  packageWidth?: number;
  packageHeight?: number;
  /** Grams. */
  itemWeight?: number;
  packageWeight?: number;
  unitCount?: KeepaRawUnitCount;
  eanList?: string[];
  upcList?: string[];
  gtinList?: string[];
  variations?: KeepaRawVariation[];
  hazardousMaterials?: KeepaRawHazardousMaterial[];
  /** [["English", "type", "audio"], ...] */
  languages?: string[][];
  /** [["Name", "role"], ...] */
  contributors?: string[][];
  categoryTree?: Array<{ name: string }>;
  imagesCSV?: string | null;
  images?: KeepaRawImage[];
  features?: string[];
  offers?: KeepaRawOffer[];
  liveOffersOrder?: number[] | null;
  offersSuccessful?: boolean;
  lastStockUpdate?: number;
  stats?: {
    buyBoxPrice?: number;
    buyBoxShipping?: number;
    buyBoxSellerId?: string;
    buyBoxIsAmazon?: boolean | null;
    stockBuyBox?: number;
    stockAmazon?: number;
    totalOfferCount?: number;
    avg30?: number[];
    avg90?: number[];
    current?: number[];
  };
}

export interface NormalizedCommerce {
  /** USD incl. shipping; null = no usable price observation. */
  price: number | null;
  /** Observed Buy Box quantity; null iff stockStatus === UNKNOWN. */
  stock: number | null;
  stockStatus: KeepaStockStatus;
  sellerId?: string;
  buyBoxIsAmazon?: boolean;
}

/** A Keepa cent value is usable only when strictly positive (sentinels are <0). */
function usableCents(value: number | undefined): number | null {
  return typeof value === 'number' && value > 0 ? value : null;
}

/** Latest quantity from a stockCSV [time, qty, ...] pair list. */
export function latestStockFromCsv(stockCSV: number[] | undefined): number | null {
  if (!Array.isArray(stockCSV) || stockCSV.length < 2 || stockCSV.length % 2 !== 0) {
    return null;
  }
  const qty = stockCSV[stockCSV.length - 1];
  return typeof qty === 'number' && qty >= 0 ? qty : null;
}

/** Live offers resolved via liveOffersOrder (falls back to all offers). */
export function liveOffers(product: KeepaRawProduct): KeepaRawOffer[] {
  const offers = product.offers ?? [];
  const order = product.liveOffersOrder;
  if (!Array.isArray(order)) {
    return offers;
  }
  return order.map((i) => offers[i]).filter((o): o is KeepaRawOffer => Boolean(o));
}

/**
 * Extract the Buy Box price + Buy Box seller stock from a raw Keepa product.
 *
 * Stock policy (agreed contract — unknown must never be collapsed to 0):
 * 1. Buy Box offer matched by sellerId with a stockCSV observation → KNOWN.
 * 2. stats.stockBuyBox / stats.stockAmazon (when Amazon holds the Buy Box)
 *    present → KNOWN.
 * 3. Live-offer retrieval succeeded and there is no live offer and no Buy Box
 *    price → OUT_OF_STOCK (0).
 * 4. Anything else → UNKNOWN (null); the caller preserves the previous value.
 */
export function extractCommerce(product: KeepaRawProduct): NormalizedCommerce {
  const stats = product.stats ?? {};

  // --- price ---
  let price: number | null = null;
  const sellerId =
    typeof stats.buyBoxSellerId === 'string' && stats.buyBoxSellerId.length > 0 ? stats.buyBoxSellerId : undefined;
  const buyBoxCents = usableCents(stats.buyBoxPrice);
  if (buyBoxCents !== null) {
    const shipping = usableCents(stats.buyBoxShipping) ?? 0;
    price = (buyBoxCents + shipping) / 100;
  } else {
    const fallback =
      usableCents(stats.current?.[KeepaCsvIndex.BUY_BOX_SHIPPING]) ??
      usableCents(stats.current?.[KeepaCsvIndex.NEW]) ??
      usableCents(stats.current?.[KeepaCsvIndex.AMAZON]);
    price = fallback !== null ? fallback / 100 : null;
  }

  const buyBoxIsAmazon = stats.buyBoxIsAmazon === true || sellerId === AMAZON_SELLER_ID || undefined;

  // --- stock ---
  const live = liveOffers(product);

  // 1. Buy Box offer's own stock observation.
  if (sellerId) {
    const buyBoxOffer = live.find((o) => o.sellerId === sellerId);
    const observed = latestStockFromCsv(buyBoxOffer?.stockCSV);
    if (observed !== null) {
      return { price, stock: observed, stockStatus: KeepaStockStatus.KNOWN, sellerId, buyBoxIsAmazon };
    }
  }

  // 2. Stats-level stock (populated by Keepa's stock collection).
  if (typeof stats.stockBuyBox === 'number' && stats.stockBuyBox >= 0) {
    return { price, stock: stats.stockBuyBox, stockStatus: KeepaStockStatus.KNOWN, sellerId, buyBoxIsAmazon };
  }
  if (buyBoxIsAmazon && typeof stats.stockAmazon === 'number' && stats.stockAmazon >= 0) {
    return { price, stock: stats.stockAmazon, stockStatus: KeepaStockStatus.KNOWN, sellerId, buyBoxIsAmazon };
  }

  // 3. Confirmed no live offer at all → genuinely out of stock.
  const offerRetrievalSucceeded = product.offersSuccessful === true || Array.isArray(product.liveOffersOrder);
  if (offerRetrievalSucceeded && live.length === 0 && price === null) {
    return { price, stock: 0, stockStatus: KeepaStockStatus.OUT_OF_STOCK, sellerId, buyBoxIsAmazon };
  }

  // 4. Unknown — never a fabricated zero.
  return { price, stock: null, stockStatus: KeepaStockStatus.UNKNOWN, sellerId, buyBoxIsAmazon };
}

/**
 * Image URLs from either the modern `images` array (preferred, large size) or
 * the legacy `imagesCSV` string — live responses can carry either.
 */
export function extractImageUrls(product: KeepaRawProduct): string[] {
  if (Array.isArray(product.images) && product.images.length > 0) {
    return product.images
      .map((img) => img.l || img.m)
      .filter((name): name is string => Boolean(name))
      .map((name) => `https://images-na.ssl-images-amazon.com/images/I/${name}`);
  }
  if (product.imagesCSV) {
    return product.imagesCSV.split(',').map((img) => `https://images-na.ssl-images-amazon.com/images/I/${img}`);
  }
  return [];
}

/**
 * Product attributes usable as eBay item specifics.
 *
 * `specs` is a display/aspect-ready `Name: Value` map; `identifiers` carries
 * the catalog identifiers eBay matches on. Before this existed the create path
 * mapped only Brand/Manufacturer/Model, which is why published listings showed
 * three item specifics and a literal "Unknown".
 */
export interface NormalizedProductAttributes {
  specs: Record<string, string>;
  identifiers: ProductIdentifiers;
}

/** Keepa uses -1 for "attribute unknown" on numeric fields. */
function usableNumber(value: number | undefined): number | null {
  return typeof value === 'number' && Number.isFinite(value) && value > 0 ? value : null;
}

function cleanText(value: string | undefined | null): string | null {
  if (typeof value !== 'string') {
    return null;
  }
  const trimmed = value.replace(/\s+/g, ' ').trim();
  if (trimmed.length === 0) {
    return null;
  }
  // Amazon/Keepa fill unknown text attributes with these placeholders.
  if (/^(unknown|n\/?a|null|none|-)$/i.test(trimmed)) {
    return null;
  }
  return trimmed.slice(0, EBAY_ASPECT_VALUE_MAX_LENGTH);
}

/**
 * A manufacturer part number that is not actually a barcode.
 *
 * Amazon fills `partNumber` with the product's UPC for a large share of grocery
 * and consumables ASINs. eBay rejects the publish outright for those —
 * "MPN has an invalid value of 021500000529 ... or you can leave the MPN field
 * blank" — because an MPN must not be a GTIN. Returning null means the listing
 * simply carries no MPN, which eBay explicitly allows.
 */
export function asPartNumber(
  value: string | undefined | null,
  brand?: string | null
): string | null {
  const clean = cleanText(value ?? null);
  if (!clean || isValidGtin(clean)) {
    return null;
  }
  // eBay also rejects an MPN that merely repeats the brand
  // ("MPN has an invalid value of \"BolaButty\""). Amazon fills partNumber with
  // the brand name for a lot of private-label listings.
  const brandText = cleanText(brand ?? null);
  if (brandText && clean.toLowerCase() === brandText.toLowerCase()) {
    return null;
  }
  return clean;
}

/** Grams → a US-marketplace-readable weight string. */
export function formatWeightFromGrams(grams: number): string {
  const ounces = grams / 28.349523125;
  if (ounces < 16) {
    return `${Math.round(ounces * 10) / 10} oz`;
  }
  return `${Math.round((ounces / 16) * 100) / 100} lbs`;
}

/** Millimetres → inches, one decimal. */
export function formatLengthFromMillimeters(mm: number): string {
  return `${Math.round((mm / 25.4) * 10) / 10} in`;
}

/**
 * Build item-specific-ready attributes from a raw Keepa product.
 *
 * Pure and total: any field Keepa omits (or fills with a sentinel) is simply
 * absent from the result — a missing attribute must never become a fabricated
 * "Unknown", which is buyer-visible noise on the live listing.
 */
export function extractProductAttributes(product: KeepaRawProduct): NormalizedProductAttributes {
  const specs: Record<string, string> = {};

  const put = (name: string, value: string | null | undefined): void => {
    const clean = cleanText(value ?? null);
    if (clean && !specs[name]) {
      specs[name] = clean;
    }
  };
  const putNumber = (name: string, value: number | undefined): void => {
    const usable = usableNumber(value);
    if (usable !== null) {
      put(name, String(usable));
    }
  };
  const putList = (name: string, values: string[] | undefined): void => {
    const joined = (values ?? [])
      .map((value) => cleanText(value))
      .filter((value): value is string => Boolean(value))
      .join(', ');
    put(name, joined);
  };
  const putBoolean = (name: string, value: boolean | null | undefined): void => {
    if (typeof value === 'boolean') {
      put(name, value ? 'Yes' : 'No');
    }
  };

  // --- identity ---
  put('Brand', product.brand);
  put('Manufacturer', product.manufacturer ?? product.brand);
  const brandForMpn = product.brand ?? product.manufacturer;
  put('Model', asPartNumber(product.model, brandForMpn));
  put('MPN', asPartNumber(product.partNumber, brandForMpn) ?? asPartNumber(product.model, brandForMpn));

  // --- descriptive attributes (the bulk of a rich item-specifics table) ---
  put('Color', product.color);
  put('Size', product.size);
  put('Pattern', product.pattern);
  put('Style', product.style);
  put('Scent', product.scent);
  put('Item Form', product.itemForm);
  put('Type', product.itemTypeKeyword ?? product.type ?? product.productGroup);
  put('Department', product.targetAudienceKeyword);
  put('Age Range', product.audienceRating);
  putList('Material', product.materials);
  put('Included Components', product.includedComponents);
  put('Recommended Uses', product.recommendedUsesForProduct);
  putList('Specific Uses', product.specificUsesForProduct);
  putList('Features', product.specialFeatures);
  put('Ingredients', product.ingredients);
  put('Active Ingredients', product.activeIngredients);
  put('Special Ingredients', product.specialIngredients);
  put('Product Benefit', product.productBenefit);
  put('Safety Warning', product.safetyWarning);
  put('Highlights', product.itemHighlights);
  putBoolean('Batteries Required', product.batteriesRequired);
  putBoolean('Batteries Included', product.batteriesIncluded);

  // --- media / publishing ---
  put('Edition', product.edition);
  put('Format', product.format ?? product.binding);
  putNumber('Number of Pages', product.numberOfPages);
  const language = product.languages?.find((entry) => Array.isArray(entry) && cleanText(entry[0]));
  if (language) {
    put('Language', language[0]);
  }
  const contributor = product.contributors?.find((entry) => Array.isArray(entry) && cleanText(entry[0]));
  if (contributor) {
    put('Author', contributor[0]);
  }

  // --- variation dimensions Amazon defines for THIS asin ---
  const variation = product.variations?.find((entry) => entry.asin && entry.asin === product.asin);
  for (const attribute of variation?.attributes ?? []) {
    const dimension = cleanText(attribute.dimension);
    const value = cleanText(attribute.value);
    if (dimension && value) {
      put(dimension, value);
    }
  }

  // --- hazard flags carry their own aspect names ---
  for (const hazard of product.hazardousMaterials ?? []) {
    const aspect = cleanText(hazard.aspect);
    const value = cleanText(hazard.value);
    if (aspect && value) {
      put(aspect, value);
    }
  }

  // --- counts ---
  putNumber('Number of Items', product.numberOfItems);
  putNumber('Package Quantity', product.packageQuantity);
  const unitValue = usableNumber(product.unitCount?.unitValue);
  if (unitValue !== null) {
    const unitType = cleanText(product.unitCount?.unitType);
    put('Unit Quantity', unitType ? `${unitValue} ${unitType}` : String(unitValue));
  }
  put('Unit Type', product.unitCount?.unitType);

  // --- measurements (Keepa is metric; US buyers read imperial) ---
  const itemWeight = usableNumber(product.itemWeight) ?? usableNumber(product.packageWeight);
  if (itemWeight !== null) {
    put('Item Weight', formatWeightFromGrams(itemWeight));
  }
  const length = usableNumber(product.itemLength) ?? usableNumber(product.packageLength);
  const width = usableNumber(product.itemWidth) ?? usableNumber(product.packageWidth);
  const height = usableNumber(product.itemHeight) ?? usableNumber(product.packageHeight);
  if (length !== null) {
    put('Item Length', formatLengthFromMillimeters(length));
  }
  if (width !== null) {
    put('Item Width', formatLengthFromMillimeters(width));
  }
  if (height !== null) {
    put('Item Height', formatLengthFromMillimeters(height));
  }

  // --- identifiers ---
  // Only check-digit-valid GTINs are kept: eBay rejects the whole publish on a
  // malformed product.upc/ean, and Amazon data carries plenty of junk codes.
  const upc = (product.upcList ?? []).map(normalizeGtin).find((value): value is string => Boolean(value));
  const ean = (product.eanList ?? []).map(normalizeGtin).find((value): value is string => Boolean(value));
  const gtin = (product.gtinList ?? []).map(normalizeGtin).find((value): value is string => Boolean(value));

  const identifiers: ProductIdentifiers = {};
  if (upc) {
    identifiers.upc = upc;
  }
  if (ean) {
    identifiers.ean = ean;
  }
  if (gtin && gtin !== upc && gtin !== ean) {
    identifiers.gtin = gtin;
  }
  // A barcode is never a part number - see asPartNumber.
  const mpn = asPartNumber(product.partNumber, brandForMpn) ?? asPartNumber(product.model, brandForMpn);
  if (mpn) {
    identifiers.mpn = mpn;
  }
  const model = asPartNumber(product.model, brandForMpn);
  if (model) {
    identifiers.model = model;
  }

  return { specs, identifiers };
}

/** Deduplicate ASINs preserving order (Keepa charges per requested product). */
export function dedupeAsins(asins: string[]): string[] {
  return [...new Set(asins.map((a) => a.trim()).filter((a) => a.length > 0))];
}

/** Split into Keepa's 100-ASIN-per-request chunks. */
export function chunkAsins(asins: string[], chunkSize = 100): string[][] {
  const chunks: string[][] = [];
  for (let i = 0; i < asins.length; i += chunkSize) {
    chunks.push(asins.slice(i, i + chunkSize));
  }
  return chunks;
}
