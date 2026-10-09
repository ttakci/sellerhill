import type { ColumnOption, SelectOption, TabNavItem, TableColumn } from '@repo/ui';
import type React from 'react';

import type { BestSellersFilterValues, BestSellersStarFill, BestSellersViewState } from '../bestSellers.types';

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
  /** The star average alone (`4.6`), for the star stat and column; null when unrated. */
  ratingValueLabel: string | null;
  /** The five stars drawn beside the average; null when unrated. */
  ratingStars: BestSellersStarFill[] | null;
  /** The review count alone, grouped for the locale — the Reviews column and stat. */
  reviewsLabel: string | null;
  /** Movers & Shakers only — `+250%`; null on every other list. */
  rankChangeLabel: string | null;
  isSelected: boolean;
  /** True for an allowance placeholder — never selectable, never sent to Add Listings. */
  isLocked: boolean;
}

/** What `useBestSellersColumns` hands the container. */
export interface BestSellersColumns {
  allColumns: TableColumn<BestSellersItemView>[];
  columnOptions: ColumnOption[];
}

/** One min/max row of the "Advanced filters" section (the Listings pattern). */
export interface BestSellersRangeFilterView {
  key: string;
  label: string;
  min: string;
  max: string;
  onMinChange: (event: React.ChangeEvent<HTMLInputElement>) => void;
  onMaxChange: (event: React.ChangeEvent<HTMLInputElement>) => void;
}

/** A removable chip naming one applied filter. */
export interface BestSellersFilterChip {
  key: string;
  label: string;
  onRemove: () => void;
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

  /* --- Table chrome, the same set the Listings / Orders pages pass ---------- */
  columns: TableColumn<BestSellersItemView>[];
  columnOptions: ColumnOption[];
  visibleColumnKeys: string[];
  onToggleColumn: (key: string) => void;
  onMoveColumn: (key: string, direction: -1 | 1) => void;
  sortOptions: { value: string; label: string }[];
  sortValue: string;
  onSortChange: (value: string | number) => void;
  sortColumn: string;
  sortDirection: 'asc' | 'desc';
  onSort: (columnKey: string) => void;
  /** Products shown on this page after the filters ("N products listed"). */
  resultCount: number;

  /** Rows of `items` that are ticked — what the table's selection column reflects. */
  selectedRows: BestSellersItemView[];
  onSelectionChange: (rows: BestSellersItemView[]) => void;
  /** False for a locked placeholder, so it gets no checkbox and select-all skips it. */
  isRowSelectable: (row: BestSellersItemView) => boolean;
  /** Ticked products across every list and page — they travel together to Add Listings. */
  selectedCount: number;
  /** Sends every ticked ASIN (all lists and pages) to the Add Listings drawer. */
  onListSelected: () => void;
  /** Unticks everything, on every list and page — the table's header box clears this page only. */
  onClearSelection: () => void;
  /** Ticks / unticks a product (card click, table row click); a locked placeholder is ignored. */
  onToggleRow: (row: BestSellersItemView) => void;

  /** Products on this page outside the allowance; drives the locked rows and the upsell card. */
  lockedCount: number;
  /** Sends the seller to the billing page (plans + top-ups). */
  onUpgrade: () => void;

  listTypeOptions: TabNavItem[];
  listType: string;
  onListTypeChange: (value: string) => void;

  /** Pre-flattened category tree — see `useBestSellersCategoryTree`. */
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

  /** Search + rating in the main row; price / reviews / rank ranges in the advanced section. */
  ratingOptions: SelectOption[];
  filterValues: BestSellersFilterValues;
  onSearchChange: (event: React.ChangeEvent<HTMLInputElement>) => void;
  onMinRatingChange: (value: string | number) => void;
  rangeFilters: BestSellersRangeFilterView[];
  activeFilterChips: BestSellersFilterChip[];
  advancedOpen: boolean;
  onToggleAdvanced: () => void;
  hasActiveFilters: boolean;
  onClearFilters: () => void;

  onRetry: () => void;

  /**
   * The allowance meter, already localized ("13,760 of 15,000 products left
   * this period" / "Unlimited product views"); null before anything arrived.
   */
  allowanceLabel: string | null;
  /**
   * When this page was read from Amazon ("9 Oct, 11:20"): the cache's fetch
   * time, or now on a live fetch. Shown in each card's footer; null while
   * nothing has arrived.
   */
  lastFetchedLabel: string | null;
  pagination: BestSellersPagination | undefined;
}
