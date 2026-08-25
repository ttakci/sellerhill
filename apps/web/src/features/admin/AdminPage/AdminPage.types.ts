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
  PlatformSettingCategory,
  PlatformSettingDto,
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

/** Settings grouped for rendering, one block per registry category. */
export interface SettingGroup {
  category: PlatformSettingCategory;
  settings: PlatformSettingDto[];
}

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
  settingGroups: SettingGroup[];
  /** Categories currently collapsed in the Settings tab accordion. Absent = expanded. */
  collapsedSettingCategories: Set<PlatformSettingCategory>;
  onToggleSettingCategory: (category: PlatformSettingCategory) => void;
  settingDrafts: Record<string, string>;
  isSavingSetting: boolean;
  emailTestResult: { ok: boolean; error: string | null } | null;
  isTestingEmail: boolean;
  onSettingDraftChange: (key: string, value: string) => void;
  onSettingSave: (key: string) => void;
  onSettingToggle: (setting: PlatformSettingDto) => void;
  onSettingReset: (key: string) => void;
  onEmailTest: () => void;
  /** Renders a micro-USD amount; returns the em-dash placeholder for null (unknown). */
  formatCost: (micros: number | null, currency: string | null) => string;
  /** Renders the Aquiline snapshot's captured-at timestamp; em-dash for null (no snapshot yet). */
  formatCapturedAt: (iso: string | null) => string;
}
