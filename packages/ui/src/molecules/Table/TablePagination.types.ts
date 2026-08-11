/**
 * `footer` sits inside the table's own bordered surface (Table renders it there),
 * so it only needs a divider. `detached` is a standalone bar under a card grid or
 * a separate table card — it carries its own border/radius/elevation, because a
 * bare divider floating under a rounded card reads as a rendering bug.
 */
export type TablePaginationVariant = 'footer' | 'detached';

export interface TablePaginationProps {
  count: number;
  page: number;
  rowsPerPage: number;
  rowsPerPageOptions?: number[];
  onPageChange: (newPage: number) => void;
  onRowsPerPageChange: (newRowsPerPage: number) => void;
  className?: string;
  labelRowsPerPage?: string;
  labelInfo?: string;
  variant?: TablePaginationVariant;
}
