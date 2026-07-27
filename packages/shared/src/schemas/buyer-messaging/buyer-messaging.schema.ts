// packages/shared/src/schemas/buyer-messaging/buyer-messaging.schema.ts
import { z } from 'zod';

import { BuyerMessageEventType, BuyerMessageTemplateKind } from '../../domain/buyer-messaging/buyer-messaging.types';

export const buyerMessageTemplateRefSchema = z.object({
  kind: z.nativeEnum(BuyerMessageTemplateKind),
  id: z.string().min(1).max(160),
});

export const buyerMessageEventConfigSchema = z.object({
  enabled: z.boolean(),
  template: buyerMessageTemplateRefSchema,
  delayDays: z.number().int().min(0).max(90).optional(),
});

export const buyerMessagingConfigSchema = z.object({
  enabled: z.boolean(),
  // Note: a ZodRecord does not require every enum key to be present at runtime,
  // so this validates the `Partial<Record<BuyerMessageEventType, BuyerMessageEventConfig>>`
  // contract from BuyerMessagingConfig. (`.partial()` is not a ZodRecord method
  // in Zod 3 or 4 — only ZodObject has it.)
  events: z.record(z.nativeEnum(BuyerMessageEventType), buyerMessageEventConfigSchema),
});

export const buyerMessageTemplateSchema = z.object({
  eventType: z.nativeEnum(BuyerMessageEventType),
  name: z.string().min(1).max(120),
  body: z.string().min(1).max(2000),
  locale: z.string().min(2).max(5).default('en'),
});
