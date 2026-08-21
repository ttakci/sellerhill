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

import { BullModule } from '@nestjs/bullmq';
import { Module } from '@nestjs/common';

import { PlatformSettingsService } from '../../common/settings/platform-settings.service';

import { resolveBillingConfig } from './billing-helpers';
import { StripeBillingProvider, type BillingProviderPort } from './billing-provider';
import { BillingRepositoryService } from './billing-repository.service';
import { BillingWebhookProcessor } from './billing-webhook-processor';
import { BillingController } from './billing.controller';
import { BillingService } from './billing.service';
import { QuotaEnforcementService } from './quota-enforcement.service';
import { BILLING_TRIAL_EXPIRY_QUEUE, TrialExpiryProcessor } from './trial-expiry.processor';

export const BILLING_PROVIDER_TOKEN = 'BILLING_PROVIDER';
export const BILLING_CONFIG_TOKEN = 'BILLING_CONFIG';

@Module({
  imports: [BullModule.registerQueue({ name: BILLING_TRIAL_EXPIRY_QUEUE })],
  controllers: [BillingController],
  providers: [
    BillingRepositoryService,
    QuotaEnforcementService,
    TrialExpiryProcessor,
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
      inject: [BillingRepositoryService, BILLING_CONFIG_TOKEN],
      useFactory: (repo: BillingRepositoryService, config: ReturnType<typeof resolveBillingConfig>) =>
        new BillingWebhookProcessor(repo, config),
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
