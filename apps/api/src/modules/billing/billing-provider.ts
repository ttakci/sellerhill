// apps/api/src/modules/billing/billing-provider.ts
//
// The billing provider: Stripe. Checkout and the customer portal are both
// Stripe-hosted — we hand the browser a URL and Stripe owns the payment form,
// card data, SCA/3DS, and PCI scope. Nothing payment-sensitive runs here.
//
// There is exactly ONE implementation. Stripe's test mode covers local dev and
// the test environment, so there is no stand-in "local provider" to fall back
// to; when STRIPE_SECRET_KEY is absent every call throws
// 'billing.errors.providerNotConfigured' and the controller maps it to 409
// (catalog + summary keep working — they are informational). A Paddle
// implementation lived here until 2026-08-16; it was removed rather than left
// as unreachable dead code, and is recoverable from git.

import { Injectable, Logger } from '@nestjs/common';
import { BillingInterval, PlanChangeDirection, type BillingInvoiceDto } from '@repo/shared';
import type { PoolClient } from 'pg';
import Stripe from 'stripe';

import type { BillingConfig, SupportedStripeLocale } from './billing-helpers';
import type { BillingRepositoryService } from './billing-repository.service';
import { BillingProvider, type BillingCheckoutDto, type BillingPortalDto } from './billing.types';
import { ScheduleSource } from './price-migration';
import {
  syncStripeCatalog,
  type CatalogQuery,
  type CatalogSyncResult,
} from './stripe-catalog-sync';
import { mapStripeInvoice, type StripeInvoiceLike } from './stripe-invoice-mapper';

/**
 * The Stripe API version every call in this file is made against.
 *
 * Pinned deliberately: leaving it unset makes the effective version whatever
 * the installed `stripe` package defaults to, so a routine dependency bump can
 * reshape the payloads this module parses. That is not hypothetical here —
 * `current_period_start`/`current_period_end` moved from the Subscription to
 * the SubscriptionItem in `2025-03-31.basil`, and every webhook silently
 * synthesised a 30-day quota window until it was found.
 *
 * This value is the version the SDK was already using, so pinning it changed
 * nothing at the time it was introduced. Raising it is a deliberate migration:
 * read Stripe's upgrade notes, then re-verify the subscription payload fields
 * `extractStripeSubscriptionFields` reads.
 */
export const STRIPE_API_VERSION = '2026-07-29.dahlia' satisfies Stripe.LatestApiVersion;

/**
 * Idempotency key for a write whose accidental repetition costs real money.
 *
 * Bucketed by the hour rather than made unique per request: the duplicate this
 * guards against is a seller double-submitting (two separate HTTP requests, so
 * no shared request id exists), and Stripe replays the first result for a
 * repeated key instead of performing the write twice. An hour is short enough
 * that a deliberate repeat later in the day still goes through, and Stripe
 * expires keys after 24h regardless.
 *
 * Deliberately NOT used for top-up purchases: buying two conversion packs in
 * one hour is a legitimate thing to do, and collapsing them would take the
 * money for one and deliver nothing. Those rely on the SDK's own retry keys.
 */
function hourlyIdempotencyKey(scope: string, ...parts: string[]): string {
  const hourBucket = new Date().toISOString().slice(0, 13);
  return [scope, ...parts, hourBucket].join(':');
}

/**
 * Stripe error codes meaning "the card needs the buyer present to authenticate"
 * (3-D Secure). Common on European and Turkish cards for an off-session charge.
 *
 * It matters because `payment_behavior: 'error_if_incomplete'` turns it into a
 * failed update: the seller stays on their old plan, which is correct, but
 * "plan change failed" tells them nothing they can act on. Reported separately
 * so the message can say what actually happened and where to fix it.
 */
const STRIPE_AUTHENTICATION_REQUIRED_CODES = new Set([
  'subscription_payment_intent_requires_action',
  'invoice_payment_intent_requires_action',
  'payment_intent_authentication_failure',
  'authentication_required',
]);

function isAuthenticationRequiredError(error: unknown): boolean {
  const code = (error as { code?: unknown } | null)?.code;
  const declineCode = (error as { decline_code?: unknown } | null)?.decline_code;
  return (
    (typeof code === 'string' && STRIPE_AUTHENTICATION_REQUIRED_CODES.has(code)) ||
    (typeof declineCode === 'string' && STRIPE_AUTHENTICATION_REQUIRED_CODES.has(declineCode))
  );
}

/**
 * Provider-facing checkout request. The controller builds this from the
 * authenticated user + SubscribeDto; the provider turns it into a Stripe
 * Checkout Session.
 */
export interface CheckoutRequest {
  userId: string;
  /** The user's email, used when creating the Stripe customer. */
  customerEmail: string;
  planId: string;
  /** The Stripe-side product id (billing_plans.provider_product_id). */
  providerProductId: string | null;
  /** The Stripe-side price id for the chosen interval
   *  (billing_plan_prices.provider_price_id). */
  providerPriceId: string | null;
  interval: BillingInterval;
  /** The seller's in-app language (resolveStripeLocale) — Checkout renders in
   *  this language rather than guessing from the browser/OS. */
  locale: SupportedStripeLocale;
}

/**
 * The billing provider abstraction. Kept as an interface (rather than folding
 * StripeBillingProvider straight into BillingService) so the service stays
 * testable without a Stripe client and the HTTP boundary is one file.
 */
