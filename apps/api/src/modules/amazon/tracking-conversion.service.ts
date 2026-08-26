// apps/api/src/modules/amazon/tracking-conversion.service.ts
//
// Owns the decision "what tracking number does the eBay buyer see?", and the
// durable record of that decision.
//
// It exists as a service rather than living inside a `TrackingConverter`
// because an external conversion is three things a pure converter cannot be:
// it is BILLED, it needs the buyer address and the seller's provider profile,
// and its result MUST outlive the call. `AmazonTrackingProcessorService`
// deliberately rethrows when the eBay push fails so the next tick retries —
// without persistence that retry would buy a second tracking number and hand
// eBay a different one, leaving the buyer with a number that tracks nothing.
//
// FAIL-SOFT BY DESIGN. Every external failure degrades to the local
// pass-through (`Amazon_Logistics`), which is exactly today's behaviour. A
// provider outage, an exhausted plan quota or a revoked key must never stop a
// shipment being marked shipped on eBay — late tracking is a defect, missing
// fulfilment is worse.

import { Injectable, Logger } from '@nestjs/common';
import {
  AmazonMarketplace,
  AquilineProblemCode,
  AutoFulfillStatus,
  buildAmazonProductUrl,
  ConversionOutcome,
  isAquilineProblemCode,
  PlatformSettingKey,
  TrackingConversionProvider,
  TrackingConversionScope,
  type AquilineAssignResult,
  type AquilineMarketplaceOrder,
  type AquilineStoreAddress,
  type TrackingConversionResult,
} from '@repo/shared';

import { DatabaseService } from '../../common/database/database.service';
import { PlatformSettingsService } from '../../common/settings/platform-settings.service';
import { QuotaEnforcementService } from '../billing/quota-enforcement.service';

import {
  AQUILINE_PLAN_SNAPSHOT_INSERT_SQL,
  buildAquilinePlanSnapshotParams,
} from './aquiline-plan-snapshot.sql';
import { AquilineProfileService } from './aquiline-profile.service';
import { AquilineClient, AquilineError, AquilineErrorKind, type AquilineConfig } from './aquiline.client';
import {
  AQUILINE_EBAY_CARRIER_CODE,
  isAmazonLogisticsTracking,
  isExternalProvider,
  LocalTrackingConverter,
  type ConversionRequest,
} from './tracking-converter';

/** Amazon has no sandbox and no non-US site the platform supports today (see
 *  CLAUDE.md "Multi-marketplace architecture") — mirrors the same literal
 *  `AquilineProfileService` already navigates to for profile creation; kept
 *  local since this file has its own single Amazon-only call site. */
const AQUILINE_AMAZON_MARKETPLACE_HOST = 'www.amazon.com';

/** `AssignOrderBody.retailer` for the schema's Amazon example. */
const AQUILINE_AMAZON_RETAILER = 'amazon-us';

/**
 * Not a tracking NUMBER — the Integration API has no field for one (see the
 * design doc: "no such field; Amazon passes a ship-track page URL"). This
 * literal marks the order's origin, matching Aquiline's own schema example
 * for an Amazon assign (`retailer` + `marketplaceHost` + `sourceTracking`,
 * never `carrier`).
 */
const AQUILINE_SOURCE_TRACKING = 'Amazon';

/** Snapshot staleness. Aquiline's plan resets on the SUBSCRIPTION anniversary
 *  (`windowKey` equals `currentPeriodStart`, verified live 2026-08-23), not a
 *  calendar month, so the reset date cannot be computed locally. Expiring the
 *  snapshot after 24h means at worst one wasted call per day re-learns the
 *  real state, and a reset is never missed. */
export const PLAN_SNAPSHOT_TTL_MS = 24 * 60 * 60 * 1000;

/** Buyer address as stored in `orders.shipping_address`. */
interface StoredAddress {
  fullName?: string;
  street?: string;
  street2?: string;
  city?: string;
  state?: string;
  zipCode?: string;
  country?: string;
  phone?: string;
}

interface ConversionOrderRow {
  id: string;
  user_id: string;
  ebay_account_id: string | null;
  /** Drives the "was this linked by hand?" question — see the note in
   *  `resolveForOrder`. Never passed in by a caller. */
  auto_fulfill_status: string | null;
  shipping_address: StoredAddress | null;
  converted_tracking_number: string | null;
  converted_tracking_carrier: string | null;
  tracking_provider_shipment_id: string | null;
  /** What eBay actually received (Task 3, migration 089). eBay's Fulfillment
   *  API has no update endpoint, so once this is set the buyer's number can
   *  never be corrected — see `shouldRefuseOnDemandConversion`. */
  ebay_tracking_pushed_number: string | null;
  /** Everything below is only needed for the Aquiline sequence (profile
   *  resolution + `upsertOrders`/`assign` bodies) — joined in from
   *  `amazon_accounts`/`listings`, never written by this service. */
  amazon_account_id: string | null;
  amazon_order_id: string | null;
  amazon_order_url: string | null;
  amazon_tracking_url: string | null;
  order_date: Date | null;
  amazon_marketplace: string | null;
  amazon_account_email: string | null;
  listing_asin: string | null;
  listing_title: string | null;
}

interface ResolvedSettingsRow {
  tracking_conversion_provider: string | null;
  tracking_provider_profile_id: string | null;
  tracking_conversion_scope: string | null;
  tracking_convert_manual_orders: boolean | null;
}

