// apps/api/src/modules/buyer-messaging/buyer-message-helpers.ts
import { createHash } from 'crypto';

import {
  BuyerMessageEventType,
  type BuyerMessageContext,
  type BuyerMessagingConfig,
  type BuyerMessageEventConfig,
} from '@repo/shared';

const PLACEHOLDER = /\{\{\s*([a-zA-Z_][a-zA-Z0-9_]*)\s*\}\}/g;

/** Replace {{token}} with context values; unknown tokens become empty string. */
export function renderTemplate(body: string, ctx: BuyerMessageContext): string {
  return body.replace(PLACEHOLDER, (full, name: string) => {
    switch (name) {
      case 'buyer_username': return ctx.buyerUsername ?? '';
      case 'item_title': return ctx.itemTitle ?? '';
      case 'order_id': return ctx.orderId ?? '';
      case 'tracking_number': return ctx.trackingNumber ?? '';
      case 'carrier': return ctx.carrier ?? '';
      case 'store_name': return ctx.storeName ?? '';
      case 'estimated_delivery': return ctx.estimatedDelivery ?? '';
      default: return '';
    }
  });
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
