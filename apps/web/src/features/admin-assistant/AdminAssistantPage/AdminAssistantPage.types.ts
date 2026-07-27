import type { AdminOverviewDto, QueueHealthDto, UsageSummaryDto } from '@repo/shared';

export interface AdminAssistantPageComponentProps {
  isLoading: boolean;
  overview: AdminOverviewDto | null;
  queues: QueueHealthDto[];
  usage: UsageSummaryDto[];
}
