// apps/api/src/modules/billing/billing.service.ts
//
// Orchestrator for catalog/summary/checkout/portal. Pure reads go through the
// repository; checkout/portal go through the provider abstraction. Config is
// resolved once per request via resolveBillingConfig() so an env change
// (operator flips BILLING_ENFORCEMENT_ENABLED) takes effect without a restart.
//
// Fail-safe contract: when no provider is configured (Paddle env absent), the
// service still serves catalog + summary; checkout + portal throw
// 'billing.errors.providerNotConfigured' so the controller can map to 409.
// When enforcement is off (default), summary reports transition='full_access'
// with NO fake subscription — the absence of a row is the truthful state.

import { Injectable, Logger } from '@nestjs/common';
import { BillingInterval, PlatformSettingKey } from '@repo/shared';

import { PlatformSettingsService } from '../../common/settings/platform-settings.service';

import {
  deriveSummaryTransition,
  isProviderConfigured,
  resolveBillingConfig,
  type BillingConfig,
} from './billing-helpers';
import type { BillingProviderPort, CheckoutRequest } from './billing-provider';
import { BillingRepositoryService } from './billing-repository.service';
import {
  type BillingCatalogDto,
  type BillingCheckoutDto,
  type BillingPortalDto,
  type BillingSummaryDto,
} from './billing.types';
import { normalizeExpiredTrial, trialEndFrom } from './trial-helpers';

@Injectable()
export class BillingService {
  private readonly logger = new Logger(BillingService.name);

  constructor(
    private readonly repository: BillingRepositoryService,
    private readonly provider: BillingProviderPort,
    private readonly platformSettings: PlatformSettingsService,
  ) {}

  /**
   * Resolve the current billing config. Reads env on each call so an operator
   * flipping a flag takes effect without a restart (env-validation still ran
   * at boot). Exposed for the controller + tests.
   */
  getConfig(): BillingConfig {
    return resolveBillingConfig();
  }

  /**
   * Public catalog — active plans with effective pricing. No auth. Always
   * succeeds, even when no provider is configured (the catalog is
   * informational in that case).
   */
  async getCatalog(): Promise<BillingCatalogDto> {
    const config = this.getConfig();
    const plans = await this.repository.loadCatalog();
    return {
      plans,
      currency: 'USD',
      enforcementEnabled: config.enforcementEnabled,
      provider: config.provider,
    };
  }

  /**
   * Authenticated summary. When enforcement is off, returns
   * transition='full_access' with a null subscription — NO fake row. When
   * enforcement is on, returns the real subscription (or null) + transition.
   */
  async getSummary(userId: string): Promise<BillingSummaryDto> {
    const config = this.getConfig();
    const storedSubscription = await this.repository.findCurrentSubscription(userId);
    // Primary expiry is the scheduled writer; normalization is the fail-closed
    // read guard when that daily job is delayed or Redis is unavailable.
    const subscription = normalizeExpiredTrial(storedSubscription, new Date());
    const plan = subscription ? await this.repository.loadPlanWithPricing(subscription.planId) : null;
    const usagePeriods = subscription ? await this.repository.findOpenUsagePeriods(subscription.id) : [];

    const transition = deriveSummaryTransition(
      config.enforcementEnabled,
      subscription?.status ?? null,
    );

    return {
      subscription,
      plan,
      usagePeriods,
      enforcementEnabled: config.enforcementEnabled,
      provider: config.provider,
      transition,
    };
  }

  /**
   * Start the one-time cardless trial for a newly-created user. Idempotency is
   * enforced by billing_customers.trial_started_at inside a transaction, not by
   * this process, so concurrent registration retries can never extend it.
   */
  async startTrialForUser(userId: string, billingEmail: string | null): Promise<void> {
    const trialDays = await this.platformSettings.getNumber(PlatformSettingKey.BILLING_TRIAL_DAYS);
    const startedAt = new Date();
    const subscription = await this.repository.startTrialOnce(
      userId,
      billingEmail,
      startedAt,
      trialEndFrom(startedAt, trialDays),
    );
    if (subscription) {
      this.logger.log(`Started ${trialDays}-day trial for user ${userId}`);
    }
  }

  /**
   * Create a checkout session. Requires a configured provider (Paddle). The
   * caller must ensure the plan exists and has a provider_price_id for the
   * requested interval — the provider throws 'billing.errors.planNotMirrored'
   * otherwise.
   */
  async createCheckout(
    userId: string,
    customerEmail: string,
    planId: string,
    interval: BillingInterval,
  ): Promise<BillingCheckoutDto> {
    const config = this.getConfig();
    if (!isProviderConfigured(config)) {
      throw new Error('billing.errors.providerNotConfigured');
    }

    // Ensure a local customer row exists so webhook processing can link the
    // incoming subscription to this user. (Paddle sends customer_id in the
    // webhook; our repository.findCustomerByProviderId resolves it.)
    await this.repository.ensureLocalCustomer(userId, customerEmail);

    const plan = await this.repository.loadPlanWithPricing(planId);
    if (!plan) {
      throw new Error('billing.errors.planNotFound');
    }

    const effectivePrice = plan.prices[interval];
    if (!effectivePrice) {
      throw new Error('billing.errors.priceNotFound');
    }

    const req: CheckoutRequest = {
      userId,
      customerEmail,
      planId,
      providerProductId: plan.providerProductId,
      providerPriceId: effectivePrice.providerPriceId,
      interval,
    };
    return this.provider.createCheckout(req);
  }

  /**
   * Create a customer portal session. Requires a configured provider AND a
   * linked provider customer id (the user must have checked out at least
   * once).
   */
  async createPortal(userId: string): Promise<BillingPortalDto> {
    const config = this.getConfig();
    if (!isProviderConfigured(config)) {
      throw new Error('billing.errors.providerNotConfigured');
    }
    const customer = await this.repository.findCustomerByUserId(userId);
    if (!customer || !customer.providerCustomerId) {
      throw new Error('billing.errors.noCustomer');
    }
    return this.provider.createPortal(userId, customer.providerCustomerId);
  }
}
