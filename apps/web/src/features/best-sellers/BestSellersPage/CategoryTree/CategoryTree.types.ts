import type React from 'react';

/**
 * One rendered row of the category tree — a department (`depth: 0`) or any
 * level below it. Pre-flattened by the container so the component only maps
 * over an array and never branches on raw category data (see
 * `flattenCategoryTree`).
 */
export interface BestSellersCategoryTreeRow {
  /** Stable React key — the category path (unique in the tree, `root` for the root row). */
  key: string;
  /** Value to pass to `onSelect` / the `category` query param; `''` for the root row. */
  path: string;
  name: string;
  /** 0 for the root row and the departments; one level deeper per generation. */
  depth: number;
  /** True when this exact path is the category currently being browsed. */
  isActive: boolean;
  /** An ancestor of the category being browsed. */
  isActiveBranch: boolean;
  /** Whether it has a chevron at all (children exist, or were never fetched). */
  hasChildren: boolean;
  isExpanded: boolean;
  /** Its sub-categories are on their way (a chevron fetch, or the list it opened). */
  isLoading: boolean;
}

export interface CategoryTreeProps {
  rows: BestSellersCategoryTreeRow[];
  searchValue: string;
  onSearchChange: (event: React.ChangeEvent<HTMLInputElement>) => void;
  /** The label: opens that category's list (its products count against the allowance). */
  onSelect: (path: string) => void;
  /** The chevron: shows or hides the sub-categories only — no products are loaded. */
  onToggleExpand: (path: string) => void;
  /** True once the root departments have been fetched at least once. */
  hasDepartments: boolean;
  className?: string;
}

export type CategoryTreeComponentProps = CategoryTreeProps;
