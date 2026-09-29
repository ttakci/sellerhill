import type { BestSellersBrowseAllowanceDto } from '@repo/shared';
import type { SelectOption, TabNavItem } from '@repo/ui';
import type React from 'react';

import type { BestSellersViewState } from '../bestSellers.types';

/**
 * One ranked product with every figure already formatted by the container
 * (money in the list's own currency, rating/review counts in the seller's
 * locale with Western digits), so the component prints strings and makes no
 * formatting decisions.
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
  /** The review count alone, grouped for the locale — the table's Reviews column. */
  reviewsLabel: string | null;
  isSelected: boolean;
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
  items: BestSellersItemView[];
  /** Rows of `items` that are ticked — what the table's selection column reflects. */
  selectedRows: BestSellersItemView[];
  onSelectionChange: (rows: BestSellersItemView[]) => void;

  listTypeOptions: TabNavItem[];
  listType: string;
  onListTypeChange: (value: string) => void;

  categoryOptions: SelectOption[];
  /** Current category alias; `''` is the root option. */
  category: string;
  onCategoryChange: (value: string | number) => void;
  /** True when a sub-category is open, so "Back to all categories" applies. */
  isSubCategory: boolean;
  onBackToAllCategories: () => void;

  selectedCount: number;
  isAllOnPageSelected: boolean;
  onToggleSelectAllOnPage: (checked: boolean) => void;
  onToggleItem: (asin: string) => void;
  /**
   * Stops a click inside a card's own controls (checkbox, Amazon link) from
   * also toggling the card — the container owns it so the component holds no
   * handler logic of its own.
   */
  onControlClick: (event: React.SyntheticEvent) => void;
  onListSelected: () => void;
  onClearSelection: () => void;
  onRetry: () => void;

  /** Today's fetch allowance, from the last answer or the 429 body; null before anything arrived. */
  allowance: BestSellersBrowseAllowanceDto | null;
  pagination: BestSellersPagination | undefined;
}
