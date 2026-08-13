/**
 * Pure assembly logic for the Action Center.
 *
 * Everything here is deliberately free of DB and Nest so the rules that decide
 * what a seller sees — which items survive, how urgent they are, what order
 * they appear in — are unit-testable without a database.
 *
 * The service's only job is to produce raw counts; this file turns counts into
 * the page.
 */

import {
  ACTION_CENTER_GROUP_ORDER,
  ACTION_CENTER_SEVERITY_RANK,
  ActionCenterGroup,
  ActionCenterItemKey,
  ActionCenterSeverity,
  type ActionCenterBreakdownEntryDto,
  type ActionCenterGroupDto,
  type ActionCenterItemDto,
  type ActionCenterSummaryDto,
} from '@repo/shared';

/**
 * How full a quota has to be before it is worth interrupting the seller.
 *
 * Below `WARN` there is nothing to do — a plan that is 40% used is working as
 * intended, and saying so trains the seller to ignore the page.
 */
export const QUOTA_WARN_RATIO = 0.8;
/** At or above this, new listings/orders are about to start being refused. */
export const QUOTA_CRITICAL_RATIO = 1;

/** A trial is only news once it is close enough to act on. */
export const TRIAL_ENDING_NOTICE_DAYS = 5;

/**
 * Severity for a usage ratio, or null when the quota is not worth reporting.
 *
 * `limit <= 0` means unlimited (the plan snapshot uses `-1`) — an unlimited
 * quota can never be under pressure, and dividing by it would report a false
 * emergency.
 */
export function resolveQuotaSeverity(used: number, limit: number): ActionCenterSeverity | null {
  if (!Number.isFinite(used) || !Number.isFinite(limit) || limit <= 0) {
    return null;
  }
  const ratio = used / limit;
  if (ratio >= QUOTA_CRITICAL_RATIO) {
    return ActionCenterSeverity.CRITICAL;
  }
  if (ratio >= QUOTA_WARN_RATIO) {
    return ActionCenterSeverity.WARNING;
  }
  return null;
}

/**
 * Whole days from `now` until `endsAt`, rounded UP.
 *
 * Rounding up matters: with 6 hours left the honest answer is "1 day", not "0".
 * A past date returns 0, never a negative.
 */
export function daysUntil(endsAt: Date, now: Date): number {
  const ms = endsAt.getTime() - now.getTime();
  if (!Number.isFinite(ms) || ms <= 0) {
    return 0;
  }
  return Math.ceil(ms / 86_400_000);
}

/** The worst severity present, or INFO for an empty list. */
export function highestSeverity(
  severities: readonly ActionCenterSeverity[],
): ActionCenterSeverity {
  return severities.reduce<ActionCenterSeverity>(
    (worst, current) =>
      ACTION_CENTER_SEVERITY_RANK[current] > ACTION_CENTER_SEVERITY_RANK[worst] ? current : worst,
    ActionCenterSeverity.INFO,
  );
}

/**
 * Normalize a `code -> count` tally into a sorted breakdown.
 *
 * Zero and negative counts are dropped: a reason nothing happened for is not a
 * reason. Ties break on the code so the order is stable between polls — a list
 * that reshuffles itself every 60s is unreadable.
 */
export function buildBreakdown(
  tally: Readonly<Record<string, number>>,
  limit = 4,
): ActionCenterBreakdownEntryDto[] {
  return Object.entries(tally)
    .filter(([, count]) => count > 0)
    .map(([code, count]) => ({ code, count }))
    .sort((a, b) => b.count - a.count || a.code.localeCompare(b.code))
    .slice(0, limit);
}

/**
 * Group items into the page's sections and compute every roll-up count.
 *
 * Two invariants the UI depends on:
 *  - **Zero-count items never appear.** The badge must equal the number of
 *    things actually waiting, so an item that resolved itself between the query
 *    and the render is dropped here rather than shown as an empty row.
 *  - **An empty group is omitted**, so the page has no headings over nothing.
 *
 * Within a group, items sort by severity then by count — the biggest fire
 * first — with the item key as the tiebreak for stable ordering across polls.
 */
