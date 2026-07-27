// apps/api/src/modules/billing/billing.controller.ts
//
// Billing HTTP endpoints. Paths are under /billing (versioned → /api/v1/billing).
//
//   GET  /billing/catalog              — public, no auth.
//   GET  /billing/summary              — authenticated (JwtAuthGuard).
//   POST /billing/checkout             — authenticated; body SubscribeDto.
//   GET  /billing/portal               — authenticated.
//   POST /billing/webhooks             — public, Paddle webhook. Raw body +
//                                        Paddle-Signature header verified
//                                        before any state mutation.
//
// Fail-safe mapping:
//   - providerNotConfigured → 409 (checkout/portal when no Paddle env).
//   - planNotFound / priceNotFound / planNotMirrored → 404 / 409.
//   - noCustomer (portal) → 409.
//   - webhook signature invalid/missing → 401.
//   - webhook processing failure → 500 (Paddle retries; idempotent on retry).

import { Body, Controller, Get, HttpCode, Post, Req, UseGuards } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { SubscribeDto } from '@repo/shared';
import type { Request } from 'express';

import { JwtAuthGuard } from '../auth/jwt-auth.guard';

import { isStaleEvent, parsePaddleEvent, verifyPaddleSignature } from './billing-helpers';
import { BillingWebhookProcessor } from './billing-webhook-processor';
import { BillingService } from './billing.service';
import {
  type BillingCatalogDto,
  type BillingCheckoutDto,
  type BillingPortalDto,
  type BillingSummaryDto,
} from './billing.types';

@ApiTags('billing')
@Controller({ path: 'billing', version: '1' })
export class BillingController {
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
  @ApiOperation({ summary: 'Create a Paddle checkout session' })
  async checkout(
    @Req() req: { user: { sub: string; email?: string } },
    @Body() dto: SubscribeDto,
  ): Promise<BillingCheckoutDto> {
    return this.billingService.createCheckout(req.user.sub, req.user.email ?? '', dto.planId, dto.interval);
  }

  @Get('portal')
  @UseGuards(JwtAuthGuard)
  @ApiOperation({ summary: 'Create a Paddle customer portal session' })
  async portal(@Req() req: { user: { sub: string } }): Promise<BillingPortalDto> {
    return this.billingService.createPortal(req.user.sub);
  }

  // --- Paddle webhook (public, signature-verified) -------------------------

  @Post('webhooks')
  @HttpCode(200)
  @ApiOperation({ summary: 'Paddle webhook receiver (signature-verified)' })
  async webhook(@Req() req: Request): Promise<{ ok: true }> {
    const config = this.billingService.getConfig();
    if (!config.paddleWebhookSecret) {
      // Fail-closed: without a configured secret we cannot verify the
      // signature, so we must not process the event. Return 401.
      // Throwing here lets the global exception filter map it.
      const err = new Error('billing.errors.webhookSecretMissing');
      (err as Error & { status?: number }).status = 401;
      throw err;
    }

    const signatureHeader = req.headers['paddle-signature'] as string | undefined;
    const rawBody = readRawBody(req);
    const valid = verifyPaddleSignature(signatureHeader, rawBody, config.paddleWebhookSecret);
    if (!valid) {
      const err = new Error('billing.errors.invalidSignature');
      (err as Error & { status?: number }).status = 401;
      throw err;
    }

    // Signature verified — safe to parse the body as JSON.
    let payload: unknown;
    try {
      payload = JSON.parse(rawBody) as unknown;
    } catch {
      const err = new Error('billing.errors.malformedBody');
      (err as Error & { status?: number }).status = 400;
      throw err;
    }

    const event = parsePaddleEvent(payload);

    // Stale-event protection runs inside the processor too, but we short-circuit
    // here so a stale event never claims a row. The inbox still logs it.
    if (isStaleEvent(event.occurredAt, config.webhookStaleMinutes)) {
      // Still log to the inbox for audit, then acknowledge to Paddle.
      await this.webhookProcessor.process(event).catch(() => {
        // Swallow — the processor marks the row 'stale' and returns; a logging
        // failure must not trigger a Paddle retry storm.
      });
      return { ok: true };
    }

    await this.webhookProcessor.process(event);
    return { ok: true };
  }
}

/**
 * Read the raw request body. NestJS by default parses JSON bodies, so
 * `req.body` is already an object. To support raw-body signature verification
 * without a global raw-body middleware, main.ts registers a per-route raw-body
 * capture for the webhook path. When that capture is active, the raw bytes are
 * stashed on `req.rawBody`; otherwise we re-serialize the parsed body (less
 * ideal — byte-for-byte may differ — but acceptable as a fallback when the
 * middleware is not wired).
 *
 * The canonical path is the raw-body middleware in main.ts; this fallback
 * exists so the endpoint degrades safely if the middleware is removed.
 */
function readRawBody(req: Request): string {
  const raw = (req as Request & { rawBody?: Buffer | string }).rawBody;
  if (raw) {
    return typeof raw === 'string' ? raw : raw.toString('utf8');
  }
  // Fallback: re-serialize. This is NOT byte-identical to the original, so
  // signature verification may fail for providers that canonicalize JSON.
  // Paddle signs the exact bytes it sent, so this fallback will reject valid
  // signatures — by design. Operators MUST wire the raw-body middleware.
  return JSON.stringify(req.body ?? {});
}
