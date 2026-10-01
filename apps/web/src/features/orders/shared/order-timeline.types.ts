import type { OrderStage, OrderTimelineStepKey, OrderTimelineStepState } from '@repo/shared';
import type { IconName } from '@repo/ui';
import type { TFunction } from 'i18next';

// Re-exported so the mapper takes its types from one place (it already
// imports the enums from `@repo/shared` as values).
export type { OrderStage, OrderTimelineStepDto } from '@repo/shared';

/** One rendered row of the order timeline — every string already resolved. */
export interface OrderTimelineRow {
  id: OrderTimelineStepKey;
  label: string;
  state: OrderTimelineStepState;
  icon: IconName;
  /** When the step happened, formatted; null when it has not (or the time is unknown). */
  dateLabel: string | null;
  description: string;
  /** What the seller does — only on the step the order is standing on. */
  action: string | null;
  /** Why the automatic purchase stopped — only on the purchase step. */
  reason: string | null;
  /** The Amazon order number / the tracking number eBay received. */
  reference: string | null;
  /** A buyer-message sub-step. */
  isMessage: boolean;
}

export interface OrderTimelineRowContext {
  t: TFunction;
  formatDate: (value: string) => string;
  stage: OrderStage;
  shippedDetectedAt?: string | null;
  /** `orders.stage.<stage>.action` (or the cancelled-with-Amazon-open line), else null. */
  stageAction: string | null;
  /** "Reason: …" for a stage that shows the automatic-purchase reason, else null. */
  reasonLabel: string | null;
  now: Date;
}
