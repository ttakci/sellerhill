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
  /** Append-only table retention windows + Chromium profile disk GC. */
  RETENTION = 'retention',
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
  /** Derive the batch size from the Keepa plan's own refill rate instead of
   *  using the fixed batchSize above. See refresh-batch-size.ts. */
  KEEPA_REFRESH_BATCH_AUTO = 'keepa.refresh.batchAuto',
  /** Percent of the Keepa refill rate held back for the create path, so a
   *  seller adding listings is never starved by background refresh. */
  KEEPA_REFRESH_RESERVE_PERCENT = 'keepa.refresh.reservePercent',
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
  /**
   * How often each Amazon buyer account's order list is scraped for cost
   * capture. This is the single largest consumer of browser time on the
   * platform: it costs one scrape per ACCOUNT per tick regardless of whether
   * anything sold, so at N accounts the cost scales with N × ticks/day and
   * with nothing else. Dial this before buying a bigger machine.
   */
  AMAZON_ORDER_SYNC_CRON = 'amazon.orderSync.cron',
  AMAZON_ORDER_SYNC_MATCH_TOLERANCE_PCT = 'amazon.orderSync.matchTolerancePct',
  AMAZON_ORDER_SYNC_MATCH_WINDOW_DAYS = 'amazon.orderSync.matchWindowDays',
  AMAZON_TRACKING_PRESHIP_INTERVAL_HOURS = 'amazon.tracking.preshipIntervalHours',
  AMAZON_TRACKING_SHIPPED_INTERVAL_HOURS = 'amazon.tracking.shippedIntervalHours',

  // --- Tracking-number conversion provider (Aquiline) ---
  /** Base URL of the conversion API. Overridable so a provider swap is config. */
  AQUILINE_BASE_URL = 'tracking.aquiline.baseUrl',
  /** Write-only secret. Without it every order degrades to the pass-through. */
  AQUILINE_API_KEY = 'tracking.aquiline.apiKey',
  /**
   * Dormant. Kept only because a deployed database may still hold a value for
   * it. The Integration API (2026-08-23) has no `X-Partner-Id` header — that
   * was a v3 partner/courier API concept. Do not read this key from new code.
   */
  AQUILINE_PARTNER_ID = 'tracking.aquiline.partnerId',
  AQUILINE_TIMEOUT_MS = 'tracking.aquiline.timeoutMs',
  /** HMAC secret for inbound webhooks. Empty = receiver refuses everything. */
  AQUILINE_WEBHOOK_SECRET = 'tracking.aquiline.webhookSecret',
  /** Reject delivery events older than this, so a replayed backlog cannot
   *  fire a burst of days-late "delivered" messages at buyers. */
  AQUILINE_WEBHOOK_MAX_AGE_MINUTES = 'tracking.aquiline.webhookMaxAgeMinutes',
  /**
   * One Aquiline account serves every environment (dev/test/production) and
   * there is no test tenant, so a profile created locally would otherwise
   * permanently burn a slot on the same paid plan production uses. Prefixed
   * onto the profile id sent to the provider so environments never collide.
   */
  AQUILINE_PROFILE_PREFIX = 'tracking.aquiline.profilePrefix',
  /** Our plan's profile ceiling. Enforced by us — the API does not expose it. */
  AQUILINE_MAX_PROFILES = 'tracking.aquiline.maxProfiles',

  // --- Chromium profile disk GC (see amazon/browser-profile-gc.ts) ---
  /** Master switch for the per-account profile sweeper. */
  BROWSER_PROFILE_GC_ENABLED = 'amazon.browserProfileGc.enabled',
  /**
   * Delete a whole profile after this many days unused. Long by design: a full
   * removal forces an Amazon re-login, which can hit a captcha/OTP challenge.
   * 0 disables dormant eviction (cache pruning and orphan purging still run).
   */
  BROWSER_PROFILE_GC_DORMANT_DAYS = 'amazon.browserProfileGc.dormantDays',
  /** Remove profiles whose Amazon account no longer exists. Never costs a re-login. */
  BROWSER_PROFILE_GC_PURGE_ORPHANS = 'amazon.browserProfileGc.purgeOrphans',

  // --- Database retention (append-only tables; see admin/data-retention.manifest.ts) ---
  RETENTION_QUEUE_OBSERVATIONS_DAYS = 'retention.queueObservationsDays',
  RETENTION_KEEPA_USAGE_LOG_DAYS = 'retention.keepaUsageLogDays',
  RETENTION_LLM_USAGE_LOG_DAYS = 'retention.llmUsageLogDays',
  RETENTION_USAGE_EVENTS_DAYS = 'retention.usageEventsDays',
  RETENTION_BUYER_MESSAGE_LOG_DAYS = 'retention.buyerMessageLogDays',
  RETENTION_AUDIT_LOGS_DAYS = 'retention.auditLogsDays',
  RETENTION_LISTING_REVISIONS_DAYS = 'retention.listingRevisionsDays',

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

  // --- Feature toggles ---
  LLM_CONTENT_ENABLED = 'llm.contentEnabled',
  /** Let a model pick a required item specific from eBay's allowed values (local provider). */
  EBAY_ASPECTS_LLM_ENABLED = 'ebay.aspects.llmEnabled',
  /** Hard per-listing ceiling on those calls. */
  EBAY_ASPECTS_LLM_MAX_PER_LISTING = 'ebay.aspects.llmMaxPerListing',
  BILLING_ENFORCEMENT_ENABLED = 'billing.enforcementEnabled',
  BILLING_TRIAL_DAYS = 'billing.trialDays',
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
