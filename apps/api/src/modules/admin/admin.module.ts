// apps/api/src/modules/admin/admin.module.ts
//
// Admin Observability & FinOps module — read-only aggregation over
// usage_events, llm_usage_log, keepa_usage_log, shared_cost_entries, and the
// BullMQ queues. Registers every queue name with BullModule so the controller
// can @InjectQueue them for getJobCounts(); it never enqueues (read-only).
// One deliberate write surface: proxy pool management (AdminProxiesService) —
// the `proxies` table is operator-owned platform infrastructure with no
// customer module, so registering/disabling proxies lives here.

import { BullModule } from '@nestjs/bullmq';
import { Module } from '@nestjs/common';

import { DatabaseModule } from '../../common/database/database.module';
import { AuthModule } from '../auth/auth.module';
import { EmailModule } from '../email/email.module';


import { AdminListingFailuresService } from './admin-listing-failures.service';
import { AdminListingQualityService } from './admin-listing-quality.service';
import { AdminProxiesService } from './admin-proxies.service';
import { AdminUsersService } from './admin-users.service';
import { AdminController } from './admin.controller';
import { AdminService } from './admin.service';
import { DATA_RETENTION_QUEUE, DataRetentionService } from './data-retention.service';
import { ProviderPricingService } from './provider-pricing.service';
import { QueueEventsCollectorService } from './queue-events-collector.service';
import { QueueObservabilityService } from './queue-observability.service';
import { UsageBackfillService } from './usage-backfill.service';
import { UsageEventsService } from './usage-events.service';

@Module({
  imports: [
    DatabaseModule,
    AuthModule,
    // Only for the SMTP "test connection" action on the settings surface.
    EmailModule,
    BullModule.registerQueue(
      { name: 'order-sync' },
      { name: 'stock-sync' },
      { name: 'auto-fulfill' },
      { name: 'amazon-order-sync' },
      { name: 'amazon-tracking' },
      { name: 'amazon-verify' },
      { name: 'listings' },
      { name: 'keepa-refresh' },
      { name: 'buyer-message' },
      { name: DATA_RETENTION_QUEUE },
    ),
  ],
  controllers: [AdminController],
  providers: [
    AdminService,
    AdminProxiesService,
    AdminListingQualityService,
    AdminListingFailuresService,
    AdminUsersService,
    UsageEventsService,
    ProviderPricingService,
    UsageBackfillService,
    QueueObservabilityService,
    QueueEventsCollectorService,
    DataRetentionService,
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