/** Every field null/absent — resolution failed or no row exists. Callers fall
 *  back to the safe defaults (local provider, TB*-only scope). */
const EMPTY_SETTINGS: ResolvedSettingsRow = {
  tracking_conversion_provider: null,
  tracking_provider_profile_id: null,
  tracking_conversion_scope: null,
  tracking_convert_manual_orders: null,
};

@Injectable()
export class TrackingConversionService {
  private readonly logger = new Logger(TrackingConversionService.name);
  private readonly local = new LocalTrackingConverter();

  constructor(
    private readonly databaseService: DatabaseService,
    private readonly platformSettings: PlatformSettingsService,
    private readonly aquiline: AquilineClient,
    private readonly quotaEnforcement: QuotaEnforcementService,
    private readonly aquilineProfile: AquilineProfileService,
  ) {}

  /**
   * Resolve the tracking number to send to eBay for one order.
   *
   * Order of operations is the whole point:
   *   1. A stored conversion wins outright — never pay twice, never change the
   *      number a buyer has already been given.
   *   2. Local provider (the default) → pure transform, nothing persisted.
   *   3. External provider → convert, PERSIST, then return. Persistence is
   *      awaited before the caller pushes to eBay, so a crash between the two
   *      leaves a paid number recorded rather than orphaned.
   *
   * WHICH CARRIERS ARE CONVERTED IS THE SELLER'S CHOICE, never an implicit rule
   * in here. This method used to convert every carrier unconditionally, and its
   * comment explained why a hardcoded `TB[A-Z]` gate would be wrong AND where
   * the choice belonged instead — "in store settings as an explicit seller
   * choice". `store_settings.tracking_conversion_scope` (migration 086) is that
   * setting, and `isAmazonLogisticsTracking` is the same predicate the carrier
   * mapper already uses, so scope and carrier labelling cannot disagree.
   *
   * The trade-off the seller is making, in both directions:
   *   - Converting only TB* leaves UPS/USPS/FedEx native. Those numbers can
   *     often be looked up to reveal an Amazon origin, so some exposure remains
   *     — but a native carrier scan is stronger evidence than a third-party one
   *     in an eBay Item-Not-Received case, and it spends far less quota.
   *   - Converting everything maximises concealment and costs proportionally
   *     more, since conversions are the metered dimension.
   *
   * Three things make this fall back to the honest pass-through rather than
   * fail: a suspended subscription, an exhausted conversion quota, and a
   * manually linked order on an account that turned that off. None of them
   * block the shipment — eBay still gets a real, scannable number.
   */
  async resolveForOrder(request: ConversionRequest): Promise<TrackingConversionResult> {
    const order = await this.loadOrder(request.orderId);
    if (!order) {
      // No row to persist against; the honest transform is still correct.
      return this.passthroughResult(request, ConversionOutcome.PASSTHROUGH_TERMINAL);
    }

    if (order.converted_tracking_number) {
      this.logger.debug(
        `Order ${order.id}: reusing stored converted tracking ${order.converted_tracking_number}`,
      );
      return {
        trackingNumber: order.converted_tracking_number,
        shippingCarrierCode: order.converted_tracking_carrier || AQUILINE_EBAY_CARRIER_CODE,
        shipmentId: order.tracking_provider_shipment_id,
        outcome: ConversionOutcome.CONVERTED,
      };
    }

    const settings = await this.resolveSettings(order);
    const provider = normalizeProvider(settings.tracking_conversion_provider);
    if (!isExternalProvider(provider)) {
      return this.passthroughResult(request, ConversionOutcome.PASSTHROUGH_TERMINAL);
    }

    // Scope: does this carrier qualify under the seller's setting?
    const scope =
      settings.tracking_conversion_scope === TrackingConversionScope.ALL
        ? TrackingConversionScope.ALL
        : TrackingConversionScope.AMAZON_LOGISTICS_ONLY;
    if (
      !request.forceManual &&
      scope === TrackingConversionScope.AMAZON_LOGISTICS_ONLY &&
      !isAmazonLogisticsTracking(request.rawNumber, request.rawCarrier)
    ) {
      this.logger.debug(
        `Order ${order.id}: carrier is not Amazon Logistics and scope is ${scope} — passing through`,
      );
      return this.passthroughResult(request, ConversionOutcome.PASSTHROUGH_TERMINAL);
    }

    // Manually linked orders: converted only when the seller allows it. The
    // flag exists so linking a backlog cannot silently spend a month of quota;
    // it defaults to true so a seller who places every order by hand is still
    // protected without having to remember a per-order button.
    // Derived from the order row, never passed in by the caller. The platform
    // placing an order is the only thing that writes `placed`, so anything else
    // reached us by hand — the same rule `deriveFulfillmentState` uses to call
    // an order MANUAL. Deriving here means no call site can forget to set a
    // flag, and there is no second definition of "manual" to drift.
    const manuallyLinked = order.auto_fulfill_status !== AutoFulfillStatus.PLACED;
    if (!request.forceManual && manuallyLinked && settings.tracking_convert_manual_orders === false) {
      this.logger.debug(
        `Order ${order.id}: manually linked and manual conversion is off — passing through`,
      );
      return this.passthroughResult(request, ConversionOutcome.PASSTHROUGH_TERMINAL);
    }

    // Entitlement: a lapsed account does not get paid conversions.
    if (await this.quotaEnforcement.isSuspended(order.user_id)) {
      this.logger.warn(
        `Order ${order.id}: subscription suspended — falling back to pass-through`,
      );
      return this.passthroughResult(request, ConversionOutcome.PASSTHROUGH_TERMINAL);
    }

    // Monthly conversion quota. Exhaustion DEGRADES rather than blocks: the
    // order still ships and eBay still gets a scannable number, it is just the
    // raw Amazon one. Logged at error, not warn, because it silently un-hides
    // the supplier for every subsequent shipment — the exact thing the seller
    // is paying to avoid, and nothing else in the flow will fail to signal it.
    const quota = await this.quotaEnforcement.canConvertTracking(order.user_id);
    if (!quota.allowed) {
      this.logger.error(
        `Order ${order.id}: monthly tracking-conversion quota exhausted ` +
          `(${quota.used}/${quota.limitValue ?? '?'}) — falling back to pass-through`,
      );
      return this.passthroughResult(request, ConversionOutcome.PASSTHROUGH_TERMINAL);
    }

    const config = await this.resolveConfig();
    if (!this.aquiline.isConfigured(config)) {
      this.logger.warn(
        `Order ${order.id}: provider is ${provider} but no API key is configured — falling back to pass-through`,
      );
      return this.passthroughResult(request, ConversionOutcome.PASSTHROUGH_TERMINAL);
    }

    const recipient = toProviderAddress(order.shipping_address);
    if (!recipient) {
      // A conversion needs a deliverable recipient. Sending a half-address
      // would burn a paid conversion on a shipment the provider cannot track.
      this.logger.warn(
        `Order ${order.id}: buyer address incomplete — cannot convert, falling back to pass-through`,
      );
      return this.passthroughResult(request, ConversionOutcome.PASSTHROUGH_TERMINAL);
    }

    // Two cheap local preconditions, checked before any network call so a
    // permanently unconvertible order never costs a profile-creation attempt:
    //   - `marketplaceOrderId` is what `upsertOrders`/`uploadTrackingHtml`/
    //     `assign` all key on — without it there is nothing to upsert.
    //   - `trackingUrl` is required by `assign`'s schema. The processor
    //     (Task 7) supplies the real ship-track href on `request.trackingUrl`;
    //     the stored `amazon_tracking_url` column is the fallback for the
    //     on-demand path, which has no live page to read one from.
    const marketplaceOrderId = order.amazon_order_id;
    const trackingUrl = request.trackingUrl || order.amazon_tracking_url;
    if (!marketplaceOrderId || !trackingUrl) {
      this.logger.warn(
        `Order ${order.id}: missing Amazon order id or tracking URL — cannot convert, falling back to pass-through`,
      );
      return this.passthroughResult(request, ConversionOutcome.PASSTHROUGH_TERMINAL);
    }

    // One Aquiline profile per (user, Amazon marketplace) — lazy, cached,
    // ceiling-guarded. `ensureProfile` never throws; `null` means the caller
    // must fall back, same as every other precondition here.
    const marketplace = (order.amazon_marketplace as AmazonMarketplace) || AmazonMarketplace.AMAZON_US;
    const profileId = await this.aquilineProfile.ensureProfile(
      order.user_id,
      marketplace,
      order.amazon_account_email,
    );
    if (!profileId) {
      this.logger.warn(
        `Order ${order.id}: no Aquiline profile available — falling back to pass-through`,
      );
      return this.passthroughResult(request, ConversionOutcome.PASSTHROUGH_TERMINAL);
    }

    try {
      const marketplaceOrder: AquilineMarketplaceOrder = {
        marketplaceOrderId,
        ...(order.order_date ? { orderPlacedAt: order.order_date.toISOString() } : {}),
        ...(order.shipping_address?.fullName?.trim()
          ? { shipToName: order.shipping_address.fullName.trim() }
          : {}),
        shippingAddress: recipient,
        ...(order.listing_title ? { productTitle: order.listing_title } : {}),
        ...(order.listing_asin
          ? { productId: order.listing_asin, productUrl: buildAmazonProductUrl(order.listing_asin, marketplace) }
          : {}),
        ...(order.amazon_order_url ? { orderUrl: order.amazon_order_url } : {}),
        trackingUrl,
        // Not a tracking number — the Integration API has no field for one.
        // This marks the order's origin the same way `assign`'s body does.
        sourceTracking: AQUILINE_SOURCE_TRACKING,
      };
      await this.aquiline.upsertOrders(profileId, [marketplaceOrder], config);
      // Diagnostic only — a failed stamp must never fail the conversion that
      // already succeeded. See `stampOrderSynced`.
      await this.stampOrderSynced(order.id);

      if (request.trackingHtml) {
        await this.aquiline.uploadTrackingHtml(
          profileId,
          marketplaceOrderId,
          { trackingUrl, html: request.trackingHtml },
          config,
        );
        await this.stampHtmlUploaded(order.id);
      }

      // Consulted immediately before `assign`, so a plan we already know is
      // exhausted never spends a call on a guaranteed 402.
      const snapshot = await this.loadLatestPlanSnapshot();
      if (isPlanExhausted(snapshot, new Date())) {
        this.logger.error(
          `Order ${order.id}: Aquiline plan is exhausted (remaining ${snapshot?.planRemaining ?? '?'}) — ` +
            `falling back to pass-through`,
        );
        return this.passthroughResult(request, ConversionOutcome.PASSTHROUGH_TERMINAL);
      }

      const assigned = await this.aquiline.assign(
        profileId,
        marketplaceOrderId,
        {
          trackingUrl,
          // Amazon has exactly one assign shape whatever the shipping
          // carrier — Aquiline derives the carrier from the uploaded HTML.
          // NEVER send `carrier` here: the schema documents it as required
          // for a NON-Amazon assign only.
          retailer: AQUILINE_AMAZON_RETAILER,
          marketplaceHost: AQUILINE_AMAZON_MARKETPLACE_HOST,
          sourceTracking: AQUILINE_SOURCE_TRACKING,
        },
        config,
      );

      // Aquiline has ALREADY issued and billed this number — everything past
      // this point is bookkeeping, and a bookkeeping failure must never be
      // reported as "conversion did not happen" (Finding 1). `persistConverted`
      // never throws; it always tries its best and we always return the real
      // number regardless of which layer, if any, actually wrote it.
      await this.persistConverted(order.id, provider, assigned.aquiline);
      await this.recordPlanSnapshot(assigned);

      this.logger.log(
        `Order ${order.id}: converted ${request.rawNumber} -> ${assigned.aquiline} (${provider})`,
      );
      return {
        trackingNumber: assigned.aquiline,
        shippingCarrierCode: AQUILINE_EBAY_CARRIER_CODE,
        shipmentId: null,
        outcome: ConversionOutcome.CONVERTED,
      };
    } catch (err) {
      const retryable = this.logConversionFailure(order.id, err);
      return this.passthroughResult(
        request,
        retryable ? ConversionOutcome.PASSTHROUGH_RETRYABLE : ConversionOutcome.PASSTHROUGH_TERMINAL,
      );
    }
  }

