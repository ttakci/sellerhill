import { Injectable } from '@nestjs/common';
import { HealthCheckError, HealthIndicator, HealthIndicatorResult } from '@nestjs/terminus';

import { RedisService } from './redis.service';

@Injectable()
export class RedisHealthIndicator extends HealthIndicator {
  constructor(private readonly redis: RedisService) {
    super();
  }

  async isHealthy(key: string): Promise<HealthIndicatorResult> {
    try {
      const pong = await this.redis.command.ping();
      if (pong === 'PONG' && this.redis.isReady()) {return this.getStatus(key, true);}
    } catch {
      // Terminus receives a sanitized health result below.
    }
    throw new HealthCheckError('Redis health check failed', this.getStatus(key, false));
  }
}
