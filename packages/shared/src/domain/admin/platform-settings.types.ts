// packages/shared/src/domain/admin/platform-settings.types.ts
//
// Runtime platform settings — the operator-tunable subset of configuration,
// editable from the admin panel instead of requiring an env change + redeploy.
//
// Resolution order for every key is DB override -> env var -> code default, so
// a deployment with no `platform_settings` rows behaves exactly as it did when
// the values lived only in env. Secrets and bootstrap config are deliberately
// NOT part of this surface (see PlatformSettingKey docs).

/** Value shape of a setting — drives coercion, validation and the UI control. */
export enum PlatformSettingType {
  /** 'true' / 'false'. Rendered as a Toggle. */
  BOOLEAN = 'boolean',
  /** Integer or decimal within optional min/max bounds. */
  NUMBER = 'number',
  /** Free text (host names, addresses). */
  STRING = 'string',
  /** One of a fixed option list. */
  ENUM = 'enum',
  /** A 5-field cron pattern. Validated for field count. */
  CRON = 'cron',
}

/** Grouping used to lay out the admin settings UI. */
export enum PlatformSettingCategory {
  KEEPA = 'keepa',
  EBAY = 'ebay',
  AMAZON = 'amazon',
  AUTO_FULFILL = 'auto_fulfill',
  EMAIL = 'email',
  ADMIN = 'admin',
  BILLING = 'billing',
  LLM = 'llm',
  BUYER_MESSAGING = 'buyer_messaging',
}

/** Where the effective value came from — shown in the UI so overrides are obvious. */
export enum PlatformSettingSource {
  /** An operator override row exists in `platform_settings`. */
  DATABASE = 'database',
  /** No override; the env var supplied the value. */
  ENV = 'env',
  /** No override and no env var; the code default applies. */
  DEFAULT = 'default',
}

/**
 * Every runtime-tunable setting key.
 *
 * Keys NOT in this enum are env-only by design and must stay that way:
 * connection bootstrap (DATABASE_*, REDIS_*), crypto/auth secrets (JWT_*,
 * AMAZON_ENCRYPTION_KEY), provider API credentials (KEEPA_API_KEY, EBAY_*,
 * GOOGLE_*, PADDLE_*, LLM_API_KEY) and process identity (NODE_ENV, PORT,
 * CORS_ORIGINS). They are read before the DB exists, are rotated as an ops
 * action, and must not be reachable over HTTP.
 */
export enum PlatformSettingKey {
  // --- Keepa product refresh (the main cost lever) ---
  KEEPA_REFRESH_ENABLED = 'keepa.refresh.enabled',
  KEEPA_REFRESH_INTERVAL_MINUTES = 'keepa.refresh.intervalMinutes',
  KEEPA_REFRESH_BATCH_SIZE = 'keepa.refresh.batchSize',
  KEEPA_REFRESH_CLAIM_LEASE_MINUTES = 'keepa.refresh.claimLeaseMinutes',
  KEEPA_REFRESH_MAX_FAILURES = 'keepa.refresh.maxFailures',
  KEEPA_REFRESH_QUARANTINE_MINUTES = 'keepa.refresh.quarantineMinutes',
  KEEPA_REFRESH_SCHEDULER_CRON = 'keepa.refresh.schedulerCron',

  // --- eBay API call budget (quotas are per APPLICATION, shared by all users) ---
  EBAY_BUDGET_ENABLED = 'ebay.budget.enabled',
  EBAY_BUDGET_RESERVE_PERCENT = 'ebay.budget.reservePercent',
  EBAY_BUDGET_INVENTORY_DAILY_LIMIT = 'ebay.budget.inventoryDailyLimit',
  EBAY_BUDGET_TAXONOMY_DAILY_LIMIT = 'ebay.budget.taxonomyDailyLimit',
  EBAY_BUDGET_ACCOUNT_DAILY_LIMIT = 'ebay.budget.accountDailyLimit',
  EBAY_BUDGET_FULFILLMENT_DAILY_LIMIT = 'ebay.budget.fulfillmentDailyLimit',
  EBAY_BUDGET_TRADING_DAILY_LIMIT = 'ebay.budget.tradingDailyLimit',

  // --- Amazon order sync / tracking ---
  AMAZON_ORDER_SYNC_MATCH_TOLERANCE_PCT = 'amazon.orderSync.matchTolerancePct',
  AMAZON_ORDER_SYNC_MATCH_WINDOW_DAYS = 'amazon.orderSync.matchWindowDays',
  AMAZON_TRACKING_PRESHIP_INTERVAL_HOURS = 'amazon.tracking.preshipIntervalHours',
  AMAZON_TRACKING_SHIPPED_INTERVAL_HOURS = 'amazon.tracking.shippedIntervalHours',

