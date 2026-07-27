import { Module } from '@nestjs/common';
import { TerminusModule } from '@nestjs/terminus';

import { RedisModule } from '../common/redis/redis.module';

import { HealthController } from './health.controller';
import { PgvectorHealthIndicator } from './pgvector-health.indicator';

@Module({
  imports: [TerminusModule, RedisModule],
  controllers: [HealthController],
  providers: [PgvectorHealthIndicator],
})
export class HealthModule {}
