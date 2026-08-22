// apps/api/src/modules/billing/billing.service.ts
//
// Orchestrator for catalog/summary/checkout/portal. Pure reads go through the
// repository; checkout/portal go through the provider abstraction. Provider
// config (Stripe keys) is resolved once per request via resolveBillingConfig()
// — those stay env-only per the platform-settings contract (provider
// credentials are never DB-overridable).
//
// `enforcementEnabled` is the one field of that config that IS a registered
// platform setting (PlatformSettingKey.BILLING_ENFORCEMENT_ENABLED) and MUST
// resolve DB override -> env -> default via PlatformSettingsService, not the
// raw env var — resolveBillingConfig() reads process.env directly and has no
// DB access, so it can never see an admin-panel toggle. Resolved separately
// here (resolveEnforcementEnabled()) rather than folded into getConfig(),
// which callers that only need the Stripe fields (webhook, checkout, portal)
// still call synchronously.
//
// Fail-safe contract: when Stripe is not configured (STRIPE_SECRET_KEY
// absent), the service still serves catalog + summary; checkout + portal throw
// 'billing.errors.providerNotConfigured' so the controller can map to 409.
// When enforcement is off (default), summary reports transition='full_access'
// with NO fake subscription — the absence of a row is the truthful state.

import { Injectable, Logger } from '@nestjs/common';
import {
  BillingInterval,
  BillingLimitKey,
  PlanChangeDirection,
  PlatformSettingKey,
  resolvePlanChangeDirection,
  type BillingDetailsDto,
  type BillingPlanChangePreviewDto,
  type BillingQuotaAddonDto,
  type BillingQuotaUsageDto,
  type BillingSubscriptionDto,
} from '@repo/shared';

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
import { isCardExpiringSoon } from './payment-method-helpers';
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
   * Resolve the current billing PROVIDER config (Stripe keys) from env.
   * Does NOT resolve enforcementEnabled correctly for display purposes — that
   * field is a DB-overridable platform setting; use resolveEnforcementEnabled()
   * instead wherever the effective value is shown to a user. Exposed for the
   * controller + tests, which only need the Stripe fields.
   */
  getConfig(): BillingConfig {
    return resolveBillingConfig();
  }

  /**
   * Resolved enforcementEnabled: DB override -> env var -> default, via
   * PlatformSettingsService (same registry entry the admin panel edits).
   */
  private async resolveEnforcementEnabled(): Promise<boolean> {
    return this.platformSettings.getBoolean(PlatformSettingKey.BILLING_ENFORCEMENT_ENABLED);
  }

  /**
   * Public catalog — active plans with effective pricing. No auth. Always
   * succeeds, even when no provider is configured (the catalog is
   * informational in that case).
   */
  async getCatalog(): Promise<BillingCatalogDto> {
    const config = this.getConfig();
    const [plans, enforcementEnabled] = await Promise.all([
      this.repository.loadCatalog(),
      this.resolveEnforcementEnabled(),
    ]);
    return {
      plans,
      currency: 'USD',
      enforcementEnabled,
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
    const [storedSubscription, enforcementEnabled] = await Promise.all([
      this.repository.findCurrentSubscription(userId),
      this.resolveEnforcementEnabled(),
    ]);
    // Primary expiry is the scheduled writer; normalization is the fail-closed
    // read guard when that daily job is delayed or Redis is unavailable.
    const subscription = normalizeExpiredTrial(storedSubscription, new Date());
    const plan = subscription ? await this.repository.loadPlanWithPricing(subscription.planId) : null;
    const usagePeriods = subscription ? await this.repository.findOpenUsagePeriods(subscription.id) : [];
    const quotas = await this.getQuotaUsage(userId, subscription);
    const quotaAddons = await this.resolveQuotaAddonOffer(quotas, enforcementEnabled);

    const transition = deriveSummaryTransition(enforcementEnabled, subscription?.status ?? null);

    return {
      subscription,
      plan,
      usagePeriods,
      quotas,
      quotaAddons,
      // True when the seller already has a Stripe subscription, i.e. picking a
      // plan must REPRICE it rather than open a checkout — the FE labels the
      // button accordingly instead of the two paths looking identical.
      hasProviderSubscription: Boolean(subscription?.providerSubscriptionId),
      enforcementEnabled,
      provider: config.provider,
      transition,
    };
  }

  /**
   * Top-up packs to offer, or nothing.
   *
   * Offered ONLY for a meter the seller has actually reached. A credit is
   * scoped to the current calendar month (migration 087), so showing packs to
   * somebody with allowance left would be selling them something they cannot
   * use — and the offer appearing is itself the clearest signal that they are
   * constrained.
   *
   * With enforcement off nothing is metered, so nothing is sold.
   */
  private async resolveQuotaAddonOffer(
    quotas: BillingQuotaUsageDto[],
    enforcementEnabled: boolean,
  ): Promise<BillingQuotaAddonDto[]> {
    if (!enforcementEnabled) {
      return [];
    }
    const exhausted = quotas.filter(
      (q) => q.limitValue !== null && q.limitValue > 0 && q.used >= q.limitValue,
    );
    if (exhausted.length === 0) {
      return [];
    }
    try {
      const packs = await Promise.all(
        exhausted.map((q) => this.repository.listQuotaAddons(q.limitKey)),
      );
      return packs.flat();
    } catch (err) {
      // An unavailable offer is a missed sale; a failed summary is a broken
      // billing page. Degrade.
      this.logger.warn(`Quota add-on offer failed: ${(err as Error).message}`);
      return [];
    }
  }



  /**
   * Live usage against each metered dimension.
   *
   * Deliberately NOT read from `billing_usage_periods.used_qty`: that column
   * exists but nothing has ever incremented it, so every consumer of it —
   * including the Action Center's quota warnings — reported zero usage for
   * every seller and could never fire. Each number here is derived from the
   * same source the gate refuses on, so the warning and the refusal cannot
   * disagree:
   *
   *   listings    — ACTIVE listing rows (a level; ending one frees a slot)
   *   AO          — this month's reservations
   *   conversions — this month's actually-performed conversions
   *
   * Fail-soft: a dimension that cannot be resolved is omitted rather than
   * reported as zero, because "0 of 100 used" is a claim, not an absence.
   */
  async getQuotaUsage(
    userId: string,
    subscription?: BillingSubscriptionDto | null,
  ): Promise<BillingQuotaUsageDto[]> {
    const sub =
      subscription === undefined
        ? await this.repository.findCurrentSubscription(userId)
        : subscription;
    if (!sub) {
      return [];
    }

    const dimensions: Array<{
      limitKey: BillingLimitKey;
      resolve: () => Promise<number>;
    }> = [
      {
        limitKey: BillingLimitKey.LISTINGS_PER_MONTH,
        resolve: async () => {
          const [active, inFlight] = await Promise.all([
            this.repository.countActiveListings(userId),
            this.repository.countReservedSlots(sub.id, BillingLimitKey.LISTINGS_PER_MONTH, null),
          ]);
          return active + inFlight;
        },
      },
      {
        limitKey: BillingLimitKey.AMAZON_ORDERS_PER_MONTH,
        resolve: async () => {
          const { limitValue: limit } = await this.repository.resolveEffectiveLimit(
            userId,
            sub.id,
            BillingLimitKey.AMAZON_ORDERS_PER_MONTH,
          );
          const periodId = await this.repository.ensureOpenUsagePeriod(
            sub.id,
            BillingLimitKey.AMAZON_ORDERS_PER_MONTH,
            limit ?? -1,
          );
          return this.repository.countReservedSlots(
            sub.id,
            BillingLimitKey.AMAZON_ORDERS_PER_MONTH,
            periodId,
          );
        },
      },
      {
        limitKey: BillingLimitKey.TRACKING_CONVERSIONS_PER_MONTH,
        resolve: () => this.repository.countMonthlyConversions(userId),
      },
    ];

    const results = await Promise.all(
      dimensions.map(async ({ limitKey, resolve }) => {
        try {
          const [used, effective] = await Promise.all([
            resolve(),
            this.repository.resolveEffectiveLimit(userId, sub.id, limitKey),
          ]);
          // The effective ceiling, not the plan's own number: a seller who just
          // topped up must not still be shown at 100%.
          return {
            limitKey,
            used,
            limitValue: effective.limitValue,
            creditValue: effective.creditValue,
          };
        } catch (err) {
          this.logger.warn(
            `Quota usage for ${limitKey} failed (user ${userId}): ${(err as Error).message}`,
          );
          return null;
        }
      }),
    );
    return results.filter((row): row is BillingQuotaUsageDto => row !== null);
  }

  /**
   * Switch an existing subscription to another plan.
   *
   * Exists because "choose a plan" means two different things depending on
   * where the seller is, and conflating them bills people twice: Stripe does
   * not refuse a second subscription for a customer who already has one. A
   * seller with a live Stripe subscription therefore never reaches checkout —
   * their choice repricies what they already have, with proration.
   *
   * A trial user has a subscription in OUR tables but none in Stripe, so they
   * correctly go through checkout: there is nothing to reprice.
   *
   * Which way the reprice goes ALSO decides how (and when) it is billed —
   * see {@link PlanChangeDirection}. An upgrade is charged now (Stripe bills
   * in advance, so it hands over the higher quota immediately); a downgrade
   * is scheduled for the end of the period the seller already paid for.
   */
  async changePlan(userId: string, planId: string, interval: BillingInterval): Promise<void> {
    if (!this.provider.isConfigured()) {
      throw new Error('billing.errors.providerNotConfigured');
    }
    const subscription = await this.repository.findCurrentSubscription(userId);
    if (!subscription?.providerSubscriptionId) {
      throw new Error('billing.errors.noSubscription');
    }
    const plan = await this.repository.loadPlanWithPricing(planId);
    if (!plan) {
      throw new Error('billing.errors.planNotFound');
    }
    const price = plan.prices[interval];
    if (!price) {
      throw new Error('billing.errors.priceNotFound');
    }
    if (!price.providerPriceId) {
      this.logger.error(`Plan ${planId} has no provider_price_id for ${interval}`);
      throw new Error('billing.errors.planNotMirrored');
    }

    // The seller's CURRENT plan, priced at the same interval as the target —
    // there is no interval switch on this endpoint (SubscribeDto carries one
    // fixed interval for both), so comparing at `interval` on both sides is
    // comparing like for like. A plan the seller is no longer subscribed to
    // (or a corrupted row) resolves to 0, which reads as "any real price is
    // an upgrade" — the safer default, since it charges now rather than
    // silently deferring.
    const currentPlan = subscription.planId
      ? await this.repository.loadPlanWithPricing(subscription.planId)
      : null;
    const direction = resolvePlanChangeDirection(
      currentPlan?.prices[interval]?.amountMicros ?? 0,
      price.amountMicros,
    );

    if (direction === PlanChangeDirection.DOWNGRADE) {
      // Takes effect at period end. No money moves now, and the local plan row
      // is deliberately NOT touched — the seller is still on the plan they
      // paid for until the schedule fires, and writing the new plan_id now
      // would enforce its lower quota and report it a month early.
      await this.provider.scheduleDowngrade({
        providerSubscriptionId: subscription.providerSubscriptionId,
        providerPriceId: price.providerPriceId,
        planId,
        direction,
      });
      this.logger.log(`User ${userId} scheduled a downgrade to ${plan.slug}`);
      return;
    }

    // Upgrading cancels any pending downgrade. A seller who changes their mind
    // upward must not have a stale schedule fire a month later and silently
    // undo the change they just paid for. Best-effort: a subscription with no
    // schedule is the normal case and `cancelScheduledChange` already treats
    // that as a no-op, so a failure here must not block an upgrade the seller
    // is waiting on.
    try {
      await this.provider.cancelScheduledChange(subscription.providerSubscriptionId);
    } catch (err) {
      this.logger.warn(
        `Could not release a pending schedule before upgrading ${userId}: ${(err as Error).message}`,
      );
    }

    await this.provider.changeSubscriptionPlan({
      providerSubscriptionId: subscription.providerSubscriptionId,
      providerPriceId: price.providerPriceId,
      planId,
      direction,
    });
    // Apply the change locally now that Stripe has accepted it, instead of
    // waiting for `customer.subscription.updated` to bring it back. That
    // webhook lands a second or two later, while the FE refetches its summary
    // as soon as this call resolves — so relying on the webhook alone showed
    // the seller their OLD plan and quotas immediately after a successful
    // upgrade. The webhook re-applies the same plan_id (we set it in the
    // subscription's metadata), so this is a head start, not a second source of
    // truth. Best-effort: a failure here is corrected by the webhook, and must
    // not turn a completed upgrade into an error the seller sees.
    //
    // UPGRADE ONLY: a scheduled downgrade must not write the new plan_id here
    // — it returned above, before this line, precisely so the seller stays on
    // record as their current (paid-for) plan until the schedule actually
    // fires.
    try {
      await this.repository.updateSubscriptionPlan(subscription.id, planId);
    } catch (err) {
      this.logger.warn(
        `Local plan write failed after Stripe accepted the change for user ${userId}; ` +
          `the webhook will reconcile it: ${(err as Error).message}`,
      );
    }
    this.logger.log(`User ${userId} switched to plan ${plan.slug}`);
  }

  /** Release a pending downgrade. The seller stays on their current plan. */
  async cancelScheduledChange(userId: string): Promise<void> {
    const subscription = await this.repository.findCurrentSubscription(userId);
    if (!subscription?.providerSubscriptionId) {
      throw new Error('billing.errors.noSubscription');
    }
    await this.provider.cancelScheduledChange(subscription.providerSubscriptionId);
    this.logger.log(`User ${userId} cancelled their scheduled plan change`);
  }

  /**
   * What will this plan change cost? Answered before anything is applied.
   *
   * A downgrade returns 0 due now: it takes effect at period end and moves no
   * money today. Returning the preview's proration figure there would tell the
   * seller they are about to be charged for a change that costs nothing now.
   */
  async previewPlanChange(
    userId: string,
    planId: string,
    interval: BillingInterval,
  ): Promise<BillingPlanChangePreviewDto> {
    const subscription = await this.repository.findCurrentSubscription(userId);
    if (!subscription?.providerSubscriptionId) {
      throw new Error('billing.errors.noSubscription');
    }
    const plan = await this.repository.loadPlanWithPricing(planId);
    const price = plan?.prices[interval];
    if (!plan || !price?.providerPriceId) {
      throw new Error('billing.errors.planNotMirrored');
    }
    // Same resolution as changePlan (current plan, priced at the SAME
    // interval as the target) — the preview must agree with what the change
    // actually does, or the seller is shown one number and charged another.
    const currentPlan = await this.repository.loadPlanWithPricing(subscription.planId);
    const direction = resolvePlanChangeDirection(
      currentPlan?.prices[interval]?.amountMicros ?? 0,
      price.amountMicros,
    );

    if (direction === PlanChangeDirection.DOWNGRADE) {
      return {
        direction,
        amountDueMicros: 0,
        currency: price.currency,
        effectiveAt: subscription.currentPeriodEnd,
        nextInvoiceAmountMicros: price.amountMicros,
        nextInvoiceAt: subscription.currentPeriodEnd,
      };
    }

    const preview = await this.provider.previewPlanChange(
      subscription.providerSubscriptionId,
      price.providerPriceId,
    );
    return {
      direction,
      amountDueMicros: preview.amountDueMicros,
      currency: preview.currency,
      effectiveAt: new Date().toISOString(),
      nextInvoiceAmountMicros: price.amountMicros,
      nextInvoiceAt: subscription.currentPeriodEnd,
    };
  }

  /**
   * Open a one-time checkout for a quota top-up.
   *
   * Refuses an inactive pack and one that has not been mirrored to Stripe yet,
   * for the same reason `createCheckout` refuses an unmirrored plan: sending a
   * seller to Stripe with a price id that does not exist is an operator
   * mistake, and it should surface here rather than as a broken Stripe page.
   */
  async createAddonCheckout(
    userId: string,
    email: string,
    addonSlug: string,
  ): Promise<BillingCheckoutDto> {
    if (!this.provider.isConfigured()) {
      throw new Error('billing.errors.providerNotConfigured');
    }
    const addon = await this.repository.findQuotaAddonBySlug(addonSlug);
    if (!addon) {
      throw new Error('billing.errors.addonNotFound');
    }
    if (!addon.isPurchasable) {
      this.logger.error(
        `Top-up ${addonSlug} has no provider_price_id — run stripe:sync-catalog`,
      );
      throw new Error('billing.errors.planNotMirrored');
    }
    const priceId = await this.repository.resolveAddonProviderPriceId(addon.id);
    const customer = await this.repository.findCustomerByUserId(userId);
    return this.provider.createAddonCheckout({
      userId,
      email,
      addonSlug: addon.slug,
      providerPriceId: priceId ?? '',
      providerCustomerId: customer?.providerCustomerId ?? null,
    });
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
   * Gate on connecting an eBay store: one free trial per store, ever.
   *
   * Called from the eBay OAuth callback BEFORE the account row is written.
   * Throws 'billing.errors.ebayTrialAlreadyUsed' when the store has already had
   * a free trial under some other account and the connecting user has not paid
   * for anything.
   *
   * Why the store and not the email: every data screen sits behind
   * EbayAccountGuard, so a trial without a connected store is worthless. The
   * scarce resource being farmed is therefore the eBay store, and
   * `ebay_accounts`' UNIQUE (seller_id, marketplace_id) already stops two live
   * accounts holding one store. The hole this closes is the sequential one —
   * delete the account (ON DELETE CASCADE drops the ebay_accounts row) and
   * reconnect the same store under a fresh registration for another trial.
   * `ebay_trial_ledger` is deliberately not FK'd to that row so it survives.
   *
   * A paying customer is never blocked: the rule refuses a second free ride,
   * not a returning customer.
   */
  async assertEbayStoreMayConnect(userId: string, sellerId: string, marketplaceId: string): Promise<void> {
    const claimed = await this.repository.claimEbayTrial(sellerId, marketplaceId, userId);
    if (claimed) {
      return; // first time this store is seen — its trial is now spent
    }
    if (await this.repository.hasPaidSubscription(userId)) {
      return;
    }
    this.logger.warn(
      `Refusing eBay connect for user ${userId}: store ${sellerId}/${marketplaceId} has already used its free trial`,
    );
    throw new Error('billing.errors.ebayTrialAlreadyUsed');
  }

  /**
   * Create a checkout session. Requires Stripe to be configured. The caller
   * must ensure the plan exists and has a provider_price_id for the requested
   * interval — the provider throws 'billing.errors.planNotMirrored' otherwise.
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

    // Resolve the Stripe customer id under a per-user advisory lock, and
    // RE-READ the local row INSIDE the lock (a lock that does not recheck
    // after acquiring is not a lock). Two concurrent checkouts for a
    // brand-new user (no linked customer yet) must not each mint a SEPARATE
    // Stripe customer: billing_customers.user_id is UNIQUE, so whichever
    // provider.ensureCustomer call links second would silently overwrite the
    // first's link, orphaning the first (now-unreferenced) Stripe customer —
    // and any subscription created under it — from all local tracking. That
    // is the same class of bug this task exists to prevent, one step
    // earlier: the duplicate-subscription check below is only trustworthy if
    // the customer id it asks Stripe about is the one true id for this user.
    const providerCustomerId = await this.repository.withUserBillingLock(userId, async () => {
      const customer = await this.repository.ensureLocalCustomer(userId, customerEmail);
      if (customer.providerCustomerId) {
        return customer.providerCustomerId;
      }
      // No linked Stripe customer yet — create it now, still holding the
      // lock, so a second request blocked on this same lock re-reads the id
      // THIS request just linked (via the branch above) instead of racing to
      // mint its own.
      return this.provider.ensureCustomer(userId, customerEmail);
    });

    // Ask Stripe itself, not our tables. This is the layer that cannot be
    // fooled by our own state being stale — and stale state is exactly what
    // produced three live subscriptions for one seller on 2026-08-22. Runs
    // AFTER the lock above is released: it is a pure read, so nothing here
    // corrupts data if two requests run it concurrently — unlike the customer
    // resolution above, holding a DB connection across this second Stripe
    // call on EVERY checkout attempt (rather than only the rare first-ever
    // one that creates a customer) would cost more than it protects.
    const alreadySubscribed = await this.provider.hasActiveProviderSubscription(providerCustomerId);
    if (alreadySubscribed) {
      throw new Error('billing.errors.alreadySubscribed');
    }

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

  /**
   * Live billing detail for the billing page only.
   *
   * Fails soft to an all-null shape: a Stripe hiccup must leave the plan card
   * and the quota rings on screen, not blank the page a suspended seller was
   * just redirected to.
   */
  async getDetails(userId: string): Promise<BillingDetailsDto> {
    const empty: BillingDetailsDto = {
      paymentMethod: null,
      nextChargeAmountMicros: null,
      nextChargeCurrency: null,
      nextChargeAt: null,
      scheduledChange: null,
    };
    const customer = await this.repository.findCustomerByUserId(userId);
    if (!customer?.providerCustomerId || !this.provider.isConfigured()) {
      return empty;
    }
    try {
      const raw = await this.provider.getBillingDetails(customer.providerCustomerId);
      const scheduledPlan = raw.scheduledPriceId
        ? await this.repository.findPlanByProviderPriceId(raw.scheduledPriceId)
        : null;
      return {
        paymentMethod: raw.paymentMethod
          ? {
              ...raw.paymentMethod,
              expiringSoon: isCardExpiringSoon(
                raw.paymentMethod.expMonth,
                raw.paymentMethod.expYear,
                new Date(),
              ),
            }
          : null,
        nextChargeAmountMicros: raw.nextChargeAmountMicros,
        nextChargeCurrency: raw.nextChargeCurrency,
        nextChargeAt: raw.nextChargeAt,
        scheduledChange:
          scheduledPlan && raw.scheduledAt
            ? { planSlug: scheduledPlan.slug, effectiveAt: raw.scheduledAt }
            : null,
      };
    } catch (err) {
      this.logger.warn(`Billing details unavailable for ${userId}: ${(err as Error).message}`);
      return empty;
    }
  }
}