export function buildActionCenterSummary(
  items: readonly ActionCenterItemDto[],
  generatedAt: Date,
): ActionCenterSummaryDto {
  const visible = items.filter((item) => item.count > 0);

  const groups: ActionCenterGroupDto[] = [];
  for (const groupKey of ACTION_CENTER_GROUP_ORDER) {
    const groupItems = visible
      .filter((item) => item.group === groupKey)
      .sort(
        (a, b) =>
          ACTION_CENTER_SEVERITY_RANK[b.severity] - ACTION_CENTER_SEVERITY_RANK[a.severity] ||
          b.count - a.count ||
          a.key.localeCompare(b.key),
      );

    if (groupItems.length === 0) {
      continue;
    }

    groups.push({
      key: groupKey,
      severity: highestSeverity(groupItems.map((item) => item.severity)),
      itemCount: groupItems.length,
      items: groupItems,
    });
  }

  const countBy = (severity: ActionCenterSeverity): number =>
    visible.filter((item) => item.severity === severity).length;

  return {
    totalCount: visible.length,
    criticalCount: countBy(ActionCenterSeverity.CRITICAL),
    warningCount: countBy(ActionCenterSeverity.WARNING),
    infoCount: countBy(ActionCenterSeverity.INFO),
    groups,
    generatedAt: generatedAt.toISOString(),
  };
}

/** An empty snapshot — used when a user has nothing waiting, and on cold start. */
export function emptyActionCenterSummary(generatedAt: Date): ActionCenterSummaryDto {
  return buildActionCenterSummary([], generatedAt);
}

/** Raw counts `setupItems` reads from the DB — one row, five columns. */
export interface SetupCounts {
  ebayCount: number;
  amazonCount: number;
  /** Amazon accounts that are ACTIVE, auto-fulfill-enabled and carry a positive cap. */
  automatedCount: number;
  /** Global (`is_global = TRUE`) store_settings rows. */
  storeSettingsCount: number;
  listingGroupCount: number;
}

function setupItem(key: ActionCenterItemKey, actionPath: string): ActionCenterItemDto {
  return {
    key,
    group: ActionCenterGroup.SETUP,
    severity: ActionCenterSeverity.INFO,
    count: 1,
    actionPath,
  };
}

/**
 * Staged foundational-setup checklist for a seller who has not finished
 * onboarding — connect eBay, add an Amazon buyer account, configure store
 * settings, create a listing settings group, then (once an Amazon account
 * exists) turn on auto-fulfillment.
 *
 * Staging, not a flat list of gaps:
 *  - **No eBay account → show ONLY that.** Every other item's destination is
 *    `/settings?drawer=...`, and the Settings hub is wrapped in the same
 *    `EbayAccountGuard` that gates this very page — showing them earlier
 *    would link to a page that immediately bounces back to "connect eBay."
 *  - **Once eBay exists, the remaining foundational gaps show together** —
 *    Amazon account, store settings, listing group have no dependency order
 *    between them, so there is no reason to drip-feed them one at a time.
 *  - **Auto-fulfillment readiness is evaluated only once an Amazon account
 *    exists** — reporting "turn on auto-fulfill" before there is anything to
 *    turn on is not actionable, and would double up with
 *    `SETUP_NO_AMAZON_ACCOUNT` describing the same underlying gap.
 */
export function buildSetupItems(counts: SetupCounts): ActionCenterItemDto[] {
  if (counts.ebayCount === 0) {
    return [setupItem(ActionCenterItemKey.SETUP_NO_EBAY_STORE, '/onboarding/ebay')];
  }

  const items: ActionCenterItemDto[] = [];

  if (counts.amazonCount === 0) {
    items.push(setupItem(ActionCenterItemKey.SETUP_NO_AMAZON_ACCOUNT, '/settings?drawer=amazonAccounts'));
  }
  if (counts.storeSettingsCount === 0) {
    items.push(setupItem(ActionCenterItemKey.SETUP_NO_STORE_SETTINGS, '/settings?drawer=storeSettings'));
  }
  if (counts.listingGroupCount === 0) {
    items.push(
      setupItem(ActionCenterItemKey.SETUP_NO_LISTING_SETTINGS_GROUP, '/settings?drawer=listingGroupCreate'),
    );
  }
  if (counts.amazonCount > 0 && counts.automatedCount === 0) {
    items.push(setupItem(ActionCenterItemKey.SETUP_AUTO_FULFILL_OFF, '/settings?drawer=amazonAccounts'));
  }

  return items;
}
