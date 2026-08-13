/**
 * Action Center Service
 *
 * Answers one question per user: what is waiting on you right now?
 *
 * Shape of the work:
 *  - Each probe below is an independent, indexed query returning COUNTS only —
 *    never rows. The page is a set of counters with deep links into the lists
 *    that already exist; re-implementing those lists here would give us a
 *    second, drifting copy of every filter.
 *  - Probes run concurrently and each is individually fail-soft. This page is
 *    read on every navigation (the sidebar badge polls it), so one degraded
 *    subsystem must cost its own row, not the whole page. A probe that throws
 *    contributes nothing — which reads as "no action needed" — so the failure
 *    is logged at warn with the probe name.
 *  - Assembly (visibility, severity roll-up, ordering) lives in the pure
 *    helpers, not here.
 *
 * **Every `actionPath` must be a route AND query param the web app actually
 * reads.** A path that half-resolves fails silently: the seller is told "3
 * orders need you", clicks, and lands on an unfiltered list of all 400 with no
 * indication which three. That is worse than showing no action at all, and it
 * is exactly what happened on the first cut — `?fulfillmentState=` was local
 * component state, `?drawer=import` did not exist, and the settings drawer key
 * was `amazon-accounts` where the app uses `amazonAccounts`. When adding an
 * item, open the consuming hook/container and confirm the param is read.
 *
 * The same class of bug recurred twice more (found 2026-08-12): `LISTING_JOB_FAILURES`
 * linked to `/listings/jobs` with no filter param at all (the jobs page's
 * filters were local `useState`, never URL-synced), and `LISTING_SOURCE_UNAVAILABLE`
 * linked to `/listings/all?status=active` with no way to narrow to the
 * quarantined-ASIN listings the item actually counted. Both list endpoints now
 * accept a purpose-built filter (`hasFailures`, `sourceUnavailable`) so the
 * count and the list agree; see `ListingsQueryDto`/`ListingJobsQueryDto`.
 *
 * Status values are written by the app as the shared lowercase enum values, so
 * every comparison uses those enums rather than the legacy uppercase column
 * defaults in the original DDL.
 */

import { Injectable, Logger } from '@nestjs/common';
import {
  ActionCenterGroup,
  ActionCenterItemKey,
  ActionCenterSeverity,
  AmazonAccountStatus,
  BillingLimitKey,
  BillingSubscriptionStatus,
  EbayAccountStatus,
  LISTING_SOURCE_UNAVAILABLE_FAILURE_THRESHOLD,
  ListingStatus,
  OrderFulfillmentState,
  OrderStatus,
  buildFulfillmentStateSql,
  type ActionCenterItemDto,
  type ActionCenterSummaryDto,
} from '@repo/shared';

import { DatabaseService } from '../../common/database/database.service';
import { BillingService } from '../billing/billing.service';

import {
  TRIAL_ENDING_NOTICE_DAYS,
  buildActionCenterSummary,
  buildBreakdown,
  buildSetupItems,
  daysUntil,
  resolveQuotaSeverity,
} from './action-center.helpers';

/**
 * How long an unfulfilled order is allowed to sit before it is the seller's
 * problem. Auto-fulfillment fires off order ingest and the checkout itself is
 * rate-limited, so anything younger than this is plausibly still in flight —
 * flagging it would be a false alarm on every single new sale.
 */
const AWAITING_PURCHASE_GRACE_HOURS = 12;

/** Lookback for "recent" signals. Older noise is history, not an action. */
const RECENT_WINDOW_DAYS = 30;
/** Job failures age out faster — a two-week-old failed batch is not today's work. */
const JOB_FAILURE_WINDOW_DAYS = 7;

/**
 * Consecutive Keepa refresh failures before a product is considered
 * unavailable at the source. Shared with `ListingsService.getListings`'
 * `sourceUnavailable` filter (`LISTING_SOURCE_UNAVAILABLE_FAILURE_THRESHOLD`)
 * so this count and the list the item links to can never disagree about which
 * listings qualify.
 */
const SOURCE_UNAVAILABLE_FAILURE_THRESHOLD = LISTING_SOURCE_UNAVAILABLE_FAILURE_THRESHOLD;

/** node-pg returns COUNT() as a string; every probe funnels through this. */
function toCount(value: unknown): number {
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed > 0 ? Math.trunc(parsed) : 0;
}

interface CountRow {
  count: string;
}

interface BreakdownRow {
  code: string | null;
  count: string;
}

