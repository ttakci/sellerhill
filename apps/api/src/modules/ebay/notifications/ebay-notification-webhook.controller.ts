/**
 * eBay Platform Notification receiver (NEW_MESSAGE).
 *
 * PUBLIC — no `@UseGuards(JwtAuthGuard)`, same as the account-deletion webhook
 * and the tracking webhook. eBay calls this with no SellerHill session; the
 * ECDSA `X-EBAY-SIGNATURE` is the authentication, verified against the RAW
 * request bytes before anything in the body is trusted. The GET challenge is
 * `@SkipThrottle` (eBay validates once); the POST carries its own generous
 * `@Throttle` — well above eBay's retry burst, but still a ceiling, since the
 * route is public and every request costs a raw-capture row.
 *
 * - GET  `?challenge_code=` → `{ challengeResponse: sha256(code + token + endpoint) }`
 * - POST while notifications are disabled → 503, nothing read or recorded
 * - POST verified            → 204 (booked through `recordDelivery`, idempotent
 *                               on `notification_id`)
 * - POST bad/missing signature, malformed or unknown `kid` → 412 — the raw
 *   capture is recorded, nothing else
 * - POST verified but not a notification envelope → 400
 *
 * Every enabled POST is captured into `ebay_notification_raw_captures` BEFORE
 * any decision, so a shape change shows up as `signature_ok`/`parsed_ok = false`
 * rather than as silence. A request with no parseable signature header is
 * captured truncated to 1 KB (it is almost certainly not eBay, and an
 * unauthenticated caller must not be able to fill the table). The capture is
 * best-effort and never changes the response eBay sees.
 */

import {
  Controller,
  Get,
  HttpCode,
  HttpException,
  HttpStatus,
  Logger,
  Post,
  Query,
  Req,
} from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { SkipThrottle, Throttle } from '@nestjs/throttler';
import type { Request } from 'express';

import { DatabaseService } from '../../../common/database/database.service';
import { computeChallengeResponse } from '../ebay-account-deletion.helpers';

import {
  parseSignatureHeader,
  verifyNotificationSignature,
} from './ebay-notification-signature';
import { parseNotificationEnvelope } from './ebay-notification.helpers';
import { EbayNotificationService } from './ebay-notification.service';

/** Only these headers are ever persisted by `captureRaw` — never cookies or auth. */
const CAPTURED_HEADER_NAMES = ['content-type', 'x-ebay-signature'] as const;

/** Bound on a captured body; eBay notifications are a few hundred bytes. */
const MAX_CAPTURED_BODY_CHARS = 20_000;

/** Bound on a captured body whose signature header is absent or malformed. */
const MAX_UNSIGNED_CAPTURED_BODY_CHARS = 1_024;

/** eBay key ids are opaque tokens; anything else is refused before a key lookup. */
const KID_SHAPE = /^[A-Za-z0-9_-]{8,100}$/;

/**
 * Generous on every named tracker in `app.module.ts` (short/medium/long), so
 * none is stricter than eBay's delivery + retry burst for a busy account.
 */
const NOTIFICATION_THROTTLE = {
  short: { limit: 600, ttl: 60_000 },
  medium: { limit: 600, ttl: 60_000 },
  long: { limit: 36_000, ttl: 3_600_000 },
};

@ApiTags('ebay')
@Controller({ path: 'ebay/notifications', version: '1' })
export class EbayNotificationWebhookController {
  private readonly logger = new Logger(EbayNotificationWebhookController.name);

  constructor(
    private readonly service: EbayNotificationService,
    private readonly databaseService: DatabaseService,
  ) {}

