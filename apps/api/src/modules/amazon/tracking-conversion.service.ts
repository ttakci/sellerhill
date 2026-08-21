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
  AutoFulfillStatus,
  PlatformSettingKey,
  TrackingConversionProvider,
  TrackingConversionScope,
  type TrackingConversionResult,
} from '@repo/shared';

import { DatabaseService } from '../../common/database/database.service';
import { PlatformSettingsService } from '../../common/settings/platform-settings.service';
import { QuotaEnforcementService } from '../billing/quota-enforcement.service';

import {
  AquilineClient,
  AquilineError,
  AquilineErrorKind,
  type AquilineAddress,
  type AquilineConfig,
} from './aquiline.client';
import {
  AQUILINE_EBAY_CARRIER_CODE,
  isAmazonLogisticsTracking,
  isExternalProvider,
  LocalTrackingConverter,
  type ConversionRequest,
} from './tracking-converter';

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
      return this.local.convertSync(request);
    }

    if (order.converted_tracking_number) {
      this.logger.debug(
        `Order ${order.id}: reusing stored converted tracking ${order.converted_tracking_number}`,
      );
      return {
        trackingNumber: order.converted_tracking_number,
        shippingCarrierCode: order.converted_tracking_carrier || AQUILINE_EBAY_CARRIER_CODE,
        shipmentId: order.tracking_provider_shipment_id,
      };
    }

    const settings = await this.resolveSettings(order);
    const provider = normalizeProvider(settings.tracking_conversion_provider);
    if (!isExternalProvider(provider)) {
      return this.local.convertSync(request);
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
      return this.local.convertSync(request);
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
      return this.local.convertSync(request);
    }

    // Entitlement: a lapsed account does not get paid conversions.
    if (await this.quotaEnforcement.isSuspended(order.user_id)) {
      this.logger.warn(
        `Order ${order.id}: subscription suspended — falling back to pass-through`,
      );
      return this.local.convertSync(request);
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
      return this.local.convertSync(request);
    }

    const config = await this.resolveConfig();
    if (!this.aquiline.isConfigured(config)) {
      this.logger.warn(
        `Order ${order.id}: provider is ${provider} but no API key is configured — falling back to pass-through`,
      );
      return this.local.convertSync(request);
    }

    const recipient = toProviderAddress(order.shipping_address);
    if (!recipient) {
      // A conversion needs a deliverable recipient. Sending a half-address
      // would burn a paid conversion on a shipment the provider cannot track.
      this.logger.warn(
        `Order ${order.id}: buyer address incomplete — cannot convert, falling back to pass-through`,
      );
      return this.local.convertSync(request);
    }

    try {
      const converted = await this.aquiline.createConversion(
        {
          externalOrderId: order.id,
          sourceTrackingNumber: request.rawNumber,
          sourceCarrier: request.rawCarrier || null,
          recipient,
          partnerId: settings.tracking_provider_profile_id,
        },
        config,
      );

      await this.persist(order.id, provider, converted.trackingNumber, converted.shipmentId);

      this.logger.log(
        `Order ${order.id}: converted ${request.rawNumber} -> ${converted.trackingNumber} (${provider})`,
      );
      return {
        trackingNumber: converted.trackingNumber,
        shippingCarrierCode: AQUILINE_EBAY_CARRIER_CODE,
        shipmentId: converted.shipmentId,
      };
    } catch (err) {
      this.logConversionFailure(order.id, err);
      return this.local.convertSync(request);
    }
  }

  /**
   * Failure logging that distinguishes an operator problem from a blip.
   *
   * A revoked key or an exhausted plan quota silently degrades every order to
   * pass-through — the supplier stops being hidden, which is the thing the
   * seller is paying to avoid. That has to be loud, and it must not read like
   * a transient network warning.
   */
  private logConversionFailure(orderId: string, err: unknown): void {
    if (err instanceof AquilineError) {
      const actionable =
        err.kind === AquilineErrorKind.UNAUTHORIZED || err.kind === AquilineErrorKind.QUOTA_EXCEEDED;
      const message =
        `Order ${orderId}: tracking conversion failed (${err.kind}) — ` +
        `falling back to the Amazon number, so the supplier is visible to the buyer. ${err.message}`;
      if (actionable) {
        this.logger.error(message);
      } else {
        this.logger.warn(message);
      }
      return;
    }
    this.logger.warn(
      `Order ${orderId}: tracking conversion failed unexpectedly — falling back to pass-through. ` +
        `${(err as Error).message}`,
    );
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

  /** Persist the paid result. Failure here is fatal to the conversion path —
   *  an unrecorded conversion would be re-bought on the next retry. */
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

  private async loadOrder(orderId: string): Promise<ConversionOrderRow | null> {
    const rows = await this.databaseService.query<ConversionOrderRow>(
      `SELECT id, user_id, ebay_account_id, shipping_address, auto_fulfill_status,
              converted_tracking_number, converted_tracking_carrier,
              tracking_provider_shipment_id
       FROM orders WHERE id = $1`,
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

  /** Effective provider credentials/config (panel override → env → default). */
  async resolveConfig(): Promise<AquilineConfig> {
    const [baseUrl, apiKey, partnerId, timeoutMs] = await Promise.all([
      this.platformSettings.getString(PlatformSettingKey.AQUILINE_BASE_URL),
      this.platformSettings.getString(PlatformSettingKey.AQUILINE_API_KEY),
      this.platformSettings.getString(PlatformSettingKey.AQUILINE_PARTNER_ID),
      this.platformSettings.getNumber(PlatformSettingKey.AQUILINE_TIMEOUT_MS),
    ]);
    return {
      baseUrl: baseUrl || 'https://api.aquiline-tracking.com/v3',
      apiKey: apiKey || null,
      partnerId: partnerId || null,
      timeoutMs: Number.isFinite(timeoutMs) && timeoutMs > 0 ? timeoutMs : 15_000,
    };
  }
}

/** Buyer address → provider address, or null when it is not deliverable. */
export function toProviderAddress(address: StoredAddress | null): AquilineAddress | null {
  if (!address) {
    return null;
  }
  const name = address.fullName?.trim();
  const addressLine1 = address.street?.trim();
  const city = address.city?.trim();
  const countryCode = (address.country?.trim() || 'US').toUpperCase();
  // Name, street and city are the minimum a carrier can deliver against. A
  // missing postcode is tolerated (some countries have none); a missing street
  // is not.
  if (!name || !addressLine1 || !city) {
    return null;
  }
  return {
    name,
    phone: address.phone?.trim() || null,
    countryCode,
    city,
    addressLine1,
    addressLine2: address.street2?.trim() || null,
    postalCode: address.zipCode?.trim() || null,
  };
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
