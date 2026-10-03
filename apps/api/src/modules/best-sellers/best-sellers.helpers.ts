// apps/api/src/modules/best-sellers/best-sellers.helpers.ts
//
// Pure helpers behind `BestSellersService`: cache-key shape, the UTC day the
// per-seller counters are bucketed on, the fetch-cap arithmetic and the
// product-allowance arithmetic (how many rows a page shows, how many it
// locks). No Redis, no settings, no HTTP, no DB — all of it is exercised by
// the unit spec.

import {
  BEST_SELLERS_ROOT_CATEGORY,
  BILLING_UNLIMITED,
  type BestSellersBrowseAllowanceDto,
  type BestSellersListDto,
  type BestSellersListType,
} from '@repo/shared';

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
 *
 * The same parts, joined by `buildViewKey`, identify the page in the
 * `best_sellers_views` ledger — one identity for "this list page" everywhere.
 */
export function buildListCacheKeyParts(
  countryCode: string,
  listType: BestSellersListType,
  category: string,
  page: number,
): string[] {
  return ['best-sellers', 'list', countryCode, listType, categoryKeySegment(category), String(page)];
}

/**
 * Parts of the tree cache key: one node's sidebar (its chain, itself, its
 * children), with no page — the tree beside page 2 is the tree beside page 1.
 * Kept apart from the list cache because it lives far longer.
 */
export function buildTreeCacheKeyParts(countryCode: string, listType: BestSellersListType, category: string): string[] {
  return ['best-sellers', 'tree', countryCode, listType, categoryKeySegment(category)];
}

function categoryKeySegment(category: string): string {
  return category === BEST_SELLERS_ROOT_CATEGORY ? ROOT_CATEGORY_KEY_SEGMENT : category.split('/').join('_');
}

/**
 * The `best_sellers_views.view_key` for a list page: the cache-key parts minus
 * the constant `best-sellers`/`list` prefix, joined with `:`. Fits the column's
 * VARCHAR(200) — the category alias is capped at 120 characters upstream.
 */
export function buildViewKey(cacheKeyParts: readonly string[]): string {
  return cacheKeyParts.slice(2).join(':');
}

/** `YYYY-MM-DD` in UTC — the bucket both per-seller counters live in. */
export function utcDayKey(date: Date): string {
  return date.toISOString().slice(0, 10);
}

/**
 * The HIDDEN per-seller cap on live fetches (cache misses) per UTC day —
 * `bestSellers.dailyFetchLimit`, a platform anti-abuse brake on proxy
 * capacity that only a script ever meets. It is NOT the seller allowance: that
 * is the plan's `best_sellers_products_per_month`, resolved by
 * `QuotaEnforcementService.resolveBestSellersAllowance` and applied through
 * `resolveRemaining` / `resolveLockedCount` below.
 */
export function resolveDailyFetchLimit(platformLimit: number): number {
  return Math.max(0, Math.floor(platformLimit));
}

/**
 * Products still available in the seller's allowance: `-1` when unmetered,
 * otherwise never negative even when the ledger overshoots the ceiling.
 */
export function resolveRemaining(limit: number, used: number): number {
  if (limit < 0) {return BILLING_UNLIMITED;}
  return Math.max(0, Math.floor(limit) - Math.max(0, Math.floor(used)));
}

/** The seller-facing allowance figure for one response. */
export function buildAllowance(used: number, limit: number, creditValue: number): BestSellersBrowseAllowanceDto {
  return { used, limit, remaining: resolveRemaining(limit, used), creditValue };
}

/** What the API reports when nothing meters the seller (or billing could not be asked). */
export const UNMETERED_ALLOWANCE: Readonly<BestSellersBrowseAllowanceDto> = Object.freeze({
  used: 0,
  limit: BILLING_UNLIMITED,
  remaining: BILLING_UNLIMITED,
  creditValue: 0,
});

/** Rows on a page the allowance did not cover — never negative. */
export function resolveLockedCount(totalItems: number, visibleItems: number): number {
  return Math.max(0, Math.floor(totalItems) - Math.max(0, Math.floor(visibleItems)));
}

/**
 * The page with only the first `visible` products. Everything else on the
 * list (categories, pagination, related lists) is untouched — those are
 * navigation, not metered content. The cut happens SERVER-SIDE so a locked
 * product never reaches the browser at all.
 */
export function truncateListItems(list: BestSellersListDto, visible: number): BestSellersListDto {
  const keep = Math.max(0, Math.floor(visible));
  if (keep >= list.items.length) {return list;}
  return { ...list, items: list.items.slice(0, keep) };
}

/** A live fetch is allowed while the seller's daily miss counter is below the hidden cap. */
export function decideFetchAllowed(used: number, limit: number): boolean {
  return used < limit;
}