  /** Wrap the honest pass-through with the outcome classification Task 7's
   *  `shouldDeferEbayPush` reads — every non-converted return goes through
   *  this so the field is never forgotten on a new early exit. */
  private passthroughResult(request: ConversionRequest, outcome: ConversionOutcome): TrackingConversionResult {
    return { ...this.local.convertSync(request), outcome };
  }

  /**
   * Re-upload the ship-track page HTML for an order the provider has ALREADY
   * issued a number for (spec 5.3 — the recurring feed).
   *
   * The provider derives the shipment's carrier and delivery context from this
   * page, and wants it roughly 1-2x per day while the order is in flight. Only
   * the shipped transition ever uploaded, and that runs exactly once, so
   * everything the provider knew about a shipment was frozen at the moment it
   * was converted.
   *
   * Three deliberate limits:
   *   - A STORED CONVERSION is the gate. An unconverted order has nothing on
   *     the provider side to refresh, and uploading for one would be an
   *     unpaid-for side effect on an order the seller may never convert.
   *   - It is NOT a conversion: no quota is consulted, no `assign` is called,
   *     nothing about the order's tracking number changes.
   *   - It never throws. Returning `false` is the whole error contract — a
   *     stale provider record is a degradation, and the caller is a tracking
   *     tick whose real job is detecting delivery.
   */
  async refreshTrackingHtml(input: {
    orderId: string;
    trackingUrl: string;
    trackingHtml: string;
  }): Promise<boolean> {
    if (!input.trackingUrl || !input.trackingHtml) {
      return false;
    }

    let order: ConversionOrderRow | null;
    try {
      order = await this.loadOrder(input.orderId);
    } catch (err) {
      this.logger.warn(
        `Order ${input.orderId}: ship-track HTML refresh skipped, order read failed: ${describeError(err)}`,
      );
      return false;
    }
    if (!order || !order.converted_tracking_number || !order.amazon_order_id) {
      return false;
    }

    const config = await this.resolveConfig();
    if (!this.aquiline.isConfigured(config)) {
      return false;
    }

    // Cached: the order is already converted, so a profile row exists and this
    // returns its id without a provider call. It never throws.
    const marketplace = (order.amazon_marketplace as AmazonMarketplace) || AmazonMarketplace.AMAZON_US;
    const profileId = await this.aquilineProfile.ensureProfile(
      order.user_id,
      marketplace,
      order.amazon_account_email,
    );
    if (!profileId) {
      return false;
    }

    try {
      await this.aquiline.uploadTrackingHtml(
        profileId,
        order.amazon_order_id,
        { trackingUrl: input.trackingUrl, html: input.trackingHtml },
        config,
      );
      await this.stampHtmlUploaded(order.id);
      this.logger.debug(`Order ${order.id}: refreshed the ship-track HTML held by the provider`);
      return true;
    } catch (err) {
      this.logger.warn(
        `Order ${order.id}: ship-track HTML refresh failed — the provider's copy stays stale. ${describeError(err)}`,
      );
      return false;
    }
  }

