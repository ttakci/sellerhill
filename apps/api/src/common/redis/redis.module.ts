import { Global, Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

import { RedisHealthIndicator } from './redis-health.indicator';
import { getRedisOptions, REDIS_OPTIONS } from './redis.config';
import { RedisService } from './redis.service';

@Global()
@Module({
  providers: [
    {
      provide: REDIS_OPTIONS,
      inject: [ConfigService],
      useFactory: getRedisOptions,
    },
    RedisService,
    RedisHealthIndicator,
  ],
  exports: [REDIS_OPTIONS, RedisService, RedisHealthIndicator],
})
export class RedisModule {}
