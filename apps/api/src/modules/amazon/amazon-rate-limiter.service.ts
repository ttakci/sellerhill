import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import Bottleneck from 'bottleneck';

@Injectable()
export class AmazonRateLimiter implements OnModuleInit {
  private readonly logger = new Logger(AmazonRateLimiter.name);

  private globalLimiter!: Bottleneck;
  private accountLimiters!: Bottleneck.Group;

  onModuleInit() {
    // Global limiter: max 5 concurrent browser actions, 500ms between them
    this.globalLimiter = new Bottleneck({
      maxConcurrent: 5,
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

    this.logger.log('Amazon rate limiter initialized (5 global concurrent, 1/account, 20 req/min/account)');
  }

  async schedule<T>(amazonAccountId: string, fn: () => Promise<T>): Promise<T> {
    return this.accountLimiters.key(amazonAccountId).schedule(fn);
  }
}
