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

const ITEM_VARIANTS: Record<string, BadgeVariant> = {
  draft: 'warning',
  retrying: 'primary',
  active: 'success',
  error: 'error',
};

/** A job ITEM's state (queued / in progress / done / failed) in the same solid badge hues as the job itself. */
export const jobItemStatusBadgeVariant = (status: string): BadgeVariant =>
  ITEM_VARIANTS[String(status).toLowerCase()] ?? 'neutral';
