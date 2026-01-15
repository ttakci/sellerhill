
export interface TablePaginationProps {
  count: number;
  page: number;
  rowsPerPage: number;
  rowsPerPageOptions?: number[];
  onPageChange: (newPage: number) => void;
  onRowsPerPageChange: (newRowsPerPage: number) => void;
  className?: string;
  labelRowsPerPage?: string; // Optional for i18n later
}
