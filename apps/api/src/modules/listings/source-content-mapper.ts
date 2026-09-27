import {
  AMAZON_MARKETPLACE_CONFIG,
  ProductDataProviderKind,
  SourceStockStatus,
  type AmazonMarketplace,
  type ProductData,
  type ProductIdentifiers,
  type ScraperContent,
  type SourceCommerce,
} from '@repo/shared';

import { isValidGtin, normalizeGtin } from '../../common/utils/gtin';

import { asPartNumber, formatLengthFromMillimeters, formatWeightFromGrams } from './keepa-normalizer';

/**
 * Scraper spec keys (snake_case from the page's overview/details tables) →
 * the canonical names `extractProductAttributes` produces for Keepa, so the
 * ONE aspect matcher (synonyms, learned defaults, priors) sees the same names
 * whichever provider filled the row. Unknown keys are Title-Cased and still
 * reach eBay as custom item specifics.
 */
const CANONICAL: Record<string, string> = {
  brand: 'Brand', brand_name: 'Brand', manufacturer: 'Manufacturer', color: 'Color', colour: 'Color',
  size: 'Size', material: 'Material', material_type: 'Material', material_type_free: 'Material', style: 'Style', pattern: 'Pattern',
  scent: 'Scent', item_form: 'Item Form', item_weight: 'Item Weight', item_length: 'Item Length',
  item_width: 'Item Width', item_height: 'Item Height', number_of_items: 'Number of Items',
  number_of_pieces: 'Number of Items', unit_count: 'Unit Quantity', package_quantity: 'Package Quantity',
  included_components: 'Included Components', age_range: 'Age Range', age_range_description: 'Age Range',
  department: 'Department', item_type_name: 'Type', special_feature: 'Features', special_features: 'Features',
  recommended_uses_for_product: 'Recommended Uses', specific_uses_for_product: 'Specific Uses',
  ingredients: 'Ingredients', active_ingredients: 'Active Ingredients', safety_warning: 'Safety Warning',
  product_benefits: 'Product Benefit', item_highlight: 'Highlights', batteries_included: 'Batteries Included',
  batteries_required: 'Batteries Required', language: 'Language', format: 'Format', edition: 'Edition',
  author: 'Author', number_of_pages: 'Number of Pages',
};

/** Page noise, and fields that belong in `identifiers` rather than specs. */
const DROP = new Set([
  'asin', 'customer_reviews', 'best_sellers_rank', 'date_first_available', 'is_discontinued_by_manufacturer',
  'upc', 'ean', 'gtin', 'isbn', 'global_trade_identification_number', 'manufacturer_part_number',
  'model_number', 'part_number', 'item_model_number',
]);

function titleCase(key: string): string {
  return key.split('_').filter(Boolean).map((w) => w.charAt(0).toUpperCase() + w.slice(1)).join(' ');
}

export function translateScraperSpecs(raw: Record<string, string>): Record<string, string> {
  const out: Record<string, string> = {};
  for (const [key, value] of Object.entries(raw ?? {})) {
    const k = key.trim().toLowerCase();
    const v = typeof value === 'string' ? value.trim() : '';
    if (!v || DROP.has(k)) {
      continue;
    }
    const name = CANONICAL[k] ?? titleCase(k);
    if (!out[name]) {
      out[name] = v;
    }
  }
  return out;
}

const MM_PER_UNIT: Record<string, number> = { in: 25.4, inch: 25.4, inches: 25.4, '"': 25.4, cm: 10, mm: 1, m: 1000, ft: 304.8, feet: 304.8 };
const G_PER_UNIT: Record<string, number> = {
  g: 1, gram: 1, grams: 1, kg: 1000, kilogram: 1000, kilograms: 1000,
  oz: 28.349523125, ounce: 28.349523125, ounces: 28.349523125,
  lb: 453.59237, lbs: 453.59237, pound: 453.59237, pounds: 453.59237,
};

export interface ParsedDimensions {
  length?: string;
  width?: string;
  height?: string;
  weight?: string;
}

