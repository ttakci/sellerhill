// apps/api/src/modules/billing/billing.controller.ts
//
// Billing HTTP endpoints. Paths are under /billing (versioned → /api/v1/billing).
//
//   GET  /billing/catalog          — public, no auth.
//   GET  /billing/summary          — authenticated (JwtAuthGuard).
//   POST /billing/checkout         — authenticated; body SubscribeDto. Returns a
//                                    Stripe-hosted checkout URL to redirect to.
//   GET  /billing/portal           — authenticated. Stripe-hosted portal URL.
//   POST /billing/webhooks/stripe  — public, Stripe webhook. Raw body +
//                                    Stripe-Signature verified by the Stripe
//                                    SDK before any state mutation.
//
// Fail-safe mapping:
//   - providerNotConfigured → 409 (checkout/portal when STRIPE_SECRET_KEY is absent).
//   - planNotFound / priceNotFound / planNotMirrored → 404 / 409.
//   - noCustomer (portal) → 409.
//   - webhook signature invalid/missing → 401.
//   - webhook processing failure → 500 (Stripe retries; idempotent on retry).

import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpException,
  HttpStatus,
  Logger,
  Post,
  Req,
  UseGuards,
} from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { SubscribeDto } from '@repo/shared';
import type { Request } from 'express';
import Stripe from 'stripe';

import { JwtAuthGuard } from '../auth/jwt-auth.guard';

import { isStaleEvent } from './billing-helpers';
import { BillingWebhookProcessor } from './billing-webhook-processor';
import { BillingService } from './billing.service';
import {
  type BillingCatalogDto,
  type BillingCheckoutDto,
  type BillingPortalDto,
  type BillingSummaryDto,
  type ParsedStripeEvent,
} from './billing.types';

/**
 * Known billing failure keys → HTTP status. Anything not listed here is a
 * genuine defect and stays a 500.
 *
 * This mapping is what makes the failure legible to the seller: the provider
 * and service layers throw plain `Error`s carrying an i18n key, and without a
 * mapping the global filter turned every one of them into a 500 whose body
 * says only "Internal server error" — so a configuration problem (an
 * unmirrored plan, a Stripe account without a tax address) reached the user as
 * the same blank "an error occurred" dialog as a real crash, with the actual
 * cause visible only in the server log.
 */
const BILLING_ERROR_STATUS: Record<string, HttpStatus> = {
  'billing.errors.providerNotConfigured': HttpStatus.CONFLICT,
  'billing.errors.planNotMirrored': HttpStatus.CONFLICT,
  'billing.errors.checkoutFailed': HttpStatus.CONFLICT,
  'billing.errors.alreadySubscribed': HttpStatus.CONFLICT,
  'billing.errors.portalFailed': HttpStatus.CONFLICT,
  'billing.errors.noCustomer': HttpStatus.CONFLICT,
  'billing.errors.planNotFound': HttpStatus.NOT_FOUND,
  'billing.errors.addonNotFound': HttpStatus.NOT_FOUND,
  'billing.errors.noSubscription': HttpStatus.CONFLICT,
  'billing.errors.planChangeFailed': HttpStatus.CONFLICT,
  'billing.errors.priceNotFound': HttpStatus.NOT_FOUND,
  'billing.errors.ebayTrialAlreadyUsed': HttpStatus.CONFLICT,
};

/**
 * Re-throw a billing error as its mapped HttpException, preserving the i18n
 * key as the response message so the web app can localize it. Unmapped errors
 * pass through untouched.
 */
function rethrowBillingError(error: unknown): never {
  const key = error instanceof Error ? error.message : '';
  const status = BILLING_ERROR_STATUS[key];
  if (status) {
    throw new HttpException(key, status);
  }
  throw error;
}

@ApiTags('billing')
@Controller({ path: 'billing', version: '1' })
export class BillingController {
  private readonly logger = new Logger(BillingController.name);

  constructor(
    private readonly billingService: BillingService,
    private readonly webhookProcessor: BillingWebhookProcessor,
  ) {}

  // --- Public catalog -------------------------------------------------------

  @Get('catalog')
  @ApiOperation({ summary: 'Public billing catalog (active plans + pricing)' })
  async getCatalog(): Promise<BillingCatalogDto> {
    return this.billingService.getCatalog();
  }

  // --- Authenticated summary / checkout / portal ---------------------------

  @Get('summary')
  @UseGuards(JwtAuthGuard)
  @ApiOperation({ summary: 'Authenticated billing summary' })
  async getSummary(@Req() req: { user: { sub: string } }): Promise<BillingSummaryDto> {
    return this.billingService.getSummary(req.user.sub);
  }

