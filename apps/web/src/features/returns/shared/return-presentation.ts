import { EbayReturnReasonType, EbayReturnSellerActivity, ReturnBucket } from '@repo/shared';

import type { ReturnBucketPresentation } from './return-presentation.types';

// Colours group by MEANING, same convention as the order stages: red = a
// deadline was missed or eBay stepped in, amber = your move, blue = nothing due
// from you, grey = over — or not known: a return eBay has not confirmed
// recently is grey with a question mark, never a colour that claims a state.
// The icon tells the two reds (and the two greys) apart.
const PRESENTATION: Record<ReturnBucket, ReturnBucketPresentation> = {
  [ReturnBucket.UNCONFIRMED]: { variant: 'neutral', icon: 'help' },
  [ReturnBucket.ACTION_OVERDUE]: { variant: 'error', icon: 'alert-triangle' },
  [ReturnBucket.ACTION_DUE]: { variant: 'warning', icon: 'alert-circle' },
  [ReturnBucket.ESCALATED]: { variant: 'error', icon: 'shield-alert' },
  [ReturnBucket.IN_PROGRESS]: { variant: 'info', icon: 'clock' },
  [ReturnBucket.CLOSED]: { variant: 'neutral', icon: 'check-circle' },
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

/** `returns.reasonType.<key>` — an absent or undocumented category reads as eBay's own UNKNOWN. */
export function resolveReasonTypeKey(reasonType: string | null | undefined): EbayReturnReasonType {
  return reasonType && REASON_TYPES.includes(reasonType)
    ? (reasonType as EbayReturnReasonType)
    : EbayReturnReasonType.UNKNOWN;
}