  /**
   * Failure logging that distinguishes an operator problem from a blip, and
   * returns whether the failure was retryable so the caller can classify the
   * `ConversionOutcome` it returns (Finding 2 — Task 7's `shouldDeferEbayPush`
   * needs that bit and cannot see inside this file).
   *
   * A revoked key, an exhausted plan quota or a full profile ceiling silently
   * degrades every order to pass-through — the supplier stops being hidden,
   * which is the thing the seller is paying to avoid. That has to be loud,
   * and it must not read like a transient network warning.
   */
  private logConversionFailure(orderId: string, err: unknown): boolean {
    if (err instanceof AquilineError) {
      const problem = toProblemCode(err.code);
      const retryable = isRetryableConversionFailure(err.kind, problem);
      const actionable =
        err.kind === AquilineErrorKind.UNAUTHORIZED ||
        err.kind === AquilineErrorKind.QUOTA_EXCEEDED ||
        err.kind === AquilineErrorKind.PROFILE_CEILING;
      const message =
        `Order ${orderId}: tracking conversion failed (${err.kind}${problem ? `/${problem}` : ''}, ` +
        `${retryable ? 'retryable' : 'terminal'}) — falling back to the Amazon number, so the supplier ` +
        `is visible to the buyer. ${err.message}`;
      if (actionable) {
        this.logger.error(message);
      } else {
        this.logger.warn(message);
      }
      return retryable;
    }
    this.logger.warn(
      `Order ${orderId}: tracking conversion failed unexpectedly — falling back to pass-through. ` +
        `${(err as Error).message}`,
    );
    return false;
  }