  @Get()
  @SkipThrottle()
  @ApiOperation({ summary: 'eBay platform notifications — destination challenge validation' })
  handleChallenge(@Query('challenge_code') challengeCode?: string): { challengeResponse: string } {
    if (!challengeCode || typeof challengeCode !== 'string') {
      throw new HttpException('challenge_code query parameter is required', HttpStatus.BAD_REQUEST);
    }
    const token = this.service.verificationToken();
    if (!this.service.isEnabled() || !token) {
      throw new HttpException(
        'eBay notifications are not configured',
        HttpStatus.SERVICE_UNAVAILABLE,
      );
    }
    return {
      challengeResponse: computeChallengeResponse(challengeCode, token, this.service.endpointUrl()),
    };
  }

  @Post()
  @HttpCode(204)
  @Throttle(NOTIFICATION_THROTTLE)
  @ApiOperation({ summary: 'eBay platform notifications — NEW_MESSAGE receiver (signature-verified)' })
  async handleNotification(@Req() req: Request): Promise<void> {
    if (!this.service.isEnabled()) {
      throw new HttpException(
        'eBay notifications are not configured',
        HttpStatus.SERVICE_UNAVAILABLE,
      );
    }
    const rawBody = readRawBody(req);
    const signatureHeader = req.headers['x-ebay-signature'];
    const parsedHeader = parseSignatureHeader(
      typeof signatureHeader === 'string' ? signatureHeader : undefined,
    );
    // A kid of the wrong shape never reaches the key lookup (an eBay call).
    const header = parsedHeader && KID_SHAPE.test(parsedHeader.kid) ? parsedHeader : null;
    const pem = header ? await this.service.publicKey(header.kid) : null;
    const signatureOk = !!header && !!pem && verifyNotificationSignature(rawBody, header, pem);

    let parsedBody: unknown = null;
    let parsedOk = false;
    try {
      parsedBody = JSON.parse(rawBody) as unknown;
      parsedOk = true;
    } catch {
      parsedOk = false;
    }

    await this.captureRaw(
      req,
      rawBody.slice(0, header ? MAX_CAPTURED_BODY_CHARS : MAX_UNSIGNED_CAPTURED_BODY_CHARS),
      signatureOk,
      parsedOk,
    );

    if (!signatureOk) {
      this.logger.warn(
        `eBay notification rejected: ${header ? (pem ? 'signature mismatch' : `unknown kid ${header.kid}`) : parsedHeader ? 'malformed kid' : 'missing/malformed X-EBAY-SIGNATURE'}`,
      );
      throw new HttpException('Invalid eBay notification signature', HttpStatus.PRECONDITION_FAILED);
    }

    const parsed = parseNotificationEnvelope(parsedBody);
    if (!parsed) {
      this.logger.warn('Verified eBay notification with unrecognised body shape — returning 400');
      throw new HttpException('Unrecognised notification payload', HttpStatus.BAD_REQUEST);
    }

    const result = await this.service.recordDelivery(parsed);
    this.logger.log(
      `eBay notification ${parsed.topic} ${parsed.notificationId} attempt=${parsed.publishAttemptCount} → ${result.outcome}`,
    );
  }

  /** `body` arrives already bounded by the caller (20 KB signed, 1 KB unsigned). */
  private async captureRaw(
    req: Request,
    body: string,
    signatureOk: boolean,
    parsedOk: boolean,
  ): Promise<void> {
    try {
      const headers: Record<string, string> = {};
      for (const name of CAPTURED_HEADER_NAMES) {
        const value = req.headers?.[name];
        if (typeof value === 'string') {
          headers[name] = value;
        }
      }
      await this.databaseService.query(
        `INSERT INTO ebay_notification_raw_captures (headers, body, signature_ok, parsed_ok)
         VALUES ($1, $2, $3, $4)`,
        [
          JSON.stringify(headers),
          body,
          signatureOk,
          parsedOk,
        ],
      );
    } catch (err) {
      this.logger.warn(
        `Could not capture raw eBay notification (diagnostic only): ${(err as Error).message}`,
      );
    }
  }
}

/**
 * Read the raw request body for signature verification. `main.ts` sets
 * `rawBody: true`, so the original bytes are on `req.rawBody`; the
 * re-serialisation fallback is best-effort (mirrors `tracking-webhook.controller.ts`).
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
