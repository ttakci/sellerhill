import type { CancellationTab } from '@repo/shared';
import type { DataTableProps, TabNavItem, TableColumn } from '@repo/ui';

import type { CancellationRowView } from '../cancellations.types';

import type { StatusLegendRow } from '@/components/StatusLegend/StatusLegend.types';

export interface CancellationsPageProps {
  rows: CancellationRowView[];
  columns: TableColumn<CancellationRowView>[];
  /** Column manager + sort picker — the same toolbar as the listings and orders tables. */
  columnOptions: { key: string; label: string; alwaysVisible?: boolean }[];
  visibleColumnKeys: string[];
  onToggleColumn: (key: string) => void;
  onMoveColumn: (key: string, direction: -1 | 1) => void;
  sortOptions: { value: string; label: string }[];
  sortValue: string;
  onSortChange: (value: string | number) => void;
  sortColumn?: string;
  sortDirection: 'asc' | 'desc';
  onSort: (columnKey: string) => void;
  pagination: NonNullable<DataTableProps<CancellationRowView>['pagination']>;
  /** Counted tabs (All · Needs action · In progress · Closed). */
  tab: CancellationTab;
  tabItems: TabNavItem[];
  /** The status legend's rows, opened from the end of the tab row. */
  legendRows: StatusLegendRow[];
  onTabChange: (tabId: string) => void;
  search: string;
  onSearchChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
  onClearFilters: () => void;
  hasActiveFilters: boolean;
  resultCount: number;
  isInitialLoading: boolean;
  /** Opens the request in the detail drawer. */
  onRowOpen: (row: CancellationRowView) => void;
  /** The request open in the detail drawer (`?c=`), or null. */
  selectedCancellationId: string | null;
  onCloseDetail: () => void;
}
