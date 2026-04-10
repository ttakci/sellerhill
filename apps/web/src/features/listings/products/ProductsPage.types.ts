import type { ProductData } from '@repo/shared';

export interface ProductsPageContainerProps {}

export interface ProductsPageComponentProps {
  products: ProductData[];
  isLoading: boolean;
  pagination?: {
    count: number;
    page: number;
    rowsPerPage: number;
    onPageChange: (page: number) => void;
    onRowsPerPageChange: (rowsPerPage: number) => void;
    labelRowsPerPage?: string;
    labelInfo?: string;
  };
  columns: any[];
  viewMode: 'table' | 'grid';
  onViewModeChange: (mode: 'table' | 'grid') => void;
  onDownload: () => void;
}
