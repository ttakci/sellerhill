/**
 * The business's public contact details, shown in the landing footer.
 *
 * These are facts, not copy: the same in every locale, so they live here rather
 * than being duplicated across the two translation files where they could drift.
 * They match what the payment processor holds as the customer-facing business
 * information, which is the point of publishing them — a visitor (and the
 * processor's own site review) can see who is behind the product and how to
 * reach them.
 */
export const BUSINESS_CONTACT = {
  legalName: '2B Trading, LLC',
  addressLines: ['30 N Gould St', 'Ste 24233', 'Sheridan, WY 82801, US'],
  phoneDisplay: '+1 (917) 818-3646',
  phoneHref: 'tel:+19178183646',
  email: 'support@sellerhill.com',
  emailHref: 'mailto:support@sellerhill.com',
} as const;
