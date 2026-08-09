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

/**
 * @deprecated The SYSTEM/CUSTOM split is legacy. Every event now points at a
 * real `BuyerMessageTemplate` row — the four starter defaults are seeded as
 * ordinary user-owned rows (`isDefault: true`) instead of a separate
 * code-constant template space. `SYSTEM` is kept only so already-persisted
 * `store_settings.buyer_messaging` configs (written before this change) keep
 * resolving; `BuyerMessageService.resolveTemplate` reads their body from
 * `buyer_message_system_defaults` (DB) rather than a hardcoded map. New saves
 * from the settings UI always write `CUSTOM`.
 */
export enum BuyerMessageTemplateKind {
  SYSTEM = 'system',
  CUSTOM = 'custom',
}

export interface BuyerMessageTemplateRef {
  kind: BuyerMessageTemplateKind;
  /** BuyerMessageTemplate UUID (or, for legacy SYSTEM refs, the event type). */
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

/** Buyer message template row DTO. */
export interface BuyerMessageTemplate {
  id: string;
  userId: string;
  eventType: BuyerMessageEventType;
  name: string;
  body: string;
  locale: string;
  /** Seeded from `buyer_message_system_defaults` as this user's starter template for the event. Drives the "Default" badge and "Reset to default" action — not a protection flag, still editable/deletable like any template. */
  isDefault: boolean;
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

// The four starter default bodies (EN, buyer-facing) used to live here as
// SYSTEM_BUYER_MESSAGE_TEMPLATES. They are now DB-stored in
// `buyer_message_system_defaults` (apps/api/migrations/066) and seeded as
// ordinary per-user BuyerMessageTemplate rows (isDefault: true) — see
// BuyerMessageTemplateRepository.ensureSeeded — so a copy-only change no
// longer needs a code deploy, and users can see/edit/reset them like any
// other template.