  /**
   * Convert an order's tracking on the seller's explicit request.
   *
   * The gaps this fills are real ones: a conversion may not have happened
   * because the quota was full at the time, because the provider was down,
   * because the buyer address was incomplete when the shipment was first seen,
   * or because the seller had manual conversion switched off and has changed
   * their mind. Without a manual trigger the only recovery was to wait for a
   * retry that would never come — the tracking push happens once.
   *
   * It goes through `resolveForOrder`, not around it, so every rule still
   * applies: an already-converted order is returned as-is rather than paid for
   * twice, a suspended account is refused, and the quota is spent the same way.
   * The one rule it bypasses is the manual-orders switch, because clicking the
   * button IS the consent that switch exists to ask for.
   *
   * Returns whether a conversion is now on the order, plus a machine-readable
   * reason when it is not, so the caller can tell the seller WHY rather than
   * showing a generic failure.
   */
  async convertOnDemand(orderId: string): Promise<{
    converted: boolean;
    trackingNumber: string | null;
    reasonKey: string | null;
  }> {
    const order = await this.loadOrder(orderId);
    if (!order) {
      return { converted: false, trackingNumber: null, reasonKey: 'orders.errors.notFound' };
    }
    if (order.converted_tracking_number) {
      return {
        converted: true,
        trackingNumber: order.converted_tracking_number,
        reasonKey: null,
      };
    }

    // eBay's Fulfillment API has no update endpoint (createShippingFulfillment
    // is POST-only), so once the raw Amazon number has been pushed the buyer's
    // tracking number can never be corrected. Buying a conversion now would be
    // pure spend with zero buyer-visible effect — refuse BEFORE the quota is
    // touched or the provider is ever called.
    if (
      shouldRefuseOnDemandConversion({
        convertedTrackingNumber: order.converted_tracking_number,
        ebayTrackingPushedNumber: order.ebay_tracking_pushed_number,
      })
    ) {
      return {
        converted: false,
        trackingNumber: null,
        reasonKey: 'orders.errors.trackingAlreadyPushed',
      };
    }

    // The order must be one we can actually publish to eBay, or converting it
    // is worse than doing nothing.
    //
    // `handleShipped` refuses to push a fulfillment when the order has no
    // linked listing (it needs the listing's eBay item id as the line item),
    // and it makes that check BEFORE converting — so the automatic path is
    // already safe. This on-demand path bypassed it, and the result was not
    // merely a wasted $0.10:
    //
    //   1. the paid number is written to `converted_tracking_number`;
    //   2. `handleShipped` still refuses the push, so eBay never receives it;
    //   3. `hasWebhookDeliveryCoverage` now sees a converted number and STOPS
    //      Amazon polling, because delivery is supposed to arrive by webhook.
    //
    // The order is then stranded in SHIPPED forever with a tracking number
    // nobody was ever given. Refusing up front is the only safe answer.
    if (!(await this.isPublishableToEbay(orderId))) {
      return {
        converted: false,
        trackingNumber: null,
        reasonKey: 'orders.errors.orderNotTracked',
      };
    }

    const raw = await this.loadRawTracking(orderId);
    if (!raw.number) {
      // Nothing to convert yet — the Amazon order has not shipped. This is the
      // most likely reason a seller finds the action unavailable, so it gets
      // its own message instead of "conversion failed".
      return {
        converted: false,
        trackingNumber: null,
        reasonKey: 'orders.errors.noTrackingYet',
      };
    }

    const result = await this.resolveForOrder({
      orderId,
      rawNumber: raw.number,
      rawCarrier: raw.carrier ?? '',
      forceManual: true,
    });

    // resolveForOrder falls back to the honest pass-through on every failure,
    // so "did it convert?" is answered by what landed on the row, never by the
    // absence of a thrown error.
    const after = await this.loadOrder(orderId);
    if (after?.converted_tracking_number) {
      return {
        converted: true,
        trackingNumber: after.converted_tracking_number,
        reasonKey: null,
      };
    }
    return {
      converted: false,
      trackingNumber: result.trackingNumber,
      reasonKey: 'orders.errors.conversionUnavailable',
    };
  }

