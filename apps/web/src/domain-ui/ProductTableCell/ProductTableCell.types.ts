import type { StoreType } from '@repo/ui';
import type { ReactNode } from 'react';

export interface ProductTableCellMetaRow {
  label: string;
  id: string;
  storeType: StoreType;
}

/**
 * The product identity cell shared by the listings and orders tables.
 * Both surfaces answer the same question ("which product is this row about?")
 * and previously did it with two separate implementations — a 4.5rem image with
 * a tooltipped 2-line title and id badges on listings, a bare 2.75rem thumb with
 * an unclamped title on orders.
 */
export interface ProductTableCellProps {
  title: string;
  imageUrl?: string;
  /** Labelled id rows under the title (ASIN, eBay item id, …). */
  meta?: ProductTableCellMetaRow[];
  /** Free slot under the title for surfaces that show something else there (brand, …). */
  subtitle?: ReactNode;
  className?: string;
}