export interface BillingProviderPort {
  readonly key: BillingProvider;
  /** True when STRIPE_SECRET_KEY is present and checkout/portal can run. */
  isConfigured(): boolean;
  /** Create a checkout session. Throws when not configured. */
  createCheckout(req: CheckoutRequest): Promise<BillingCheckoutDto>;
  /**
   * Does this customer already have a subscription Stripe considers live?
   *
   * Asked BEFORE opening a checkout, and deliberately asked of Stripe rather
   * than of our own tables: our tables being wrong is precisely how one
   * customer ended up with three concurrent subscriptions on 2026-08-22.
   */
  hasActiveProviderSubscription(providerCustomerId: string): Promise<boolean>;
  /**
   * Resolve (creating if necessary) this user's provider customer id, and
   * persist the link. `createCheckout`/`createAddonCheckout` each call this
   * for their own request; `BillingService.createCheckout` ALSO calls it
   * directly, up front, under its own per-user advisory lock
   * (`BillingRepositoryService.withUserBillingLock`) — closing the race where
   * two concurrent first-time checkouts each see no linked customer and each
   * mint a SEPARATE Stripe customer for the same user. By the time
   * `createCheckout` below reaches its own call, the customer is already
   * resolved and linked, so that call is a fast, no-Stripe-call re-read.
   *
   * `client` is the connection `withUserBillingLock` is already holding for
   * the advisory lock — pass it through so the DB reads/writes this method
   * does (`findCustomerByUserId`, `linkProviderCustomer`) reuse that
   * connection instead of checking out a second one from the pool for the
   * duration of the lock. Omit it for a call made outside a lock (there is
   * none today, but the DB layer must not assume one).
   */
  ensureCustomer(userId: string, customerEmail: string, client?: PoolClient): Promise<string>;
  /** Create a customer portal session. Throws when not configured or when the
   *  user has no Stripe customer id. */
  createPortal(
    userId: string,
    providerCustomerId: string | null,
    locale: SupportedStripeLocale,
  ): Promise<BillingPortalDto>;
  /**
   * Create a ONE-TIME checkout session for a quota top-up (`mode: 'payment'`).
   * Separate from `createCheckout` rather than a flag on it: the two produce
   * different Stripe objects and are reported by different webhook events, and
   * a boolean would hide that behind one name.
   */
  createAddonCheckout(req: AddonCheckoutRequest): Promise<BillingCheckoutDto>;
  /**
   * Move an EXISTING subscription onto a different price, with proration.
   *
   * Separate from `createCheckout` because Stripe will happily create a second
   * subscription for a customer who already has one — it does not treat that
   * as a mistake — and the customer would then be charged for both. Checkout
   * subscribes; this changes what an existing subscription bills for.
   *
   * UPGRADE path only. Stripe bills in advance, so an upgrade hands over the
   * higher quota immediately — this charges the prorated difference NOW and
   * throws if the charge cannot be completed, rather than billing it up to 30
   * days later. Downgrades never call this; see {@link scheduleDowngrade}.
   */
  changeSubscriptionPlan(req: ChangePlanRequest): Promise<void>;
  /**
   * DOWNGRADE path: move the subscription to a cheaper price at the END of the
   * current paid period, via a Stripe Subscription Schedule, instead of
   * applying it now. The seller already paid for this period, so nothing is
   * refunded and nothing changes until the period runs out.
   */
  /**
   * Re-read one subscription straight from Stripe, as the raw object, for the
   * reconcile paths (periodic job + operator CLI) to feed through
   * `extractStripeSubscriptionFields`. Returns null when Stripe has no such
   * subscription; THROWS on any other failure, so a transport problem is never
   * mistaken for "this subscription is gone".
   */
  fetchSubscription(providerSubscriptionId: string): Promise<unknown>;
  /**
   * The subscription a completed Checkout Session produced, with the two ids
   * needed to prove the session belongs to the caller. Used on the checkout
   * return page so a first subscription is recorded without waiting for (or
   * depending on) the webhook. Null when the session has no subscription yet.
   */
  retrieveCheckoutSubscription(sessionId: string): Promise<{
    customerId: string | null;
    clientReferenceId: string | null;
    subscription: unknown;
  } | null>;
  /** Every subscription Stripe holds for a customer, newest first, raw. */
  listCustomerSubscriptions(providerCustomerId: string): Promise<unknown[]>;
  scheduleDowngrade(req: ChangePlanRequest): Promise<void>;
  /** Read one subscription for the automatic price migration. Throws on failure. */
  inspectForPriceMigration(providerSubscriptionId: string): Promise<PriceMigrationInspection>;
  /** Mirror the local catalog into Stripe and verify it — see stripe-catalog-sync.ts. */
  syncCatalog(query: CatalogQuery): Promise<CatalogSyncResult>;
  /**
   * Release a pending downgrade schedule — e.g. because the seller upgraded
   * before it took effect — leaving the subscription exactly as it currently
   * is. A no-op when nothing is scheduled, so callers can call it
   * unconditionally before every upgrade.
   */
  cancelScheduledChange(providerSubscriptionId: string): Promise<void>;
  /**
   * What would `changeSubscriptionPlan` actually charge, without applying it.
   *
   * Uses the same `always_invoice` proration Stripe would use for a real
   * upgrade, via `invoices.createPreview` — so the figure includes tax and
   * discounts exactly as Stripe would bill them, not an estimate computed
   * here. UPGRADE path only; the service never calls this for a downgrade
   * (which bills nothing today — see {@link PlanChangeDirection}).
   */
  previewPlanChange(
    providerSubscriptionId: string,
    providerPriceId: string,
  ): Promise<{ amountDueMicros: number; currency: string }>;
  /**
   * Live billing detail for the /billing/details endpoint: the DEFAULT
   * payment method, the next invoice's amount/currency/date, any pending
   * downgrade schedule, and whether the subscription is set to cancel at
   * period end (the Billing Portal's own cancel action, which writes nothing
   * to our tables). All Stripe-side — nothing here is stored locally.
   */
  getBillingDetails(providerCustomerId: string): Promise<ProviderBillingDetails>;
  /**
   * Paginated invoice history for the billing page. Read live from Stripe —
   * nothing is mirrored locally, so this always reflects Stripe's own record.
   */
  listInvoices(
    providerCustomerId: string,
    limit: number,
    startingAfter?: string,
  ): Promise<{ items: BillingInvoiceDto[]; hasMore: boolean; nextCursor: string | null }>;
}