  @Post('checkout')
  @UseGuards(JwtAuthGuard)
  @HttpCode(200)
  @ApiOperation({ summary: 'Create a Stripe Checkout session' })
  async checkout(
    @Req() req: { user: { sub: string; email?: string } },
    @Body() dto: SubscribeDto,
  ): Promise<BillingCheckoutDto> {
    try {
      return await this.billingService.createCheckout(
        req.user.sub,
        req.user.email ?? '',
        dto.planId,
        dto.interval,
      );
    } catch (error) {
      rethrowBillingError(error);
    }
  }

  @Post('change-plan')
  @UseGuards(JwtAuthGuard)
  @HttpCode(200)
  @ApiOperation({ summary: 'Move an existing subscription to another plan (prorated)' })
  async changePlan(
    @Req() req: { user: { sub: string } },
    @Body() dto: SubscribeDto,
  ): Promise<{ ok: true }> {
    try {
      await this.billingService.changePlan(req.user.sub, dto.planId, dto.interval);
      return { ok: true };
    } catch (error) {
      rethrowBillingError(error);
    }
  }

  @Post('checkout/addon')
  @UseGuards(JwtAuthGuard)
  @HttpCode(200)
  @ApiOperation({ summary: 'Create a one-time Stripe Checkout session for a quota top-up' })
  async addonCheckout(
    @Req() req: { user: { sub: string; email?: string } },
    @Body() dto: { addonSlug: string },
  ): Promise<BillingCheckoutDto> {
    try {
      return await this.billingService.createAddonCheckout(
        req.user.sub,
        req.user.email ?? '',
        dto.addonSlug,
      );
    } catch (error) {
      rethrowBillingError(error);
    }
  }

  @Get('portal')
  @UseGuards(JwtAuthGuard)
  @ApiOperation({ summary: 'Create a Stripe Billing Portal session' })
  async portal(@Req() req: { user: { sub: string } }): Promise<BillingPortalDto> {
    try {
      return await this.billingService.createPortal(req.user.sub);
    } catch (error) {
      rethrowBillingError(error);
    }
  }

  // --- Stripe webhook (public, signature-verified) -------------------------

  @Post('webhooks/stripe')
  @HttpCode(200)
  @ApiOperation({ summary: 'Stripe webhook receiver (signature-verified)' })
  async stripeWebhook(@Req() req: Request): Promise<{ ok: true }> {
    const config = this.billingService.getConfig();
    if (!config.stripeWebhookSecret || !config.stripeSecretKey) {
      // Fail-closed: without a configured secret we cannot verify the
      // signature, so we must not process the event. Throwing lets the global
      // exception filter map it to 401.
      const err = new Error('billing.errors.webhookSecretMissing');
      (err as Error & { status?: number }).status = 401;
      throw err;
    }

    const signatureHeader = req.headers['stripe-signature'] as string | undefined;
    const rawBody = readRawBody(req);

    let stripeEvent: Stripe.Event;
    try {
      // Stripe's own verification, not a hand-rolled HMAC — it also enforces
      // the replay-tolerance window. This is the whole security boundary of
      // the endpoint, so it runs before the body is trusted for anything.
      const client = new Stripe(config.stripeSecretKey);
      stripeEvent = client.webhooks.constructEvent(rawBody, signatureHeader ?? '', config.stripeWebhookSecret);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      this.logger.warn(`Stripe webhook signature verification failed: ${message}`);
      const err = new Error('billing.errors.invalidSignature');
      (err as Error & { status?: number }).status = 401;
      throw err;
    }

    const event: ParsedStripeEvent = {
      eventId: stripeEvent.id,
      eventType: stripeEvent.type,
      occurredAt: new Date(stripeEvent.created * 1000).toISOString(),
      payload: stripeEvent as unknown as Record<string, unknown>,
    };

    // Stale-event protection runs inside the processor too, but short-circuit
    // here so a stale event never claims a row. The inbox still logs it.
    if (isStaleEvent(event.occurredAt, config.webhookStaleMinutes)) {
      await this.webhookProcessor.process(event).catch(() => {
        // Swallow — the processor marks the row 'stale' and returns; a logging
        // failure must not trigger a Stripe retry storm.
      });
      return { ok: true };
    }

    await this.webhookProcessor.process(event);
    return { ok: true };
  }
}

/**
 * Read the raw request body. Signature verification must run against the exact
 * bytes Stripe signed, so `main.ts` boots Nest with `rawBody: true`, which
 * stashes them on `req.rawBody`.
 *
 * The fallback re-serializes the parsed body, which is NOT byte-identical and
 * will therefore fail verification — deliberately, since a silently-accepted
 * unverifiable webhook is far worse than a rejected one. It exists only so the
 * endpoint degrades safely (401) rather than crashing if that flag is removed.
 */
function readRawBody(req: Request): string {
  const raw = (req as Request & { rawBody?: Buffer | string }).rawBody;
  if (raw) {
    return typeof raw === 'string' ? raw : raw.toString('utf8');
  }
  return JSON.stringify(req.body ?? {});
}
