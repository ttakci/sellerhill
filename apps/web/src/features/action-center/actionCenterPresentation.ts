/**
 * Presentation mapping for the Action Center.
 *
 * The API sends codes only, so exactly one file decides how each severity, each
 * group and each item LOOKS. Keeping it here (not inline in the component)
 * means the page, and any later surface that wants to show the same items,
 * cannot disagree about what "critical" or "drafts pending" is.
 */

import { ActionCenterGroup, ActionCenterItemKey, ActionCenterSeverity } from '@repo/shared';
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
 * Group header icon. Reuses the exact glyph the sidebar nav already draws for
 * that domain (`AppLayout.component.tsx`) so a group card and its own nav
 * item can never disagree about what represents it — e.g. Orders is
 * `shopping-bag` in both places. Connections has no matching nav item (eBay/
 * Amazon account health isn't its own page), so it uses `plug`, the icon set's
 * own "integration / connected account" glyph. Setup uses `clipboard-list`
 * (not a rocket/launch glyph) — its items are a checklist of onboarding
 * steps, not a "go live" moment. Deliberately NOT `check-list`: `SettingsCard`
 * special-cases that exact icon name to render its always-green "validation"
 * tint (see `SettingsCard.component.tsx`), which painted this group's icon
 * green while every sibling group stayed brand-blue.
 */
const GROUP_ICON: Record<ActionCenterGroup, IconName> = {
  [ActionCenterGroup.ORDERS]: 'shopping-bag',
  [ActionCenterGroup.CONNECTIONS]: 'plug',
  [ActionCenterGroup.LISTINGS]: 'inventory',
  [ActionCenterGroup.PLAN]: 'wallet-cards',
  [ActionCenterGroup.SETUP]: 'clipboard-list',
};

export const groupToIcon = (group: ActionCenterGroup): IconName => GROUP_ICON[group];

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
  // Not reusing `orders:orders.tracking.problem` even though it covers the same
  // eight codes: those are camelCase full sentences written for the order
  // detail page, while a breakdown chip needs a short snake_case-keyed label.
  // Same reason the Amazon account statuses got their own set.
  [ActionCenterItemKey.ORDER_TRACKING_PROBLEM]: 'actionCenter.reasons.trackingProblem',
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
