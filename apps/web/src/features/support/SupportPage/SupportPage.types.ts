import type { SupportQueueConversationDto, SupportQueueFilter } from '@repo/shared';

export interface SupportPageComponentProps {
  filter: SupportQueueFilter;
  isLoading: boolean;
  items: SupportQueueConversationDto[];
  onFilterChange: (filter: SupportQueueFilter) => void;
  onOpenConversation: (id: string) => void;
}
