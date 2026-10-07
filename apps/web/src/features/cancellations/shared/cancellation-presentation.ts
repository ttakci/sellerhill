import { CancellationBucket } from '@repo/shared';

import type { CancellationBucketPresentation, CancellationHistoryActor } from '../cancellations.types';

// Same colour-by-meaning convention as the return buckets: grey = not confirmed
// recently, red = past eBay's deadline, amber = your turn, teal = you answered and
// eBay is processing it, sky = moving, green = closed.
const PRESENTATION: Record<CancellationBucket, CancellationBucketPresentation> = {
  [CancellationBucket.UNCONFIRMED]: { variant: 'neutral', icon: 'help' },
  [CancellationBucket.ACTION_OVERDUE]: { variant: 'error', icon: 'alert-triangle' },
  [CancellationBucket.ACTION_DUE]: { variant: 'warning', icon: 'alert-circle' },
  [CancellationBucket.ANSWERED]: { variant: 'teal', icon: 'check' },
  [CancellationBucket.IN_PROGRESS]: { variant: 'sky', icon: 'clock' },
  [CancellationBucket.CLOSED]: { variant: 'success', icon: 'check-circle' },
};

export function cancellationBucketPresentation(bucket: CancellationBucket): CancellationBucketPresentation {
  return PRESENTATION[bucket];
}

/** `CancelReasonEnum` values seen on real requests (`cancellations.reason.<value>`); eBay's full list has no local page. */
const KNOWN_REASONS: readonly string[] = [
  'BUYER_ASKED_CANCEL',
  'BUYER_CANCEL_OR_ADDRESS_ISSUE',
  'OUT_OF_STOCK_OR_CANNOT_FULFILL',
];

/** `cancellations.reason.<key>` — anything else reads as the generic "other reason". */
export function resolveCancellationReasonKey(reason: string | null | undefined): string {
  return reason && KNOWN_REASONS.includes(reason) ? reason : 'other';
}

/** Journey steps the page words itself (`CancelActivityTypeEnum` values from eBay's samples). */
const KNOWN_ACTIVITIES: readonly string[] = ['SELLER_CREATE_CANCEL', 'SYSTEM_REFUND', 'SYSTEM_NOTIFY_REFUND_STATUS'];

/**
 * Who did a step: eBay's `activityParty` (`PartyEnum` BUYER / SELLER / UNKNOWN),
 * else the activity name's prefix, else eBay itself (the `SYSTEM_*` steps).
 */
export function resolveHistoryActor(
  party: string | null | undefined,
  activity: string | null | undefined
): CancellationHistoryActor {
  if (party === 'BUYER' || activity?.startsWith('BUYER_')) {
    return 'buyer';
  }
  if (party === 'SELLER' || activity?.startsWith('SELLER_')) {
    return 'seller';
  }
  return 'ebay';
}

/**
 * `cancellations.history.<key>` — a step the page does not word renders as the
 * generic line for its actor (`buyerOther` / `sellerOther` / `ebayOther`),
 * never the raw enum.
 */
export function resolveHistoryActivityKey(
  activity: string | null | undefined,
  actor: CancellationHistoryActor
): string {
  return activity && KNOWN_ACTIVITIES.includes(activity) ? activity : `${actor}Other`;
}
