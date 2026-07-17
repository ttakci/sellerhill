import type { TFunction } from 'i18next';
import { z } from 'zod';

/**
 * Blacklist keyword schema
 */
export const blacklistKeywordSchema = (t: TFunction) => z.object({
  keyword: z.string().min(1, t('validation.required')),
  scope: z.enum(['title', 'description', 'both']),
});

/**
 * Store settings schema
 */
export const storeSettingsSchema = (t: TFunction) => z.object({
  isGlobal: z.boolean(),
  storeId: z.string().optional(),

  country: z.string().min(1, t('validation.countryRequired')),
  state: z.string().min(1, t('validation.stateRequired')),
  zipCode: z.string().min(1, t('validation.zipCodeRequired')),

  validateTitle: z.boolean(),
  validateDescription: z.boolean(),

  blacklist: z.array(blacklistKeywordSchema(t)),

  amazonTaxRate: z.number().min(0).max(100),
});

export type StoreSettingsFormData = z.infer<ReturnType<typeof storeSettingsSchema>>;
