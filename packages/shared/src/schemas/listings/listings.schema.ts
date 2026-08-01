import { z } from 'zod';

/**
 * ASIN validation regex (Amazon Standard Identification Number)
 * Format: B followed by 9 alphanumeric characters
 */
const ASIN_REGEX = /^B[0-9A-Z]{9}$/;

export const parseAsins = (val: string): string[] => {
  const lines = val
    .split('\n')
    .map((line) => line.trim().toUpperCase())
    .filter((line) => line.length > 0);
  return [...new Set(lines)];
};

type TranslationFunction = (key: string) => string;

export const createListingsSchema = (t: TranslationFunction) =>
  z.object({
    asins: z
      .string()
      .min(1, t('listings.validation.minOneAsin'))
      .refine((val) => {
        const parsed = parseAsins(val);
        return parsed.length > 0;
      }, t('listings.validation.minOneAsin'))
      .refine((val) => {
        const parsed = parseAsins(val);
        return parsed.every((asin) => ASIN_REGEX.test(asin));
      }, t('listings.validation.invalidAsin'))
      .refine((val) => {
        const parsed = parseAsins(val);
        return parsed.length <= 1000;
      }, t('listings.validation.maxAsins')),
    ebayAccountId: z.string().uuid(t('listings.validation.ebayAccountRequired')),
    listingSettingsGroupId: z.string().min(1, t('listings.validation.listingSettingsGroupRequired')),
    paymentPolicyId: z.string().min(1, t('listings.validation.paymentPolicyRequired')),
    shippingPolicyId: z.string().min(1, t('listings.validation.shippingPolicyRequired')),
    returnPolicyId: z.string().min(1, t('listings.validation.returnPolicyRequired')),
    /** Save prepared listings without publishing to eBay. */
    asDraft: z.boolean().optional(),
  });

export type CreateListingsFormData = z.infer<ReturnType<typeof createListingsSchema>>;

/** Zod schema for listing detail settings form (title + strategy + policies). */
export const updateListingSchema = (t: TranslationFunction) =>
  z.object({
    title: z.string().min(1, t('listings.validation.titleRequired')).max(80, t('listings.validation.titleMax')),
    listingSettingsGroupId: z.string().min(1, t('listings.validation.listingSettingsGroupRequired')),
    paymentPolicyId: z.string().min(1, t('listings.validation.paymentPolicyRequired')),
    shippingPolicyId: z.string().min(1, t('listings.validation.shippingPolicyRequired')),
    returnPolicyId: z.string().min(1, t('listings.validation.returnPolicyRequired')),
  });

export type UpdateListingFormData = z.infer<ReturnType<typeof updateListingSchema>>;

/** Per-listing override form (easync Listing Settings). */
export const listingOverridesSchema = z.object({
  disableOrdering: z.boolean(),
  disableRepricing: z.boolean(),
  lockPrice: z.boolean(),
  lockQuantity: z.boolean(),
  priceOverride: z.string().optional(),
  quantityOverride: z.string().optional(),
  marginPercentOverride: z.string().optional(),
  marginFixedOverride: z.string().optional(),
});

export type ListingOverridesFormData = z.infer<typeof listingOverridesSchema>;