/**
 * Which pending-action item each plan limit produces.
 *
 * A map rather than a chain of comparisons because `BillingUsagePeriodDto.limitKey`
 * is a plain `string` on the wire — comparing it to the enum directly is an
 * unsafe enum comparison, and an unmapped key must fall through to "skip", not
 * to an arbitrary branch.
 */
const QUOTA_ITEM_BY_LIMIT_KEY: Readonly<Record<string, ActionCenterItemKey>> = {
  [BillingLimitKey.LISTINGS_PER_MONTH]: ActionCenterItemKey.PLAN_LISTING_QUOTA,
  [BillingLimitKey.AMAZON_ORDERS_PER_MONTH]: ActionCenterItemKey.PLAN_AO_QUOTA,
};

@Injectable()
export class ActionCenterService {
  private readonly logger = new Logger(ActionCenterService.name);

  constructor(
    private readonly db: DatabaseService,
    private readonly billing: BillingService,
  ) {}

  async getSummary(userId: string): Promise<ActionCenterSummaryDto> {
    const probes = await Promise.all([
      this.probe('orders', () => this.orderItems(userId)),
      this.probe('connections', () => this.connectionItems(userId)),
      this.probe('listings', () => this.listingItems(userId)),
      this.probe('plan', () => this.planItems(userId)),
      this.probe('setup', () => this.setupItems(userId)),
    ]);

    return buildActionCenterSummary(probes.flat(), new Date());
  }

  /**
   * Run one probe, absorbing its failure.
   *
   * A degraded probe yields no items, which the page renders as "nothing to do
   * here" — the safe direction. Reporting a fabricated action would be worse
   * than reporting none.
   */
  private async probe(
    name: string,
    run: () => Promise<ActionCenterItemDto[]>,
  ): Promise<ActionCenterItemDto[]> {
    try {
      return await run();
    } catch (error) {
      this.logger.warn(
        `Action Center probe "${name}" failed; its actions are omitted from this snapshot: ${
          error instanceof Error ? error.message : String(error)
        }`,
      );
      return [];
    }
  }

  // ---------------------------------------------------------------- orders