/** Raw Stripe-shaped result of {@link BillingProviderPort.getBillingDetails}.
 *  `BillingService.getDetails` resolves `scheduledPriceId` to a local plan
 *  slug and computes `expiringSoon` before handing the FE its DTO. */
export interface ProviderBillingDetails {
  paymentMethod: { brand: string; last4: string; expMonth: number; expYear: number } | null;
  nextChargeAmountMicros: number | null;
  nextChargeCurrency: string | null;
  nextChargeAt: string | null;
  scheduledPriceId: string | null;
  scheduledAt: string | null;
  /**
   * True when the Stripe Billing Portal's default "cancel" action has been
   * used on this subscription (`cancel_at_period_end`). Read live from
   * Stripe, same as everything else here — cancelling from the Portal writes
   * nothing to our tables, so without this field a cancelled-but-not-yet-
   * expired subscription looked identical to a normal renewing one: badged
   * active, with a next-charge amount for a charge that will never happen.
   */
  cancelAtPeriodEnd: boolean;
  /** When `cancelAtPeriodEnd` is true, the date access ends (Stripe's
   *  `cancel_at`, normally equal to the current period end). Null otherwise. */
  cancelAt: string | null;
}

/** Everything a plan change needs, upgrade or downgrade. */
export interface ChangePlanRequest {
  providerSubscriptionId: string;
  providerPriceId: string;
  /** Our plan id, written to the subscription's (or, for a downgrade, the new
   *  schedule phase's) metadata so the resulting `customer.subscription.updated`
   *  webhook resolves to the right local plan. */
  planId: string;
  /** Which way this change goes — see {@link PlanChangeDirection}. Carried on
   *  the request so the provider's own logs/metadata can record it; the
   *  service has already used it to pick which provider method to call. */
  direction: PlanChangeDirection;
  /**
   * Who is scheduling this change, written to the Stripe schedule's metadata.
   * The automatic price migration must be able to tell ITS schedule apart from
   * a downgrade the seller chose: it may replace its own, never theirs, and the
   * billing page must not offer the seller a "cancel" button for a price
   * change. Defaults to a seller plan change.
   */
  scheduleSource?: ScheduleSource;
}


/** What the price-migration job needs to know about one live subscription. */
export interface PriceMigrationInspection {
  status: string;
  /** The Stripe Price the subscription is billed at today. */
  priceId: string | null;
  unitAmount: number | null;
  currency: string | null;
  cancelAtPeriodEnd: boolean;
  /** When the current period ends — i.e. when a scheduled price takes effect. */
  currentPeriodEnd: Date | null;
  /**
   * A change that is still to come: a schedule phase starting in the future.
   * Null when there is none. A schedule whose last phase has already begun is
   * NOT pending — Stripe leaves such schedules attached for ever, so treating
   * "has a schedule" as "has a pending change" would skip every seller who has
   * ever downgraded.
   */
  pendingChange: { source: string | null; priceId: string | null } | null;
}

/** Everything a one-time top-up checkout needs. */
export interface AddonCheckoutRequest {
  userId: string;
  email: string;
  /** Stable pack key, echoed into session metadata so the webhook can resolve it. */
  addonSlug: string;
  providerPriceId: string;
  providerCustomerId: string | null;
  /** See `CheckoutRequest.locale`. */
  locale: SupportedStripeLocale;
}

/**
 * Generate an 8-random-letter suffix for Checkout Session `integration_identifier`
 * tags (Dashboard flow tracking/comparison), per Stripe's own recommendation.
 * Not security-sensitive — Math.random is fine for a display label.
 */
function randomLetterSuffix(length = 8): string {
  const alphabet = 'abcdefghijklmnopqrstuvwxyz';
  let out = '';
  for (let i = 0; i < length; i++) {
    out += alphabet[Math.floor(Math.random() * alphabet.length)];
  }
  return out;
}

/** Returned for a deleted Stripe customer — every field genuinely unknown. */
const EMPTY_PROVIDER_BILLING_DETAILS: ProviderBillingDetails = {
  paymentMethod: null,
  nextChargeAmountMicros: null,
  nextChargeCurrency: null,
  nextChargeAt: null,
  scheduledPriceId: null,
  scheduledAt: null,
  cancelAtPeriodEnd: false,
  cancelAt: null,
};

/**
 * Stripe Billing provider. Creates Stripe Checkout Sessions (mode:
 * subscription) and Billing Portal sessions via the official SDK.
 *
 * The flow is redirect-based: the FE POSTs /billing/checkout, we create a
 * session and return its hosted URL, the FE redirects. After payment Stripe
 * sends `customer.subscription.*` webhooks to POST /billing/webhooks/stripe,
 * which stripe-event-applier.ts applies to billing_subscriptions.
 */
@Injectable()
export class StripeBillingProvider implements BillingProviderPort {
  readonly key = BillingProvider.STRIPE;
  private readonly logger = new Logger(StripeBillingProvider.name);
  private client: Stripe | null = null;

  constructor(
    private readonly config: BillingConfig,
    private readonly repository: BillingRepositoryService,
  ) {}

  isConfigured(): boolean {
    return Boolean(this.config.stripeSecretKey);
  }

  /**
   * Lazily build the Stripe client. Construction is deferred because
   * `new Stripe('')` throws — an unconfigured deployment must still boot and
   * serve catalog/summary, and only fail on the calls that actually need
   * Stripe. Always a client instance; never the deprecated global-key pattern.
   */
  private getClient(): Stripe {
    if (!this.config.stripeSecretKey) {
      throw new Error('billing.errors.providerNotConfigured');
    }
    // The API version is PINNED, not left to the SDK's default. Without this,
    // the effective API version moves whenever the `stripe` package is
    // upgraded — and that has already cost this codebase a real defect once:
    // `current_period_start`/`current_period_end` moved from the Subscription
    // to the SubscriptionItem in 2025-03-31.basil, so every webhook silently
    // fell through to a synthesised 30-day quota window (see the comment in
    // stripe-event-applier.ts). A dependency bump must never be able to
    // reshape a payload this module reads.
    this.client ??= new Stripe(this.config.stripeSecretKey, {
      apiVersion: STRIPE_API_VERSION,
      // Retry a request Stripe never answered (connection reset, timeout,
      // 500). The SDK replays it under the SAME idempotency key it generated
      // for the first attempt, so a retry can never create a second
      // subscription or charge — which is exactly why the retry belongs here
      // rather than in a caller's try/catch.
      maxNetworkRetries: 2,
    });
    return this.client;
  }

