import type { ReturnTab } from '@repo/shared';
import type { DataTableProps, TabNavItem, TableColumn } from '@repo/ui';

import type { ReturnRowView } from '../returns.types';

export interface ReturnsPageProps {
  rows: ReturnRowView[];
  columns: TableColumn<ReturnRowView>[];
  pagination: NonNullable<DataTableProps<ReturnRowView>['pagination']>;
  /** PageHeader subtitle — the result count, or the loading line during the first fetch. */
  subtitle: string;
  /** Counted tabs (All · Needs action · In progress · Closed). */
  tab: ReturnTab;
  tabItems: TabNavItem[];
  onTabChange: (tabId: string) => void;
  search: string;
  onSearchChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
  onClearFilters: () => void;
  hasActiveFilters: boolean;
  resultCount: number;
  isInitialLoading: boolean;
  /** Opens the return in the detail drawer. */
  onRowOpen: (row: ReturnRowView) => void;
  onCardKeyDown: (event: React.KeyboardEvent<HTMLDivElement>, row: ReturnRowView) => void;
  /** The return open in the detail drawer (`?r=`), or null. */
  selectedReturnId: string | null;
  onCloseDetail: () => void;
}
