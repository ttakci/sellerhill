// packages/shared/src/domain/amazon/tracking-provider.types.ts
//
// Wire vocabulary for the external tracking-conversion provider (Aquiline).
// Values here are THEIR strings, not ours — they are matched against live
// payloads, so renaming a value silently breaks status handling.
//
// Sourced from the published v3 Integration API spec
// (developer.aquiline-tracking.com, read 2026-08-23).

/**
 * Public problem codes. The document is explicit that payloads use these and
 * never internal parser names, so this enum is the whole vocabulary a seller
 * or an operator can ever be shown.
 */
export enum AquilineProblemCode {
  WRONG_PAGE_TYPE = 'wrong_page_type',
  AMAZON_SESSION_EXPIRED = 'amazon_session_expired',
  TRACKING_URL_MISMATCH = 'tracking_url_mismatch',
  NEEDS_TRACKING_UPLOAD = 'needs_tracking_upload',
  UPDATE_NOT_APPLIED = 'update_not_applied',
  ASSIGN_VALIDATION = 'assign_validation',
  SHIPMENT_EXCEPTION = 'shipment_exception',
  TRACKING_UPDATE_UNAVAILABLE = 'tracking_update_unavailable',
}

/**
 * Narrow an arbitrary provider string. The provider may add codes; an unknown
 * one must degrade to "some problem" rather than be cast into the enum, which
 * would let it masquerade as a known code everywhere downstream.
 */
export function isAquilineProblemCode(value: string): value is AquilineProblemCode {
  return (Object.values(AquilineProblemCode) as string[]).includes(value);
}

export enum AquilineWebhookEvent {
  HTML_ACCEPTED = 'tracking.html.accepted',
  HTML_APPLIED = 'tracking.html.applied',
  HTML_REJECTED = 'tracking.html.rejected',
  PROBLEM_OPENED = 'tracking.problem.opened',
  PROBLEM_CLEARED = 'tracking.problem.cleared',
}

/**
 * `accepted` means stored and validated, NOT applied. The API document warns
 * against treating success alone as applied, which is why the deferral in
 * Task 7 exists.
 */
export enum AquilineHtmlOutcome {
  ACCEPTED = 'accepted',
  APPLIED = 'applied',
}

export enum AquilineAccountOrigin {
  AMAZON = 'amazon',
  ALIEXPRESS = 'aliexpress',
  WALMART = 'walmart',
}

/** Provider address shape — snake_case on the wire, unlike the rest of the API. */
export interface AquilineStoreAddress {
  first_name?: string;
  last_name?: string;
  address_line1: string;
  address_line2?: string;
  city: string;
  state?: string;
  zip_code?: string;
  country: string;
  phone_number?: string;
}

export interface AquilineMarketplaceOrder {
  marketplaceOrderId: string;
  orderPlacedAt?: string;
  shipToName?: string;
  shippingAddress?: AquilineStoreAddress;
  productTitle?: string;
  productId?: string;
  productUrl?: string;
  orderUrl?: string;
  trackingUrl?: string;
  sourceTracking?: string;
  status?: string;
}

export interface AquilineAssignResult {
  aquiline: string;
  chargedCents: number | null;
  planLimit: number | null;
  planUsed: number | null;
  planRemaining: number | null;
  /** Undocumented, reported by support for a repeated assign. Read defensively. */
  reused: boolean;
}

/** `GET /v1/me` billing block. Observed live 2026-08-23. */
export interface AquilinePlanUsage {
  planCode: string | null;
  /** Window key equals `currentPeriodStart` — the SUBSCRIPTION period, not a month. */
  windowKey: string | null;
  used: number | null;
  limit: number | null;
  remaining: number | null;
}

/**
 * Whether `resolveForOrder` produced a real conversion or is falling back to
 * the honest pass-through, and — for a pass-through — whether the same order
 * is worth trying again shortly.
 *
 * `RETRYABLE` mirrors `isRetryableConversionFailure`'s classification
 * (transport blip, "HTML not parsed yet"): the caller (the shipped-transition
 * processor) may choose to defer the eBay push a short while rather than
 * commit to the raw Amazon number immediately. Every other pass-through —
 * including a deliberately terminal business decision like "scope excludes
 * this carrier" or "quota exhausted" — is `TERMINAL`: retrying changes
 * nothing, so the eBay push should happen now with whatever number was
 * produced.
 */
export enum ConversionOutcome {
  CONVERTED = 'converted',
  PASSTHROUGH_TERMINAL = 'passthrough_terminal',
  PASSTHROUGH_RETRYABLE = 'passthrough_retryable',
}

/**
 * Outcome of converting one Amazon tracking number.
 *
 * `shipmentId` is persisted alongside the number because the provider's own
 * integration guide requires it for later retrieval/cancellation, and because
 * it is the only handle on a paid resource we have already been billed for.
 *
 * `outcome` is OPTIONAL and additive: `LocalTrackingConverter`'s pure
 * transform never sets it (there is no failure to classify — it always
 * "succeeds" at being the honest pass-through), so this stays a non-breaking
 * change for every existing caller. Only `TrackingConversionService` sets it,
 * and only so a caller outside that file (the shipped-transition processor)
 * can read the retryable/terminal bit without importing anything from it.
 */
export interface TrackingConversionResult {
  trackingNumber: string;
  shippingCarrierCode: string;
  /** Provider-side shipment handle; null for the local pass-through converter. */
  shipmentId: string | null;
  outcome?: ConversionOutcome;
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

// ============================================================================
// Webhook envelope — CONFIRMED BY THE PROVIDER (support, 2026-08-26)
//
// The published OpenAPI is 3.0.3, which has no `webhooks:` section, so this
// shape can never appear in it. It was obtained from support directly and is
// the ONLY authority for these fields; do not "correct" them against the
// OpenAPI document, which is silent by construction.
//
// Delivery: up to 4 attempts (1s / 5s / 20s), 8s timeout per attempt, then the
// provider gives up. So the receiver must be idempotent AND fast — an event
// that takes longer than 8s to acknowledge is retried, and after four tries it
// is lost for good.
// ============================================================================

/**
 * One inbound webhook.
 *
 * Note what is NOT here: the `AQUA…YQ` number. The provider confirmed webhook
 * payloads never carry it, so a receiver that needs it must read
 * `GET /v1/profiles/{profileId}/orders/{orderId}` → `aquilineNumber`. That is
 * also why `orderId` (the MARKETPLACE order id — the same Amazon order id we
 * sent to `upsertOrders`, not our internal UUID) is the join key on our side,
 * not the tracking number.
 */
export interface AquilineWebhookPayload {
  /** One of `AquilineWebhookEvent`, but typed wide — the provider may add events. */
  event: string;
  /** ISO 8601. */
  createdAt: string;
  data: {
    /** Provider profile id, i.e. our `{prefix}-{userId}-{marketplace}`. */
    profileId: string;
    /** Marketplace order id — matches `orders.amazon_order_id`. */
    orderId: string;
    /** `applied` | `accepted` | `rejected` on the `tracking.html.*` events. */
    outcome?: string | null;
    /** Present on a problem, and on `tracking.html.accepted` when degraded. */
    problemCode?: string | null;
    /** The code that was just resolved — `tracking.problem.cleared` only. */
    previousProblemCode?: string | null;
    /** Provider's human-readable explanation; seller-facing text is ours, not this. */
    message?: string | null;
  };
}
