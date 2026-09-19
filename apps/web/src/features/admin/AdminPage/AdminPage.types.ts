import type {
  AdminAspectDefaultDto,
  AdminBillingMetricsDto,
  AdminListingFailureDto,
  AdminListingFailuresDto,
  AdminListingQualitySummaryDto,
  AdminOperationsSummaryDto,
  AdminOverviewDto,
  AdminUserDto,
  AdminUsersListDto,
  ProviderCostSummaryDto,
  EbayCallBudgetStatusDto,
} from '@repo/shared';
import type { TableColumn } from '@repo/ui';

export type AdminTabId =
  | 'overview'
  | 'queues'
  | 'costs'
  | 'listingQuality'
  | 'settings'
  | 'billing'
  | 'users'
  | 'ebayLimits'
  | 'listingFailures';

/** Listing-quality tab data + actions. */
export interface AdminListingQualityView {
  summary?: AdminListingQualitySummaryDto;
  defaults: AdminAspectDefaultDto[];
  search: string;
  onSearchChange: (value: string) => void;
  onRemoveDefault: (id: string) => void;
  isRemoving: boolean;
}

export interface AdminPageComponentProps {
  activeTab: AdminTabId;
  listingQuality: AdminListingQualityView;
  overview?: AdminOverviewDto;
  operations?: AdminOperationsSummaryDto;
  providerCosts: ProviderCostSummaryDto[];
  billingMetrics?: AdminBillingMetricsDto;
  usersList?: AdminUsersListDto;
  /** Per-resource daily eBay quota usage. The pool is shared by every seller. */
  ebayBudget: EbayCallBudgetStatusDto[];
  /** Failed listing attempts WITH the raw provider text — operators only. */
  listingFailures?: AdminListingFailuresDto;
  /** Real table columns — the tabs used to render hand-built flex rows. */
  userColumns: TableColumn<AdminUserDto>[];
  budgetColumns: TableColumn<EbayCallBudgetStatusDto>[];
  failureColumns: TableColumn<AdminListingFailureDto>[];
  /** True until the admin role is confirmed; child panels that fetch on their own must not query before then. */
  skip: boolean;
  /** Renders a micro-USD amount; returns the em-dash placeholder for null (unknown). */
  formatCost: (micros: number | null, currency: string | null) => string;
  /** Renders the Aquiline snapshot's captured-at timestamp; em-dash for null (no snapshot yet). */
  formatCapturedAt: (iso: string | null) => string;
}
