import type { TFunction } from 'i18next';
import { z } from 'zod';

import { TemplateType } from '../../domain/listing-settings-groups/listing-settings-group.types';

/**
 * A number typed into a form field. `z.coerce.number()` alone accepts "04" and
 * silently stores 4, so a mistyped "0.4" passes as four dollars. A leading zero
 * followed by another digit is never a number a person meant, so the raw text is
 * refused before coercion. "0", "0.4" and "4" are unaffected.
 */
const LEADING_ZERO = /^[+-]?0\d/;

const formNumber = <T extends z.ZodType>(
  t: TFunction,
  build: (base: z.ZodNumber) => T = (base) => base as unknown as T
) =>
  z.preprocess(
    (raw) => (typeof raw === 'string' && LEADING_ZERO.test(raw.trim()) ? Number.NaN : raw),
    build(z.coerce.number({ error: t('listingSettingsGroup.validation.invalidNumber') }))
  );

/**
 * Price Range Schema
 */
export const priceRangeSchema = (t: TFunction) =>
  z
    .object({
      id: z.string(),
      minPrice: formNumber(t, (n) => n.min(0, t('listingSettingsGroup.validation.minPrice'))),
      maxPrice: formNumber(t, (n) => n.min(0, t('listingSettingsGroup.validation.maxPrice'))),
      profitMarginPercent: formNumber(t, (n) =>
        n
          .min(0, t('listingSettingsGroup.validation.profitMarginRange'))
          .max(100, t('listingSettingsGroup.validation.profitMarginRange'))
      ).optional(),
      fixedProfitAmount: formNumber(t, (n) => n.min(0, t('listingSettingsGroup.validation.fixedProfitMin'))).optional(),
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
    defaultQuantity: formNumber(t, (n) => n.int().min(1, t('listingSettingsGroup.validation.minQuantity'))),
    stockBuffer: formNumber(t, (n) => n.int().min(0, t('listingSettingsGroup.validation.minStockBuffer')))
      .optional()
      .default(0),
  });

/**
 * Fee Config Schema
 */
export const feeConfigSchema = (t: TFunction) =>
  z.object({
    ebayFeePercent: formNumber(t, (n) =>
      n
        .min(0, t('listingSettingsGroup.validation.minFeePercent'))
        .max(100, t('listingSettingsGroup.validation.maxFeePercent'))
    ),
    fixedFeeAmount: formNumber(t, (n) => n.min(0, t('listingSettingsGroup.validation.minFixedFee'))),
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
 * Content policy (title strip / AI scaffold)
 */
export const listingContentConfigSchema = () =>
  z.object({
    stripBrandFromTitle: z.boolean().default(false),
    aiTitleEnabled: z.boolean().default(false),
    aiDescriptionEnabled: z.boolean().default(false),
  });

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
          // A range must start STRICTLY above where the previous one ends.
          // Equal boundaries used to be allowed ("tile continuously"), but the
          // actual price match (`amazonPrice >= min && amazonPrice <= max`) is
          // inclusive on both ends, so an Amazon price landing exactly on the
          // shared boundary matched BOTH ranges — which one governed was
          // whichever came first in the array, an implementation detail no
          // user ever chose. At $0.01 currency granularity there is no real
          // price this excludes, so tightening it costs nothing.
          if (items[i].minPrice <= items[i - 1].maxPrice) {
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
    content: listingContentConfigSchema().default({
      stripBrandFromTitle: false,
      aiTitleEnabled: false,
      aiDescriptionEnabled: false,
    }),
  });

export type ListingSettingsGroupFormData = z.infer<ReturnType<typeof listingSettingsGroupSchema>>;
