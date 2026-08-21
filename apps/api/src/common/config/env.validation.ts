import { plainToInstance } from 'class-transformer';
import { IsBoolean, IsEnum, IsIn, IsNumber, IsOptional, IsString, Max, Min, validateSync } from 'class-validator';

enum Environment {
  Development = 'development',
  Production = 'production',
  Test = 'test',
  Staging = 'staging',
}

/**
 * Environment Variables Validation Schema
 * Validates all required environment variables at startup
 */
class EnvironmentVariables {
  @IsEnum(Environment)
  @IsOptional()
  NODE_ENV: Environment = Environment.Development;

  @IsNumber()
  @Min(1024)
  @Max(65535)
  @IsOptional()
  PORT: number = 3000;

  @IsString()
  @IsOptional()
  CORS_ORIGINS: string = 'http://localhost:5173';

  @IsString()
  @IsOptional()
  DATABASE_URL?: string;

  @IsString()
  @IsOptional()
  JWT_SECRET?: string;

  @IsNumber()
  @IsOptional()
  @Min(60)
  JWT_EXPIRATION?: number;

  @IsString()
  @IsOptional()
  REDIS_URL?: string;

  @IsString()
  @IsOptional()
  REDIS_HOST: string = 'localhost';

  @IsNumber()
  @Min(1)
  @Max(65535)
  @IsOptional()
  REDIS_PORT: number = 6379;

  @IsString()
  @IsOptional()
  REDIS_PASSWORD?: string;

  @IsNumber()
  @Min(0)
  @Max(15)
  @IsOptional()
  REDIS_DB: number = 0;

  @IsString()
  @IsOptional()
  REDIS_KEY_PREFIX: string = 'sellerhill';

  @IsString()
  @IsOptional()
  SENTRY_DSN?: string;

  @IsString()
  @IsOptional()
  LOG_LEVEL?: string;

  @IsString()
  @IsOptional()
  KEEPA_API_KEY?: string;

  // --- Keepa stale-driven refresh pipeline (all optional, sensible defaults) ---
  @IsNumber()
  @IsOptional()
  @Min(1)
  KEEPA_REFRESH_INTERVAL_MINUTES: number = 720; // 12h

  @IsNumber()
  @IsOptional()
  @Min(1)
  KEEPA_REFRESH_BATCH_SIZE: number = 50;

  @IsString()
  @IsOptional()
  KEEPA_REFRESH_SCHEDULER_CRON: string = '* * * * *';

  @IsNumber()
  @IsOptional()
  @Min(1)
  KEEPA_REFRESH_WORKER_CONCURRENCY: number = 1;

  @IsNumber()
  @IsOptional()
  @Min(1)
  KEEPA_REFRESH_QUARANTINE_MINUTES: number = 1440; // 1 day

  @IsNumber()
  @IsOptional()
  @Min(1)
  KEEPA_REFRESH_MAX_FAILURES: number = 5;

  // Master switch for the stale-driven refresh scheduler. Disable to keep the
  // API running (e.g. during token-budget testing) without any background
  // Keepa spend; user-triggered create-path calls are unaffected.
  @IsString()
  @IsOptional()
  KEEPA_REFRESH_ENABLED: string = 'true';

  // Claim lease: how far next_refresh_at is pushed when a scheduler tick claims
  // a batch. Must exceed the worst-case batch runtime (BullMQ retries incl.) so
  // rows aren't re-claimed mid-flight, and stay short enough that a crashed
  // batch re-becomes due quickly.
  @IsNumber()
  @IsOptional()
  @Min(1)
  KEEPA_REFRESH_CLAIM_LEASE_MINUTES: number = 15;

  // Keepa `update` freshness threshold in hours: serve Keepa-side cached offer
  // data younger than this (cheap/0 tokens) instead of forcing a live offer
  // refresh (6 tokens/found page). Unset → Keepa's ~1h default. Trade staleness
  // tolerance for tokens; keep well below KEEPA_REFRESH_INTERVAL_MINUTES.
  @IsNumber()
  @IsOptional()
  @Min(0)
  KEEPA_UPDATE_HOURS?: number;

