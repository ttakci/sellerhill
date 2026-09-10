/**
 * eBay Marketplace Account Deletion / Closure Notification receiver.
 *
 * PUBLIC — no `@UseGuards(JwtAuthGuard)`, same as the OAuth callback and the
 * tracking webhook. eBay calls this with no SellerHill session. `@SkipThrottle`
 * because eBay's challenge validation and its notification retries must not be
 * rate-limited into a "validation failed" (which permanently disables the
 * production keyset).
 *
 * Config (both plain env, resolved via ConfigService):
 *   EBAY_VERIFICATION_TOKEN     — the 32–80 char secret, also pasted into the
 *                                 eBay developer portal.
 *   EBAY_DELETION_ENDPOINT_URL  — the exact public URL registered in the portal,
 *                                 used verbatim in the challenge hash. Falls
 *                                 back to `${FRONTEND_URL}${DEFAULT_PATH}` so a
 *                                 deploy that only sets FRONTEND_URL still works
 *                                 as long as the portal is given the same URL.
 *
 * Until EBAY_VERIFICATION_TOKEN is set the endpoint returns 503 — the API still
 * boots (this is not a `:?` compose var), it just cannot be validated yet.
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
import { ConfigService } from '@nestjs/config';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { SkipThrottle } from '@nestjs/throttler';
import type { Request } from 'express';

import {
  computeChallengeResponse,
  isValidVerificationToken,
  parseAccountDeletionNotification,
} from './ebay-account-deletion.helpers';
import { EbayAccountDeletionService } from './ebay-account-deletion.service';

const DEFAULT_PATH = '/api/v1/ebay/marketplace-deletion-notification';

@ApiTags('ebay')
@Controller({ path: 'ebay/marketplace-deletion-notification', version: '1' })
@SkipThrottle()
export class EbayAccountDeletionController {
  private readonly logger = new Logger(EbayAccountDeletionController.name);

  constructor(
    private readonly configService: ConfigService,
    private readonly deletionService: EbayAccountDeletionService,
  ) {}

  /**
   * eBay's endpoint validation: `GET ...?challenge_code=<random>`.
   * Answer with `sha256(challengeCode + verificationToken + endpointUrl)` hex.
   */
  @Get()
  @ApiOperation({ summary: 'eBay marketplace account deletion — challenge validation' })
  handleChallenge(@Query('challenge_code') challengeCode?: string): { challengeResponse: string } {
    if (!challengeCode || typeof challengeCode !== 'string') {
      throw new HttpException('challenge_code query parameter is required', HttpStatus.BAD_REQUEST);
    }
    const token = this.resolveVerificationToken();
    const endpointUrl = this.resolveEndpointUrl();
    return { challengeResponse: computeChallengeResponse(challengeCode, token, endpointUrl) };
  }

  /**
   * The deletion notification itself. Always answers 200 once we understood the
   * shape — including for a payload we hold no data for — so eBay does not retry
   * something already actioned. A malformed body is a 400 (a retry could carry a
   * readable one); a missing verification token is a 503.
   */
  @Post()
  @HttpCode(200)
  @ApiOperation({ summary: 'eBay marketplace account deletion — notification receiver' })
  async handleNotification(@Req() req: Request): Promise<{ ok: true }> {
    // Presence of the token is the deploy-readiness gate; the value is not used
    // to authenticate the POST (eBay signs these with X-EBAY-SIGNATURE, whose
    // verification is a deliberate follow-up — the challenge/response above is
    // what actually enables the keyset).
    this.resolveVerificationToken();

    const target = parseAccountDeletionNotification(req.body);
    if (!target) {
      this.logger.warn('eBay account-deletion POST with unrecognised body shape — returning 400');
      throw new HttpException('Unrecognised notification payload', HttpStatus.BAD_REQUEST);
    }

    await this.deletionService.eraseUserData(target);
    return { ok: true };
  }

  private resolveVerificationToken(): string {
    const token = this.configService.get<string>('EBAY_VERIFICATION_TOKEN');
    if (!isValidVerificationToken(token)) {
      throw new HttpException(
        'EBAY_VERIFICATION_TOKEN is not configured (must be 32–80 chars of A–Z, a–z, 0–9, _ or -)',
        HttpStatus.SERVICE_UNAVAILABLE,
      );
    }
    return token;
  }

  private resolveEndpointUrl(): string {
    const explicit = this.configService.get<string>('EBAY_DELETION_ENDPOINT_URL');
    if (explicit && explicit.trim().length > 0) {
      return explicit.trim();
    }
    const frontendUrl = (this.configService.get<string>('FRONTEND_URL') ?? '').replace(/\/+$/, '');
    return `${frontendUrl}${DEFAULT_PATH}`;
  }
}
