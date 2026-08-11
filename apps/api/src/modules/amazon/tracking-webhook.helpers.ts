// apps/api/src/modules/amazon/tracking-webhook.helpers.ts
//
// Pure decision layer for inbound tracking-provider webhooks. No Nest, no pg,
// no http — everything here is unit-testable.
//
// The provider (Aquiline) retries any non-2xx on 1s / 5s / 20s with an 8s
// timeout, so the same delivery event WILL arrive more than once and may
// arrive late. Every function here exists to make that safe.

import { createHmac, timingSafeEqual } from 'crypto';

import {
  OrderStatus,
  TrackingWebhookChangeType,
  TrackingWebhookEvent,
  type TrackingWebhookPayload,
} from '@repo/shared';

/** What the receiver decided to do with one delivery. */
export enum TrackingWebhookOutcome {
  APPLIED = 'applied',
  /** Already applied — the idempotency guard caught a provider retry. */
  DUPLICATE = 'duplicate',
  /** Older than the freshness window; recorded but never applied. */
  STALE = 'stale',
  /** No order carries this tracking number. */
  UNMATCHED = 'unmatched',
  /** A valid event that maps to no state change we act on. */
  IGNORED = 'ignored',
  FAILED = 'failed',
}

/**
 * Verify the `X-Webhook-Signature` header.
 *
 * Format per the provider docs: `sha256=<hex(hmac_sha256(secret, rawBody))>`.
 * The comparison is constant-time — a fast-exit compare on a signature leaks
 * enough timing to forge one.
 *
 * Verification runs on the RAW bytes. Re-serialising a parsed body changes key
 * order and whitespace and would fail against a valid signature.
 */
export function verifyTrackingWebhookSignature(
  header: string | undefined,
  rawBody: string,
  secret: string,
): boolean {
  if (!header || !secret) {
    return false;
  }
  const provided = header.startsWith('sha256=') ? header.slice('sha256='.length) : header;
  if (!/^[0-9a-f]+$/i.test(provided)) {
    return false;
  }
  const expected = createHmac('sha256', secret).update(rawBody, 'utf8').digest('hex');
  const a = Buffer.from(expected, 'hex');
  const b = Buffer.from(provided.toLowerCase(), 'hex');
  // timingSafeEqual throws on a length mismatch, so guard first — the length
  // itself is not a secret.
  if (a.length !== b.length || a.length === 0) {
    return false;
  }
  return timingSafeEqual(a, b);
}

/**
 * Parse an unknown JSON body into the webhook envelope, or return null.
 *
 * Deliberately strict on the three fields we key on (`type`, `occurredAt`,
 * `data.trackingNumber`) and lenient on everything else: the provider may add
 * fields, but a payload missing its own identity is not a payload.
 */
export function parseTrackingWebhookPayload(body: unknown): TrackingWebhookPayload | null {
  if (typeof body !== 'object' || body === null) {
    return null;
  }
  const raw = body as Record<string, unknown>;
  const type = typeof raw.type === 'string' ? raw.type : null;
  const occurredAt = typeof raw.occurredAt === 'string' ? raw.occurredAt : null;
  const data = typeof raw.data === 'object' && raw.data !== null
    ? (raw.data as Record<string, unknown>)
    : null;
  const trackingNumber =
    data && typeof data.trackingNumber === 'string' ? data.trackingNumber.trim() : null;

  if (!type || !occurredAt || !trackingNumber) {
    return null;
  }
  if (Number.isNaN(Date.parse(occurredAt))) {
    return null;
  }

  return {
    type,
    occurredAt,
    data: {
      trackingNumber,
      status: typeof data?.status === 'string' ? data.status : null,
      statusCode: typeof data?.statusCode === 'string' ? data.statusCode : null,
      changeType: typeof data?.changeType === 'string' ? data.changeType : null,
      newEvents: Array.isArray(data?.newEvents)
        ? (data.newEvents as TrackingWebhookPayload['data']['newEvents'])
        : [],
    },
  };
}

/**
 * The order status a webhook event implies, or null when it implies none.
 *
 * ONLY delivery is actionable. The intermediate events (`in_transit`,
 * `out_for_delivery`) carry no state we store — the order is already SHIPPED
 * by the time a conversion exists, since the conversion is created AT the
 * shipped transition. Acting on them would be churn.
 *
 * `shipment.exception` deliberately maps to null rather than to a failure
 * state: an exception is the carrier reporting a delivery problem, not our
 * order breaking, and there is no eBay-side action it should trigger
 * automatically. It is recorded in the inbox for an operator to read.
 *
 * `shipment.updated` is the provider's catch-all, so the status FIELD is
 * consulted rather than the event name — that is the only way a delivery that
 * arrives under the fallback event is not missed.
 */
export function resolveWebhookOrderStatus(payload: TrackingWebhookPayload): OrderStatus | null {
  if (isEvent(payload.type, TrackingWebhookEvent.DELIVERED)) {
    return OrderStatus.COMPLETED;
  }
  if (isEvent(payload.type, TrackingWebhookEvent.UPDATED)) {
    const status = (payload.data.status ?? payload.data.statusCode ?? '').toLowerCase();
    return status === 'delivered' ? OrderStatus.COMPLETED : null;
  }
  return null;
}

/**
 * Compare a raw wire string against a known event name.
 *
 * The comparison is widened deliberately: `payload.type` is whatever the
 * provider sent, NOT a value we can assume is in our enum. Casting the payload
 * to the enum instead would let an unknown event name masquerade as a known
 * one throughout the file.
 */
function isEvent(value: string, event: TrackingWebhookEvent): boolean {
  return value === (event as string);
}

/**
 * Whether an event is too old to act on.
 *
 * A provider outage can replay hours of backlog. Applying a very old delivery
 * is usually harmless, but the guard is cheap and keeps a replayed batch from
 * firing a burst of buyer "your order was delivered" messages days late.
 * Future-dated events are accepted — clock skew between two systems is normal
 * and rejecting them would drop live traffic.
 */
export function isStaleTrackingEvent(
  occurredAt: string,
  nowMs: number,
  maxAgeMinutes: number,
): boolean {
  const eventMs = Date.parse(occurredAt);
  if (Number.isNaN(eventMs)) {
    return true;
  }
  if (eventMs > nowMs) {
    return false;
  }
  return nowMs - eventMs > maxAgeMinutes * 60_000;
}

/**
 * Whether the payload carries a real state move.
 *
 * The provider sends `status_change` even with an empty `newEvents` array, so
 * a handler keyed on `newEvents.length` would miss delivery entirely. Treat a
 * missing/unknown changeType as significant — dropping a real delivery is far
 * worse than recording one redundant event.
 */
export function isSignificantChange(payload: TrackingWebhookPayload): boolean {
  const changeType = payload.data.changeType;
  if (!changeType) {
    return true;
  }
  if (changeType === (TrackingWebhookChangeType.STATUS_CHANGE as string)) {
    return true;
  }
  if (changeType === (TrackingWebhookChangeType.EVENT_APPEND as string)) {
    return (payload.data.newEvents?.length ?? 0) > 0;
  }
  return true;
}

/** Every event name we subscribe to. Intermediate ones are stored, not acted on. */
export const SUBSCRIBED_TRACKING_EVENTS: readonly TrackingWebhookEvent[] = [
  TrackingWebhookEvent.DELIVERED,
  TrackingWebhookEvent.EXCEPTION,
  TrackingWebhookEvent.UPDATED,
] as const;
