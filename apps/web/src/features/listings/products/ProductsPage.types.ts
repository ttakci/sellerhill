import type { ProductData } from '@repo/shared';
import type React from 'react';

export interface ProductsPageContainerProps {}

export interface ProductsPageComponentProps {
  products: ProductData[];
  /** Initial fetch — rendered as an in-table EmptyState, never the global overlay. */
  isLoading: boolean;
  /** Server-side search over title / ASIN / brand. */
  search: string;
  onSearchChange: (event: React.ChangeEvent<HTMLInputElement>) => void;
  onClearSearch: () => void;
  /** Locale-aware money formatter (shared `formatCurrency`). */
  formatCurrency: (value: number) => string;
  pagination?: {
    count: number;
    page: number;
    rowsPerPage: number;
    onPageChange: (page: number) => void;
    onRowsPerPageChange: (rowsPerPage: number) => void;
    labelRowsPerPage?: string;
    labelInfo?: string;
  };
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  columns: any[];
  onDownload: () => void;
}