  /**
   * Whether a converted number could actually reach eBay for this order.
   *
   * Deliberately the SAME condition `handleShipped` pushes on — a linked
   * listing carrying an eBay item id, which is the line item a fulfillment is
   * created against. Asking a different question here (e.g. only
   * `listing_id IS NOT NULL`) would let the two drift, and the direction that
   * drifts is the expensive one: converting something that can never be
   * published.
   */
  private async isPublishableToEbay(orderId: string): Promise<boolean> {
    const rows = await this.databaseService.query<{ ebay_item_id: string | null }>(
      `SELECT l.ebay_item_id
         FROM orders o
         JOIN listings l ON l.id = o.listing_id
        WHERE o.id = $1`,
      [orderId],
    );
    return Boolean(rows[0]?.ebay_item_id);
  }

  /** Amazon's own tracking number/carrier for an order, if it has shipped. */
  private async loadRawTracking(
    orderId: string,
  ): Promise<{ number: string | null; carrier: string | null }> {
    const rows = await this.databaseService.query<{
      amazon_tracking_number: string | null;
      amazon_tracking_carrier: string | null;
    }>(
      `SELECT amazon_tracking_number, amazon_tracking_carrier FROM orders WHERE id = $1`,
      [orderId],
    );
    return {
      number: rows[0]?.amazon_tracking_number ?? null,
      carrier: rows[0]?.amazon_tracking_carrier ?? null,
    };
  }

  /** Layer 1 of `persistConverted` — the full write. Throws on failure; the
   *  caller is the only one that decides what happens next. Never call this
   *  directly from `resolveForOrder` — go through `persistConverted`. */
  private async persist(
    orderId: string,
    provider: TrackingConversionProvider,
    trackingNumber: string,
    shipmentId: string | null,
  ): Promise<void> {
    await this.databaseService.query(
      `UPDATE orders SET
         converted_tracking_number     = $1,
         converted_tracking_carrier    = $2,
         tracking_provider_shipment_id = $3,
         tracking_provider             = $4,
         tracking_converted_at         = NOW(),
         updated_at                    = CURRENT_TIMESTAMP
       WHERE id = $5`,
      [trackingNumber, AQUILINE_EBAY_CARRIER_CODE, shipmentId, provider, orderId],
    );
  }

  /**
   * Record a converted tracking number in up to three fail-soft layers,
   * mirroring `AmazonCheckoutService.onPlaced` (CLAUDE.md "Money safety —
   * onPlaced (fail-soft layered)"). By the time this runs, Aquiline has
   * ALREADY issued and billed the AQUA number — a persistence failure here
   * must never be reported as "conversion did not happen", or the next
   * retry finds nothing stored and calls `assign` again: a real re-buy.
   *
   * Layer 1: the full write (`persist`) — number, carrier, shipment id,
   *   provider, timestamps.
   * Layer 2: a minimal write — just the two columns eBay actually needs
   *   (`converted_tracking_number`/`converted_tracking_carrier`), fewer
   *   columns and fewer ways to fail.
   * Layer 3: both writes failed. Nothing local now records a real, billed
   *   AQUA number, so this is logged at `error` (not `warn`) WITH the
   *   number, so it can be recovered by hand — the log line is the only
   *   remaining record.
   *
   * Never throws. `resolveForOrder` returns the converted number in every
   * case regardless of which layer (if any) actually wrote it.
   */
  private async persistConverted(
    orderId: string,
    provider: TrackingConversionProvider,
    trackingNumber: string,
  ): Promise<void> {
    try {
      await this.persist(orderId, provider, trackingNumber, null);
      return;
    } catch (err) {
      this.logger.warn(
        `Order ${orderId}: full persist of converted tracking ${trackingNumber} failed ` +
          `(${(err as Error).message}) — trying a minimal write`,
      );
    }

    try {
      await this.databaseService.query(
        `UPDATE orders SET converted_tracking_number = $1, converted_tracking_carrier = $2 WHERE id = $3`,
        [trackingNumber, AQUILINE_EBAY_CARRIER_CODE, orderId],
      );
    } catch (err) {
      this.logger.error(
        `Order ${orderId}: Aquiline issued AQUA number ${trackingNumber} but BOTH persist layers failed ` +
          `(${(err as Error).message}) — nothing local records this conversion; recover it by hand.`,
      );
    }
  }

  /** Diagnostic timestamp — `orders.aquiline_order_synced_at` (migration 089).
   *  Best-effort: a failed stamp must never fail a conversion that already
   *  succeeded. */
  private async stampOrderSynced(orderId: string): Promise<void> {
    try {
      await this.databaseService.query(`UPDATE orders SET aquiline_order_synced_at = NOW() WHERE id = $1`, [
        orderId,
      ]);
    } catch (err) {
      this.logger.warn(`Order ${orderId}: could not stamp aquiline_order_synced_at: ${(err as Error).message}`);
    }
  }

  /** Diagnostic timestamp — `orders.tracking_html_uploaded_at` (migration 089).
   *  Same best-effort contract as `stampOrderSynced`. */
  private async stampHtmlUploaded(orderId: string): Promise<void> {
    try {
      await this.databaseService.query(`UPDATE orders SET tracking_html_uploaded_at = NOW() WHERE id = $1`, [
        orderId,
      ]);
    } catch (err) {
      this.logger.warn(`Order ${orderId}: could not stamp tracking_html_uploaded_at: ${(err as Error).message}`);
    }
  }

