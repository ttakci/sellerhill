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

/**
 * Sample rows for the "item specifics" card in the Why section: what another
 * tool publishes for a required field versus what SellerHill fills in. The
 * names and values are eBay-US listing data (always English on eBay.com), and
 * "Does not apply" is eBay's own non-value quoted verbatim — so, like the
 * screenshots, these are the same in every locale and are not i18n copy.
 */
export const SPEC_SAMPLES = [
  { name: 'Color', value: 'Black' },
  { name: 'Material', value: 'Aluminum' },
  { name: 'Connectivity', value: 'Bluetooth 5.3' },
  { name: 'Battery Life', value: '30 Hours' },
] as const;

export const SPEC_PLACEHOLDER = 'Does not apply';

/** The four daily checks on the sync card's 24-hour rail (UTC-neutral clock labels). */
export const SYNC_TIMES = ['00:00', '06:00', '12:00', '18:00'] as const;
