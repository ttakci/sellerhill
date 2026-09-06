export enum AmazonAccountStatus {
  ACTIVE = 'active',
  VERIFYING = 'verifying',
  INVALID = 'invalid',
  NEEDS_REAUTH = 'needs_reauth',
  LOCKED = 'locked',
}

/**
 * Stable, seller-facing reason an Amazon buyer-account verification failed.
 *
 * Same audience split as `AutoFulfillBlockedReason` / `ListingFailureCode`:
 * the backend classifies the raw Playwright/Amazon failure into ONE of these
 * codes and persists the CODE (never the raw sentence) in
 * `amazon_accounts.last_verification_error`; the web app resolves it to a
 * localized string via `settingsHub.sections.amazon.verificationError.<code>`.
 *
 * The raw provider message is unbounded and can echo account identifiers,
 * URLs and DOM diagnostics (see the throw sites in `amazon-scraping.service`),
 * so it stays server-side in logs only — it must never reach this column.
 *
 * `UNKNOWN` is the catch-all the FE also falls back to for any legacy raw
 * string already stored before this enum existed.
 */
export enum AmazonVerificationFailureCode {
  /** Amazon rejected the email/password (auth-error box on the sign-in form). */
  INVALID_CREDENTIALS = 'invalid_credentials',
  /** A captcha challenge blocked the automated sign-in. */
  CAPTCHA = 'captcha',
  /** Account has 2FA enabled but no TOTP secret is stored for it. */
  TWO_FACTOR_REQUIRED = 'two_factor_required',
  /** Sign-in completed with no error but no signed-in signal could be proven. */
  AUTH_NOT_PROVEN = 'auth_not_proven',
  /** Amazon presented an unexpected / changed login page (selector drift). */
  UNEXPECTED_LOGIN_PAGE = 'unexpected_login_page',
  /** Transport/infra failure (navigation timeout, network, browser crash). */
  TRANSPORT = 'transport',
  /** Anything not matched above, plus pre-enum legacy raw strings. */
  UNKNOWN = 'unknown',
}

/**
 * Amazon marketplace (buyer-account storefront/country). Mirrors the shape
 * of EbayMarketplaceId (packages/shared/src/domain/ebay/ebay.types.ts), but
 * ships with a single member: unlike eBay's SiteID table (already fully
 * known for 6 real markets), a second Amazon marketplace's Keepa domain id
 * and TLD are undecided product scope — fabricating that config now would be
 * building support for a country nobody has chosen. Adding a real one later
 * is one enum member + one AMAZON_MARKETPLACE_CONFIG entry + one
 * SUPPORTED_AMAZON_MARKETPLACES entry (see amazon.constants.ts), not a new
 * code path.
 */
export enum AmazonMarketplace {
  AMAZON_US = 'AMAZON_US',
}

/**
 * Steps of the add/edit Amazon buyer-account drawer wizard. Mirrors
 * StoreSettingsDrawerStep (packages/shared/src/domain/store-settings): the
 * container holds `step` as this enum, the component renders one `<Stepper>`
 * plus per-step content, and `primaryAction` reads "Save" only on the last
 * step. Zero-based so `(step + 1)` / `(step - 1)` walk the flow.
 */
export enum AmazonAccountDrawerStep {
  /** Label, marketplace note, credentials (email / password / 2FA) and the
   *  per-account auto-fulfillment toggle + spend cap. */
  ACCOUNT = 0,
  /** Optional self-service proxy (migration 080). Last step — its primary
   *  action saves. */
  PROXY = 1,
}
