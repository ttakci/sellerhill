import { z } from 'zod';

/**
 * ASIN "shape" check — 10 alphanumeric characters, matching Amazon's own ASIN
 * spec (and ISBN-10, which IS a valid ASIN for books). There is deliberately
 * NO leading-'B' requirement: that was a false assumption an earlier revision
 * of this file encoded, and it rejected real ASINs (e.g. digit-leading ISBN-10
 * book identifiers). The 10-character bound is not arbitrary either — the
 * `listing_job_items`/`listings`/`products` DB columns are `VARCHAR(10)`, so a
 * value that doesn't fit this shape can never be stored or resolved anyway.
 */
export const ASIN_SHAPE_REGEX = /^[0-9A-Z]{10}$/;

export const isValidAsinShape = (asin: string): boolean => ASIN_SHAPE_REGEX.test(asin);

/**
 * Splits free-form pasted text into individual identifier tokens. Splits on
 * newlines AND commas/semicolons/whitespace — not just `\n` — so a
 * comma-separated paste doesn't survive as one glued-together token (which
 * would otherwise collide with Keepa's own comma-joined batch request format
 * and desynchronize per-item job tracking).
 */
export const parseAsins = (val: string): string[] => {
  const tokens = val
    .split(/[\s,;]+/)
    .map((token) => token.trim().toUpperCase())
    .filter((token) => token.length > 0);
  return [...new Set(tokens)];
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
        // Block submission only when NOTHING entered is usable. A batch with
        // a mix of valid and malformed entries must proceed — the malformed
        // ones are filtered out (and the user is warned) at submit time, not
        // rejected as a whole here. See AddListingsDrawer.container.tsx.
        const parsed = parseAsins(val);
        return parsed.some((asin) => isValidAsinShape(asin));
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

/**
 * Zod schema for listing detail settings form (title + strategy group only).
 * eBay policies are read-only on this page — reassigning a listing's payment/
 * shipping/return policy is not pushed to eBay's offer yet, so no form field
 * edits them (see listing detail eBay Policies card).
 */
export const updateListingSchema = (t: TranslationFunction) =>
  z.object({
    title: z.string().min(1, t('listings.validation.titleRequired')).max(80, t('listings.validation.titleMax')),
    listingSettingsGroupId: z.string().min(1, t('listings.validation.listingSettingsGroupRequired')),
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