  @IsString()
  @IsOptional()
  EBAY_CLIENT_ID?: string;

  @IsString()
  @IsOptional()
  EBAY_CLIENT_SECRET?: string;

  @IsString()
  @IsOptional()
  EBAY_REDIRECT_URI?: string;

  @IsString()
  @IsOptional()
  EBAY_RUNAME?: string;

  @IsString()
  @IsOptional()
  @IsIn(['sandbox', 'production'])
  EBAY_ENVIRONMENT: 'sandbox' | 'production' = 'sandbox';

  @IsString()
  @IsOptional()
  EBAY_AUTH_URL?: string;

  @IsString()
  @IsOptional()
  EBAY_TOKEN_URL?: string;

  @IsString()
  @IsOptional()
  EBAY_REST_API_URL?: string;

  @IsString()
  @IsOptional()
  EBAY_XML_API_URL?: string;

  @IsString()
  @IsOptional()
  AMAZON_ENCRYPTION_KEY?: string;

  @IsString()
  @IsOptional()
  BROWSER_STATE_DIR?: string;

  // --- Google OAuth (GIS popup auth-code). Optional; without these POST /auth/google returns 503. ---
  @IsString()
  @IsOptional()
  GOOGLE_CLIENT_ID?: string;

  @IsString()
  @IsOptional()
  GOOGLE_CLIENT_SECRET?: string;

  // --- Billing (Stripe). All optional — BILLING_ENFORCEMENT_ENABLED defaults
  // to false so the app runs in "full access" transition mode without Stripe
  // configured. Checkout/portal need STRIPE_SECRET_KEY and webhooks need
  // STRIPE_WEBHOOK_SECRET; without them the billing module fails safe
  // (catalog + summary still work; checkout/portal return 409; webhooks 401).
  // Stripe's own test mode is what local dev and the test environment use —
  // there is no separate sandbox/environment switch to configure. ---
  /** Master enforcement toggle. When false (default), all users have full
   *  access and the summary reports `transition: 'full_access'` with NO fake
   *  subscription. Set to true only after Stripe is wired and plans are
   *  meant to gate features. */
  @IsBoolean()
  @IsOptional()
  BILLING_ENFORCEMENT_ENABLED: boolean = false;

  /** Stripe secret key (`sk_test_...` / `sk_live_...`, or a restricted
   *  `rk_...`). Required for checkout + portal; without it they return 409. */
  @IsString()
  @IsOptional()
  STRIPE_SECRET_KEY?: string;

  /** Stripe webhook signing secret (`whsec_...`) used to verify the
   *  `Stripe-Signature` header. Required for `POST /billing/webhooks/stripe`
   *  to accept deliveries; without it the endpoint 401s. */
  @IsString()
  @IsOptional()
  STRIPE_WEBHOOK_SECRET?: string;

  /** Stale-webhook protection: drop events older than this many minutes after
   *  they are logged to the inbox. Prevents a flood of ancient redeliveries
   *  from mutating current subscription state. 0 = no staleness drop. */
  @IsNumber()
  @Min(0)
  @IsOptional()
  BILLING_WEBHOOK_STALE_MINUTES: number = 1440; // 24h

  /** Max attempts to process a single webhook event before marking it failed. */
  @IsNumber()
  @Min(1)
  @IsOptional()
  BILLING_WEBHOOK_MAX_ATTEMPTS: number = 5;
}

/**
 * Validate environment variables
 * Throws error if validation fails
 */
export function validateEnv(config: Record<string, unknown>) {
  const validatedConfig = plainToInstance(EnvironmentVariables, config, {
    enableImplicitConversion: true,
  });

  const errors = validateSync(validatedConfig, {
    skipMissingProperties: false,
  });

  if (errors.length > 0) {
    const errorMessages = errors.map((error) => Object.values(error.constraints || {}).join(', ')).join('\n');
    throw new Error(`Environment validation failed:\n${errorMessages}`);
  }

  return validatedConfig;
}
