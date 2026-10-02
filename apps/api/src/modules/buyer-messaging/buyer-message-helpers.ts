// apps/api/src/modules/buyer-messaging/buyer-message-helpers.ts
import { createHash } from 'crypto';

import {
  AQUILINE_EBAY_CARRIER_CODE,
  BuyerMessageEventType,
  type BuyerMessageContext,
  type BuyerMessagingConfig,
  type BuyerMessageEventConfig,
} from '@repo/shared';

const PLACEHOLDER = /\{\{\s*([a-zA-Z_][a-zA-Z0-9_]*)\s*\}\}/g;

/**
 * Tokens whose value may legitimately be missing. A line that names one of
 * them and gets nothing is dropped whole, so a buyer never reads a dangling
 * "Tracking number:" label.
 */
const OPTIONAL_TOKENS = new Set(['tracking_number', 'carrier', 'estimated_delivery']);

const GREETING_FALLBACK = 'there';

function resolveToken(name: string, ctx: BuyerMessageContext): string {
  switch (name) {
    case 'buyer_name': return ctx.buyerName ?? '';
    case 'buyer_username': return ctx.buyerUsername ?? '';
    case 'item_title': return ctx.itemTitle ?? '';
    case 'order_id': return ctx.orderId ?? '';
    case 'tracking_number': return ctx.trackingNumber ?? '';
    case 'carrier': return ctx.carrier ?? '';
    case 'store_name': return ctx.storeName ?? '';
    case 'estimated_delivery': return ctx.estimatedDelivery ?? '';
    default: return '';
  }
}

/**
 * Replace {{token}} with context values; unknown tokens become empty string.
 * A line whose optional token (tracking number, carrier, estimated delivery)
 * resolved empty is removed, and the blank lines it leaves are collapsed.
 */
export function renderTemplate(body: string, ctx: BuyerMessageContext): string {
  const lines: string[] = [];
  for (const line of body.split('\n')) {
    let missingOptional = false;
    const rendered = line.replace(PLACEHOLDER, (_full, name: string) => {
      const value = resolveToken(name, ctx);
      if (!value && OPTIONAL_TOKENS.has(name)) {
        missingOptional = true;
      }
      return value;
    });
    if (!missingOptional) {
      lines.push(rendered);
    }
  }
  return lines.join('\n').replace(/\n{3,}/g, '\n\n').trim();
}

/**
 * The name a message greets the buyer by: the first word of the name eBay
 * holds for them ("John" from "john smith"). eBay hands names over in whatever
 * case the buyer typed, so a lower-case first name or an all-capitals full
 * name is re-cased; anything else ("McDonald", "ABC Trading") stays as written.
 * No usable name → "there", never the eBay username.
 */
export function greetingName(fullName: string | null | undefined): string {
  const name = (fullName ?? '').trim().replace(/\s+/g, ' ');
  if (!name) {
    return GREETING_FALLBACK;
  }
  const first = name.split(' ')[0].replace(/[.,;:]+$/, '');
  if (!/\p{L}{2,}/u.test(first)) {
    return GREETING_FALLBACK;
  }
  // "joseph" is always a typing habit; "ABC" is only one when the WHOLE name
  // is shouted ("JOHN SMITH"), otherwise it is an acronym and stays.
  const typedLower = first === first.toLowerCase();
  const typedUpper = name === name.toUpperCase();
  if (!typedLower && !typedUpper) {
    return first;
  }
  return first.charAt(0).toUpperCase() + first.slice(1).toLowerCase();
}

/** eBay carrier code → what a buyer reads ("Amazon_Logistics" → "Amazon Logistics", "AQUILINE" → "Aquiline"). */
export function formatCarrierForBuyer(carrierCode: string | null | undefined): string | undefined {
  const code = (carrierCode ?? '').trim();
  if (!code) {
    return undefined;
  }
  if (code === AQUILINE_EBAY_CARRIER_CODE) {
    return code.charAt(0) + code.slice(1).toLowerCase();
  }
  return code.replace(/_/g, ' ');
}

/** Returns the event config iff the feature is enabled AND the event is enabled; else null. */
export function resolveEventConfig(
  config: BuyerMessagingConfig | null,
  event: BuyerMessageEventType,
): BuyerMessageEventConfig | null {
  if (!config || !config.enabled) {
    return null;
  }
  const ev = config.events?.[event];
  if (!ev || !ev.enabled) {
    return null;
  }
  return ev;
}

/** Stable BullMQ jobId for dedup. */
export function buyerMessageJobId(ebayOrderId: string, event: BuyerMessageEventType): string {
  return `buyer-msg-${ebayOrderId}-${event}`;
}

/**
 * Whether a message parked by a suspension has waited too long to still send.
 *
 * Measured from the message's ORIGINAL due time (BullMQ creation timestamp +
 * its scheduled delay), never from the latest re-park — each re-park moves the
 * job forward, so measuring from it would let a message defer forever.
 */
export function isSuspendedMessageExpired(
  createdAtMs: number,
  scheduledDelayMs: number | undefined,
  nowMs: number,
  maxAgeMs: number,
): boolean {
  const dueAtMs = createdAtMs + Math.max(0, scheduledDelayMs ?? 0);
  return nowMs - dueAtMs > maxAgeMs;
}

/** Short hash of a template body, stored on the log for audit/versioning. */
export function templateVersionHash(body: string): string {
  return createHash('sha256').update(body).digest('hex').slice(0, 12);
}

/**
 * Strip token-like substrings (Bearer tokens, `token=...`, `"token":"..."`)
 * before persisting an error to logs. Mirrors the regex used by the eBay
 * provider's internal redactor. Truncates to 400 chars.
 */
export function redactForLog(message: unknown): string {
  return String(message)
    .replace(/(Bearer\s+[\w.-]+|token["']?\s*[:=]\s*["']?[\w.-]+)/gi, '[redacted]')
    .slice(0, 400);
}
