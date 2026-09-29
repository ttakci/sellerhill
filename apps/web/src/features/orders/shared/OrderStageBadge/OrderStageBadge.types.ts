import type { OrderStage } from '@repo/shared';
import type { BadgeSize, BadgeVariant, IconName } from '@repo/ui';

export interface OrderStageBadgeProps {
  stage: OrderStage;
  shippedDetectedAt?: string | null;
  size?: BadgeSize;
  /** Hover shows the stage's `meaning` (and `action`). Off in the legend, where the text is already visible. */
  withTooltip?: boolean;
}

export interface OrderStageBadgeViewProps {
  label: string;
  tooltip: string | null;
  variant: BadgeVariant;
  icon: IconName;
  size: BadgeSize;
}
