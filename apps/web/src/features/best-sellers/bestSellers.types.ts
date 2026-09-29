/**
 * Best Sellers feature-wide types (shared by the page and its hooks).
 */

import type { BestSellersBrowseAllowanceDto, BestSellersCategoryDto, BestSellersListType } from '@repo/shared';

/** URL-backed browse position: which list, which category, which of the two pages. */
export interface BestSellersUrlState {
  listType: BestSellersListType;
  /** Category alias, or `BEST_SELLERS_ROOT_CATEGORY` (`''`) for all departments. */
  category: string;
  /** 1-based, never above `BEST_SELLERS_MAX_PAGE`. */
  page: number;
  setListType: (value: BestSellersListType) => void;
  setCategory: (value: string) => void;
  setPage: (value: number) => void;
}

/**
 * The ticked ASINs. In-memory only and deliberately NOT keyed on the list or
 * category, so a seller can collect products across several lists and pages
 * before sending them all to Add Listings at once.
 */
export interface BestSellersSelection {
  selectedAsins: ReadonlySet<string>;
  count: number;
  isSelected: (asin: string) => boolean;
  toggle: (asin: string) => void;
  selectMany: (asins: readonly string[]) => void;
  deselectMany: (asins: readonly string[]) => void;
  /**
   * Replace the selection state of exactly these page ASINs: `selected`
   * becomes ticked, the rest of `pageAsins` unticked, everything off the page
   * untouched. This is what the table's own selection callback maps onto.
   */
  setPageSelection: (pageAsins: readonly string[], selected: readonly string[]) => void;
  clear: () => void;
}

/**
 * The client-side category tree cache (`useBestSellersCategoryTree`). Amazon's
 * alias grammar caps a category at two segments — a department, or one
 * sub-category under it — so this is a two-level tree: departments at the
 * root, each one's own sub-categories revealed once the seller has visited it.
 */
export interface BestSellersCategoryTreeListTypeBucket {
  departments: BestSellersCategoryDto[];
  childrenByDepartment: Record<string, BestSellersCategoryDto[]>;
}

export interface BestSellersCategoryTreeState {
  /** Root-level departments for the active list type, once seen (empty until then). */
  departments: BestSellersCategoryDto[];
  /** A department's own sub-categories, once visited; `undefined` if never fetched. */
  childrenOf: (departmentPath: string) => BestSellersCategoryDto[] | undefined;
  isExpanded: (departmentPath: string) => boolean;
  toggleExpanded: (departmentPath: string) => void;
}

/** What the page shows instead of (or around) the product grid. */
export enum BestSellersViewState {
  LOADING = 'loading',
  READY = 'ready',
  EMPTY = 'empty',
  /** Amazon does not offer this list for the chosen category. */
  NOT_FOUND = 'not_found',
  /** Amazon did not answer (blocked / unreadable page) — retryable. */
  BLOCKED = 'blocked',
  /** The list service itself is unreachable (HTTP 503 / no egress). */
  UNAVAILABLE = 'unavailable',
  /** The operator switched the feature off for this account (HTTP 404). */
  DISABLED = 'disabled',
  /**
   * The platform's hidden per-seller cap on LIVE list fetches for the day is
   * spent (HTTP 429). An anti-abuse brake on proxy capacity, not the seller's
   * product allowance — that one never refuses, it locks rows instead.
   */
  LIMIT_REACHED = 'limit_reached',
}

/** Body of a refused request — `message` is an i18n key, `allowance` the period's product meter (429 only). */
export interface BestSellersRefusalBody {
  message?: string;
  allowance?: BestSellersBrowseAllowanceDto;
}
