import type { ListingJobItemDto } from '@repo/shared';

export interface ListingJobDetailsPageContainerProps {}

export interface ListingJobDetailsPageComponentProps {
  jobId: string;
  items: ListingJobItemDto[];
  isLoading: boolean;
  onRefresh: () => void;
  onBack: () => void;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  columns: any[];
}
