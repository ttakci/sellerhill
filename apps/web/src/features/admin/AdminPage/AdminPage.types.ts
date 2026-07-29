import type {
  AdminBillingMetricsDto,
  AdminOperationsSummaryDto,
  AdminOverviewDto,
  AdminProxyDto,
  AdminProxyListDto,
  AdminUsersListDto,
  PlatformSettingCategory,
  PlatformSettingDto,
  ProviderCostSummaryDto,
} from '@repo/shared';

export type AdminTabId = 'overview' | 'queues' | 'costs' | 'proxies' | 'settings' | 'billing' | 'users';

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

export interface AdminPageComponentProps {
  activeTab: AdminTabId;
  overview?: AdminOverviewDto;
  operations?: AdminOperationsSummaryDto;
  providerCosts: ProviderCostSummaryDto[];
  billingMetrics?: AdminBillingMetricsDto;
  proxyPool?: AdminProxyListDto;
  usersList?: AdminUsersListDto;
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
  onProxyToggleStatus: (proxy: AdminProxyDto) => void;
  onSettingDraftChange: (key: string, value: string) => void;
  onSettingSave: (key: string) => void;
  onSettingToggle: (setting: PlatformSettingDto) => void;
  onSettingReset: (key: string) => void;
  onEmailTest: () => void;
  /** Renders a micro-USD amount; returns the em-dash placeholder for null (unknown). */
  formatCost: (micros: number | null, currency: string | null) => string;
  /** Localized short date for ISO strings; em-dash for null. */
  formatDateValue: (iso: string | null) => string;
}