  private async orderItems(userId: string): Promise<ActionCenterItemDto[]> {
    const items: ActionCenterItemDto[] = [];

    /*
     * Both order-state probes count through `buildFulfillmentStateSql` — the
     * same expression the orders list filters on. That is what makes "3 orders
     * need you" and the list behind the link agree: they are one definition,
     * not two that have to be kept in step by comment. Re-deriving the state
     * here with hand-written predicates is how the two silently diverge.
     *
     * It also means the badge clears on its own: a settled (completed) eBay
     * sale derives as MANUAL, so an order the seller fixed by hand drops out of
     * both the count and the list without needing an acknowledge flag.
     */
    const fulfillmentState = buildFulfillmentStateSql('o');

    // Amazon cancelled after we paid, and the eBay sale is still owed to the
    // buyer — the most urgent thing the platform can tell a seller.
    const cancelled = await this.db.query<CountRow>(
      `SELECT COUNT(*) AS count
         FROM orders o
        WHERE o.user_id = $1
          AND ${fulfillmentState} = $2`,
      [userId, OrderFulfillmentState.AMAZON_CANCELLED],
    );
    items.push({
      key: ActionCenterItemKey.ORDER_AMAZON_CANCELLED,
      group: ActionCenterGroup.ORDERS,
      severity: ActionCenterSeverity.CRITICAL,
      count: toCount(cancelled[0]?.count),
      actionPath: `/orders?fulfillmentState=${OrderFulfillmentState.AMAZON_CANCELLED}`,
    });

    /*
     * Blocked/failed automation, broken down by reason. The breakdown is the
     * point: the reasons demand different fixes (raise the cap, solve a
     * captcha, end a delisted listing) and a single total hides all of them.
     */
    const blocked = await this.db.query<BreakdownRow>(
      `SELECT COALESCE(o.auto_fulfill_blocked_reason, '') AS code, COUNT(*) AS count
         FROM orders o
        WHERE o.user_id = $1
          AND ${fulfillmentState} = $2
        GROUP BY 1`,
      [userId, OrderFulfillmentState.ACTION_REQUIRED],
    );
    const blockedTally: Record<string, number> = {};
    let blockedTotal = 0;
    for (const row of blocked) {
      const count = toCount(row.count);
      blockedTotal += count;
      // An empty reason is a `failed` (transport) row, which has no reason
      // column by design. It still counts toward the total; it just cannot
      // contribute a labelled breakdown entry.
      if (row.code) {
        blockedTally[row.code] = (blockedTally[row.code] ?? 0) + count;
      }
    }
    items.push({
      key: ActionCenterItemKey.ORDER_FULFILLMENT_BLOCKED,
      group: ActionCenterGroup.ORDERS,
      severity: ActionCenterSeverity.CRITICAL,
      count: blockedTotal,
      breakdown: buildBreakdown(blockedTally),
      actionPath: `/orders?fulfillmentState=${OrderFulfillmentState.ACTION_REQUIRED}`,
    });

    /*
     * Nobody is going to buy this but the seller.
     *
     * This is the one probe whose count is deliberately NARROWER than the list
     * it links to: the grace window keeps a brand-new sale from flashing as
     * "neglected" during the minutes between ingest and the rate-limited
     * checkout. Unlike an unbounded exclusion, this one is self-clearing — an
     * order not purchased simply ages into the count — so the two converge
     * instead of drifting apart forever.
     */
    const awaiting = await this.db.query<CountRow>(
      `SELECT COUNT(*) AS count
         FROM orders o
        WHERE o.user_id = $1
          AND ${fulfillmentState} = $2
          AND o.order_date < NOW() - ($3 || ' hours')::INTERVAL`,
      [
        userId,
        OrderFulfillmentState.NOT_AUTOMATED,
        String(AWAITING_PURCHASE_GRACE_HOURS),
      ],
    );
    items.push({
      key: ActionCenterItemKey.ORDER_AWAITING_PURCHASE,
      group: ActionCenterGroup.ORDERS,
      severity: ActionCenterSeverity.WARNING,
      count: toCount(awaiting[0]?.count),
      context: { hours: AWAITING_PURCHASE_GRACE_HOURS },
      actionPath: `/orders?fulfillmentState=${OrderFulfillmentState.NOT_AUTOMATED}`,
    });

    /*
     * Sold through an eBay item we do not track, so cost and profit are
     * permanently unresolvable for it. Scoped to the recent window because
     * importing a listing does NOT backfill old orders (`ON CONFLICT` never
     * assigns `listing_id` after ingest) — an ancient untracked order is a
     * fact, not a task.
     */
    const untracked = await this.db.query<CountRow>(
      `SELECT COUNT(*) AS count
         FROM orders o
        WHERE o.user_id = $1
          AND o.listing_id IS NULL
          AND o.status <> $2
          AND o.order_date >= NOW() - ($3 || ' days')::INTERVAL`,
      [userId, OrderStatus.CANCELLED, String(RECENT_WINDOW_DAYS)],
    );
    items.push({
      key: ActionCenterItemKey.ORDER_UNTRACKED,
      group: ActionCenterGroup.ORDERS,
      severity: ActionCenterSeverity.INFO,
      count: toCount(untracked[0]?.count),
      context: { days: RECENT_WINDOW_DAYS },
      actionPath: '/listings?drawer=import',
    });

    return items;
  }

  // ----------------------------------------------------------- connections

  private async connectionItems(userId: string): Promise<ActionCenterItemDto[]> {
    const ebay = await this.db.query<CountRow>(
      `SELECT COUNT(*) AS count
         FROM ebay_accounts
        WHERE user_id = $1
          AND status IN ($2, $3)`,
      [userId, EbayAccountStatus.REVOKED, EbayAccountStatus.ERROR],
    );

    /*
     * Amazon sign-in is broken. Broken down by status because the remedies
     * differ: `needs_reauth`/`invalid` want fresh credentials, `locked` wants
     * the seller to clear a hold with Amazon directly — re-saving the password
     * would not touch it.
     */
    const amazon = await this.db.query<BreakdownRow>(
      `SELECT status AS code, COUNT(*) AS count
         FROM amazon_accounts
        WHERE user_id = $1
          AND status IN ($2, $3, $4)
        GROUP BY 1`,
      [
        userId,
        AmazonAccountStatus.NEEDS_REAUTH,
        AmazonAccountStatus.INVALID,
        AmazonAccountStatus.LOCKED,
      ],
    );
    const amazonTally: Record<string, number> = {};
    let amazonTotal = 0;
    for (const row of amazon) {
      const count = toCount(row.count);
      amazonTotal += count;
      if (row.code) {
        amazonTally[row.code] = count;
      }
    }

    return [
      {
        key: ActionCenterItemKey.EBAY_ACCOUNT_DISCONNECTED,
        group: ActionCenterGroup.CONNECTIONS,
        severity: ActionCenterSeverity.CRITICAL,
        count: toCount(ebay[0]?.count),
        actionPath: '/stores',
      },
      {
        key: ActionCenterItemKey.AMAZON_ACCOUNT_NEEDS_ATTENTION,
        group: ActionCenterGroup.CONNECTIONS,
        severity: ActionCenterSeverity.CRITICAL,
        count: amazonTotal,
        breakdown: buildBreakdown(amazonTally),
        actionPath: '/settings?drawer=amazonAccounts',
      },
    ];
  }