  async createCheckout(req: CheckoutRequest): Promise<BillingCheckoutDto> {
    const stripe = this.getClient();
    if (!req.providerPriceId) {
      // The plan has not been mirrored to Stripe yet (no provider_price_id on
      // the effective price row) — see stripe-sync-catalog.ts. Operator task,
      // not a user error.
      this.logger.error(
        `Checkout failed: plan ${req.planId} has no provider_price_id for interval ${req.interval}`,
      );
      throw new Error('billing.errors.planNotMirrored');
    }

    // Resolve (or create) the Stripe customer BEFORE opening checkout, and
    // persist the link immediately. This is load-bearing, not an optimisation:
    // webhook delivery order is not guaranteed, so if the link were only
    // written when `checkout.session.completed` arrived, a
    // `customer.subscription.created` that landed first would find no local
    // customer and be dropped — the user would have paid and received no
    // subscription row until some later, unrelated event fired. Linking here
    // means the link always exists before any webhook can reference it.
    const customerId = await this.ensureCustomer(req.userId, req.customerEmail);

    let session: Stripe.Checkout.Session;
    try {
      session = await stripe.checkout.sessions.create(
        {
        mode: 'subscription',
        customer: customerId,
        client_reference_id: req.userId,
        // Do NOT set payment_method_types — omitting it lets Stripe show the
        // payment methods enabled in the Dashboard, per account and per buyer.
        line_items: [{ price: req.providerPriceId, quantity: 1 }],
        // Copied onto the Subscription object Stripe creates, which is how the
        // webhook resolves which local plan the subscription belongs to.
        subscription_data: { metadata: { plan_id: req.planId } },
        automatic_tax: { enabled: true },
        // Required BECAUSE the customer is created up-front (see above): a
        // Stripe Customer with no address makes `automatic_tax` reject the
        // session outright rather than degrade, so Checkout has to be told to
        // write the address it collects back onto the Customer. Without this
        // every checkout fails with "Automatic tax calculation in Checkout
        // requires a valid address on the Customer". `name: 'auto'` keeps the
        // Customer record and the invoice in step for the same reason.
        customer_update: { address: 'auto', name: 'auto' },
        billing_address_collection: 'required',
        // Sellers are businesses, so let them enter a VAT/tax ID. In the EU
        // this is what triggers reverse charge — without the field a
        // VAT-registered buyer is charged tax they should not pay.
        tax_id_collection: { enabled: true },
        // Checkout renders its own "Add promotion code" field. Coupons live in
        // the Stripe Dashboard — no local coupon model, no admin surface.
        allow_promotion_codes: true,
        metadata: { plan_id: req.planId, user_id: req.userId },
        locale: req.locale,
        success_url: `${this.config.frontendUrl}/billing?checkout=success&session_id={CHECKOUT_SESSION_ID}`,
        cancel_url: `${this.config.frontendUrl}/billing?checkout=cancelled`,
        integration_identifier: `sellerhill_checkout_${randomLetterSuffix()}`,
        },
        {
          // A double-submitted subscribe must not open two checkout sessions:
          // each one can be completed, and Stripe does not refuse a second
          // subscription for a customer who already has one.
          idempotencyKey: hourlyIdempotencyKey('checkout', req.userId, req.providerPriceId),
        },
      );
    } catch (error) {
      this.logger.error(`Stripe checkout failed: ${describeError(error)}`);
      throw new Error('billing.errors.checkoutFailed');
    }

    if (!session.url) {
      this.logger.error(`Stripe checkout returned no URL (session=${session.id})`);
      throw new Error('billing.errors.checkoutFailed');
    }

    return {
      provider: BillingProvider.STRIPE,
      checkoutUrl: session.url,
      providerSessionId: session.id,
      planId: req.planId,
      interval: req.interval,
    };
  }

  /** Statuses that mean "this customer is already subscribed". `incomplete`
   *  and `incomplete_expired` are excluded: those never became a subscription
   *  the customer is being billed for, and blocking on them would trap a
   *  seller whose first card attempt failed. `paused` IS included: this
   *  codebase's own stripe-event-applier.ts (mapStatus) already documents it
   *  as a real Stripe status (a trial that ended with no payment method) —
   *  the subscription is still a live Stripe object tied to the customer and
   *  can resume billing later, so treating it as "no subscription" would
   *  reopen exactly the hole this guard exists to close. */
  private static readonly LIVE_SUBSCRIPTION_STATUSES = new Set([
    'active',
    'trialing',
    'past_due',
    'unpaid',
    'paused',
  ]);

  async hasActiveProviderSubscription(providerCustomerId: string): Promise<boolean> {
    const stripe = this.getClient();
    try {
      const list = await stripe.subscriptions.list({
        customer: providerCustomerId,
        status: 'all',
        limit: 100,
      });
      return list.data.some((sub) =>
        StripeBillingProvider.LIVE_SUBSCRIPTION_STATUSES.has(sub.status),
      );
    } catch (error) {
      // Fail CLOSED. An unreadable answer here must not be read as "no
      // subscription" — that is the branch that double-bills. Refusing the
      // checkout is recoverable; a duplicate subscription is a refund.
      this.logger.error(`Stripe subscription lookup failed: ${describeError(error)}`);
      throw new Error('billing.errors.checkoutFailed');
    }
  }

