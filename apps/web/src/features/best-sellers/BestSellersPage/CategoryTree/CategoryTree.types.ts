import type React from 'react';

/**
 * One rendered row of the two-level category tree — a department (`depth: 0`)
 * or one of its sub-categories (`depth: 1`). Pre-flattened by the container so
 * the component only maps over an array and never branches on raw category
 * data (see `useBestSellersCategoryTree`).
 */
export interface BestSellersCategoryTreeRow {
  /** Stable React key — the department path alone, or `department::child` for a sub-row. */
  key: string;
  /** Value to pass to `onSelect` / the `category` query param; `''` for the root row. */
  path: string;
  name: string;
  depth: 0 | 1;
  /** True when this exact path is the category currently being browsed. */
  isActive: boolean;
  /** Department rows only — whether it has a chevron at all. */
  hasChildren: boolean;
  isExpanded: boolean;
}

export interface CategoryTreeProps {
  rows: BestSellersCategoryTreeRow[];
  searchValue: string;
  onSearchChange: (event: React.ChangeEvent<HTMLInputElement>) => void;
  onSelect: (path: string) => void;
  onToggleExpand: (path: string) => void;
  /** True once the root departments have been fetched at least once. */
  hasDepartments: boolean;
  className?: string;
}

export type CategoryTreeComponentProps = CategoryTreeProps;
