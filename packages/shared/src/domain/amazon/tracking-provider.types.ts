// packages/shared/src/domain/amazon/tracking-provider.types.ts
//
// Wire vocabulary for the external tracking-conversion provider (Aquiline).
// Values here are THEIR strings, not ours — they are matched against live
// payloads, so renaming a value silently breaks status handling.
//
// Sourced from the published v3 OpenAPI spec + webhook docs
// (developer.aquiline-tracking.com, read 2026-08-11).

/**
 * Status returned by `GET /v3/tracking/{trackingNumber}`.
 *
 * Note the inconsistent casing — `Shipping` is capitalised while the others are
 * not. That is how the provider sends it; normalise on read
 * (`parseTrackingProviderStatus`) rather than "fixing" it here.
 */
export enum TrackingProviderStatus {
  /** In transit. The normal state between conversion and delivery. */
  SHIPPING = 'Shipping',
  DELIVERED = 'delivered',
  OUT_FOR_DELIVERY = 'out_for_delivery',
  /** Assigned but not yet moving. */
  CREATED = 'created',
  /** Provider-side problem with the shipment. NOT the same as a failed request. */
  EXCEPTION = 'exception',
  CANCELLED = 'cancelled',
  DELAYED = 'delayed',
  ERROR = 'error',
}

/** Webhook event names accepted by `POST /v3/webhooks/subscriptions`. */
export enum TrackingWebhookEvent {
  IN_TRANSIT = 'shipment.in_transit',
  OUT_FOR_DELIVERY = 'shipment.out_for_delivery',
  DELIVERED = 'shipment.delivered',
  EXCEPTION = 'shipment.exception',
  /** Catch-all the provider sends for any status it has not mapped. */
  UPDATED = 'shipment.updated',
  PICKUP_UPDATED = 'pickup.updated',
}

/**
 * Whether the webhook carries new timeline entries or only a status move.
 * The provider sends `status_change` even when there are no new events, so a
 * handler that only reads `newEvents` would miss delivery.
 */
export enum TrackingWebhookChangeType {
  EVENT_APPEND = 'event_append',
  STATUS_CHANGE = 'status_change',
}

/** One entry in a tracking timeline. */
export interface TrackingProviderEvent {
  /** Free-text description from the underlying carrier. */
  content: string;
  location?: string | null;
  /** Provider format is `YYYY-MM-DD HH:mm:ss` — NOT ISO 8601, and not zoned. */
  time: string;
}

/** Response body of `GET /v3/tracking/{trackingNumber}`. */
export interface TrackingProviderStatusDto {
  number: string;
  status: string;
  oriCountry?: string | null;
  destCountry?: string | null;
  events?: TrackingProviderEvent[];
}

/** Webhook envelope delivered to our receiver. */
export interface TrackingWebhookPayload {
  type: string;
  /** ISO 8601, unlike the event timestamps inside `data`. */
  occurredAt: string;
  data: {
    trackingNumber: string;
    status?: string | null;
    statusCode?: string | null;
    changeType?: string | null;
    newEvents?: TrackingProviderEvent[];
  };
}

/**
 * Outcome of converting one Amazon tracking number.
 *
 * `shipmentId` is persisted alongside the number because the provider's own
 * integration guide requires it for later retrieval/cancellation, and because
 * it is the only handle on a paid resource we have already been billed for.
 */
export interface TrackingConversionResult {
  trackingNumber: string;
  shippingCarrierCode: string;
  /** Provider-side shipment handle; null for the local pass-through converter. */
  shipmentId: string | null;
}

/**
 * eBay carrier code for an Aquiline-issued number. eBay's Add-Tracking form
 * shows this verbatim as the carrier name, so it must match what eBay lists.
 */
export const AQUILINE_EBAY_CARRIER_CODE = 'AQUILINE';

/**
 * Shape of an Aquiline tracking number. Used to reject a malformed provider
 * response before it reaches eBay — specifically the case where we are talking
 * to the courier product rather than the conversion product and get back
 * something that is not an AQUA number at all.
 *
 * DELIBERATELY LOOSE, because two prefixes are attested and we do not know
 * which is authoritative:
 *   - `AQUAA6435850826YQ` — observed on a live eBay listing (2026-08-11)
 *   - `AQAA123456789YQ`   — the example in the published v3 OpenAPI spec
 *
 * The failure modes are asymmetric, which decides the trade-off. Too strict
 * and a valid number is rejected, the converter silently degrades to the
 * pass-through, and the supplier is exposed to the buyer with nothing visibly
 * broken. Too loose and a junk number reaches eBay, which rejects it loudly
 * and we find out immediately. Prefer the loud failure: match the whole `AQ…`
 * family rather than one exact prefix.
 */
export const AQUILINE_TRACKING_NUMBER_PATTERN = /^AQ[A-Z]{1,4}\d{6,}[A-Z]{0,3}$/i;
