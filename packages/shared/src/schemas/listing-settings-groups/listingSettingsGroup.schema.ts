import type { TFunction } from 'i18next';
import { z } from 'zod';

/**
 * Price Range Schema
 */
export const priceRangeSchema = (t: TFunction) =>
  z.object({
    id: z.string(),
    minPrice: z.number().min(0, t('listingSettingsGroup.validation.minPrice')),
    maxPrice: z.number().min(0, t('listingSettingsGroup.validation.maxPrice')),
    profitMarginPercent: z.number().min(0).max(100).optional(),
    fixedProfitAmount: z.number().min(0).optional(),
  }).refine(
    (data) => data.profitMarginPercent !== undefined || data.fixedProfitAmount !== undefined,
    { message: t('listingSettingsGroup.validation.profitRequired'), path: ['profitMarginPercent'] }
  ).refine(
    (data) => data.maxPrice > data.minPrice,
    { message: t('listingSettingsGroup.validation.maxPriceGreaterThanMin'), path: ['maxPrice'] }
  );

/**
 * Stock Config Schema
 */
export const stockConfigSchema = (t: TFunction) =>
  z.object({
    defaultQuantity: z.number().int().min(1, t('listingSettingsGroup.validation.minQuantity')),
    autoRestock: z.boolean(),
  });

/**
 * Fee Config Schema
 */
export const feeConfigSchema = (t: TFunction) =>
  z.object({
    ebayFeePercent: z.number().min(0).max(100, t('listingSettingsGroup.validation.maxFeePercent')),
    fixedFeeAmount: z.number().min(0, t('listingSettingsGroup.validation.minFixedFee')),
    taxPercent: z.number().min(0).max(100, t('listingSettingsGroup.validation.maxTaxPercent')),
  });

/**
 * Template Config Schema
 */
export const templateConfigSchema = (t: TFunction) =>
  z.object({
    type: z.enum(['custom', 'predefined']),
    customTemplateHtml: z.string().optional(),
    predefinedTemplateId: z.string().optional(),
  }).refine(
    (data) => {
      if (data.type === 'custom') return !!data.customTemplateHtml;
      if (data.type === 'predefined') return !!data.predefinedTemplateId;
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
    repricingStrategy: z.array(priceRangeSchema(t)).min(1, t('listingSettingsGroup.validation.minOnePriceRange')),
    stock: stockConfigSchema(t),
    fees: feeConfigSchema(t),
    templates: templateConfigSchema(t),
  });

export type ListingSettingsGroupFormData = z.infer<ReturnType<typeof listingSettingsGroupSchema>>;
