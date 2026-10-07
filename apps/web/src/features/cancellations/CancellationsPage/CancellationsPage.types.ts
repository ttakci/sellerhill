import type { CancellationTab } from '@repo/shared';
import type { DataTableProps, TabNavItem, TableColumn } from '@repo/ui';

import type { CancellationRowView } from '../cancellations.types';

export interface CancellationsPageProps {
  rows: CancellationRowView[];
  columns: TableColumn<CancellationRowView>[];
  pagination: NonNullable<DataTableProps<CancellationRowView>['pagination']>;
  /** PageHeader subtitle — the result count, or the loading line during the first fetch. */
  subtitle: string;
  /** Counted tabs (All · Needs action · In progress · Closed). */
  tab: CancellationTab;
  tabItems: TabNavItem[];
  onTabChange: (tabId: string) => void;
  search: string;
  onSearchChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
  onClearFilters: () => void;
  hasActiveFilters: boolean;
  resultCount: number;
  isInitialLoading: boolean;
  /** Opens the request in the detail drawer. */
  onRowOpen: (row: CancellationRowView) => void;
  onCardKeyDown: (event: React.KeyboardEvent<HTMLDivElement>, row: CancellationRowView) => void;
  /** The request open in the detail drawer (`?c=`), or null. */
  selectedCancellationId: string | null;
  onCloseDetail: () => void;
}