  private async loadOrder(orderId: string): Promise<ConversionOrderRow | null> {
    const rows = await this.databaseService.query<ConversionOrderRow>(
      `SELECT o.id, o.user_id, o.ebay_account_id, o.shipping_address, o.auto_fulfill_status,
              o.converted_tracking_number, o.converted_tracking_carrier,
              o.tracking_provider_shipment_id, o.ebay_tracking_pushed_number,
              o.amazon_account_id, o.amazon_order_id,
              o.amazon_order_url, o.amazon_tracking_url, o.order_date,
              aa.marketplace AS amazon_marketplace, aa.email AS amazon_account_email,
              l.asin AS listing_asin, l.title AS listing_title
       FROM orders o
       LEFT JOIN amazon_accounts aa ON aa.id = o.amazon_account_id
       LEFT JOIN listings l ON l.id = o.listing_id
       WHERE o.id = $1`,
      [orderId],
    );
    return rows[0] ?? null;
  }

  /**
   * Provider + profile for this order, using the same Store > Global > Default
   * precedence as the rest of `store_settings`. Passing the order's eBay
   * account (rather than always NULL) is what makes a per-store override real —
   * the auto-fulfill gate had exactly this bug once.
   */
  private async resolveSettings(order: ConversionOrderRow): Promise<ResolvedSettingsRow> {
    try {
      const rows = await this.databaseService.query<ResolvedSettingsRow>(
        `SELECT tracking_conversion_provider, tracking_provider_profile_id,
                tracking_conversion_scope, tracking_convert_manual_orders
         FROM store_settings
         WHERE user_id = $1 AND (ebay_account_id = $2 OR ebay_account_id IS NULL)
         ORDER BY ebay_account_id NULLS LAST
         LIMIT 1`,
        [order.user_id, order.ebay_account_id],
      );
      return rows[0] ?? EMPTY_SETTINGS;
    } catch (err) {
      // Settings resolution must never break the shipped push.
      this.logger.warn(
        `Order ${order.id}: could not resolve tracking settings (${(err as Error).message}) — using defaults`,
      );
      return EMPTY_SETTINGS;
    }
  }

  /** Effective provider credentials/config (panel override → env → default).
   *  Same resolution — and, necessarily, the same duplication — as
   *  `AquilineProfileService`'s private `resolveConfig`: that method isn't
   *  reachable from here, and this task's file list doesn't include it. */
  async resolveConfig(): Promise<AquilineConfig> {
    const [baseUrl, token, profilePrefix, maxProfiles, timeoutMs] = await Promise.all([
      this.platformSettings.getString(PlatformSettingKey.AQUILINE_BASE_URL),
      this.platformSettings.getString(PlatformSettingKey.AQUILINE_API_KEY),
      this.platformSettings.getString(PlatformSettingKey.AQUILINE_PROFILE_PREFIX),
      this.platformSettings.getNumber(PlatformSettingKey.AQUILINE_MAX_PROFILES),
      this.platformSettings.getNumber(PlatformSettingKey.AQUILINE_TIMEOUT_MS),
    ]);
    return {
      baseUrl: baseUrl || 'https://aquiline-tracking.com/app/api/integration',
      token: token || null,
      profilePrefix: profilePrefix || 'sh',
      maxProfiles: Number.isFinite(maxProfiles) && maxProfiles > 0 ? maxProfiles : 10,
      timeoutMs: Number.isFinite(timeoutMs) && timeoutMs > 0 ? timeoutMs : 15_000,
    };
  }

  /** Most recent `aquiline_plan_snapshot` row, or `null` on no row / a read
   *  failure — both read by `isPlanExhausted` as "unknown", which fails open
   *  (never short-circuits) rather than fabricating exhaustion. */
  private async loadLatestPlanSnapshot(): Promise<{ planRemaining: number | null; capturedAt: Date } | null> {
    try {
      const rows = await this.databaseService.query<{
        plan_remaining: number | null;
        captured_at: Date;
      }>(`SELECT plan_remaining, captured_at FROM aquiline_plan_snapshot ORDER BY captured_at DESC LIMIT 1`);
      const row = rows[0];
      if (!row) {
        return null;
      }
      return { planRemaining: row.plan_remaining, capturedAt: new Date(row.captured_at) };
    } catch (err) {
      this.logger.warn(`Could not load the Aquiline plan snapshot: ${(err as Error).message}`);
      return null;
    }
  }

  /** Append-only, mirroring `keepa_balance` — one row per `assign` response.
   *  A write failure only costs the next call's early-exit optimisation, so
   *  it is logged and swallowed rather than allowed to fail the conversion
   *  that already succeeded. */
  private async recordPlanSnapshot(result: AquilineAssignResult): Promise<void> {
    try {
      await this.databaseService.query(
        AQUILINE_PLAN_SNAPSHOT_INSERT_SQL,
        buildAquilinePlanSnapshotParams({
          planLimit: result.planLimit,
          planUsed: result.planUsed,
          planRemaining: result.planRemaining,
        }),
      );
    } catch (err) {
      this.logger.warn(`Could not record the Aquiline plan snapshot: ${(err as Error).message}`);
    }
  }
}

/** One-line description of any thrown value, naming the provider failure kind
 *  when there is one. Used by the paths that only LOG a failure, so an
 *  `AquilineError` never degrades to a bare message with no kind on it. */
function describeError(err: unknown): string {
  if (err instanceof AquilineError) {
    return `${err.kind}${err.code ? ` (${err.code})` : ''}: ${err.message}`;
  }
  return err instanceof Error ? err.message : String(err);
}

