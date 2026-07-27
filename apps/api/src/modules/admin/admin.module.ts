// apps/api/src/modules/admin/admin.module.ts
//
// Admin Observability & FinOps module — read-only aggregation over
// usage_events, llm_usage_log, keepa_usage_log, shared_cost_entries, and the
// BullMQ queues. Registers every queue name with BullModule so the controller
// can @InjectQueue them for getJobCounts(); it never enqueues (read-only).

import { BullModule } from '@nestjs/bullmq';
import { Module } from '@nestjs/common';

import { DatabaseModule } from '../../common/database/database.module';
import { AuthModule } from '../auth/auth.module';

import { AdminController } from './admin.controller';
import { AdminService } from './admin.service';
import { ProviderPricingService } from './provider-pricing.service';
import { QueueEventsCollectorService } from './queue-events-collector.service';
import { QUEUE_OBSERVABILITY_RETENTION_QUEUE, QueueObservabilityRetentionService } from './queue-observability-retention.service';
import { QueueObservabilityService } from './queue-observability.service';
import { UsageBackfillService } from './usage-backfill.service';
import { UsageEventsService } from './usage-events.service';

@Module({
  imports: [
    DatabaseModule,
    AuthModule,
    BullModule.registerQueue(
      { name: 'order-sync' },
      { name: 'stock-sync' },
      { name: 'auto-fulfill' },
      { name: 'amazon-order-sync' },
      { name: 'amazon-tracking' },
      { name: 'amazon-verify' },
      { name: 'listings' },
      { name: 'keepa-refresh' },
      { name: 'knowledge-ingestion' },
      { name: QUEUE_OBSERVABILITY_RETENTION_QUEUE },
    ),
  ],
  controllers: [AdminController],
  providers: [
    AdminService,
    UsageEventsService,
    ProviderPricingService,
    UsageBackfillService,
    QueueObservabilityService,
    QueueEventsCollectorService,
    QueueObservabilityRetentionService,
  ],
  exports: [
    AdminService,
    UsageEventsService,
    ProviderPricingService,
    UsageBackfillService,
    QueueObservabilityService,
  ],
})
export class AdminModule {}
