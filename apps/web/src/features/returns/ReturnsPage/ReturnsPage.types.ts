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
  ebayAccountId: string;
  onEbayAccountChange: (value: string | number) => void;
  storeOptions: { value: string | number; label: string }[];
  onClearFilters: () => void;
  hasActiveFilters: boolean;
  resultCount: number;
  isInitialLoading: boolean;
  /** Opens the order behind a return; a row whose order we do not hold is left inert. */
  onRowOpen: (row: ReturnRowView) => void;
  onCardKeyDown: (event: React.KeyboardEvent<HTMLDivElement>, row: ReturnRowView) => void;
}
