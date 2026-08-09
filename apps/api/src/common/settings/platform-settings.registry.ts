// apps/api/src/modules/admin/platform-settings.registry.ts
//
// The single source of truth for every runtime-tunable setting: its type,
// bounds, code default, and the env var it falls back to. Adding a knob means
// adding one entry here (plus the key in @repo/shared) — the admin API, the
// validation and the UI all derive from this table.
//
// `requiresRestart` is not cosmetic: it marks values consumed once at boot
// (repeatable job cron patterns, worker concurrency) where a silently-ignored
// change would be worse than no change at all.

import {
  PlatformSettingCategory,
  PlatformSettingKey,
  PlatformSettingType,
} from '@repo/shared';

export interface PlatformSettingDefinition {
  key: PlatformSettingKey;
  category: PlatformSettingCategory;
  type: PlatformSettingType;
  /** Env var consulted when no DB override exists. */
  envVar: string;
  /** Code default in canonical string form; null when the setting is optional. */
  defaultValue: string | null;
  /** Value is consumed at boot — changing it needs an API restart to apply. */
  requiresRestart?: boolean;
  /** Never returned by read endpoints; stored encrypted at rest. */
  isSecret?: boolean;
  min?: number;
  max?: number;
  options?: string[];
}

const def = (d: PlatformSettingDefinition): PlatformSettingDefinition => d;

