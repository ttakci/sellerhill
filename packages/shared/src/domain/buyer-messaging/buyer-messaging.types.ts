// packages/shared/src/domain/buyer-messaging/buyer-messaging.types.ts

export enum BuyerMessageEventType {
  ORDER_RECEIVED = 'order_received',
  SHIPPED = 'shipped',
  DELIVERED = 'delivered',
  FEEDBACK_REQUEST = 'feedback_request',
}

export enum BuyerMessageStatus {
  SENT = 'sent',
  FAILED = 'failed',
  SKIPPED = 'skipped',
}

export enum BuyerMessageTemplateKind {
  SYSTEM = 'system',
  CUSTOM = 'custom',
}

export interface BuyerMessageTemplateRef {
  kind: BuyerMessageTemplateKind;
  /** System template id (e.g. 'order_received.en.default') OR custom template UUID. */
  id: string;
}

export interface BuyerMessageEventConfig {
  enabled: boolean;
  template: BuyerMessageTemplateRef;
  /** feedback_request only: days after delivered to send. */
  delayDays?: number;
}

export interface BuyerMessagingConfig {
  enabled: boolean;
  events: Partial<Record<BuyerMessageEventType, BuyerMessageEventConfig>>;
}

/** Custom template row DTO. */
export interface BuyerMessageTemplate {
  id: string;
  userId: string;
  eventType: BuyerMessageEventType;
  name: string;
  body: string;
  locale: string;
  createdAt: string;
  updatedAt: string;
}

/** Placeholder values resolved from order/listing/product context. */
export interface BuyerMessageContext {
  buyerUsername: string;
  itemTitle: string;
  orderId: string;
  trackingNumber?: string;
  carrier?: string;
  storeName: string;
  estimatedDelivery?: string;
}

/** Placeholder tokens a user may insert into a custom template. */
export const BUYER_MESSAGE_PLACEHOLDERS = [
  '{{buyer_username}}',
  '{{item_title}}',
  '{{order_id}}',
  '{{tracking_number}}',
  '{{carrier}}',
  '{{store_name}}',
  '{{estimated_delivery}}',
] as const;

/**
 * Predefined system templates (EN buyer-facing). Versioned in code — copy
 * changes need no migration. The `shipped` body is deliberately distinct from
 * eBay's automatic tracking notification (warm tone, does not repeat tracking).
 */
export const SYSTEM_BUYER_MESSAGE_TEMPLATES: Record<
  BuyerMessageEventType,
  { id: string; body: string }
> = {
  [BuyerMessageEventType.ORDER_RECEIVED]: {
    id: 'order_received.en.default',
    body:
      'Hi {{buyer_username}}, thank you for your order of "{{item_title}}"! We’re getting it ready and will let you know once it ships.',
  },
  [BuyerMessageEventType.SHIPPED]: {
    id: 'shipped.en.default',
    body:
      'Hi {{buyer_username}}, great news — "{{item_title}}" is on its way! \u{1F4E6} It’ll arrive with you soon.',
  },
  [BuyerMessageEventType.DELIVERED]: {
    id: 'delivered.en.default',
    body:
      'Hi {{buyer_username}}, your "{{item_title}}" has been delivered. We hope you love it! If you’re happy, a quick feedback would mean a lot.',
  },
  [BuyerMessageEventType.FEEDBACK_REQUEST]: {
    id: 'feedback_request.en.default',
    body:
      'Hi {{buyer_username}}, just checking in — if you’re enjoying "{{item_title}}", a moment of feedback really helps our small business. Thank you!',
  },
};