  // --- Auto-fulfillment ---
  AUTO_FULFILL_REVIEW_CAP_HARD_STOP = 'autoFulfill.reviewCapHardStop',
  FULFILLMENT_EVIDENCE_TTL_DAYS = 'autoFulfill.evidenceTtlDays',

  // --- Email / SMTP ---
  SMTP_HOST = 'email.smtpHost',
  SMTP_PORT = 'email.smtpPort',
  SMTP_SECURE = 'email.smtpSecure',
  SMTP_USER = 'email.smtpUser',
  SMTP_PASSWORD = 'email.smtpPassword',
  SMTP_FROM = 'email.smtpFrom',

  // --- Admin panel warning thresholds ---
  ADMIN_QUEUE_WAITING_THRESHOLD = 'admin.queueWaitingThreshold',
  ADMIN_KEEPA_LOW_TOKENS_THRESHOLD = 'admin.keepaLowTokensThreshold',
  ADMIN_LLM_FAILURE_RATE_THRESHOLD = 'admin.llmFailureRateThreshold',
  ADMIN_LISTING_QUOTA_WARN_THRESHOLD = 'admin.listingQuotaWarnThreshold',
  ADMIN_LISTING_QUOTA_CRITICAL_THRESHOLD = 'admin.listingQuotaCriticalThreshold',
  ADMIN_AMAZON_ACCOUNT_QUOTA_WARN_THRESHOLD = 'admin.amazonAccountQuotaWarnThreshold',
  ADMIN_AMAZON_ACCOUNT_QUOTA_CRITICAL_THRESHOLD = 'admin.amazonAccountQuotaCriticalThreshold',
  ADMIN_PROXY_EXPIRY_WARN_DAYS = 'admin.proxyExpiryWarnDays',

  // --- Feature toggles ---
  LLM_CONTENT_ENABLED = 'llm.contentEnabled',
  /** Let a model pick a required item specific from eBay's allowed values (local provider). */
  EBAY_ASPECTS_LLM_ENABLED = 'ebay.aspects.llmEnabled',
  /** Hard per-listing ceiling on those calls. */
  EBAY_ASPECTS_LLM_MAX_PER_LISTING = 'ebay.aspects.llmMaxPerListing',
  BILLING_ENFORCEMENT_ENABLED = 'billing.enforcementEnabled',
  BUYER_MESSAGING_FEEDBACK_DEFAULT_DELAY_DAYS = 'buyerMessaging.feedbackDefaultDelayDays',
}

/** One setting as presented to the admin UI. */
export interface PlatformSettingDto {
  key: PlatformSettingKey;
  category: PlatformSettingCategory;
  type: PlatformSettingType;
  /**
   * Effective value in canonical string form. ALWAYS null for secret settings
   * — the stored value is never returned, only `hasValue` tells you whether
   * one is configured.
   */
  value: string | null;
  /** Code default in string form; null when the setting has no default. */
  defaultValue: string | null;
  /** Which layer supplied the effective value. */
  source: PlatformSettingSource;
  /** Env var this key falls back to, shown so operators can map old config. */
  envVar: string;
  /**
   * True when the new value only takes effect after an API restart (the value
   * is consumed at boot, e.g. a repeatable job's cron pattern). The UI must
   * surface this — a silently-ignored change is worse than no change.
   */
  requiresRestart: boolean;
  /** Secret settings are write-only: never returned, only replaced. */
  isSecret: boolean;
  /** For secrets: whether any value is configured (DB override or env). */
  hasValue: boolean;
  /** Inclusive lower bound for NUMBER settings. */
  min: number | null;
  /** Inclusive upper bound for NUMBER settings. */
  max: number | null;
  /** Allowed values for ENUM settings. */
  options: string[] | null;
  /** ISO 8601 timestamp of the last override write; null when never overridden. */
  updatedAt: string | null;
}

/** Payload of GET /admin/settings. */
export interface PlatformSettingsListDto {
  generatedAt: string;
  settings: PlatformSettingDto[];
}

/** Request body for PUT /admin/settings/:key. */
export interface UpdatePlatformSettingRequest {
  /** Canonical string form; validated/coerced against the registry entry. */
  value: string;
}