/** `'2.88 ounces'` / `'680 g'` / `'1.72 pounds'` → Keepa's own `oz`/`lbs` string, or undefined. */
export function parseWeightCell(value: string | undefined): string | undefined {
  const m = /(\d+(?:\.\d+)?)\s*([a-z]+)/i.exec(value ?? '');
  const perUnit = m ? G_PER_UNIT[m[2].toLowerCase()] : undefined;
  return perUnit ? formatWeightFromGrams(Number(m![1]) * perUnit) : undefined;
}

/**
 * Amazon's one-cell dimension formats → the per-axis attributes Keepa emits
 * (`Item Length`/`Item Width`/`Item Height`, and `Item Weight` when the cell
 * carries one after a `;`):
 *   `5.91 x 5.91 x 11.81 inches`, `8.43 x 5.04 x 4.92 inches; 1.72 pounds`,
 *   `13"L x 3"W`, `10 x 20 cm`. Order is L × W × H, as Amazon renders it.
 * provider:compare 2026-09-27: Item Length/Width/Height were the most frequent
 * Keepa-only specs (7 of 7 sampled products) — the page had them, in one string.
 */
export function parseDimensionsCell(value: string | undefined): ParsedDimensions {
  const out: ParsedDimensions = {};
  const [dims, weightPart] = (value ?? '').split(';');
  const nums = [...dims.matchAll(/(\d+(?:\.\d+)?)\s*(?:"|in\b|inches|inch|cm\b|mm\b|ft\b|feet|m\b)?\s*([LWHDlwhd])?/g)]
    .map((m) => ({ n: Number(m[1]), axis: m[2]?.toUpperCase() }))
    .filter((m) => Number.isFinite(m.n));
  const unitMatch = /(inches|inch|in\b|cm\b|mm\b|ft\b|feet|"|\bm\b)/i.exec(dims);
  const mmPerUnit = unitMatch ? MM_PER_UNIT[unitMatch[1].toLowerCase()] : undefined;
  if (mmPerUnit && nums.length >= 2 && nums.length <= 3) {
    const byAxis: Record<string, number> = {};
    nums.forEach((m, i) => {
      byAxis[m.axis ?? ['L', 'W', 'H'][i]] = m.n;
    });
    if (byAxis.L !== undefined) {out.length = formatLengthFromMillimeters(byAxis.L * mmPerUnit);}
    if (byAxis.W !== undefined) {out.width = formatLengthFromMillimeters(byAxis.W * mmPerUnit);}
    if (byAxis.H !== undefined) {out.height = formatLengthFromMillimeters(byAxis.H * mmPerUnit);}
    if (byAxis.D !== undefined && out.height === undefined) {out.height = formatLengthFromMillimeters(byAxis.D * mmPerUnit);}
  }
  const weight = parseWeightCell(weightPart);
  if (weight) {
    out.weight = weight;
  }
  return out;
}

/**
 * The full spec table for a scraped product, shaped like `extractProductAttributes`
 * shapes Keepa's, so the aspect ladder sees one vocabulary. On top of the page's
 * own overview/details rows it adds what the page shows elsewhere and Keepa
 * carries as structured fields: brand/manufacturer, Model/MPN (the validated
 * identifiers), the twister selection (Color/Size/Scent…), and per-axis
 * dimensions parsed from the one-cell `Item Dimensions`/`Product Dimensions`.
 * Existing rows always win; nothing here overwrites what the page said.
 */
export function buildScraperSpecs(content: ScraperContent, identifiers: ProductIdentifiers): Record<string, string> {
  const specs = translateScraperSpecs(content.specs ?? {});
  const put = (name: string, value: string | null | undefined): void => {
    const v = (value ?? '').trim();
    if (v && !specs[name]) {
      specs[name] = v;
    }
  };
  put('Brand', content.brand);
  put('Manufacturer', content.manufacturer ?? content.brand);
  put('Model', identifiers.model);
  put('MPN', identifiers.mpn ?? identifiers.model);
  for (const [key, value] of Object.entries(content.variationAttributes ?? {})) {
    const k = key.trim().toLowerCase().replace(/\s+/g, '_');
    put(CANONICAL[k] ?? titleCase(k), value);
  }
  const dims = parseDimensionsCell(specs['Item Dimensions'] ?? specs['Product Dimensions']);
  put('Item Length', dims.length);
  put('Item Width', dims.width);
  put('Item Height', dims.height);
  const weight = parseWeightCell(specs['Item Weight']) ?? dims.weight ?? parseDimensionsCell(specs['Package Dimensions']).weight;
  if (weight) {
    // Normalise the page's own "2.88 ounces" to Keepa's "2.9 oz" as well, so
    // one product does not carry two spellings across a provider switch.
    specs['Item Weight'] = weight;
  }
  return specs;
}

/**
 * First check-digit-valid GTIN in a cell. Amazon lists several barcodes in one
 * cell ("071924213920 071924414518", "00071924213920, 00071924414518"); read
 * whole, the cell fails validation and a real barcode is lost.
 */
function firstValidGtin(value: string | undefined, length?: number): string | undefined {
  for (const token of (value ?? '').split(/[\s,;]+/)) {
    const gtin = normalizeGtin(token);
    if (gtin && (length === undefined || gtin.length === length)) {
      return gtin;
    }
  }
  return undefined;
}

export function mapScraperIdentifiers(raw: Record<string, string>, brand: string | null): ProductIdentifiers {
  const ids: ProductIdentifiers = {};
  const upc = firstValidGtin(raw.upc, 12);
  if (upc && isValidGtin(upc) && upc.length === 12) {
    ids.upc = upc;
  }
  const gtin = firstValidGtin(raw.gtin ?? raw.ean);
  if (gtin && isValidGtin(gtin)) {
    if (gtin.length === 13) {
      ids.ean = gtin;
    } else if (gtin.length === 14 && !ids.upc) {
      ids.gtin = gtin;
    }
  }
  const mpn = asPartNumber(raw.part_number ?? raw.manufacturer_part_number ?? null, brand);
  if (mpn) {
    ids.mpn = mpn;
  }
  const model = asPartNumber(raw.model_number ?? null, brand);
  if (model) {
    ids.model = model;
  }
  return ids;
}

export function mapScraperProduct(
  asin: string,
  content: ScraperContent,
  commerce: SourceCommerce,
  marketplace: AmazonMarketplace,
): ProductData {
  const categories = (content.categories ?? []).map((c) => c.trim()).filter(Boolean);
  // Create path only: a brand-new product has no previous value to preserve,
  // so UNKNOWN is stored as out-of-stock 0 (the worker refuses to publish at
  // quantity 0). Same rule Keepa's create path applies.
  const unknown = commerce.stockStatus === SourceStockStatus.UNKNOWN;
  const identifiers = mapScraperIdentifiers(content.identifiers ?? {}, content.brand);
  return {
    asin,
    title: content.title?.trim() || 'Unknown Product',
    description: content.description?.trim() || '',
    imageUrls: content.images ?? [],
    brand: content.brand?.trim() || 'Unknown',
    manufacturer: content.manufacturer?.trim() || content.brand?.trim() || 'Unknown',
    category: categories[categories.length - 1],
    categoryPath: categories.length > 0 ? categories.join(' > ') : undefined,
    features: content.bullets ?? [],
    specs: buildScraperSpecs(content, identifiers),
    identifiers,
    price: { current: commerce.price ?? 0, currency: AMAZON_MARKETPLACE_CONFIG[marketplace].currency },
    stock: unknown ? 0 : (commerce.stock ?? 0),
    stockStatus: unknown ? SourceStockStatus.OUT_OF_STOCK : commerce.stockStatus,
    maxOrderQuantity: commerce.maxOrderQuantity,
    sourceRemoved: commerce.removed,
    raw: { provider: ProductDataProviderKind.SCRAPER, content, commerce } as unknown as Record<string, unknown>,
  };
}
