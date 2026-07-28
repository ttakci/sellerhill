// apps/api/src/modules/buyer-messaging/buyer-messaging.constants.ts
import { BuyerMessageEventType } from '@repo/shared';

/** BullMQ queue name for the buyer-message pipeline. */
export const BUYER_MESSAGE_QUEUE = 'buyer-message';

/**
 * DI token for the BuyerMessagingProvider. Defined here (rather than in the
 * module file) so the processor can import it without a circular dep on the
 * module that binds it. Task 11's BuyerMessagingModule imports this same token
 * and binds the active provider (EbayMessageApiProvider) to it.
 */
export const BUYER_MESSAGE_TOKEN = Symbol('BUYER_MESSAGING_PROVIDER');

export const BUYER_MESSAGING_DEFAULTS = {
  ENABLED: false,
  QUEUE_CONCURRENCY: 1,
  FEEDBACK_DELAY_DAYS: 3,
  ATTEMPTS: 3,
} as const;

export const ALL_BUYER_MESSAGE_EVENTS = Object.values(BuyerMessageEventType);
