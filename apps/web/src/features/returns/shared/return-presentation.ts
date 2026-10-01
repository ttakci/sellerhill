import {
  EBAY_RETURN_CLOSE_REASONS,
  EBAY_RETURN_HISTORY_ACTIVITIES,
  EBAY_RETURN_TYPES,
  EbayReturnReasonType,
  EbayReturnSellerActivity,
  ReturnBucket,
} from '@repo/shared';

import type { ReturnHistoryActor } from '../returns.types';

import type { ReturnBucketPresentation } from './return-presentation.types';

// Colours group by MEANING, same convention as the order stages: red = a
// deadline was missed or eBay stepped in, amber = your move, blue = nothing due
// from you, grey = over — or not known: a return eBay has not confirmed
// recently is grey with a question mark, never a colour that claims a state.
// The icon tells the two reds (and the two greys) apart.
const PRESENTATION: Record<ReturnBucket, ReturnBucketPresentation> = {
  // One colour per bucket (operator decision, 2026-10-01): grey = we cannot
  // confirm it, red = past eBay's deadline, amber = your turn, orange = in an
  // eBay case, sky = moving, green = closed.
  [ReturnBucket.UNCONFIRMED]: { variant: 'neutral', icon: 'help' },
  [ReturnBucket.ACTION_OVERDUE]: { variant: 'error', icon: 'alert-triangle' },
  [ReturnBucket.ACTION_DUE]: { variant: 'warning', icon: 'alert-circle' },
  [ReturnBucket.ESCALATED]: { variant: 'orange', icon: 'shield-alert' },
  [ReturnBucket.IN_PROGRESS]: { variant: 'sky', icon: 'clock' },
  [ReturnBucket.CLOSED]: { variant: 'success', icon: 'check-circle' },
};

export function returnBucketPresentation(bucket: ReturnBucket): ReturnBucketPresentation {
  return PRESENTATION[bucket];
}

/** i18n key suffix under `returns.activity.*` for anything eBay names that we do not localize. */
export const RETURN_ACTIVITY_OTHER_KEY = 'other';

const SELLER_ACTIVITIES: readonly string[] = Object.values(EbayReturnSellerActivity);
const REASON_TYPES: readonly string[] = Object.values(EbayReturnReasonType);

/**
 * `returns.activity.<key>` for eBay's `sellerResponseDue.activityDue`.
 *
 * eBay's `ActivityOptionEnum` has ~90 values and grows; only the ones that name
 * a seller action are localized. Any other value still means "eBay expects
 * something from you", so it resolves to the generic "respond on eBay" wording
 * rather than printing a raw enum. `null` = nothing is due.
 */
export function resolveSellerActivityKey(activity: string | null | undefined): string | null {
  if (!activity) {
    return null;
  }
  return SELLER_ACTIVITIES.includes(activity) ? activity : RETURN_ACTIVITY_OTHER_KEY;
}

const HISTORY_ACTIVITIES: readonly string[] = EBAY_RETURN_HISTORY_ACTIVITIES;
const RETURN_TYPES: readonly string[] = EBAY_RETURN_TYPES;
const CLOSE_REASONS: readonly string[] = EBAY_RETURN_CLOSE_REASONS;

/** Who did a history step, read from eBay's activity name prefix. */
export function resolveHistoryActor(activity: string | null | undefined): ReturnHistoryActor {
  if (activity?.startsWith('BUYER_')) {
    return 'buyer';
  }
  if (activity?.startsWith('SELLER_')) {
    return 'seller';
  }
  return 'ebay';
}

/**
 * `returns.history.<key>` for one step of eBay's `responseHistory`. A value the
 * page does not localize renders as the generic line for its actor
 * (`buyerOther` / `sellerOther` / `ebayOther`), never the raw enum.
 */
export function resolveHistoryActivityKey(activity: string | null | undefined): string {
  if (activity && HISTORY_ACTIVITIES.includes(activity)) {
    return activity;
  }
  return `${resolveHistoryActor(activity)}Other`;
}

/** `returns.returnType.<key>`, or null for an absent / undocumented type. */
export function resolveReturnTypeKey(type: string | null | undefined): string | null {
  return type && RETURN_TYPES.includes(type) ? type : null;
}

/** `returns.closeReason.<key>` — an unknown reason renders the generic "closed" line. */
export function resolveCloseReasonKey(reason: string | null | undefined): string {
  return reason && CLOSE_REASONS.includes(reason) ? reason : 'other';
}

/** `returns.reasonType.<key>` — an absent or undocumented category reads as eBay's own UNKNOWN. */
export function resolveReasonTypeKey(reasonType: string | null | undefined): EbayReturnReasonType {
  return reasonType && REASON_TYPES.includes(reasonType)
    ? (reasonType as EbayReturnReasonType)
    : EbayReturnReasonType.UNKNOWN;
}
