// apps/api/src/modules/amazon/tracking-webhook.helpers.ts
//
// Pure decision layer for inbound Aquiline webhooks. No Nest, no pg, no http —
// everything here is unit-testable.
//
// The payload shape below was confirmed by the provider on 2026-08-26. It could
// not be read from their OpenAPI document, which is 3.0.3 and therefore has no
// `webhooks:` section at all. The previous version of this file was written
// against the v3 courier API's vocabulary (`shipment.delivered`, a tracking
// number in the body, a `changeType` discriminator) and would have rejected
// every genuine delivery with a 400.
//
// Delivery contract: up to 4 attempts on any non-2xx, spaced 1s / 5s / 20s,
// with an 8s timeout per attempt — then the provider gives up permanently.
// So the receiver must be idempotent (the same event WILL arrive more than
// once) and fast (an event we take longer than 8s to acknowledge is retried,
// and after four tries it is gone).

import { createHmac, timingSafeEqual } from 'crypto';

import {
  AquilineProblemCode,
  AquilineWebhookEvent,
  isAquilineProblemCode,
  type AquilineWebhookPayload,
} from '@repo/shared';

/** What the receiver decided to do with one delivery. */
export enum TrackingWebhookOutcome {
  APPLIED = 'applied',
  /** Already applied — the idempotency guard caught a provider retry. */
  DUPLICATE = 'duplicate',
  /** Older than the freshness window; recorded but never applied. */
  STALE = 'stale',
  /** No order matches this (profileId, orderId) pair. */
  UNMATCHED = 'unmatched',
  /** A valid event that maps to no state change we act on. */
  IGNORED = 'ignored',
  FAILED = 'failed',
}

/**
 * Verify the `X-Webhook-Signature` header.
 *
 * Format per the provider: `sha256=<hex(hmac_sha256(secret, rawBody))>`. The
 * comparison is constant-time — a fast-exit compare on a signature leaks
 * enough timing to forge one.
 *
 * Verification runs on the RAW bytes. Re-serialising a parsed body changes key
 * order and whitespace and would fail against a valid signature.
 *
 * Unchanged from the previous implementation: this was the one part of the old
 * receiver the provider's answer confirmed rather than contradicted.
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
 * Strict on the four fields that give a payload its identity (`event`,
 * `createdAt`, `data.profileId`, `data.orderId`) and lenient on everything
 * else — the provider may add fields, and an unknown extra must never cost us
 * a delivery. `event` is deliberately kept as a raw string rather than being
 * cast to `AquilineWebhookEvent`: the provider can add event names, and casting
 * would let an unknown one masquerade as a known one everywhere downstream.
 */
export function parseTrackingWebhookPayload(body: unknown): AquilineWebhookPayload | null {
  if (typeof body !== 'object' || body === null) {
    return null;
  }
  const raw = body as Record<string, unknown>;
  const event = typeof raw.event === 'string' ? raw.event.trim() : '';
  const createdAt = typeof raw.createdAt === 'string' ? raw.createdAt : '';
  const data =
    typeof raw.data === 'object' && raw.data !== null
      ? (raw.data as Record<string, unknown>)
      : null;
  const profileId = data && typeof data.profileId === 'string' ? data.profileId.trim() : '';
  const orderId = data && typeof data.orderId === 'string' ? data.orderId.trim() : '';

  if (!event || !createdAt || !profileId || !orderId) {
    return null;
  }
  if (Number.isNaN(Date.parse(createdAt))) {
    return null;
  }

  const optionalString = (value: unknown): string | null =>
    typeof value === 'string' && value.trim() ? value.trim() : null;

  return {
    event,
    createdAt,
    data: {
      profileId,
      orderId,
      outcome: optionalString(data?.outcome),
      problemCode: optionalString(data?.problemCode),
      previousProblemCode: optionalString(data?.previousProblemCode),
      message: optionalString(data?.message),
    },
  };
}

/** What this webhook means for `orders.tracking_problem_code`. */
export enum TrackingProblemTransition {
  /** Store the code — the order has a problem the seller may need to act on. */
  SET = 'set',
  /** Clear it — the problem is resolved, or the upload finally applied. */
  CLEAR = 'clear',
  /** Leave the column alone. */
  NONE = 'none',
}

export interface TrackingProblemDecision {
  transition: TrackingProblemTransition;
  /** The code to store; only meaningful when `transition === SET`. */
  problemCode: AquilineProblemCode | null;
  /**
   * True when the provider named a code we do not know. The transition still
   * happens (an unknown problem is still a problem) but the stored value is
   * null, so nothing downstream tries to localize a string we have no key for.
   */
  unknownCode: boolean;
}

