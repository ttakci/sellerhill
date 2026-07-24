import { plainToInstance } from 'class-transformer';
import { IsEnum, IsIn, IsNumber, IsOptional, IsString, Max, Min, validateSync } from 'class-validator';

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
  @IsOptional()
  REDIS_PORT: number = 6379;

  @IsString()
  @IsOptional()
  REDIS_PASSWORD?: string;

  @IsNumber()
  @IsOptional()
  REDIS_DB: number = 0;

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