  // -------------------------------------------------------------- listings

  private async listingItems(userId: string): Promise<ActionCenterItemDto[]> {
    /*
     * Terminal listing-creation failures, by structured failure code. The raw
     * provider message is deliberately not read here — it names internal fields
     * and is operator-only (see the failure-visibility split); the code is what
     * the seller can act on.
     */
    const failures = await this.db.query<BreakdownRow>(
      `SELECT COALESCE(i.failure_code, '') AS code, COUNT(*) AS count
         FROM listing_job_items i
         JOIN listing_jobs j ON j.id = i.job_id
        WHERE j.user_id = $1
          AND LOWER(i.status) = 'error'
          AND i.updated_at >= NOW() - ($2 || ' days')::INTERVAL
        GROUP BY 1`,
      [userId, String(JOB_FAILURE_WINDOW_DAYS)],
    );
    const failureTally: Record<string, number> = {};
    let failureTotal = 0;
    for (const row of failures) {
      const count = toCount(row.count);
      failureTotal += count;
      if (row.code) {
        failureTally[row.code] = (failureTally[row.code] ?? 0) + count;
      }
    }

    const drafts = await this.db.query<CountRow>(
      `SELECT COUNT(*) AS count FROM listings WHERE user_id = $1 AND status = $2`,
      [userId, ListingStatus.DRAFT],
    );

    /*
     * The source ASIN has failed refresh enough times to be quarantined —
     * almost always because Amazon delisted it. The eBay listing is still live
     * and still sellable, which is the whole danger: a sale on it cannot be
     * fulfilled. The platform stops refreshing such products but deliberately
     * does not end the listing, so this is the only place the seller learns.
     */
    const deadSource = await this.db.query<CountRow>(
      `SELECT COUNT(*) AS count
         FROM listings l
         JOIN products p ON p.id = l.product_id
        WHERE l.user_id = $1
          AND l.status = $2
          AND p.consecutive_failures >= $3`,
      [userId, ListingStatus.ACTIVE, SOURCE_UNAVAILABLE_FAILURE_THRESHOLD],
    );

    /*
     * Live on eBay at quantity 0. Not an error — the stock pipeline is working
     * exactly as designed — but a listing that cannot be bought earns nothing,
     * and the seller may want to swap the source or end it.
     */
    const outOfStock = await this.db.query<CountRow>(
      `SELECT COUNT(*) AS count
         FROM listings
        WHERE user_id = $1
          AND status = $2
          AND quantity <= 0`,
      [userId, ListingStatus.ACTIVE],
    );

    return [
      {
        key: ActionCenterItemKey.LISTING_JOB_FAILURES,
        group: ActionCenterGroup.LISTINGS,
        severity: ActionCenterSeverity.WARNING,
        count: failureTotal,
        breakdown: buildBreakdown(failureTally),
        context: { days: JOB_FAILURE_WINDOW_DAYS },
        // `hasFailures=true` (jobs with ≥1 failed item), not `status=failed` —
        // a job is only marked FAILED when EVERY item failed, so a partial
        // batch failure (the common case) would be invisible to a status
        // filter. `datePreset` mirrors the item-level 7-day count window.
        actionPath: '/listings/jobs?hasFailures=true&datePreset=last7Days',
      },
      {
        key: ActionCenterItemKey.LISTING_SOURCE_UNAVAILABLE,
        group: ActionCenterGroup.LISTINGS,
        severity: ActionCenterSeverity.WARNING,
        count: toCount(deadSource[0]?.count),
        actionPath: '/listings/all?status=active&sourceUnavailable=true',
      },
      {
        key: ActionCenterItemKey.LISTING_OUT_OF_STOCK,
        group: ActionCenterGroup.LISTINGS,
        severity: ActionCenterSeverity.WARNING,
        count: toCount(outOfStock[0]?.count),
        actionPath: '/listings/all?status=active&quantityMax=0',
      },
      {
        key: ActionCenterItemKey.LISTING_DRAFTS_PENDING,
        group: ActionCenterGroup.LISTINGS,
        severity: ActionCenterSeverity.INFO,
        count: toCount(drafts[0]?.count),
        actionPath: '/listings/all?status=draft',
      },
    ];
  }

