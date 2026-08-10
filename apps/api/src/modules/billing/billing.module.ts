// apps/api/src/modules/billing/billing.module.ts
//
// Billing module. Wires the provider abstraction with a fail-safe: when Paddle
// env is absent, the LocalBillingProvider is injected (checkout/portal throw
// 'billing.errors.providerNotConfigured' → 409; catalog/summary still work).
// When Paddle env is present, PaddleBillingProvider is injected with the
// resolved config.
//
// DI tokens:
//   'BILLING_PROVIDER'  → concrete provider (Paddle or Local)
//   'BILLING_CONFIG'    → resolved BillingConfig snapshot (read at boot)
// The repository/service/processor are concrete classes.

import { BullModule } from '@nestjs/bullmq';
import { Module } from '@nestjs/common';

import { PlatformSettingsService } from '../../common/settings/platform-settings.service';

import { resolveBillingConfig } from './billing-helpers';
import { LocalBillingProvider, PaddleBillingProvider, type BillingProviderPort } from './billing-provider';
import { BillingRepositoryService } from './billing-repository.service';
import { BillingWebhookProcessor } from './billing-webhook-processor';
import { BillingController } from './billing.controller';
import { BillingService } from './billing.service';
import { BillingProvider } from './billing.types';
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
      // Provider is selected at module-init time based on env. The token is a
      // string; the concrete impl is Paddle or Local. BillingService injects
      // this token and treats the result as the provider port.
      provide: BILLING_PROVIDER_TOKEN,
      useFactory: () => {
        const config = resolveBillingConfig();
        return config.provider === BillingProvider.PADDLE
          ? new PaddleBillingProvider(config)
          : new LocalBillingProvider();
      },
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
