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
import { BillingInterval } from '@repo/shared';
import Stripe from 'stripe';

import type { BillingConfig } from './billing-helpers';
import type { BillingRepositoryService } from './billing-repository.service';
import { BillingProvider, type BillingCheckoutDto, type BillingPortalDto } from './billing.types';

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
  /** Create a customer portal session. Throws when not configured or when the
   *  user has no Stripe customer id. */
  createPortal(userId: string, providerCustomerId: string | null): Promise<BillingPortalDto>;
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
   */
  changeSubscriptionPlan(req: ChangePlanRequest): Promise<void>;
}

/** Everything an in-place plan change needs. */
export interface ChangePlanRequest {
  providerSubscriptionId: string;
  providerPriceId: string;
  /** Our plan id, written to the subscription's metadata so the resulting
   *  `customer.subscription.updated` webhook resolves to the right local plan. */
  planId: string;
}

/** Everything a one-time top-up checkout needs. */
export interface AddonCheckoutRequest {
  userId: string;
  email: string;
  /** Stable pack key, echoed into session metadata so the webhook can resolve it. */
  addonSlug: string;
  providerPriceId: string;
  providerCustomerId: string | null;
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
    this.client ??= new Stripe(this.config.stripeSecretKey);
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
    const customerId = await this.ensureStripeCustomer(stripe, req);

    let session: Stripe.Checkout.Session;
    try {
      session = await stripe.checkout.sessions.create({
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
        metadata: { plan_id: req.planId, user_id: req.userId },
        success_url: `${this.config.frontendUrl}/billing?checkout=success&session_id={CHECKOUT_SESSION_ID}`,
        cancel_url: `${this.config.frontendUrl}/billing?checkout=cancelled`,
        integration_identifier: `sellerhill_checkout_${randomLetterSuffix()}`,
      });
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
    const customerId =
      req.providerCustomerId ??
      (await this.ensureStripeCustomer(stripe, {
        userId: req.userId,
        customerEmail: req.email,
        planId: '',
        providerProductId: null,
        providerPriceId: null,
        interval: BillingInterval.MONTHLY,
      }));

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
        metadata: { addon_slug: req.addonSlug, user_id: req.userId },
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
      await stripe.subscriptions.update(req.providerSubscriptionId, {
        items: [{ id: itemId, price: req.providerPriceId }],
        // Stripe credits the unused part of the old plan and charges the
        // prorated new one. `create_prorations` rather than
        // `always_invoice` so an upgrade does not fire an immediate charge the
        // seller did not expect — it lands on the next invoice.
        proration_behavior: 'create_prorations',
        // The webhook applier reads the local plan from here, so it has to move
        // with the price. Leaving stale metadata would have the subscription
        // report the OLD plan back to us on its next update.
        metadata: { plan_id: req.planId },
      });
    } catch (error) {
      this.logger.error(`Stripe plan change failed: ${describeError(error)}`);
      throw new Error('billing.errors.planChangeFailed');
    }
  }

  async createPortal(userId: string, providerCustomerId: string | null): Promise<BillingPortalDto> {
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
   */
  private async ensureStripeCustomer(stripe: Stripe, req: CheckoutRequest): Promise<string> {
    const existing = await this.repository.findCustomerByUserId(req.userId);
    if (existing?.provider === BillingProvider.STRIPE && existing.providerCustomerId) {
      return existing.providerCustomerId;
    }

    let customer: Stripe.Customer;
    try {
      customer = await stripe.customers.create({
        email: req.customerEmail || undefined,
        metadata: { user_id: req.userId },
      });
    } catch (error) {
      this.logger.error(`Stripe customer create failed for user ${req.userId}: ${describeError(error)}`);
      throw new Error('billing.errors.checkoutFailed');
    }

    await this.repository.linkProviderCustomer(req.userId, BillingProvider.STRIPE, customer.id);
    return customer.id;
  }
}

function describeError(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}