  /**
   * One-time checkout for a quota top-up (`mode: 'payment'`, not
   * `'subscription'`).
   *
   * The metadata is load-bearing, not decoration. A one-time purchase creates
   * no Subscription object, so `checkout.session.completed` is the ONLY event
   * that will ever mention it — and that event carries whatever we put here and
   * nothing else. Without `user_id` and `addon_slug` on the session there is no
   * way to know afterwards who bought what, and the money would be taken with
   * nothing granted.
   */
  async createAddonCheckout(req: AddonCheckoutRequest): Promise<BillingCheckoutDto> {
    const stripe = this.getClient();
    const customerId = req.providerCustomerId ?? (await this.ensureCustomer(req.userId, req.email));

    let session: Stripe.Checkout.Session;
    try {
      session = await stripe.checkout.sessions.create({
        mode: 'payment',
        customer: customerId,
        client_reference_id: req.userId,
        line_items: [{ price: req.providerPriceId, quantity: 1 }],
        automatic_tax: { enabled: true },
        // Same reason as the subscription checkout: the customer is created
        // up-front and has no address, so automatic_tax rejects the session
        // outright unless Checkout is allowed to write back what it collects.
        customer_update: { address: 'auto', name: 'auto' },
        billing_address_collection: 'required',
        tax_id_collection: { enabled: true },
        // `mode: 'payment'` creates NO invoice by default, so without this a
        // top-up purchase would be missing from the invoice history — and
        // "what did I pay for" has to mean everything or it means nothing.
        // Deliberately no allow_promotion_codes here (unlike the subscription
        // checkout above): a discount on a consumable already priced against a
        // hard ~$0.10/conversion supplier cost erodes a thin margin with no
        // acquisition benefit.
        invoice_creation: { enabled: true },
        metadata: { addon_slug: req.addonSlug, user_id: req.userId },
        locale: req.locale,
        success_url: `${this.config.frontendUrl}/billing?topup=success`,
        cancel_url: `${this.config.frontendUrl}/billing?topup=cancelled`,
        integration_identifier: `sellerhill_topup_${randomLetterSuffix()}`,
      });
    } catch (error) {
      this.logger.error(`Stripe top-up checkout failed: ${describeError(error)}`);
      throw new Error('billing.errors.checkoutFailed');
    }

    if (!session.url) {
      this.logger.error(`Stripe top-up checkout returned no URL (session=${session.id})`);
      throw new Error('billing.errors.checkoutFailed');
    }

    return {
      provider: BillingProvider.STRIPE,
      checkoutUrl: session.url,
      providerSessionId: session.id,
      planId: req.addonSlug,
      interval: BillingInterval.MONTHLY,
    };
  }

  async changeSubscriptionPlan(req: ChangePlanRequest): Promise<void> {
    const stripe = this.getClient();
    try {
      const current = await stripe.subscriptions.retrieve(req.providerSubscriptionId);
      const itemId = current.items.data[0]?.id;
      if (!itemId) {
        // A subscription with no line item cannot be repriced. Refusing beats
        // guessing, because the alternative guess is "add an item", which
        // charges for both.
        throw new Error('billing.errors.planChangeFailed');
      }
      await stripe.subscriptions.update(
        req.providerSubscriptionId,
        {
          items: [{ id: itemId, price: req.providerPriceId }],
        // Stripe bills in ADVANCE, and an upgrade hands over the higher quota
        // the moment it applies. `always_invoice` charges the prorated
        // difference NOW rather than up to 30 days later, and
        // `error_if_incomplete` makes the whole update fail if that charge
        // cannot be completed — so a declined card leaves the seller on the
        // plan they were already paying for instead of on one they have not
        // paid for.
          proration_behavior: 'always_invoice',
          payment_behavior: 'error_if_incomplete',
          // The webhook applier reads the local plan from here, so it has to move
          // with the price. Leaving stale metadata would have the subscription
          // report the OLD plan back to us on its next update.
          metadata: { plan_id: req.planId },
        },
        {
          idempotencyKey: hourlyIdempotencyKey(
            'plan-change',
            req.providerSubscriptionId,
            req.providerPriceId,
          ),
        },
      );
    } catch (error) {
      this.logger.error(`Stripe plan change failed: ${describeError(error)}`);
      if (isAuthenticationRequiredError(error)) {
        // The plan did NOT change (error_if_incomplete rolled it back), so the
        // seller is still on what they were paying for. They need a card that
        // can be charged off-session, which is a portal action, not a retry.
        throw new Error('billing.errors.paymentRequiresAction');
      }
      throw new Error('billing.errors.planChangeFailed');
    }
  }

  /**
   * Move a subscription to a cheaper price at the END of the paid period.
   *
   * The seller has already paid for this period, so they keep the plan they
   * paid for until it runs out. Applying it now would also strand a seller
   * with 24,000 active listings under a 200-listing ceiling, and would need a
   * credit balance we deliberately do not have.
   */
  async fetchSubscription(providerSubscriptionId: string): Promise<unknown> {
    const stripe = this.getClient();
    try {
      return await stripe.subscriptions.retrieve(providerSubscriptionId);
    } catch (error) {
      const code = (error as { code?: unknown } | null)?.code;
      if (code === 'resource_missing') {
        // Deleted in Stripe. A real answer, not a failure — the caller records
        // it rather than retrying forever.
        return null;
      }
      this.logger.error(
        `Stripe subscription fetch failed (${providerSubscriptionId}): ${describeError(error)}`,
      );
      throw error;
    }
  }

  async retrieveCheckoutSubscription(sessionId: string): Promise<{
    customerId: string | null;
    clientReferenceId: string | null;
    subscription: unknown;
  } | null> {
    const stripe = this.getClient();
    const session = await stripe.checkout.sessions.retrieve(sessionId, {
      expand: ['subscription'],
    });
    if (session.mode !== 'subscription' || !session.subscription) {
      return null;
    }
    const subscription =
      typeof session.subscription === 'string'
        ? await stripe.subscriptions.retrieve(session.subscription)
        : session.subscription;
    const customerId =
      typeof session.customer === 'string' ? session.customer : (session.customer?.id ?? null);
    return {
      customerId,
      clientReferenceId: session.client_reference_id ?? null,
      subscription,
    };
  }

