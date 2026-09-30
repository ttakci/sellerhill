import type { ReturnBucket } from '@repo/shared';
import type { BadgeSize, BadgeVariant, IconName } from '@repo/ui';

export interface ReturnBucketBadgeProps {
  bucket: ReturnBucket;
  size?: BadgeSize;
  /** Hover explains the bucket in one sentence. Off where that text is already on screen. */
  withTooltip?: boolean;
}

export interface ReturnBucketBadgeViewProps {
  label: string;
  tooltip: string | null;
  variant: BadgeVariant;
  icon: IconName;
  size: BadgeSize;
}
