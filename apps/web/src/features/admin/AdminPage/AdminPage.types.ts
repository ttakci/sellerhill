import type {
  AdminOperationsSummaryDto,
  AdminOverviewDto,
  ProviderCostSummaryDto,
  UserCostSummaryDto,
} from '@repo/shared';

export type AdminTabId = 'queues' | 'costs' | 'users';

export interface AdminPageComponentProps {
  activeTab: AdminTabId;
  overview?: AdminOverviewDto;
  operations?: AdminOperationsSummaryDto;
  providerCosts: ProviderCostSummaryDto[];
  userCosts: UserCostSummaryDto[];
  onTabChange: (tab: AdminTabId) => void;
}
