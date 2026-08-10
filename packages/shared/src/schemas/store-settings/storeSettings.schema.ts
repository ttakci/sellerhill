import type { TFunction } from 'i18next';
import { z } from 'zod';

import { BlacklistType } from '../../domain/store-settings/store-settings.types';

/**
 * Blacklist keyword schema
 */
export const blacklistKeywordSchema = (t: TFunction) => z.object({
  keyword: z.string().trim().min(1, t('validation.required')),
  types: z.array(z.nativeEnum(BlacklistType)).min(1, t('validation.required')).refine(
    (types) => new Set(types).size === types.length,
    t('validation.required'),
  ),
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

  checkBlacklist: z.boolean(),

  blacklist: z.array(blacklistKeywordSchema(t)),

  amazonTaxRate: z.number().min(0).max(100),
});

export type StoreSettingsFormData = z.infer<ReturnType<typeof storeSettingsSchema>>;
