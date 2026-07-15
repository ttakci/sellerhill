import type { TFunction } from 'i18next';
import { z } from 'zod';

import { TemplateType } from '../../domain/listing-settings-groups/listing-settings-group.types';

/**
 * Price Range Schema
 */
export const priceRangeSchema = (t: TFunction) =>
  z
    .object({
      id: z.string(),
      minPrice: z.coerce.number().min(0, t('listingSettingsGroup.validation.minPrice')),
      maxPrice: z.coerce.number().min(0, t('listingSettingsGroup.validation.maxPrice')),
      profitMarginPercent: z.coerce
        .number()
        .min(0, t('listingSettingsGroup.validation.profitMarginRange'))
        .max(100, t('listingSettingsGroup.validation.profitMarginRange'))
        .optional(),
      fixedProfitAmount: z.coerce.number().min(0, t('listingSettingsGroup.validation.fixedProfitMin')).optional(),
    })
    .refine((data) => data.profitMarginPercent !== undefined || data.fixedProfitAmount !== undefined, {
      message: t('listingSettingsGroup.validation.profitRequired'),
      path: ['profitMarginPercent'],
    })
    .refine((data) => data.maxPrice > data.minPrice, {
      message: t('listingSettingsGroup.validation.maxPriceGreaterThanMin'),
      path: ['maxPrice'],
    });

/**
 * Stock Config Schema
 */
export const stockConfigSchema = (t: TFunction) =>
  z.object({
    defaultQuantity: z.coerce.number().int().min(1, t('listingSettingsGroup.validation.minQuantity')),
    stockBuffer: z.coerce
      .number()
      .int()
      .min(0, t('listingSettingsGroup.validation.minStockBuffer'))
      .optional()
      .default(0),
  });

/**
 * Fee Config Schema
 */
export const feeConfigSchema = (t: TFunction) =>
  z.object({
    ebayFeePercent: z.coerce
      .number()
      .min(0, t('listingSettingsGroup.validation.minFeePercent'))
      .max(100, t('listingSettingsGroup.validation.maxFeePercent')),
    fixedFeeAmount: z.coerce.number().min(0, t('listingSettingsGroup.validation.minFixedFee')),
    taxPercent: z.coerce
      .number()
      .min(0, t('listingSettingsGroup.validation.minTaxPercent'))
      .max(100, t('listingSettingsGroup.validation.maxTaxPercent')),
  });

/**
 * Template Config Schema
 */
export const templateConfigSchema = (t: TFunction) =>
  z
    .object({
      type: z.enum([TemplateType.CUSTOM, TemplateType.PREDEFINED]),
      customTemplateHtml: z.string().optional(),
      predefinedTemplateId: z.string().optional(),
    })
    .refine(
      (data) => {
        if (data.type === TemplateType.CUSTOM) {
          return !!data.customTemplateHtml;
        }
        if (data.type === TemplateType.PREDEFINED) {
          return !!data.predefinedTemplateId;
        }
        return true;
      },
      { message: t('listingSettingsGroup.validation.templateRequired'), path: ['customTemplateHtml'] }
    );

/**
 * Listing Settings Group Form Schema
 */
export const listingSettingsGroupSchema = (t: TFunction) =>
  z.object({
    name: z.string().min(1, t('listingSettingsGroup.validation.nameRequired')),
    description: z.string().optional(),
    repricingStrategy: z
      .array(priceRangeSchema(t))
      .min(1, t('listingSettingsGroup.validation.minOnePriceRange'))
      .superRefine((items, ctx) => {
        for (let i = 1; i < items.length; i++) {
          // Forbid overlap but ALLOW contiguity: a range may start exactly where
          // the previous one ends (minPrice === prev.maxPrice) so the price
          // buckets tile continuously with no gaps. Only a true overlap
          // (minPrice < prev.maxPrice) is invalid.
          if (items[i].minPrice < items[i - 1].maxPrice) {
            ctx.addIssue({
              code: z.ZodIssueCode.custom,
              message: t('listingSettingsGroup.validation.overlappingPriceRanges'),
              path: [i, 'minPrice'],
            });
          }
        }
      }),
    stock: stockConfigSchema(t),
    fees: feeConfigSchema(t),
    templates: templateConfigSchema(t),
  });

export type ListingSettingsGroupFormData = z.infer<ReturnType<typeof listingSettingsGroupSchema>>;
