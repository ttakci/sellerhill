import type { SelectOption, TabNavItem } from '@repo/ui';
import type React from 'react';

import type { BestSellersFilterValues, BestSellersViewState } from '../bestSellers.types';

import type { BestSellersCategoryTreeRow } from './CategoryTree';

/**
 * One ranked product with every figure already formatted by the container
 * (money in the list's own currency, rating/review counts in the seller's
 * locale with Western digits), so the component prints strings and makes no
 * formatting decisions.
 *
 * A LOCKED row is a placeholder for a product the seller's monthly allowance
 * did not cover. The server removes those products from the payload entirely
 * (`BestSellersPageDto.lockedCount`), so a locked row carries no real data —
 * `asin` is a synthetic key, every label is null — and only exists so the grid
 * and the table can draw a blurred slot where the product would have been.
 */
export interface BestSellersItemView {
  asin: string;
  rank: number | null;
  /** `#12`, or null when Amazon rendered the card without a rank. */
  rankLabel: string | null;
  title: string;
  imageUrl: string | null;
  /** `$19.99` from the structured price, else Amazon's own price text, else null. */
  priceLabel: string | null;
  /** `★ 4.6 (12,345)` / `★ 4.6`, or null when the product has no rating yet. */
  ratingLabel: string | null;
  /** The star average alone (`4.6`), for the card's star stat; null when unrated. */
  ratingValueLabel: string | null;
  /** The review count alone, grouped for the locale — the table's Reviews column. */
  reviewsLabel: string | null;
  /** Movers & Shakers only — `+250%`; null on every other list. */
  rankChangeLabel: string | null;
  isSelected: boolean;
  /** True for an allowance placeholder — never selectable, never sent to Add Listings. */
  isLocked: boolean;
}

export interface BestSellersPagination {
  count: number;
  page: number;
  rowsPerPage: number;
  onPageChange: (page: number) => void;
  onRowsPerPageChange: (rowsPerPage: number) => void;
  labelRowsPerPage?: string;
  labelInfo?: string;
}

export interface BestSellersPageComponentProps {
  viewState: BestSellersViewState;
  /** Visible products first, then `lockedCount` locked placeholders — the DataTable's rows. */
  items: BestSellersItemView[];
  /** Rows of `items` that are ticked — what the table's selection column reflects. */
  selectedRows: BestSellersItemView[];
  onSelectionChange: (rows: BestSellersItemView[]) => void;
  /** False for a locked placeholder, so it gets no checkbox and select-all skips it. */
  isRowSelectable: (row: BestSellersItemView) => boolean;
  /** True when at least one real (unlocked) product is on the page. */
  hasSelectableItems: boolean;
  /** Products on this page outside the allowance; drives the locked rows and the upsell card. */
  lockedCount: number;
  /** Sends the seller to the billing page (plans + top-ups). */
  onUpgrade: () => void;

  listTypeOptions: TabNavItem[];
  listType: string;
  onListTypeChange: (value: string) => void;

  /** Pre-flattened two-level category tree — see `useBestSellersCategoryTree`. */
  categoryTreeRows: BestSellersCategoryTreeRow[];
  categorySearchValue: string;
  onCategorySearchChange: (event: React.ChangeEvent<HTMLInputElement>) => void;
  onCategorySelect: (path: string) => void;
  onToggleCategoryExpand: (path: string) => void;
  /** True once the root departments have been fetched at least once. */
  hasDepartments: boolean;
  /** The currently browsed category's display name, for the mobile trigger. */
  activeCategoryLabel: string;
  isCategoryDrawerOpen: boolean;
  onOpenCategoryDrawer: () => void;
  onCloseCategoryDrawer: () => void;
  /** True when a category other than the root is open (the not-found screen offers a way back). */
  isSubCategory: boolean;
  onBackToAllCategories: () => void;

  /** Rating / reviews / price filters over the page being viewed. */
  ratingOptions: SelectOption[];
  filterValues: BestSellersFilterValues;
  onMinRatingChange: (value: string | number) => void;
  onMinReviewsChange: (event: React.ChangeEvent<HTMLInputElement>) => void;
  onPriceMinChange: (event: React.ChangeEvent<HTMLInputElement>) => void;
  onPriceMaxChange: (event: React.ChangeEvent<HTMLInputElement>) => void;
  hasActiveFilters: boolean;
  onClearFilters: () => void;
  /** "12 of 50 products on this page" while a filter narrows the page; null otherwise. */
  filterResultLabel: string | null;

  selectedCount: number;
  isAllOnPageSelected: boolean;
  onToggleSelectAllOnPage: (checked: boolean) => void;
  onToggleItem: (asin: string) => void;
  onListSelected: () => void;
  onClearSelection: () => void;
  onRetry: () => void;

  /**
   * The allowance meter, already localized ("13,760 of 15,000 products left
   * this period" / "Unlimited product views"); null before anything arrived.
   */
  allowanceLabel: string | null;
  pagination: BestSellersPagination | undefined;
}