  async listCustomerSubscriptions(providerCustomerId: string): Promise<unknown[]> {
    const stripe = this.getClient();
    const page = await stripe.subscriptions.list({
      customer: providerCustomerId,
      status: 'all',
      limit: 10,
    });
    return page.data;
  }

  async inspectForPriceMigration(
    providerSubscriptionId: string,
  ): Promise<PriceMigrationInspection> {
    const stripe = this.getClient();
    const sub = await stripe.subscriptions.retrieve(providerSubscriptionId);
    const item = sub.items.data[0];
    const price = item?.price;

    let pendingChange: PriceMigrationInspection['pendingChange'] = null;
    const scheduleId = typeof sub.schedule === 'string' ? sub.schedule : (sub.schedule?.id ?? null);
    if (scheduleId) {
      const schedule = await stripe.subscriptionSchedules.retrieve(scheduleId);
      const nowSeconds = Math.floor(Date.now() / 1000);
      const future = schedule.phases.find((phase) => phase.start_date > nowSeconds);
      if (future) {
        const ref = future.items[0]?.price;
        pendingChange = {
          source: typeof schedule.metadata?.source === 'string' ? schedule.metadata.source : null,
          priceId: typeof ref === 'string' ? ref : (ref?.id ?? null),
        };
      }
    }

    return {
      status: sub.status,
      priceId: price?.id ?? null,
      unitAmount: price?.unit_amount ?? null,
      currency: price?.currency ?? null,
      cancelAtPeriodEnd: sub.cancel_at_period_end,
      currentPeriodEnd: item?.current_period_end ? new Date(item.current_period_end * 1000) : null,
      pendingChange,
    };
  }

  async syncCatalog(query: CatalogQuery): Promise<CatalogSyncResult> {
    return syncStripeCatalog(query, this.getClient());
  }

  async scheduleDowngrade(req: ChangePlanRequest): Promise<void> {
    const stripe = this.getClient();
    try {
      const current = await stripe.subscriptions.retrieve(req.providerSubscriptionId);
      const existingScheduleId =
        typeof current.schedule === 'string' ? current.schedule : current.schedule?.id;

      // Replace, never stack: only one pending change may exist.
      const schedule = existingScheduleId
        ? await stripe.subscriptionSchedules.retrieve(existingScheduleId)
        : await stripe.subscriptionSchedules.create({
            from_subscription: req.providerSubscriptionId,
          });

      // The LIVE phase — NOT necessarily phases[0]. On a schedule that
      // already carries a PRIOR pending downgrade (the seller downgrades a
      // second time before the first one lands), phases[0] is a COMPLETED,
      // past phase: Stripe refuses to rewrite it, so reading it here silently
      // broke every second downgrade. `schedule.current_phase` is Stripe's
      // own answer to "which entry in `phases` is live right now" (a
      // window, not the phase object itself); a schedule's phases never
      // share a start_date, so matching on it recovers the real entry. Fall
      // back to phases[0] only for a schedule THIS call just created via
      // `from_subscription` a few lines up, where current_phase can be
      // momentarily unset on the create response even though there is
      // exactly one phase to find.
      const currentPhaseWindow = schedule.current_phase;
      const currentPhase =
        (currentPhaseWindow
          ? schedule.phases.find((phase) => phase.start_date === currentPhaseWindow.start_date)
          : undefined) ?? schedule.phases[0];
      if (!currentPhase) {
        throw new Error('billing.errors.planChangeFailed');
      }

      await stripe.subscriptionSchedules.update(schedule.id, {
        end_behavior: 'release',
        // Overwritten on every write, so a seller downgrade that replaces an
        // automatic price migration (or the reverse) is labelled correctly.
        metadata: { source: req.scheduleSource ?? ScheduleSource.PLAN_CHANGE },
        // `automatic_tax` is a real field on BOTH `default_settings` AND each
        // individual phase ("Automatic tax settings for this phase" per the
        // Stripe SDK's own Phase type) — and the phase reconstruction below
        // only copies items/quantity/dates off `currentPhase`, dropping
        // whatever automatic_tax setting that phase actually carried. Setting
        // it explicitly at BOTH levels, on BOTH phases, turns "does Stripe
        // inherit it from the source subscription" into a fact this call
        // guarantees rather than an unprovable runtime assumption — the
        // Wyoming tax registration went live 2026-08-22, so a downgrade that
        // silently stopped collecting sales tax is a compliance exposure, not
        // a cosmetic gap.
        default_settings: { automatic_tax: { enabled: true } },
        phases: [
          {
            // NOTE: this carries forward price + quantity ONLY. A phase can
            // also carry a discount/coupon, custom tax rates, billing
            // thresholds, etc., and none of that is copied here. Nothing in
            // this codebase applies a Stripe coupon to a subscription today,
            // so there is nothing to lose yet — but if that ever changes,
            // this needs to copy those fields too, or scheduling a downgrade
            // will silently strip them off the still-open current phase.
            items: currentPhase.items.map((item) => ({
              price: typeof item.price === 'string' ? item.price : item.price.id,
              quantity: item.quantity ?? 1,
            })),
            start_date: currentPhase.start_date,
            end_date: currentPhase.end_date,
            automatic_tax: { enabled: true },
          },
          {
            items: [{ price: req.providerPriceId, quantity: 1 }],
            metadata: { plan_id: req.planId },
            automatic_tax: { enabled: true },
          },
        ],
      });
    } catch (error) {
      this.logger.error(`Stripe downgrade schedule failed: ${describeError(error)}`);
      throw new Error('billing.errors.planChangeFailed');
    }
  }

