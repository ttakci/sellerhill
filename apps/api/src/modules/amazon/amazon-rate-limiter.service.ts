import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import Bottleneck from 'bottleneck';

/**
 * Default global ceiling on concurrent browser actions. Unchanged from when it
 * was hardcoded, so adopting the env var is not a behaviour change.
 */
const DEFAULT_GLOBAL_CONCURRENCY = 5;

@Injectable()
export class AmazonRateLimiter implements OnModuleInit {
  private readonly logger = new Logger(AmazonRateLimiter.name);

  private globalLimiter!: Bottleneck;
  private accountLimiters!: Bottleneck.Group;

  onModuleInit() {
    // Global limiter: N concurrent browser actions, 500ms between starts.
    //
    // This is a RESOURCE guard (Chromium RSS + CPU on the host), NOT the
    // anti-ban control — bans are governed per account by the group below
    // (1 concurrent, 3s spacing, 20/min), which is deliberately NOT tunable.
    // Raising this does not make any single Amazon account look busier.
    //
    // It is also the platform's throughput ceiling: capacity is
    // `maxConcurrent × 86,400` browser-seconds/day, so at 5 the whole
    // installation gets ~432k/day. Around 400+ buyer accounts that becomes the
    // binding constraint (order-list scraping alone is `accounts × ticks/day`
    // — see AmazonOrderSyncSchedulerService), which is why it is an env knob
    // rather than a constant. Budget ~150–300 MB RSS per unit before raising
    // it, and dial AMAZON_ORDER_SYNC_CRON first: that is far cheaper than
    // paying for the RAM.
    const globalConcurrency = parsePositiveInt(
      process.env.AMAZON_GLOBAL_CONCURRENCY,
      DEFAULT_GLOBAL_CONCURRENCY,
    );
    this.globalLimiter = new Bottleneck({
      maxConcurrent: globalConcurrency,
      minTime: 500,
    });

    // Per-account limiter group: 1 concurrent, 3s between requests, 20/min
    this.accountLimiters = new Bottleneck.Group({
      maxConcurrent: 1,
      minTime: 3000,
      reservoir: 20,
      reservoirRefreshAmount: 20,
      reservoirRefreshInterval: 60 * 1000,
      timeout: 300000, // auto-cleanup idle limiters after 5 min
    });

    // Chain per-account limiters to global limiter
    this.accountLimiters.on('created', (limiter) => {
      limiter.chain(this.globalLimiter);
    });

    // Exponential backoff on failures
    this.accountLimiters.on('created', (limiter) => {
      limiter.on('failed', (error, jobInfo) => {
        const msg = error instanceof Error ? error.message : String(error);
        if (msg.includes('429') || msg.includes('captcha') || msg.includes('blocked')) {
          if (jobInfo.retryCount < 3) {
            const delay = Math.pow(5, jobInfo.retryCount + 1) * 1000 + Math.random() * 2000;
            this.logger.warn(`Rate limited, retrying in ${Math.round(delay / 1000)}s (attempt ${jobInfo.retryCount + 1})`);
            return delay;
          }
        }
        return undefined;
      });
    });

    this.logger.log(
      `Amazon rate limiter initialized (${globalConcurrency} global concurrent, 1/account, 20 req/min/account) ` +
        `— platform ceiling ≈ ${(globalConcurrency * 86_400).toLocaleString('en-US')} browser-seconds/day.`,
    );
  }

  async schedule<T>(amazonAccountId: string, fn: () => Promise<T>): Promise<T> {
    return this.accountLimiters.key(amazonAccountId).schedule(fn);
  }
}

/** Parse a positive int env var; anything invalid falls back to `fallback`. */
function parsePositiveInt(raw: string | undefined, fallback: number): number {
  if (!raw) {
    return fallback;
  }
  const parsed = Number.parseInt(raw, 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
}
