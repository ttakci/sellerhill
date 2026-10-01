/**
 * Best Sellers feature-wide types (shared by the page and its hooks).
 */

import type { BestSellersBrowseAllowanceDto, BestSellersListType } from '@repo/shared';

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
 * One known node of the category tree. Amazon's alias is always
 * `<department>` or `<department>/<nodeId>`, but the node id can sit at ANY
 * depth under that department, so the tree is a real tree: each answer tells
 * us the chain above the browsed node, the node itself and its children.
 */
export interface BestSellersCategoryNode {
  name: string;
  /** Path of the parent node; `null` for a department (a child of the root). */
  parent: string | null;
  /** Child paths once this node has been visited; `undefined` while never fetched. */
  children: string[] | undefined;
}

/**
 * The client-side category tree cache (`useBestSellersCategoryTree`), one per
 * list type — Movers & Shakers does not carry the same departments as Best
 * Sellers.
 */
export interface BestSellersCategoryTreeListTypeBucket {
  /** Department paths (the root's children); `undefined` until the root answer or its fallback fetch arrived. */
  rootChildren: string[] | undefined;
  nodes: Record<string, BestSellersCategoryNode>;
}

export interface BestSellersCategoryTreeState {
  bucket: BestSellersCategoryTreeListTypeBucket;
  /** Whether a node's children are shown (open by default along the active chain). */
  isExpanded: (path: string) => boolean;
  toggleExpanded: (path: string) => void;
}

/** What the page shows instead of (or around) the product grid. */
export enum BestSellersViewState {
  LOADING = 'loading',
  READY = 'ready',
  EMPTY = 'empty',
  /** The page has products, but none passes the seller's filters. */
  NO_MATCHES = 'no_matches',
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

/**
 * Seller-side filters over the products of the page being viewed, kept as the
 * raw text the seller typed (a half-typed "4." must not snap back to "4").
 * Each is optional; an empty string means "no constraint". Only fields Amazon
 * actually prints on a Best Sellers card exist here — rating, review count and
 * price. Prime and "bought in past month" are not on those pages, so there is
 * nothing honest to filter them on.
 */
export interface BestSellersFilterValues {
  /** Minimum star average, one of `BEST_SELLERS_RATING_OPTIONS`; `''` = any. */
  minRating: string;
  minReviews: string;
  priceMin: string;
  priceMax: string;
}

/** The same filters parsed into numbers; `null` = no constraint. */
export interface BestSellersFilterCriteria {
  minRating: number | null;
  minReviews: number | null;
  priceMin: number | null;
  priceMax: number | null;
}

export interface BestSellersFilters {
  values: BestSellersFilterValues;
  criteria: BestSellersFilterCriteria;
  isActive: boolean;
  setMinRating: (value: string) => void;
  setMinReviews: (value: string) => void;
  setPriceMin: (value: string) => void;
  setPriceMax: (value: string) => void;
  clear: () => void;
}
