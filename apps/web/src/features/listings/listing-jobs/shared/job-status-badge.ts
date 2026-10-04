import { ListingJobStatus } from '@repo/shared';
import type { BadgeVariant } from '@repo/ui';

const VARIANTS: Record<string, BadgeVariant> = {
  [ListingJobStatus.PENDING]: 'warning',
  [ListingJobStatus.PROCESSING]: 'primary',
  [ListingJobStatus.COMPLETED]: 'success',
  [ListingJobStatus.FAILED]: 'error',
};

/** One hue per job state, the same solid badge the order screens use; anything else (cancelled) is neutral. */
export const jobStatusBadgeVariant = (status: string): BadgeVariant =>
  VARIANTS[String(status).toLowerCase()] ?? 'neutral';