export const PLATFORM_SETTING_DEFINITIONS: PlatformSettingDefinition[] = [
  // --- eBay API call budget ---
  // eBay meters calls PER APPLICATION, so all users share one daily quota and
  // exhausting it locks out every seller at once. Defaults mirror eBay's
  // published ceilings (developer.ebay.com/develop/apis/api-call-limits); raise
  // them here after an Application Growth Check is approved, without a deploy.
  def({
    key: PlatformSettingKey.EBAY_BUDGET_ENABLED,
    category: PlatformSettingCategory.EBAY,
    type: PlatformSettingType.BOOLEAN,
    envVar: 'EBAY_BUDGET_ENABLED',
    defaultValue: 'true',
  }),
  def({
    // Share of each quota fenced off for seller-triggered actions, so a night
    // of background refreshing cannot leave a user unable to publish.
    key: PlatformSettingKey.EBAY_BUDGET_RESERVE_PERCENT,
    category: PlatformSettingCategory.EBAY,
    type: PlatformSettingType.NUMBER,
    envVar: 'EBAY_BUDGET_RESERVE_PERCENT',
    defaultValue: '5',
    min: 0,
    max: 50,
  }),
  def({
    key: PlatformSettingKey.EBAY_BUDGET_INVENTORY_DAILY_LIMIT,
    category: PlatformSettingCategory.EBAY,
    type: PlatformSettingType.NUMBER,
    envVar: 'EBAY_BUDGET_INVENTORY_DAILY_LIMIT',
    defaultValue: '2000000',
    min: 1,
  }),
  def({
    // The scarcest resource we depend on, and the one that caps how many NEW
    // ASINs the platform can onboard per day.
    key: PlatformSettingKey.EBAY_BUDGET_TAXONOMY_DAILY_LIMIT,
    category: PlatformSettingCategory.EBAY,
    type: PlatformSettingType.NUMBER,
    envVar: 'EBAY_BUDGET_TAXONOMY_DAILY_LIMIT',
    defaultValue: '5000',
    min: 1,
  }),
  def({
    key: PlatformSettingKey.EBAY_BUDGET_ACCOUNT_DAILY_LIMIT,
    category: PlatformSettingCategory.EBAY,
    type: PlatformSettingType.NUMBER,
    envVar: 'EBAY_BUDGET_ACCOUNT_DAILY_LIMIT',
    defaultValue: '25000',
    min: 1,
  }),
  def({
    key: PlatformSettingKey.EBAY_BUDGET_FULFILLMENT_DAILY_LIMIT,
    category: PlatformSettingCategory.EBAY,
    type: PlatformSettingType.NUMBER,
    envVar: 'EBAY_BUDGET_FULFILLMENT_DAILY_LIMIT',
    defaultValue: '100000',
    min: 1,
  }),
  def({
    key: PlatformSettingKey.EBAY_BUDGET_TRADING_DAILY_LIMIT,
    category: PlatformSettingCategory.EBAY,
    type: PlatformSettingType.NUMBER,
    envVar: 'EBAY_BUDGET_TRADING_DAILY_LIMIT',
    defaultValue: '5000',
    min: 1,
  }),

  // --- Keepa refresh: the dominant recurring provider cost ---
  def({
    key: PlatformSettingKey.KEEPA_REFRESH_ENABLED,
    category: PlatformSettingCategory.KEEPA,
    type: PlatformSettingType.BOOLEAN,
    envVar: 'KEEPA_REFRESH_ENABLED',
    defaultValue: 'true',
  }),
  def({
    key: PlatformSettingKey.KEEPA_REFRESH_INTERVAL_MINUTES,
    category: PlatformSettingCategory.KEEPA,
    type: PlatformSettingType.NUMBER,
    envVar: 'KEEPA_REFRESH_INTERVAL_MINUTES',
    defaultValue: '720',
    min: 15,
    max: 10080,
  }),
  def({
    key: PlatformSettingKey.KEEPA_REFRESH_BATCH_SIZE,
    category: PlatformSettingCategory.KEEPA,
    type: PlatformSettingType.NUMBER,
    envVar: 'KEEPA_REFRESH_BATCH_SIZE',
    defaultValue: '50',
    min: 1,
    max: 1000,
  }),
  def({
    key: PlatformSettingKey.KEEPA_REFRESH_CLAIM_LEASE_MINUTES,
    category: PlatformSettingCategory.KEEPA,
    type: PlatformSettingType.NUMBER,
    envVar: 'KEEPA_REFRESH_CLAIM_LEASE_MINUTES',
    defaultValue: '15',
    min: 1,
    max: 240,
  }),
  def({
    key: PlatformSettingKey.KEEPA_REFRESH_MAX_FAILURES,
    category: PlatformSettingCategory.KEEPA,
    type: PlatformSettingType.NUMBER,
    envVar: 'KEEPA_REFRESH_MAX_FAILURES',
    defaultValue: '5',
    min: 1,
    max: 50,
  }),
  def({
    key: PlatformSettingKey.KEEPA_REFRESH_QUARANTINE_MINUTES,
    category: PlatformSettingCategory.KEEPA,
    type: PlatformSettingType.NUMBER,
    envVar: 'KEEPA_REFRESH_QUARANTINE_MINUTES',
    defaultValue: '1440',
    min: 5,
    max: 43200,
  }),
  def({
    // The repeatable tick is registered once at boot — a new pattern only
    // applies after a restart re-registers the scheduler.
    key: PlatformSettingKey.KEEPA_REFRESH_SCHEDULER_CRON,
    category: PlatformSettingCategory.KEEPA,
    type: PlatformSettingType.CRON,
    envVar: 'KEEPA_REFRESH_SCHEDULER_CRON',
    defaultValue: '* * * * *',
    requiresRestart: true,
  }),

  // --- Amazon order sync + tracking ---
  def({
    key: PlatformSettingKey.AMAZON_ORDER_SYNC_MATCH_TOLERANCE_PCT,
    category: PlatformSettingCategory.AMAZON,
    type: PlatformSettingType.NUMBER,
    envVar: 'AMAZON_ORDER_SYNC_MATCH_TOLERANCE_PCT',
    defaultValue: '5',
    min: 0,
    max: 50,
  }),
  def({
    key: PlatformSettingKey.AMAZON_ORDER_SYNC_MATCH_WINDOW_DAYS,
    category: PlatformSettingCategory.AMAZON,
    type: PlatformSettingType.NUMBER,
    envVar: 'AMAZON_ORDER_SYNC_MATCH_WINDOW_DAYS',
    defaultValue: '7',
    min: 1,
    max: 60,
  }),
  def({
    // Baked into the per-order job schedulers at reconcile time; a restart
    // re-runs reconcileSchedulers() and applies the new cadence.
    key: PlatformSettingKey.AMAZON_TRACKING_PRESHIP_INTERVAL_HOURS,
    category: PlatformSettingCategory.AMAZON,
    type: PlatformSettingType.NUMBER,
    envVar: 'AMAZON_TRACKING_PRESHIP_INTERVAL_HOURS',
    defaultValue: '6',
    min: 1,
    max: 72,
    requiresRestart: true,
  }),
  def({
    key: PlatformSettingKey.AMAZON_TRACKING_SHIPPED_INTERVAL_HOURS,
    category: PlatformSettingCategory.AMAZON,
    type: PlatformSettingType.NUMBER,
    envVar: 'AMAZON_TRACKING_SHIPPED_INTERVAL_HOURS',
    defaultValue: '24',
    min: 1,
    max: 168,
    requiresRestart: true,
  }),

  // --- Auto-fulfillment safety ---
  def({
    key: PlatformSettingKey.AUTO_FULFILL_REVIEW_CAP_HARD_STOP,
    category: PlatformSettingCategory.AUTO_FULFILL,
    type: PlatformSettingType.BOOLEAN,
    envVar: 'AUTO_FULFILL_REVIEW_CAP_HARD_STOP',
    defaultValue: 'true',
  }),
  def({
    key: PlatformSettingKey.FULFILLMENT_EVIDENCE_TTL_DAYS,
    category: PlatformSettingCategory.AUTO_FULFILL,
    type: PlatformSettingType.NUMBER,
    envVar: 'FULFILLMENT_EVIDENCE_TTL_DAYS',
    defaultValue: '7',
    min: 1,
    max: 365,
  }),

  // --- Email / SMTP ---
  def({
    key: PlatformSettingKey.SMTP_HOST,
    category: PlatformSettingCategory.EMAIL,
    type: PlatformSettingType.STRING,
    envVar: 'SMTP_HOST',
    defaultValue: 'smtp.gmail.com',
  }),
  def({
    key: PlatformSettingKey.SMTP_PORT,
    category: PlatformSettingCategory.EMAIL,
    type: PlatformSettingType.NUMBER,
    envVar: 'SMTP_PORT',
    defaultValue: '587',
    min: 1,
    max: 65535,
  }),
  def({
    key: PlatformSettingKey.SMTP_SECURE,
    category: PlatformSettingCategory.EMAIL,
    type: PlatformSettingType.BOOLEAN,
    envVar: 'SMTP_SECURE',
    defaultValue: 'false',
  }),
  def({
    key: PlatformSettingKey.SMTP_USER,
    category: PlatformSettingCategory.EMAIL,
    type: PlatformSettingType.STRING,
    envVar: 'SMTP_USER',
    defaultValue: null,
  }),
  def({
    key: PlatformSettingKey.SMTP_PASSWORD,
    category: PlatformSettingCategory.EMAIL,
    type: PlatformSettingType.STRING,
    envVar: 'SMTP_PASSWORD',
    defaultValue: null,
    isSecret: true,
  }),
  def({
    key: PlatformSettingKey.SMTP_FROM,
    category: PlatformSettingCategory.EMAIL,
    type: PlatformSettingType.STRING,
    envVar: 'SMTP_FROM',
    defaultValue: null,
  }),

  // --- Admin panel warning thresholds ---
  def({
    key: PlatformSettingKey.ADMIN_QUEUE_WAITING_THRESHOLD,
    category: PlatformSettingCategory.ADMIN,
    type: PlatformSettingType.NUMBER,
    envVar: 'ADMIN_QUEUE_WAITING_THRESHOLD',
    defaultValue: '100',
    min: 1,
    max: 100000,
  }),
  def({
    key: PlatformSettingKey.ADMIN_KEEPA_LOW_TOKENS_THRESHOLD,
    category: PlatformSettingCategory.ADMIN,
    type: PlatformSettingType.NUMBER,
    envVar: 'ADMIN_KEEPA_LOW_TOKENS_THRESHOLD',
    defaultValue: '100',
    min: 0,
    max: 1000000,
  }),
  def({
    key: PlatformSettingKey.ADMIN_LLM_FAILURE_RATE_THRESHOLD,
    category: PlatformSettingCategory.ADMIN,
    type: PlatformSettingType.NUMBER,
    envVar: 'ADMIN_LLM_FAILURE_RATE_THRESHOLD',
    defaultValue: '10',
    min: 0,
    max: 100,
  }),
  def({
    key: PlatformSettingKey.ADMIN_LISTING_QUOTA_WARN_THRESHOLD,
    category: PlatformSettingCategory.ADMIN,
    type: PlatformSettingType.NUMBER,
    envVar: 'ADMIN_LISTING_QUOTA_WARN_THRESHOLD',
    defaultValue: '25',
    min: 1,
    max: 1000000,
  }),
  def({
    key: PlatformSettingKey.ADMIN_LISTING_QUOTA_CRITICAL_THRESHOLD,
    category: PlatformSettingCategory.ADMIN,
    type: PlatformSettingType.NUMBER,
    envVar: 'ADMIN_LISTING_QUOTA_CRITICAL_THRESHOLD',
    defaultValue: '100',
    min: 1,
    max: 1000000,
  }),
  def({
    key: PlatformSettingKey.ADMIN_AMAZON_ACCOUNT_QUOTA_WARN_THRESHOLD,
    category: PlatformSettingCategory.ADMIN,
    type: PlatformSettingType.NUMBER,
    envVar: 'ADMIN_AMAZON_ACCOUNT_QUOTA_WARN_THRESHOLD',
    defaultValue: '3',
    min: 1,
    max: 1000,
  }),
  def({
    key: PlatformSettingKey.ADMIN_AMAZON_ACCOUNT_QUOTA_CRITICAL_THRESHOLD,
    category: PlatformSettingCategory.ADMIN,
    type: PlatformSettingType.NUMBER,
    envVar: 'ADMIN_AMAZON_ACCOUNT_QUOTA_CRITICAL_THRESHOLD',
    defaultValue: '10',
    min: 1,
    max: 1000,
  }),
  def({
    key: PlatformSettingKey.ADMIN_PROXY_EXPIRY_WARN_DAYS,
    category: PlatformSettingCategory.ADMIN,
    type: PlatformSettingType.NUMBER,
    envVar: 'ADMIN_PROXY_EXPIRY_WARN_DAYS',
    defaultValue: '7',
    min: 1,
    max: 90,
  }),

  // --- Feature toggles ---
  def({
    key: PlatformSettingKey.LLM_CONTENT_ENABLED,
    category: PlatformSettingCategory.LLM,
    type: PlatformSettingType.BOOLEAN,
    envVar: 'LLM_CONTENT_ENABLED',
    defaultValue: 'false',
  }),
  def({
    // Off by default: it needs a local model pulled (`ollama pull qwen3:1.7b`).
    // Turning it on costs nothing on the local provider, and a failure falls
    // back to the deterministic layers.
    key: PlatformSettingKey.EBAY_ASPECTS_LLM_ENABLED,
    category: PlatformSettingCategory.LLM,
    type: PlatformSettingType.BOOLEAN,
    envVar: 'EBAY_ASPECTS_LLM_ENABLED',
    defaultValue: 'false',
  }),
  def({
    key: PlatformSettingKey.EBAY_ASPECTS_LLM_MAX_PER_LISTING,
    category: PlatformSettingCategory.LLM,
    type: PlatformSettingType.NUMBER,
    envVar: 'EBAY_ASPECTS_LLM_MAX_PER_LISTING',
    defaultValue: '3',
    min: 0,
    max: 20,
  }),
  def({
    key: PlatformSettingKey.BILLING_ENFORCEMENT_ENABLED,
    category: PlatformSettingCategory.BILLING,
    type: PlatformSettingType.BOOLEAN,
    envVar: 'BILLING_ENFORCEMENT_ENABLED',
    defaultValue: 'false',
  }),
  def({
    key: PlatformSettingKey.BUYER_MESSAGING_FEEDBACK_DEFAULT_DELAY_DAYS,
    category: PlatformSettingCategory.BUYER_MESSAGING,
    type: PlatformSettingType.NUMBER,
    envVar: 'BUYER_MESSAGING_FEEDBACK_DEFAULT_DELAY_DAYS',
    defaultValue: '3',
    min: 0,
    max: 60,
  }),
];

/** Registry lookup by key. Unknown keys are rejected at the API boundary. */
export const PLATFORM_SETTINGS_BY_KEY: ReadonlyMap<PlatformSettingKey, PlatformSettingDefinition> =
  new Map(PLATFORM_SETTING_DEFINITIONS.map((d) => [d.key, d]));
