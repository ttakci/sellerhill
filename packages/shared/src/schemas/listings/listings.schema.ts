import { z } from 'zod';

/**
 * ASIN validation regex (Amazon Standard Identification Number)
 * Format: B followed by 9 alphanumeric characters
 */
const ASIN_REGEX = /^B[0-9A-Z]{9}$/;

export const parseAsins = (val: string): string[] => {
  const lines = val.split('\n')
    .map(line => line.trim().toUpperCase())
    .filter(line => line.length > 0);
  return [...new Set(lines)];
};

export const createListingsSchema = (t: any) => z.object({
  asins: z.string()
    .min(1, t('listings.validation.minOneAsin'))
    .refine(val => {
      const parsed = parseAsins(val);
      return parsed.length > 0;
    }, t('listings.validation.minOneAsin'))
    .refine(val => {
      const parsed = parseAsins(val);
      return parsed.every(asin => ASIN_REGEX.test(asin));
    }, t('listings.validation.invalidAsin'))
    .refine(val => {
      const parsed = parseAsins(val);
      return parsed.length <= 1000;
    }, t('listings.validation.maxAsins')),
  listingSettingsGroupId: z.string().min(1, t('listings.validation.listingSettingsGroupRequired')),
  paymentPolicyId: z.string().min(1, t('listings.validation.paymentPolicyRequired')),
  shippingPolicyId: z.string().min(1, t('listings.validation.shippingPolicyRequired')),
  returnPolicyId: z.string().min(1, t('listings.validation.returnPolicyRequired')),
});

export type CreateListingsFormData = z.infer<ReturnType<typeof createListingsSchema>>;
