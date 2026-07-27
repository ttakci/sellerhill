import type {
  AdminBillingMetricsDto,
  AdminOperationsSummaryDto,
  AdminOverviewDto,
  ProviderCostSummaryDto,
  UserCostSummaryDto,
} from '@repo/shared';

export type AdminTabId = 'queues' | 'costs' | 'billing' | 'users';

export interface AdminPageComponentProps {
  activeTab: AdminTabId;
  overview?: AdminOverviewDto;
  operations?: AdminOperationsSummaryDto;
  providerCosts: ProviderCostSummaryDto[];
  userCosts: UserCostSummaryDto[];
  billingMetrics?: AdminBillingMetricsDto;
  onTabChange: (tab: AdminTabId) => void;
}