  /** Release a pending downgrade, leaving the subscription as it is. */
  async cancelScheduledChange(providerSubscriptionId: string): Promise<void> {
    const stripe = this.getClient();
    try {
      const current = await stripe.subscriptions.retrieve(providerSubscriptionId);
      const scheduleId =
        typeof current.schedule === 'string' ? current.schedule : current.schedule?.id;
      if (!scheduleId) {
        return; // Nothing pending — treat as already done rather than an error.
      }
      await stripe.subscriptionSchedules.release(scheduleId);
    } catch (error) {
      this.logger.error(`Stripe schedule release failed: ${describeError(error)}`);
      throw new Error('billing.errors.planChangeFailed');
    }
  }

  async previewPlanChange(
    providerSubscriptionId: string,
    providerPriceId: string,
  ): Promise<{ amountDueMicros: number; currency: string }> {
    const stripe = this.getClient();
    try {
      const current = await stripe.subscriptions.retrieve(providerSubscriptionId);
      const itemId = current.items.data[0]?.id;
      if (!itemId) {
        throw new Error('billing.errors.planChangeFailed');
      }
      const preview = await stripe.invoices.createPreview({
        customer: typeof current.customer === 'string' ? current.customer : current.customer.id,
        subscription: providerSubscriptionId,
        subscription_details: {
          items: [{ id: itemId, price: providerPriceId }],
          proration_behavior: 'always_invoice',
        },
      });
      // Stripe amounts are minor units (cents); our DTOs are micro-units.
      return {
        amountDueMicros: preview.amount_due * 10_000,
        currency: preview.currency.toUpperCase(),
      };
    } catch (error) {
      // Sibling to changeSubscriptionPlan/scheduleDowngrade above: without
      // this, a raw Stripe error (or the missing-itemId throw two lines up)
      // reached the controller's rethrowBillingError, missed
      // BILLING_ERROR_STATUS entirely (it only recognizes our own
      // 'billing.errors.*' keys), and surfaced as a blank 500 instead of the
      // mapped 409 every other provider failure gets.
      this.logger.error(`Stripe plan-change preview failed: ${describeError(error)}`);
      throw new Error('billing.errors.planChangeFailed');
    }
  }

  async getBillingDetails(providerCustomerId: string): Promise<ProviderBillingDetails> {
    const stripe = this.getClient();
    try {
      const customer = await stripe.customers.retrieve(providerCustomerId, {
        expand: ['invoice_settings.default_payment_method'],
      });
      if (customer.deleted) {
        return EMPTY_PROVIDER_BILLING_DETAILS;
      }

      // The DEFAULT method, not the first attached one. Several cards can be
      // attached (each Checkout run adds one); showing the wrong one puts a
      // false number on the screen whose whole purpose is being right.
      const pm = customer.invoice_settings?.default_payment_method;
      const card = pm && typeof pm !== 'string' ? pm.card : null;

      // `status` on `subscriptions.list` takes ONE value, not a set, so it
      // cannot express LIVE_SUBSCRIPTION_STATUSES directly — fetch a small
      // page (newest first, Stripe's default list order) and pick the first
      // one that is actually live, rather than trusting `limit: 1` with no
      // status filter at all. Unfiltered, that previously returned whatever
      // subscription happened to be newest — including a cancelled or
      // otherwise dead one — and reported ITS payment method/schedule as the
      // seller's current billing detail.
      const subsPage = await stripe.subscriptions.list({
        customer: providerCustomerId,
        status: 'all',
        limit: 10,
      });
      const liveSub = subsPage.data.find((sub) =>
        StripeBillingProvider.LIVE_SUBSCRIPTION_STATUSES.has(sub.status),
      );
      // The upcoming-invoice preview must name the subscription: Stripe (API
      // 2026-07-29) rejects a customer-only createPreview with "You must
      // provide at least one of: subscription, schedule, ...", so the old
      // customer-only call always failed into the catch below and the next
      // charge amount/date were never shown. Skipped when there is no live
      // subscription — that is a normal state, not a failure.
      let nextChargeAmountMicros: number | null = null;
      let nextChargeCurrency: string | null = null;
      let nextChargeAt: string | null = null;
      if (liveSub) {
        try {
          const upcoming = await stripe.invoices.createPreview({
            customer: providerCustomerId,
            subscription: liveSub.id,
          });
          nextChargeAmountMicros = upcoming.amount_due * 10_000;
          nextChargeCurrency = upcoming.currency.toUpperCase();
          nextChargeAt = upcoming.next_payment_attempt
            ? new Date(upcoming.next_payment_attempt * 1000).toISOString()
            : null;
        } catch (error) {
          this.logger.warn(`Stripe upcoming-invoice preview failed: ${describeError(error)}`);
        }
      }

      const scheduleId =
        typeof liveSub?.schedule === 'string' ? liveSub.schedule : (liveSub?.schedule?.id ?? null);
      let scheduledPriceId: string | null = null;
      let scheduledAt: string | null = null;
      if (scheduleId) {
        const schedule = await stripe.subscriptionSchedules.retrieve(scheduleId);
        // An automatic price migration keeps the seller on the SAME plan, so it
        // is not a "scheduled plan change" — surfacing it would show "switches
        // to Growth" to someone already on Growth, next to a Cancel button that
        // would quietly undo the migration. The seller learns about it by the
        // price-change e-mail instead.
        const pending =
          schedule.metadata?.source === ScheduleSource.PRICE_MIGRATION ? undefined : schedule.phases[1];
        // A phase whose start_date has already passed is not "pending" — it
        // IS the current phase now. scheduleDowngrade's final phase carries
        // no end_date, so the schedule never "completes" (end_behavior:
        // 'release' never fires) and phases[1] stays populated forever once
        // the change lands. Reading it unconditionally made the "Switches to
        // X on <date>" banner permanent instead of clearing when the
        // downgrade actually applied, and made a SECOND downgrade land on a
        // now-past phases[0] that Stripe refuses to rewrite (see
        // scheduleDowngrade's own current_phase lookup for that half of the
        // fix).
        const nowSeconds = Math.floor(Date.now() / 1000);
        if (pending && pending.start_date > nowSeconds) {
          const priceRef = pending.items[0]?.price;
          scheduledPriceId = typeof priceRef === 'string' ? priceRef : (priceRef?.id ?? null);
          scheduledAt = new Date(pending.start_date * 1000).toISOString();
        }
      }

      return {
        paymentMethod: card
          ? {
              brand: card.brand,
              last4: card.last4,
              expMonth: card.exp_month,
              expYear: card.exp_year,
            }
          : null,
        nextChargeAmountMicros,
        nextChargeCurrency,
        nextChargeAt,
        scheduledPriceId,
        scheduledAt,
        // Same subscription object the schedule lookup above already fetched
        // — Stripe's Billing Portal cancel action sets these two fields
        // directly on the subscription (no separate event/object), so no
        // extra call is needed to read them.
        cancelAtPeriodEnd: Boolean(liveSub?.cancel_at_period_end),
        cancelAt: liveSub?.cancel_at ? new Date(liveSub.cancel_at * 1000).toISOString() : null,
      };
    } catch (error) {
      // BillingService.getDetails fails this whole request soft to an
      // all-null shape, so the seller-facing outcome is silence, not an error
      // screen — this log is the only trace of why.
      this.logger.warn(
        `Stripe billing details failed for customer ${providerCustomerId}: ${describeError(error)}`,
      );
      throw error;
    }
  }

