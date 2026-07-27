// apps/api/src/modules/billing/billing.types.ts
//
// Phase-2 billing contracts. The customer-facing wire DTOs
// (BillingCatalogDto, BillingSummaryDto, BillingCheckoutDto, BillingPortalDto,
// BillingProvider) have been lifted into `@repo/shared` domain/billing
// (billing.wire.ts) so the frontend RTK Query API can import them without
// duplication. This file re-exports them for the backend's single-import
// convenience and keeps the webhook-internal `ParsedPaddleEvent` here (the
// frontend never parses raw webhook payloads).

import {
  BillingInterval,
  BillingProvider,
  type BillingCatalogDto,
  type BillingCheckoutDto,
  type BillingPlanWithPricingDto,
  type BillingPortalDto,
  type BillingSubscriptionDto,
  type BillingSubscriptionStatus,
  type BillingSummaryDto,
  type BillingUsagePeriodDto,
} from '@repo/shared';

/**
 * Parsed Paddle webhook event. The signature-verification layer produces this
 * from the raw body; the idempotent processor consumes it. Only the fields the
 * processor needs are typed — the full payload is stored verbatim in the
 * webhook inbox. Backend-internal: the frontend never parses raw webhooks.
 */
export interface ParsedPaddleEvent {
  /** Paddle event id (`evt_...`). Used for idempotency dedup. */
  eventId: string | null;
  /** Paddle event type (e.g. `subscription.created`, `subscription.canceled`). */
  eventType: string;
  /** Occurred-at timestamp from the Paddle payload (ISO 8601). Used for
   *  stale-event protection: events older than the configured TTL are dropped
   *  after being logged to the inbox. */
  occurredAt: string | null;
  /** The raw payload, stored verbatim in the webhook inbox. */
  payload: Record<string, unknown>;
}

/**
 * Re-export the wire DTOs + enums the backend uses, so the billing module has
 * a single import surface for both phase-1 (shared) and phase-2 (shared wire)
 * contracts.
 */
export {
  BillingInterval,
  BillingProvider,
  BillingCatalogDto,
  BillingCheckoutDto,
  BillingPlanWithPricingDto,
  BillingPortalDto,
  BillingSubscriptionDto,
  BillingSubscriptionStatus,
  BillingSummaryDto,
  BillingUsagePeriodDto,
};
