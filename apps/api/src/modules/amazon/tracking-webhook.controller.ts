// apps/api/src/modules/amazon/tracking-webhook.controller.ts
//
// Public receiver for tracking-provider (Aquiline) delivery events.
//
// Deliberately carries NO `@UseGuards(JwtAuthGuard)` — same as the Paddle
// billing webhook. The provider has no SellerHill session; the HMAC signature is
// the authentication, and it is verified against the RAW request bytes before
// the body is parsed.

import { Controller, HttpCode, Post, Req } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { SkipThrottle } from '@nestjs/throttler';
import { PlatformSettingKey } from '@repo/shared';
import type { Request } from 'express';

import { PlatformSettingsService } from '../../common/settings/platform-settings.service';

import {
  parseTrackingWebhookPayload,
  TrackingWebhookOutcome,
  verifyTrackingWebhookSignature,
} from './tracking-webhook.helpers';
import { TrackingWebhookService } from './tracking-webhook.service';

@ApiTags('tracking')
@Controller({ path: 'tracking', version: '1' })
export class TrackingWebhookController {
  constructor(
    private readonly webhookService: TrackingWebhookService,
    private readonly platformSettings: PlatformSettingsService,
  ) {}

  /**
   * `POST /v1/tracking/webhooks` — this is the URL registered with the provider.
   *
   * Answers 200 for every event we understood, including duplicates, stale
   * events and unmatched tracking numbers. That is deliberate: the provider
   * retries any non-2xx three times (1s/5s/20s), so returning an error for
   * something we have already handled buys three pointless redeliveries. Only
   * a failed signature (401) or an unparseable body (400) is rejected, because
   * those are the two cases where a retry could legitimately succeed or where
   * we must not appear to have accepted the event.
   *
   * Throttling is skipped — a burst of genuine delivery events must not be
   * rate-limited into a retry storm.
   */
  @Post('webhooks')
  @HttpCode(200)
  @SkipThrottle()
  @ApiOperation({ summary: 'Tracking provider webhook receiver (signature-verified)' })
  async webhook(@Req() req: Request): Promise<{ ok: true; outcome: TrackingWebhookOutcome }> {
    const secret = await this.platformSettings.getString(
      PlatformSettingKey.AQUILINE_WEBHOOK_SECRET,
    );
    if (!secret) {
      // Fail closed. Without a secret we cannot tell a provider event from an
      // arbitrary POST, and this endpoint completes orders and messages buyers.
      throw httpError('tracking.errors.webhookSecretMissing', 401);
    }

    const rawBody = readRawBody(req);
    const signature = req.headers['x-webhook-signature'] as string | undefined;
    if (!verifyTrackingWebhookSignature(signature, rawBody, secret)) {
      throw httpError('tracking.errors.invalidSignature', 401);
    }

    let parsedBody: unknown;
    try {
      parsedBody = JSON.parse(rawBody) as unknown;
    } catch {
      throw httpError('tracking.errors.malformedBody', 400);
    }

    const payload = parseTrackingWebhookPayload(parsedBody);
    if (!payload) {
      throw httpError('tracking.errors.malformedBody', 400);
    }

    const outcome = await this.webhookService.process(payload);
    return { ok: true, outcome };
  }
}

function httpError(message: string, status: number): Error {
  const err = new Error(message);
  (err as Error & { status?: number }).status = status;
  return err;
}

/**
 * Read the raw request body for signature verification.
 *
 * Nest parses JSON before the handler runs, so `req.body` is already an object.
 * When a raw-body capture is active the original bytes are on `req.rawBody`;
 * otherwise we re-serialise, which is best-effort — key order and whitespace
 * may differ from what the provider signed. Mirrors `billing.controller.ts`.
 */
function readRawBody(req: Request): string {
  const raw = (req as Request & { rawBody?: Buffer | string }).rawBody;
  if (Buffer.isBuffer(raw)) {
    return raw.toString('utf8');
  }
  if (typeof raw === 'string') {
    return raw;
  }
  return JSON.stringify(req.body ?? {});
}