/**
 * Decide what one webhook does to the order's problem state.
 *
 * The rules follow the provider's own semantics, confirmed 2026-08-26:
 *
 *   - `tracking.html.applied`   — the upload landed. Any prior problem on this
 *     order is stale by definition, so CLEAR. This is the only "success" event
 *     that proves the provider actually parsed what we sent; `accepted` alone
 *     does not (their docs are explicit: "never treat success alone as
 *     applied").
 *   - `tracking.html.accepted`  — stored and validated, not yet applied. Carries
 *     an OPTIONAL `problemCode` when it was accepted in a degraded state. SET
 *     when one is present; otherwise NONE, because "accepted" on its own is an
 *     intermediate state and clearing a real prior problem on it would hide a
 *     fault that has not been fixed.
 *   - `tracking.html.rejected`  — SET. The upload was refused outright.
 *   - `tracking.problem.opened` — SET.
 *   - `tracking.problem.cleared`— CLEAR.
 *
 * Anything unrecognised is NONE: recorded in the inbox, never acted on.
 */
export function decideTrackingProblem(payload: AquilineWebhookPayload): TrackingProblemDecision {
  const none: TrackingProblemDecision = {
    transition: TrackingProblemTransition.NONE,
    problemCode: null,
    unknownCode: false,
  };

  const set = (rawCode: string | null | undefined): TrackingProblemDecision => {
    if (!rawCode) {
      // A problem event with no code still means "something is wrong", but we
      // have nothing specific to store or show. Treat it as no transition
      // rather than writing a null over a code we already hold, which would
      // discard information the seller can act on.
      return none;
    }
    if (isAquilineProblemCode(rawCode)) {
      return {
        transition: TrackingProblemTransition.SET,
        problemCode: rawCode,
        unknownCode: false,
      };
    }
    return { transition: TrackingProblemTransition.SET, problemCode: null, unknownCode: true };
  };

  // Compared through `isEvent` rather than a `switch` on the enum: `event` is
  // whatever the provider sent, NOT a value we can assume is in our enum, and
  // a direct enum comparison would both fail lint and let an unknown event
  // name masquerade as a known one.
  if (isEvent(payload.event, AquilineWebhookEvent.HTML_APPLIED)) {
    return { transition: TrackingProblemTransition.CLEAR, problemCode: null, unknownCode: false };
  }
  if (isEvent(payload.event, AquilineWebhookEvent.PROBLEM_CLEARED)) {
    return { transition: TrackingProblemTransition.CLEAR, problemCode: null, unknownCode: false };
  }
  if (isEvent(payload.event, AquilineWebhookEvent.HTML_ACCEPTED)) {
    return payload.data.problemCode ? set(payload.data.problemCode) : none;
  }
  if (
    isEvent(payload.event, AquilineWebhookEvent.HTML_REJECTED) ||
    isEvent(payload.event, AquilineWebhookEvent.PROBLEM_OPENED)
  ) {
    return set(payload.data.problemCode);
  }
  return none;
}

/**
 * Compare a raw wire string against a known event name.
 *
 * The widening is deliberate and load-bearing, not a lint workaround: the
 * provider can add event names, so `payload.event` is a `string` by contract.
 * Casting the payload into the enum instead would let an unrecognised event
 * be treated as a known one everywhere downstream.
 */
function isEvent(value: string, event: AquilineWebhookEvent): boolean {
  return value === (event as string);
}

/**
 * Whether an event is too old to act on.
 *
 * A provider outage can replay a backlog. Applying a very old problem code is
 * usually harmless, but the guard is cheap and stops a replayed batch from
 * re-flagging orders whose problem was resolved days ago. Future-dated events
 * are accepted — clock skew between two systems is normal and rejecting them
 * would drop live traffic.
 */
export function isStaleTrackingEvent(
  createdAt: string,
  nowMs: number,
  maxAgeMinutes: number,
): boolean {
  const eventMs = Date.parse(createdAt);
  if (Number.isNaN(eventMs)) {
    return true;
  }
  if (eventMs > nowMs) {
    return false;
  }
  return nowMs - eventMs > maxAgeMinutes * 60_000;
}

/**
 * Every event we subscribe to — all five.
 *
 * There is no filtering to do here, unlike the v3 vocabulary this replaces:
 * the provider emits exactly these five and every one of them changes, or
 * confirms, something we surface to the seller. Passing all five to
 * `POST /v1/webhooks` is also what their docs recommend (omitting `events`
 * subscribes to all).
 */
export const SUBSCRIBED_TRACKING_EVENTS: readonly AquilineWebhookEvent[] = [
  AquilineWebhookEvent.HTML_ACCEPTED,
  AquilineWebhookEvent.HTML_APPLIED,
  AquilineWebhookEvent.HTML_REJECTED,
  AquilineWebhookEvent.PROBLEM_OPENED,
  AquilineWebhookEvent.PROBLEM_CLEARED,
] as const;
