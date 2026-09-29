import type { BadgeVariant, IconName } from '@repo/ui';

/** How a stage renders: the badge colour family and its literal icon. */
export interface OrderStagePresentation {
  variant: BadgeVariant;
  icon: IconName;
}