  async listInvoices(
    providerCustomerId: string,
    limit: number,
    startingAfter?: string,
  ): Promise<{ items: BillingInvoiceDto[]; hasMore: boolean; nextCursor: string | null }> {
    const stripe = this.getClient();
    try {
      const page = await stripe.invoices.list({
        customer: providerCustomerId,
        limit,
        ...(startingAfter ? { starting_after: startingAfter } : {}),
      });
      const items = page.data.map((inv) => mapStripeInvoice(inv as unknown as StripeInvoiceLike));
      return {
        items,
        hasMore: page.has_more,
        // Stripe's starting_after cursor is a position in the LIST's own return
        // order, not a timestamp — so "the last id we returned" is exactly the
        // cursor that resumes correctly on the next page, no matter the sort.
        nextCursor: page.has_more ? (items[items.length - 1]?.id ?? null) : null,
      };
    } catch (error) {
      // Sibling to every other provider method: without this, a raw Stripe
      // error reached the controller's rethrowBillingError, missed
      // BILLING_ERROR_STATUS, and surfaced as a blank 500 to the FE card
      // whose whole job is rendering its own retry state for exactly this
      // failure.
      this.logger.error(
        `Stripe invoice list failed for customer ${providerCustomerId}: ${describeError(error)}`,
      );
      throw new Error('billing.errors.invoicesFailed');
    }
  }

  async createPortal(
    userId: string,
    providerCustomerId: string | null,
    locale: SupportedStripeLocale,
  ): Promise<BillingPortalDto> {
    const stripe = this.getClient();
    if (!providerCustomerId) {
      // The user has never reached checkout, so there is no Stripe customer to
      // manage. The controller maps this to a 409.
      throw new Error('billing.errors.noCustomer');
    }

    try {
      const session = await stripe.billingPortal.sessions.create({
        customer: providerCustomerId,
        return_url: `${this.config.frontendUrl}/billing`,
        locale,
      });
      return { provider: BillingProvider.STRIPE, portalUrl: session.url };
    } catch (error) {
      this.logger.error(`Stripe portal failed for customer ${providerCustomerId}: ${describeError(error)}`);
      throw new Error('billing.errors.portalFailed');
    }
  }

  /**
   * Return the user's Stripe customer id, creating and persisting one on first
   * checkout. Reusing the stored id keeps a retried or repeated checkout from
   * minting a second Stripe customer for the same user (which would split
   * their invoice history and break the portal).
   *
   * Public (part of BillingProviderPort) rather than a private helper of
   * createCheckout: BillingService.createCheckout calls it directly, up
   * front, under BillingRepositoryService.withUserBillingLock — a per-user
   * Postgres advisory lock — so that two concurrent requests for a brand-new
   * user (no linked customer yet) cannot each independently reach the
   * `stripe.customers.create` call below and each mint a separate Stripe
   * customer. Without that lock, billing_customers.user_id being UNIQUE means
   * whichever linkProviderCustomer call below lands second silently
   * overwrites the first's link, orphaning the first (now-unreferenced)
   * Stripe customer — and any subscription created under it — from all local
   * tracking. This method itself stays lock-agnostic (it just does the read,
   * and the create+link if needed): the lock lives in the repository and is
   * acquired by the caller, so a call from createCheckout/createAddonCheckout
   * below (already inside, or after, the service's lock has resolved things)
   * is a correct, ordinary re-read.
   *
   * `client` (see the interface doc) is threaded straight through to both
   * repository calls, so the read-then-maybe-write here runs on the SAME
   * connection `withUserBillingLock` is holding for the advisory lock,
   * instead of each borrowing its own from the pool for the duration of the
   * lock.
   */
  async ensureCustomer(userId: string, customerEmail: string, client?: PoolClient): Promise<string> {
    const stripe = this.getClient();
    const existing = await this.repository.findCustomerByUserId(userId, client);
    if (existing?.provider === BillingProvider.STRIPE && existing.providerCustomerId) {
      return existing.providerCustomerId;
    }

    let customer: Stripe.Customer;
    try {
      customer = await stripe.customers.create({
        email: customerEmail || undefined,
        metadata: { user_id: userId },
      });
    } catch (error) {
      this.logger.error(`Stripe customer create failed for user ${userId}: ${describeError(error)}`);
      throw new Error('billing.errors.checkoutFailed');
    }

    await this.repository.linkProviderCustomer(userId, BillingProvider.STRIPE, customer.id, client);
    return customer.id;
  }
}

function describeError(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}
