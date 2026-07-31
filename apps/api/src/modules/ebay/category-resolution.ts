import { createHash } from 'crypto';

/**
 * Pure helpers for resolving an eBay leaf category.
 *
 * The category decides which item specifics are required, so a wrong or
 * unusable category is the root of most publish failures. It used to fall back
 * to `'1'` — eBay's ROOT category — which is not listable, so the real failure
 * surfaced several calls later with a message that never mentioned categories.
 */

/** How a stored category mapping was keyed. */
export enum CategoryMapScope {
  /** Exact product — the strongest signal, learned after a successful publish. */
  ASIN = 'asin',
  /** Amazon category path — generalizes across a whole niche. */
  AMAZON_CATEGORY = 'amazon_category',
  /** Hash of the taxonomy search query — plain cache. */
  QUERY = 'query',
}

export enum CategoryMapSource {
  TAXONOMY = 'taxonomy',
  CURATED = 'curated',
}

export interface CategoryMapRow {
  scope: CategoryMapScope;
  scopeKey: string;
  categoryId: string;
  categoryName: string;
  source: CategoryMapSource;
  isLocked: boolean;
}

/**
 * eBay's taxonomy matcher keys off brand + product words. The Amazon category
 * is appended because it disambiguates generic titles ("Replacement Cord Set"
 * lands very differently under Patio Furniture than under Jukebox Parts).
 */
export function buildCategoryQuery(input: {
  brand?: string | null;
  title: string;
  amazonCategory?: string | null;
}): string {
  return [input.brand, input.title, input.amazonCategory]
    .filter((part): part is string => Boolean(part && part.trim().length > 0))
    .join(' ')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 350);
}

/** Stable key for the query cache (queries are long and contain punctuation). */
export function categoryQueryHash(query: string): string {
  return createHash('sha256').update(query.toLowerCase()).digest('hex').slice(0, 40);
}

/**
 * A category id we are willing to list into.
 * Rejects empty values, non-numeric ids and eBay's root category `1`.
 */
export function isUsableLeafCategoryId(categoryId: string | undefined | null): boolean {
  return typeof categoryId === 'string' && /^[0-9]+$/.test(categoryId) && categoryId !== '1';
}

/**
 * Pick the mapping to trust.
 *
 * Precedence: an operator's locked pin always wins; then the most specific
 * scope (ASIN → Amazon category → query). A curated row outranks a cached
 * taxonomy answer at the same scope, because it exists precisely because the
 * taxonomy answer was wrong.
 */
export function pickCategoryFromRows(rows: CategoryMapRow[]): CategoryMapRow | null {
  const usable = rows.filter((row) => isUsableLeafCategoryId(row.categoryId));
  if (usable.length === 0) {
    return null;
  }

  const scopeRank: Record<CategoryMapScope, number> = {
    [CategoryMapScope.ASIN]: 0,
    [CategoryMapScope.AMAZON_CATEGORY]: 1,
    [CategoryMapScope.QUERY]: 2,
  };

  return [...usable].sort((a, b) => {
    if (a.isLocked !== b.isLocked) {
      return a.isLocked ? -1 : 1;
    }
    if (scopeRank[a.scope] !== scopeRank[b.scope]) {
      return scopeRank[a.scope] - scopeRank[b.scope];
    }
    if (a.source !== b.source) {
      return a.source === CategoryMapSource.CURATED ? -1 : 1;
    }
    return 0;
  })[0];
}

/** Normalized Amazon category path used as a mapping key. */
export function normalizeAmazonCategory(category: string | undefined | null): string | null {
  const clean = category?.replace(/\s+/g, ' ').trim().toLowerCase();
  return clean && clean.length > 0 ? clean.slice(0, 200) : null;
}