  // ------------------------------------------------------------------ plan

  /**
   * Plan pressure, read through `BillingService.getSummary` rather than the
   * billing tables directly — quota is "usage + open reservations", and a
   * second implementation of that arithmetic would eventually disagree with the
   * one that actually refuses the work.
   *
   * With enforcement off (the transition default) nothing here can block the
   * seller, so nothing is reported: warning about a limit that is not enforced
   * is a false alarm.
   */
  private async planItems(userId: string): Promise<ActionCenterItemDto[]> {
    const summary = await this.billing.getSummary(userId);
    if (!summary.enforcementEnabled) {
      return [];
    }

    const items: ActionCenterItemDto[] = [];
    const now = new Date();

    for (const period of summary.usagePeriods) {
      const severity = resolveQuotaSeverity(period.usedQty, period.limitValueSnapshot);
      if (!severity) {
        continue;
      }
      // A limit key we have no item for is skipped rather than guessed at, so a
      // future plan dimension cannot surface as a mislabelled quota warning.
      const key = QUOTA_ITEM_BY_LIMIT_KEY[period.limitKey];
      if (!key) {
        continue;
      }
      items.push({
        key,
        group: ActionCenterGroup.PLAN,
        severity,
        // The count is "1 thing needs you" — the pressure itself. The numbers
        // the seller reads are in `context`; counting used slots here would
        // make the sidebar badge read in the thousands.
        count: 1,
        context: { used: period.usedQty, limit: period.limitValueSnapshot },
        actionPath: '/billing',
      });
    }

    const subscription = summary.subscription;
    if (subscription?.status === BillingSubscriptionStatus.PAST_DUE) {
      items.push({
        key: ActionCenterItemKey.PLAN_PAST_DUE,
        group: ActionCenterGroup.PLAN,
        severity: ActionCenterSeverity.CRITICAL,
        count: 1,
        actionPath: '/billing',
      });
    }

    if (subscription?.status === BillingSubscriptionStatus.TRIALING && subscription.trialEndsAt) {
      const days = daysUntil(new Date(subscription.trialEndsAt), now);
      if (days <= TRIAL_ENDING_NOTICE_DAYS) {
        items.push({
          key: ActionCenterItemKey.PLAN_TRIAL_ENDING,
          group: ActionCenterGroup.PLAN,
          severity: ActionCenterSeverity.WARNING,
          count: 1,
          context: { days },
          actionPath: '/billing',
        });
      }
    }

    return items;
  }

  // ----------------------------------------------------------------- setup

  /**
   * Foundational onboarding checklist — the first thing a brand-new registrant
   * sees, before there is a single listing or order to report on. Staging rules
   * live in the pure `buildSetupItems` (see its doc comment): no eBay account
   * shows only the eBay item, since every other destination here sits behind
   * the same `EbayAccountGuard` that gates the Settings hub; once eBay exists,
   * the remaining foundational gaps (Amazon account, store settings, listing
   * group) are reported together; auto-fulfillment readiness is only evaluated
   * once an Amazon account exists to evaluate it on.
   */
  private async setupItems(userId: string): Promise<ActionCenterItemDto[]> {
    const row = await this.db.query<{
      ebay_count: string;
      amazon_count: string;
      automated_count: string;
      store_settings_count: string;
      listing_group_count: string;
    }>(
      `SELECT
         (SELECT COUNT(*) FROM ebay_accounts WHERE user_id = $1) AS ebay_count,
         (SELECT COUNT(*) FROM amazon_accounts WHERE user_id = $1) AS amazon_count,
         (SELECT COUNT(*) FROM amazon_accounts
           WHERE user_id = $1
             AND status = $2
             AND auto_fulfill_enabled = TRUE
             AND auto_fulfill_cap_total IS NOT NULL
             AND auto_fulfill_cap_total > 0) AS automated_count,
         (SELECT COUNT(*) FROM store_settings WHERE user_id = $1 AND is_global = TRUE) AS store_settings_count,
         (SELECT COUNT(*) FROM listing_settings_groups WHERE user_id = $1) AS listing_group_count`,
      [userId, AmazonAccountStatus.ACTIVE],
    );

    return buildSetupItems({
      ebayCount: toCount(row[0]?.ebay_count),
      amazonCount: toCount(row[0]?.amazon_count),
      automatedCount: toCount(row[0]?.automated_count),
      storeSettingsCount: toCount(row[0]?.store_settings_count),
      listingGroupCount: toCount(row[0]?.listing_group_count),
    });
  }
}
