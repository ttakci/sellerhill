// apps/api/src/modules/billing/billing-provider.ts
//
// Provider abstraction for checkout/portal. The billing module talks to a
// BillingProvider; the concrete impl is Paddle (when configured) or Local
// (the config-unavailable fail-safe). The Local provider throws on every
// checkout/portal call so the controller can map it to a 409 — it never
// silently no-ops.
//
// Phase 2 ships Paddle checkout/portal URL generation. Paddle API calls (to
// create transactions / open the customer portal) are made via fetch against
// PADDLE_API_BASE_URL with the PADDLE_API_KEY bearer token. Webhook
// signature verification lives in billing-helpers.ts (verifyPaddleSignature)
// because it must run BEFORE the body is parsed as JSON (raw body required).

import { Injectable, Logger } from '@nestjs/common';
import { BillingInterval } from '@repo/shared';

import type { BillingConfig } from './billing-helpers';
import { BillingProvider, type BillingCheckoutDto, type BillingPortalDto } from './billing.types';


/**
 * Provider-facing checkout request. The controller builds this from the
 * authenticated user + SubscribeDto; the provider turns it into a provider
 * checkout session.
 */
export interface CheckoutRequest {
  userId: string;
  /** The user's email, used as the Paddle customer email. */
  customerEmail: string;
  planId: string;
  /** The provider-side product id (billing_plans.provider_product_id). */
  providerProductId: string | null;
  /** The provider-side price id for the chosen interval
   *  (billing_plan_prices.provider_price_id). */
  providerPriceId: string | null;
  interval: BillingInterval;
}

/**
 * The billing provider abstraction. Implementations:
 *  - PaddleBillingProvider — real checkout/portal via the Paddle API.
 *  - LocalBillingProvider — fail-safe; throws on checkout/portal.
 */
export interface BillingProviderPort {
  readonly key: BillingProvider;
  /** True when the provider is ready to serve checkout/portal. The Local
   *  provider returns false; Paddle returns true only when env is present. */
  isConfigured(): boolean;
  /** Create a checkout session. Throws when not configured. */
  createCheckout(req: CheckoutRequest): Promise<BillingCheckoutDto>;
  /** Create a customer portal session. Throws when not configured or when the
   *  user has no provider customer id. */
  createPortal(userId: string, providerCustomerId: string | null): Promise<BillingPortalDto>;
}

// ---------------------------------------------------------------------------
// Local provider (fail-safe)
// ---------------------------------------------------------------------------

/**
 * The Local provider is the config-unavailable fail-safe. It never produces a
 * checkout/portal session — callers MUST check `isConfigured()` first OR
 * catch the thrown error and map to 409. This exists so the billing module
 * has a non-null provider to inject even when Paddle env is absent (catalog
 * and summary still work; checkout/portal/webhook do not).
 */
@Injectable()
export class LocalBillingProvider implements BillingProviderPort {
  readonly key = BillingProvider.LOCAL;
  private readonly logger = new Logger(LocalBillingProvider.name);

  isConfigured(): boolean {
    return false;
  }

  createCheckout(): Promise<BillingCheckoutDto> {
    this.logger.warn('Checkout requested but no billing provider is configured');
    return Promise.reject(new Error('billing.errors.providerNotConfigured'));
  }

  createPortal(): Promise<BillingPortalDto> {
    this.logger.warn('Portal requested but no billing provider is configured');
    return Promise.reject(new Error('billing.errors.providerNotConfigured'));
  }
}

// ---------------------------------------------------------------------------
// Paddle provider
// ---------------------------------------------------------------------------

interface PaddlePriceOverride {
  /** Paddle price id (pri_...). */
  priceId: string;
  quantity: number;
}

interface PaddleTransactionResponse {
  data?: {
    id: string;
    checkout?: { url?: string | null } | null;
  } | null;
}

interface PaddleCustomerPortalResponse {
  data?: {
    url?: string | null;
  } | null;
}

