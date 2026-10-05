import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { EbayApiResource, EbayCallPriority, type EbayAdvertisingEligibilityDto } from '@repo/shared';
import axios from 'axios';

import { EbayCallBudgetService } from '../../common/ebay-budget/ebay-call-budget.service';

import { withEbayRateLimitRetry } from './ebay-http-retry';
import {
  EBAY_PROGRAM_PROMOTED_LISTINGS_STANDARD,
  readStandardEligibility,
  type AdvertisingEligibility,
} from './ebay-promoted.helpers';
import { EbayService } from './ebay.service';

/** How long one store's eligibility answer is reused. eBay changes it with seller standing, not by the hour. */
const ELIGIBILITY_TTL_MS = 6 * 60 * 60 * 1000;

/**
 * Read-only advertising eligibility. Campaign mutations live in the dedicated
 * ebay-campaigns module; this provider remains for the eligibility endpoint.
 */
@Injectable()
export class EbayPromotedListingsService {
  private readonly logger = new Logger(EbayPromotedListingsService.name);
  private readonly eligibilityCache = new Map<string, { at: number; value: AdvertisingEligibility }>();

  constructor(
    private readonly configService: ConfigService,
    private readonly ebayService: EbayService,
    private readonly budget: EbayCallBudgetService
  ) {}

  private base(): string {
    return String(this.configService.get('EBAY_REST_API_URL') ?? '');
  }

  /**
   * eBay's own answer to "may this store use Promoted Listings?"
   * (`GET /sell/account/v1/advertising_eligibility`). Unknown (nulls) when the
   * call fails — never "eligible" and never "ineligible" by assumption.
   */
  async getEligibility(
    accountId: string,
    priority: EbayCallPriority = EbayCallPriority.BACKGROUND
  ): Promise<EbayAdvertisingEligibilityDto> {
    const cached = this.eligibilityCache.get(accountId);
    if (cached && Date.now() - cached.at < ELIGIBILITY_TTL_MS) {
      return cached.value;
    }
    try {
      const context = await this.ebayService.getAccountApiContext(accountId);
      const response = await withEbayRateLimitRetry(
        () =>
          axios.get(`${this.base()}/sell/account/v1/advertising_eligibility`, {
            params: { program_types: EBAY_PROGRAM_PROMOTED_LISTINGS_STANDARD },
            headers: {
              Authorization: `Bearer ${context.accessToken}`,
              'X-EBAY-C-MARKETPLACE-ID': context.marketplaceId,
            },
          }),
        { logger: this.logger, acquireBudget: () => this.budget.acquire(EbayApiResource.ACCOUNT, priority) }
      );
      const value = readStandardEligibility(response.data);
      this.eligibilityCache.set(accountId, { at: Date.now(), value });
      return value;
    } catch (error: unknown) {
      this.logger.warn(
        `Advertising eligibility unavailable for store ${accountId}: ${error instanceof Error ? error.message : 'unknown'}`
      );
      return { status: null, reason: null };
    }
  }
}
