/**
 * Presentation mapping for the Action Center.
 *
 * The API sends codes only, so exactly one file decides how each severity, each
 * group and each item LOOKS. Keeping it here (not inline in the component)
 * means the page, and any later surface that wants to show the same items,
 * cannot disagree about what "critical" or "drafts pending" is.
 */

import { ActionCenterItemKey, ActionCenterSeverity } from '@repo/shared';
import type { BadgeVariant, IconName } from '@repo/ui';

/**
 * The severity filter's "no filter" value.
 *
 * A real value rather than `undefined` because it feeds `SegmentedControl`,
 * which is a controlled string input — an undefined value renders the rail with
 * nothing selected. It lives here and not in `.types.ts`, which holds type
 * declarations only.
 */
export const ACTION_CENTER_FILTER_ALL = 'all';

/**
 * Badge colour per severity. Mirrors the fulfillment-state policy: colour
 * tracks urgency, never which subsystem produced the row.
 */
export const severityToBadgeVariant = (severity: ActionCenterSeverity): BadgeVariant => {
  const map: Record<ActionCenterSeverity, BadgeVariant> = {
    [ActionCenterSeverity.CRITICAL]: 'error',
    [ActionCenterSeverity.WARNING]: 'warning',
    [ActionCenterSeverity.INFO]: 'info',
  };
  return map[severity] ?? 'neutral';
};

/**
 * Leading icon per severity.
 *
 * Colour alone is not enough — it fails for colour-blind users and in a dense
 * stack of rows the eye reads shape faster than hue.
 */
export const severityToIcon = (severity: ActionCenterSeverity): IconName => {
  const map: Record<ActionCenterSeverity, IconName> = {
    [ActionCenterSeverity.CRITICAL]: 'alert-circle',
    [ActionCenterSeverity.WARNING]: 'alert-triangle',
    [ActionCenterSeverity.INFO]: 'info',
  };
  return map[severity] ?? 'info';
};

/**
 * Tone key for the severity mark's styled props. Separate from the badge
 * variant because the mark is tinted from the semantic palette directly.
 */
export const severityToTone = (
  severity: ActionCenterSeverity,
): 'critical' | 'warning' | 'info' => {
  const map: Record<ActionCenterSeverity, 'critical' | 'warning' | 'info'> = {
    [ActionCenterSeverity.CRITICAL]: 'critical',
    [ActionCenterSeverity.WARNING]: 'warning',
    [ActionCenterSeverity.INFO]: 'info',
  };
  return map[severity] ?? 'info';
};

/**
 * Where an item's breakdown codes are localized.
 *
 * Blocked reasons and listing failure codes already have complete, translated
 * label sets in their own namespaces — reusing them keeps one vocabulary per
 * concept instead of a second Action-Center-only copy that would drift. Only
 * the Amazon account statuses needed new keys, because the existing ones are
 * camelCase display labels rather than code-keyed entries.
 */
const BREAKDOWN_NAMESPACE: Partial<Record<ActionCenterItemKey, string>> = {
  [ActionCenterItemKey.ORDER_FULFILLMENT_BLOCKED]: 'orders:orders.autoFulfill.reason',
  [ActionCenterItemKey.LISTING_JOB_FAILURES]: 'listings:listings.jobs.failure',
  [ActionCenterItemKey.AMAZON_ACCOUNT_NEEDS_ATTENTION]: 'actionCenter.reasons.amazonAccount',
};

/**
 * Full i18n key for one breakdown code, or null when the item has no localized
 * vocabulary — in which case the row shows its count without a reason chip
 * rather than printing a raw enum value at the seller.
 */
export const breakdownLabelKey = (item: ActionCenterItemKey, code: string): string | null => {
  const namespace = BREAKDOWN_NAMESPACE[item];
  return namespace ? `${namespace}.${code}` : null;
};