/** Buyer address → the provider's wire shape (`AquilineStoreAddress`, snake_case
 *  and split first/last name — unlike the rest of this API), or null when it is
 *  not deliverable. */
export function toProviderAddress(address: StoredAddress | null): AquilineStoreAddress | null {
  if (!address) {
    return null;
  }
  const name = address.fullName?.trim();
  const addressLine1 = address.street?.trim();
  const city = address.city?.trim();
  const country = (address.country?.trim() || 'US').toUpperCase();
  // Name, street and city are the minimum a carrier can deliver against. A
  // missing postcode is tolerated (some countries have none); a missing street
  // is not.
  if (!name || !addressLine1 || !city) {
    return null;
  }
  const { firstName, lastName } = splitBuyerName(name);
  return {
    ...(firstName ? { first_name: firstName } : {}),
    ...(lastName ? { last_name: lastName } : {}),
    address_line1: addressLine1,
    ...(address.street2?.trim() ? { address_line2: address.street2.trim() } : {}),
    city,
    ...(address.state?.trim() ? { state: address.state.trim() } : {}),
    ...(address.zipCode?.trim() ? { zip_code: address.zipCode.trim() } : {}),
    country,
    ...(address.phone?.trim() ? { phone_number: address.phone.trim() } : {}),
  };
}

/** First/last split of a single display name, since `AquilineStoreAddress`
 *  carries them separately. Mirrors `AquilineProfileService`'s own
 *  `splitShipFromName` — that one is private to its file, and this is a
 *  two-line function, so a small duplicate beats a cross-file import for it. */
function splitBuyerName(name: string): { firstName?: string; lastName?: string } {
  const parts = name.trim().split(/\s+/);
  if (parts.length === 1) {
    return { firstName: parts[0] };
  }
  return { firstName: parts.slice(0, -1).join(' '), lastName: parts[parts.length - 1] };
}

/** Narrow the provider's raw `code` string to the known vocabulary. An
 *  unrecognised code degrades to `null` ("some problem") rather than being
 *  cast — see `isAquilineProblemCode`'s own doc comment. */
function toProblemCode(code: string | null | undefined): AquilineProblemCode | null {
  return typeof code === 'string' && isAquilineProblemCode(code) ? code : null;
}

/**
 * Whether a failed conversion is worth deferring the eBay push for.
 *
 * Retryable means "the same request may succeed shortly". A plan wall, a
 * revoked token, a full profile ceiling and a rejected page all give the same
 * answer next time, so deferring only delays the seller's fulfilment.
 */
export function isRetryableConversionFailure(
  kind: AquilineErrorKind,
  problem: AquilineProblemCode | null,
): boolean {
  if (problem === AquilineProblemCode.NEEDS_TRACKING_UPLOAD) {
    return true;
  }
  if (problem === AquilineProblemCode.UPDATE_NOT_APPLIED) {
    return true;
  }
  if (problem !== null) {
    return false;
  }
  return kind === AquilineErrorKind.TRANSPORT;
}

/**
 * Whether the last known Aquiline plan snapshot says nothing is left.
 *
 * Spending a call on a guaranteed 402 wastes a request and logs noise, so
 * this short-circuits BEFORE `assign` — see `resolveForOrder`. A `null`
 * `planRemaining` (never observed, or the read itself failed) fails open: an
 * unknown count must never be read as exhaustion. A snapshot older than
 * `PLAN_SNAPSHOT_TTL_MS` is treated the same way, since Aquiline's window
 * resets on the subscription anniversary, not a date this code can compute.
 */
export function isPlanExhausted(
  snapshot: { planRemaining: number | null; capturedAt: Date } | null,
  now: Date,
): boolean {
  if (!snapshot || snapshot.planRemaining === null) {
    return false;
  }
  if (now.getTime() - snapshot.capturedAt.getTime() > PLAN_SNAPSHOT_TTL_MS) {
    return false;
  }
  return snapshot.planRemaining <= 0;
}

/**
 * Whether an on-demand conversion must be refused because eBay already has
 * the raw Amazon number.
 *
 * `createShippingFulfillment` is POST-only — eBay's Fulfillment API has no
 * update endpoint — so once `ebayTrackingPushedNumber` is set, the buyer's
 * tracking number is permanent. Converting after that point would spend a
 * paid conversion with no buyer-visible effect: the buyer already saw (and
 * will always see) the raw number.
 *
 * `convertedTrackingNumber` is checked too so this predicate is safe to call
 * even when a conversion already exists on the order — that case is a
 * success (the existing AQUA number is returned), never a refusal, and
 * `convertOnDemand` short-circuits on it first regardless.
 */
export function shouldRefuseOnDemandConversion(args: {
  convertedTrackingNumber: string | null;
  ebayTrackingPushedNumber: string | null;
}): boolean {
  return !args.convertedTrackingNumber && Boolean(args.ebayTrackingPushedNumber);
}

/** Stored provider string → enum, defaulting to LOCAL for anything unknown. */
export function normalizeProvider(value: string | null): TrackingConversionProvider {
  switch (value) {
    case TrackingConversionProvider.AQUILINE:
    case TrackingConversionProvider.API:
      return TrackingConversionProvider.AQUILINE;
    default:
      return TrackingConversionProvider.LOCAL;
  }
}
