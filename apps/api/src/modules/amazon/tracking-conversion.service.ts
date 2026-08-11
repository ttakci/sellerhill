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
  PlatformSettingKey,
  TrackingConversionProvider,
  type TrackingConversionResult,
} from '@repo/shared';

import { DatabaseService } from '../../common/database/database.service';
import { PlatformSettingsService } from '../../common/settings/platform-settings.service';

import {
  AquilineClient,
  AquilineError,
  AquilineErrorKind,
  type AquilineAddress,
  type AquilineConfig,
} from './aquiline.client';
import {
  AQUILINE_EBAY_CARRIER_CODE,
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
  shipping_address: StoredAddress | null;
  converted_tracking_number: string | null;
  converted_tracking_carrier: string | null;
  tracking_provider_shipment_id: string | null;
}

interface ResolvedSettingsRow {
  tracking_conversion_provider: string | null;
  tracking_provider_profile_id: string | null;
}

@Injectable()
export class TrackingConversionService {
  private readonly logger = new Logger(TrackingConversionService.name);
  private readonly local = new LocalTrackingConverter();

  constructor(
    private readonly databaseService: DatabaseService,
    private readonly platformSettings: PlatformSettingsService,
    private readonly aquiline: AquilineClient,
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
   * EVERY CARRIER IS CONVERTED, NOT JUST AMAZON LOGISTICS. There is
   * deliberately no `TB[A-Z]` gate here. Amazon ships a large share of orders
   * through UPS/USPS/FedEx, and a real carrier number is MORE revealing than a
   * TBA one, not less: the buyer can look it up and read the shipper and
   * origin. Converting only TBA would hide the supplier on some orders and
   * expose it on the rest, which defeats the purpose the seller is paying for.
   *
   * Do not "optimise" this by skipping real carriers. If a per-carrier policy
   * is ever wanted, it belongs in store settings as an explicit seller choice,
   * not as an implicit rule here — and note it has a real cost, since eBay
   * treats a native UPS/USPS number as stronger delivery evidence than a
   * third-party carrier in an Item-Not-Received case.
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
      `SELECT id, user_id, ebay_account_id, shipping_address,
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
        `SELECT tracking_conversion_provider, tracking_provider_profile_id
         FROM store_settings
         WHERE user_id = $1 AND (ebay_account_id = $2 OR ebay_account_id IS NULL)
         ORDER BY ebay_account_id NULLS LAST
         LIMIT 1`,
        [order.user_id, order.ebay_account_id],
      );
      return rows[0] ?? { tracking_conversion_provider: null, tracking_provider_profile_id: null };
    } catch (err) {
      // Settings resolution must never break the shipped push.
      this.logger.warn(
        `Order ${order.id}: could not resolve tracking settings (${(err as Error).message}) — using defaults`,
      );
      return { tracking_conversion_provider: null, tracking_provider_profile_id: null };
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
