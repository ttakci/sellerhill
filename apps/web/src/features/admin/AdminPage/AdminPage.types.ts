import type {
  AdminAspectDefaultDto,
  AdminBillingMetricsDto,
  AdminListingFailureDto,
  AdminListingFailuresDto,
  AdminListingQualitySummaryDto,
  AdminOperationsSummaryDto,
  AdminOverviewDto,
  AdminProxyDto,
  AdminProxyListDto,
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
  | 'proxies'
  | 'listingQuality'
  | 'settings'
  | 'billing'
  | 'users'
  | 'ebayLimits'
  | 'listingFailures';

/** Controlled add-proxy form state (strings — converted at submit). */
export interface ProxyFormState {
  host: string;
  port: string;
  username: string;
  password: string;
  label: string;
  /** YYYY-MM-DD (native date input value). */
  expiresAt: string;
  /** Monthly cost in USD; converted to micro-USD at submit. */
  monthlyCostUsd: string;
}

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
  proxyPool?: AdminProxyListDto;
  usersList?: AdminUsersListDto;
  /** Per-resource daily eBay quota usage. The pool is shared by every seller. */
  ebayBudget: EbayCallBudgetStatusDto[];
  /** Failed listing attempts WITH the raw provider text — operators only. */
  listingFailures?: AdminListingFailuresDto;
  /** Real table columns — the tabs used to render hand-built flex rows. */
  userColumns: TableColumn<AdminUserDto>[];
  proxyColumns: TableColumn<AdminProxyDto>[];
  budgetColumns: TableColumn<EbayCallBudgetStatusDto>[];
  failureColumns: TableColumn<AdminListingFailureDto>[];
  settingGroups: SettingGroup[];
  settingDrafts: Record<string, string>;
  isSavingSetting: boolean;
  emailTestResult: { ok: boolean; error: string | null } | null;
  isTestingEmail: boolean;
  proxyForm: ProxyFormState;
  isSavingProxy: boolean;
  onTabChange: (tab: AdminTabId) => void;
  onProxyFieldChange: (field: keyof ProxyFormState, value: string) => void;
  onProxySubmit: () => void;
  onSettingDraftChange: (key: string, value: string) => void;
  onSettingSave: (key: string) => void;
  onSettingToggle: (setting: PlatformSettingDto) => void;
  onSettingReset: (key: string) => void;
  onEmailTest: () => void;
  /** Renders a micro-USD amount; returns the em-dash placeholder for null (unknown). */
  formatCost: (micros: number | null, currency: string | null) => string;
}
