import type { BadgeVariant, IconName } from '@repo/ui';

/** How a return bucket renders: the badge colour family and its literal icon. */
export interface ReturnBucketPresentation {
  variant: BadgeVariant;
  icon: IconName;
}
