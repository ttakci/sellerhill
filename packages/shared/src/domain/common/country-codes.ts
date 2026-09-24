// packages/shared/src/domain/common/country-codes.ts
//
// ISO 3166-1 alpha-2 country codes — the value set eBay's `CountryCodeEnum`
// accepts for an address `country` field.
//
// This exists because eBay reports an UNPARSEABLE country as a MISSING one.
// `store_settings.country` was a free-text input, so a seller who typed a
// country NAME ("United States", "Türkiye") sent that string straight through
// to `createInventoryLocation`, where eBay failed to map it onto the enum,
// dropped the field, and answered:
//
//   errorId 25801, API_INVENTORY, "Missing field country." (fieldName: country)
//
// The field was never empty — it was invalid — so every "is it filled in?"
// check upstream passed and the create failed at eBay with a message that
// pointed at the one thing that was not wrong. Validating against this list is
// what keeps an unmappable value from reaching eBay at all.

/** Every officially assigned ISO 3166-1 alpha-2 code (249). */
export const COUNTRY_CODES = [
  'AD', 'AE', 'AF', 'AG', 'AI', 'AL', 'AM', 'AO', 'AQ', 'AR', 'AS', 'AT', 'AU', 'AW', 'AX', 'AZ',
  'BA', 'BB', 'BD', 'BE', 'BF', 'BG', 'BH', 'BI', 'BJ', 'BL', 'BM', 'BN', 'BO', 'BQ', 'BR', 'BS',
  'BT', 'BV', 'BW', 'BY', 'BZ',
  'CA', 'CC', 'CD', 'CF', 'CG', 'CH', 'CI', 'CK', 'CL', 'CM', 'CN', 'CO', 'CR', 'CU', 'CV', 'CW',
  'CX', 'CY', 'CZ',
  'DE', 'DJ', 'DK', 'DM', 'DO', 'DZ',
  'EC', 'EE', 'EG', 'EH', 'ER', 'ES', 'ET',
  'FI', 'FJ', 'FK', 'FM', 'FO', 'FR',
  'GA', 'GB', 'GD', 'GE', 'GF', 'GG', 'GH', 'GI', 'GL', 'GM', 'GN', 'GP', 'GQ', 'GR', 'GS', 'GT',
  'GU', 'GW', 'GY',
  'HK', 'HM', 'HN', 'HR', 'HT', 'HU',
  'ID', 'IE', 'IL', 'IM', 'IN', 'IO', 'IQ', 'IR', 'IS', 'IT',
  'JE', 'JM', 'JO', 'JP',
  'KE', 'KG', 'KH', 'KI', 'KM', 'KN', 'KP', 'KR', 'KW', 'KY', 'KZ',
  'LA', 'LB', 'LC', 'LI', 'LK', 'LR', 'LS', 'LT', 'LU', 'LV', 'LY',
  'MA', 'MC', 'MD', 'ME', 'MF', 'MG', 'MH', 'MK', 'ML', 'MM', 'MN', 'MO', 'MP', 'MQ', 'MR', 'MS',
  'MT', 'MU', 'MV', 'MW', 'MX', 'MY', 'MZ',
  'NA', 'NC', 'NE', 'NF', 'NG', 'NI', 'NL', 'NO', 'NP', 'NR', 'NU', 'NZ',
  'OM',
  'PA', 'PE', 'PF', 'PG', 'PH', 'PK', 'PL', 'PM', 'PN', 'PR', 'PS', 'PT', 'PW', 'PY',
  'QA',
  'RE', 'RO', 'RS', 'RU', 'RW',
  'SA', 'SB', 'SC', 'SD', 'SE', 'SG', 'SH', 'SI', 'SJ', 'SK', 'SL', 'SM', 'SN', 'SO', 'SR', 'SS',
  'ST', 'SV', 'SX', 'SY', 'SZ',
  'TC', 'TD', 'TF', 'TG', 'TH', 'TJ', 'TK', 'TL', 'TM', 'TN', 'TO', 'TR', 'TT', 'TV', 'TW', 'TZ',
  'UA', 'UG', 'UM', 'US', 'UY', 'UZ',
  'VA', 'VC', 'VE', 'VG', 'VI', 'VN', 'VU',
  'WF', 'WS',
  'YE', 'YT',
  'ZA', 'ZM', 'ZW',
] as const;

export type CountryCode = (typeof COUNTRY_CODES)[number];

const COUNTRY_CODE_SET: ReadonlySet<string> = new Set(COUNTRY_CODES);

/**
 * The canonical code, or `null` when the input is not one.
 *
 * Trims and upper-cases first, so a stored `"us"` is accepted rather than
 * rejected over a detail eBay does not care about — but a country NAME is
 * never guessed at. Mapping "United States" onto `US` would mean owning a
 * name table in every language a seller might type, and silently rewriting
 * seller input is how the wrong country ships.
 */
export function normalizeCountryCode(value: string | null | undefined): CountryCode | null {
  const candidate = value?.trim().toUpperCase() ?? '';
  return COUNTRY_CODE_SET.has(candidate) ? (candidate as CountryCode) : null;
}

export function isValidCountryCode(value: string | null | undefined): boolean {
  return normalizeCountryCode(value) !== null;
}
