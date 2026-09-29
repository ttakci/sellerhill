// apps/api/src/modules/best-sellers/best-sellers.helpers.ts
//
// Pure helpers behind `BestSellersService`: cache-key shape, the UTC day the
// per-seller fetch counter is bucketed on, and the allowance arithmetic. No
// Redis, no settings, no HTTP — all of it is exercised by the unit spec.

import { BEST_SELLERS_ROOT_CATEGORY, type BestSellersBrowseAllowanceDto, type BestSellersListType } from '@repo/shared';

/** Segment used in a cache key for the root (all departments) list. */
export const ROOT_CATEGORY_KEY_SEGMENT = 'root';

/**
 * Canonical form of a category alias: trimmed and lowercased, so
 * `Electronics/172541 ` and `electronics/172541` share one cache entry and one
 * scraper call. Undefined and blank both mean the root.
 */
export function normalizeCategory(category: string | undefined | null): string {
  if (category === undefined || category === null) {return BEST_SELLERS_ROOT_CATEGORY;}
  return category.trim().toLowerCase();
}

/**
 * Parts of the shared list cache key, in order. `RedisKeyService.key` joins
 * them with `:` and rewrites any `:` inside a part, so the category's own `/`
 * is replaced here to keep the key readable in `redis-cli`.
 */
export function buildListCacheKeyParts(
  countryCode: string,
  listType: BestSellersListType,
  category: string,
  page: number,
): string[] {
  const categorySegment = category === BEST_SELLERS_ROOT_CATEGORY ? ROOT_CATEGORY_KEY_SEGMENT : category.split('/').join('_');
  return ['best-sellers', 'list', countryCode, listType, categorySegment, String(page)];
}

/** `YYYY-MM-DD` in UTC — the bucket the per-seller fetch counter lives in. */
export function utcDayKey(date: Date): string {
  return date.toISOString().slice(0, 10);
}

/**
 * The seller's daily live-fetch allowance.
 *
 * Today this is the platform-wide setting and nothing else. This function is
 * the seam where a per-plan limit (read from the seller's `billing_plans` row)
 * and a purchasable top-up (a `billing_quota_addons` row granting extra
 * fetches for the month, exactly like the tracking-conversion packs) will plug
 * in — both would be summed here, and no caller would change. Billing is
 * deliberately NOT wired yet.
 */
export function resolveDailyFetchLimit(platformLimit: number): number {
  return Math.max(0, Math.floor(platformLimit));
}

/** `remaining` never goes negative even when the counter overshoots the limit. */
export function buildAllowance(used: number, limit: number): BestSellersBrowseAllowanceDto {
  return { used, limit, remaining: Math.max(0, limit - used) };
}

/** A live fetch is allowed while the seller's counter is below the limit. */
export function decideFetchAllowed(used: number, limit: number): boolean {
  return used < limit;
}
