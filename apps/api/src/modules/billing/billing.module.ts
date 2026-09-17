// apps/api/src/modules/billing/billing.module.ts
//
// Billing module. Stripe is the only payment provider — there is no provider
// selection and nothing to fall back to. When STRIPE_SECRET_KEY is absent the
// same StripeBillingProvider is still injected; it simply reports
// isConfigured() === false and throws 'billing.errors.providerNotConfigured'
// (→ 409) on checkout/portal, while catalog/summary keep working. That is why
// no stand-in "local provider" class exists: Stripe's own test mode covers
// local dev and the test environment.
//
// DI tokens:
//   'BILLING_PROVIDER'  → StripeBillingProvider (behind the port interface)
//   'BILLING_CONFIG'    → resolved BillingConfig snapshot (read at boot)
// The repository/service/processor are concrete classes.

import { BullModule, getQueueToken } from '@nestjs/bullmq';
import { Module } from '@nestjs/common';
import type { Queue } from 'bullmq';

import { PlatformSettingsService } from '../../common/settings/platform-settings.service';
import { EmailModule } from '../email/email.module';
import { EmailService } from '../email/email.service';

import { resolveBillingConfig } from './billing-helpers';
import { StripeBillingProvider, type BillingProviderPort } from './billing-provider';
import { BillingRepositoryService } from './billing-repository.service';
import { BillingWebhookProcessor } from './billing-webhook-processor';
import { BillingController } from './billing.controller';
import { BillingService } from './billing.service';
import { BILLING_CONFIG_TOKEN, BILLING_PROVIDER_TOKEN } from './billing.tokens';
import {
  BILLING_LISTING_PLAN_LIMIT_QUEUE,
  ListingPlanLimitProcessor,
} from './listing-plan-limit.processor';
import { QuotaEnforcementService } from './quota-enforcement.service';
import {
  BILLING_RECONCILE_QUEUE,
  SubscriptionReconcileProcessor,
} from './subscription-reconcile.processor';
import { BILLING_TRIAL_EXPIRY_QUEUE, TrialExpiryProcessor } from './trial-expiry.processor';

// Declared in billing.tokens.ts (a provider inside this module injects one,
// and importing the module from a provider is a cycle); re-exported here so
// existing import sites keep working.
export { BILLING_CONFIG_TOKEN, BILLING_PROVIDER_TOKEN };

@Module({
  imports: [
    // Payment-failed and trial-ending e-mails (migration 107). EmailModule
    // imports only ConfigModule + DatabaseModule, so this adds no cycle.
    EmailModule,
    BullModule.registerQueue({ name: BILLING_TRIAL_EXPIRY_QUEUE }),
    BullModule.registerQueue({ name: BILLING_LISTING_PLAN_LIMIT_QUEUE }),
    BullModule.registerQueue({ name: BILLING_RECONCILE_QUEUE }),
  ],
  controllers: [BillingController],
  providers: [
    BillingRepositoryService,
    QuotaEnforcementService,
    {
      // Constructed by factory purely to pass EmailService as the optional
      // reminder sender; the queue + repository come from DI as usual.
      provide: TrialExpiryProcessor,
      inject: [getQueueToken(BILLING_TRIAL_EXPIRY_QUEUE), BillingRepositoryService, EmailService],
      useFactory: (queue: Queue, repo: BillingRepositoryService, email: EmailService) =>
        new TrialExpiryProcessor(queue, repo, email),
    },
    ListingPlanLimitProcessor,
    SubscriptionReconcileProcessor,
    {
      // BillingService injects this token and treats the result as the port,
      // so it never needs a Stripe client of its own.
      provide: BILLING_PROVIDER_TOKEN,
      inject: [BillingRepositoryService],
      useFactory: (repository: BillingRepositoryService) =>
        new StripeBillingProvider(resolveBillingConfig(), repository),
    },
    {
      provide: BILLING_CONFIG_TOKEN,
      useFactory: () => resolveBillingConfig(),
    },
    {
      provide: BillingWebhookProcessor,
      inject: [BillingRepositoryService, BILLING_CONFIG_TOKEN, EmailService],
      useFactory: (
        repo: BillingRepositoryService,
        config: ReturnType<typeof resolveBillingConfig>,
        email: EmailService,
      ) => new BillingWebhookProcessor(repo, config, email),
    },
    {
      provide: BillingService,
      inject: [BillingRepositoryService, BILLING_PROVIDER_TOKEN, PlatformSettingsService],
      useFactory: (
        repo: BillingRepositoryService,
        provider: BillingProviderPort,
        platformSettings: PlatformSettingsService,
      ) => new BillingService(repo, provider, platformSettings),
    },
  ],
  exports: [BillingService, BillingRepositoryService, QuotaEnforcementService],
})
export class BillingModule {}