/**
 * Paddle Billing provider. Creates Paddle transactions (checkout sessions)
 * and customer portal sessions via the Paddle API. Requires PADDLE_API_KEY
 * and (for webhooks) PADDLE_WEBHOOK_SECRET — see resolveBillingConfig.
 *
 * The checkout flow is redirect-based: the FE POSTs /billing/checkout, the
 * backend creates a Paddle transaction with the items[] set to the plan's
 * Paddle price id, and returns the checkout URL. After payment, Paddle sends
 * a webhook (subscription.created / subscription.activated) which the
 * idempotent processor applies to billing_subscriptions.
 */
@Injectable()
export class PaddleBillingProvider implements BillingProviderPort {
  readonly key = BillingProvider.PADDLE;
  private readonly logger = new Logger(PaddleBillingProvider.name);

  constructor(private readonly config: BillingConfig) {}

  isConfigured(): boolean {
    return Boolean(this.config.paddleApiKey);
  }

  async createCheckout(req: CheckoutRequest): Promise<BillingCheckoutDto> {
    if (!this.isConfigured()) {
      throw new Error('billing.errors.providerNotConfigured');
    }
    if (!req.providerPriceId) {
      // The plan has not been mirrored to Paddle yet (no provider_price_id on
      // the effective price row). This is an operator task, not a user error.
      this.logger.error(
        `Checkout failed: plan ${req.planId} has no provider_price_id for interval ${req.interval}`,
      );
      throw new Error('billing.errors.planNotMirrored');
    }

    const items: PaddlePriceOverride[] = [{ priceId: req.providerPriceId, quantity: 1 }];
    const body = {
      items,
      customer: { email: req.customerEmail },
      // Paddle redirects back here after checkout. The FE passes the return
      // URL as a query param; the backend echoes it. For phase 2 the return
      // URL is the billing summary page.
      checkout: { variant: 'one_step' },
    };

    const res = await fetch(`${this.config.paddleApiBaseUrl}/transactions`, {
      method: 'POST',
      headers: this.apiHeaders(),
      body: JSON.stringify(body),
    });

    if (!res.ok) {
      const text = await res.text().catch(() => '');
      this.logger.error(
        `Paddle checkout failed: ${res.status} ${res.statusText} body=${text.slice(0, 500)}`,
      );
      throw new Error('billing.errors.checkoutFailed');
    }

    const json = (await res.json()) as PaddleTransactionResponse;
    const checkoutUrl = json.data?.checkout?.url ?? null;
    const sessionId = json.data?.id ?? null;
    if (!checkoutUrl) {
      this.logger.error(`Paddle checkout returned no checkout URL (txn=${sessionId})`);
      throw new Error('billing.errors.checkoutFailed');
    }

    return {
      provider: BillingProvider.PADDLE,
      checkoutUrl,
      providerSessionId: sessionId,
      planId: req.planId,
      interval: req.interval,
    };
  }

  async createPortal(userId: string, providerCustomerId: string | null): Promise<BillingPortalDto> {
    if (!this.isConfigured()) {
      throw new Error('billing.errors.providerNotConfigured');
    }
    if (!providerCustomerId) {
      // No Paddle customer record — the user has never checked out. Portal
      // cannot be opened. The controller maps this to a 409/404.
      throw new Error('billing.errors.noCustomer');
    }

    const res = await fetch(
      `${this.config.paddleApiBaseUrl}/customers/${encodeURIComponent(providerCustomerId)}/portal-sessions`,
      {
        method: 'POST',
        headers: this.apiHeaders(),
        body: JSON.stringify({}),
      },
    );

    if (!res.ok) {
      const text = await res.text().catch(() => '');
      this.logger.error(
        `Paddle portal failed for customer ${providerCustomerId}: ${res.status} ${res.statusText} body=${text.slice(0, 500)}`,
      );
      throw new Error('billing.errors.portalFailed');
    }

    const json = (await res.json()) as PaddleCustomerPortalResponse;
    const portalUrl = json.data?.url ?? null;
    if (!portalUrl) {
      throw new Error('billing.errors.portalFailed');
    }
    return { provider: BillingProvider.PADDLE, portalUrl };
  }

  private apiHeaders(): Record<string, string> {
    return {
      Authorization: `Bearer ${this.config.paddleApiKey as string}`,
      'Content-Type': 'application/json',
    };
  }
}
