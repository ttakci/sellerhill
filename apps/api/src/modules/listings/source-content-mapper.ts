import {
  AMAZON_MARKETPLACE_CONFIG,
  SourceStockStatus,
  type AmazonMarketplace,
  type ProductData,
  type ProductIdentifiers,
  type ScraperContent,
  type SourceCommerce,
} from '@repo/shared';

import { isValidGtin, normalizeGtin } from '../../common/utils/gtin';

import { asPartNumber } from './keepa-normalizer';

/**
 * Scraper spec keys (snake_case from the page's overview/details tables) →
 * the canonical names `extractProductAttributes` produces for Keepa, so the
 * ONE aspect matcher (synonyms, learned defaults, priors) sees the same names
 * whichever provider filled the row. Unknown keys are Title-Cased and still
 * reach eBay as custom item specifics.
 */
const CANONICAL: Record<string, string> = {
  brand: 'Brand', brand_name: 'Brand', manufacturer: 'Manufacturer', color: 'Color', colour: 'Color',
  size: 'Size', material: 'Material', material_type: 'Material', style: 'Style', pattern: 'Pattern',
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

export function mapScraperIdentifiers(raw: Record<string, string>, brand: string | null): ProductIdentifiers {
  const ids: ProductIdentifiers = {};
  const upc = normalizeGtin(raw.upc);
  if (upc && isValidGtin(upc) && upc.length === 12) {
    ids.upc = upc;
  }
  const gtin = normalizeGtin(raw.gtin ?? raw.ean);
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
    specs: translateScraperSpecs(content.specs ?? {}),
    identifiers: mapScraperIdentifiers(content.identifiers ?? {}, content.brand),
    price: { current: commerce.price ?? 0, currency: AMAZON_MARKETPLACE_CONFIG[marketplace].currency },
    stock: unknown ? 0 : (commerce.stock ?? 0),
    stockStatus: unknown ? SourceStockStatus.OUT_OF_STOCK : commerce.stockStatus,
    maxOrderQuantity: commerce.maxOrderQuantity,
    sourceRemoved: commerce.removed,
    raw: { provider: 'scraper', content, commerce } as unknown as Record<string, unknown>,
  };
}
