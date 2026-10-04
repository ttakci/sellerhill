import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { CampaignAction, EbayApiResource, EbayCallPriority } from '@repo/shared';
import axios from 'axios';

import { EbayBudgetExhaustedError } from '../../common/ebay-budget/ebay-budget.errors';
import { EbayCallBudgetService } from '../../common/ebay-budget/ebay-call-budget.service';
import { withEbayRateLimitRetry } from '../ebay/ebay-http-retry';
import {
  EBAY_ERROR_CAMPAIGN_NAME_EXISTS,
  EBAY_FUNDING_MODEL_COST_PER_SALE,
  formatCampaignDate,
  parseCampaignIdFromLocation,
  readEbayErrorIds,
} from '../ebay/ebay-promoted.helpers';

export type AccountContext = { accessToken: string; marketplaceId: string };

const CAMPAIGN_START_LEAD_MS = 2 * 60 * 1000;
const PATH = '/sell/marketing/v1/ad_campaign';

/**
 * Thin eBay Marketing API client (Promoted Listings, general strategy). No
 * service logic: every method is one documented call, budget-charged to the
 * `sell.marketing.ads.campaign` pool before each attempt.
 *
 * The writes are safe to retry: an ad that already exists answers 35036 and a
 * deleted one is simply gone.
 */
@Injectable()
export class EbayMarketingClient {
  private readonly logger = new Logger(EbayMarketingClient.name);

  constructor(
    private readonly config: ConfigService,
    private readonly budget: EbayCallBudgetService
  ) {}

  private base(): string {
    return `${String(this.config.get('EBAY_REST_API_URL') ?? '')}${PATH}`;
  }

  private headers(ctx: AccountContext, json = false): Record<string, string> {
    return {
      Authorization: `Bearer ${ctx.accessToken}`,
      'X-EBAY-C-MARKETPLACE-ID': ctx.marketplaceId,
      ...(json ? { 'Content-Type': 'application/json' } : {}),
    };
  }

  private options(priority: EbayCallPriority) {
    return {
      logger: this.logger,
      acquireBudget: () => this.budget.acquire(EbayApiResource.MARKETING_ADS, priority),
    };
  }

  async getCampaigns(ctx: AccountContext, offset: number, priority: EbayCallPriority): Promise<unknown> {
    const response = await withEbayRateLimitRetry(
      () => axios.get(this.base(), { params: { limit: 500, offset }, headers: this.headers(ctx) }),
      this.options(priority)
    );
    return response.data as unknown;
  }

  async getCampaign(ctx: AccountContext, campaignId: string, priority: EbayCallPriority): Promise<unknown> {
    const response = await withEbayRateLimitRetry(
      () => axios.get(`${this.base()}/${encodeURIComponent(campaignId)}`, { headers: this.headers(ctx) }),
      this.options(priority)
    );
    return response.data as unknown;
  }

  async getAds(
    ctx: AccountContext,
    campaignId: string,
    params: { listingIds?: string[]; limit: number; offset?: number },
    priority: EbayCallPriority
  ): Promise<unknown> {
    const query: Record<string, string | number> = { limit: params.limit, offset: params.offset ?? 0 };
    if (params.listingIds && params.listingIds.length > 0) {
      query.listing_ids = params.listingIds.join(',');
    }
    const response = await withEbayRateLimitRetry(
      () =>
        axios.get(`${this.base()}/${encodeURIComponent(campaignId)}/ad`, {
          params: query,
          headers: this.headers(ctx),
        }),
      this.options(priority)
    );
    return response.data as unknown;
  }

  async createCampaign(
    ctx: AccountContext,
    name: string,
    bid: string
  ): Promise<{ campaignId: string | null; nameTaken: boolean }> {
    try {
      const response = await withEbayRateLimitRetry(
        () =>
          axios.post(
            this.base(),
            {
              campaignName: name,
              startDate: formatCampaignDate(new Date(Date.now() + CAMPAIGN_START_LEAD_MS)),
              marketplaceId: ctx.marketplaceId,
              fundingStrategy: {
                fundingModel: EBAY_FUNDING_MODEL_COST_PER_SALE,
                adRateStrategy: 'FIXED',
                bidPercentage: bid,
              },
            },
            { headers: this.headers(ctx, true) }
          ),
        this.options(EbayCallPriority.INTERACTIVE)
      );
      const fromHeader = parseCampaignIdFromLocation((response.headers as Record<string, unknown> | undefined)?.location);
      if (fromHeader) {
        return { campaignId: fromHeader, nameTaken: false };
      }
      const byName = await withEbayRateLimitRetry(
        () =>
          axios.get(`${this.base()}/get_campaign_by_name`, {
            params: { campaign_name: name },
            headers: this.headers(ctx),
          }),
        this.options(EbayCallPriority.INTERACTIVE)
      );
      const id = (byName.data as { campaignId?: unknown } | undefined)?.campaignId;
      return { campaignId: typeof id === 'string' && id ? id : null, nameTaken: false };
    } catch (error: unknown) {
      if (
        axios.isAxiosError(error) &&
        readEbayErrorIds(error.response?.data).includes(EBAY_ERROR_CAMPAIGN_NAME_EXISTS)
      ) {
        return { campaignId: null, nameTaken: true };
      }
      throw error;
    }
  }

  bulkCreateAds(ctx: AccountContext, campaignId: string, listingIds: string[], bid: string): Promise<unknown> {
    return this.bulk(ctx, campaignId, 'bulk_create_ads_by_listing_id', {
      requests: listingIds.map((listingId) => ({ listingId, bidPercentage: bid })),
    });
  }

  bulkDeleteAds(ctx: AccountContext, campaignId: string, listingIds: string[]): Promise<unknown> {
    return this.bulk(ctx, campaignId, 'bulk_delete_ads_by_listing_id', {
      requests: listingIds.map((listingId) => ({ listingId })),
    });
  }

  bulkUpdateBids(ctx: AccountContext, campaignId: string, listingIds: string[], bid: string): Promise<unknown> {
    return this.bulk(ctx, campaignId, 'bulk_update_ads_bid_by_listing_id', {
      requests: listingIds.map((listingId) => ({ listingId, bidPercentage: bid })),
    });
  }

  async updateDefaultRate(ctx: AccountContext, campaignId: string, bid: string): Promise<void> {
    await withEbayRateLimitRetry(
      () =>
        axios.post(
          `${this.base()}/${encodeURIComponent(campaignId)}/update_ad_rate_strategy`,
          { adRateStrategy: 'FIXED', bidPercentage: bid },
          { headers: this.headers(ctx, true) }
        ),
      this.options(EbayCallPriority.INTERACTIVE)
    );
  }

  async campaignAction(ctx: AccountContext, campaignId: string, action: CampaignAction): Promise<void> {
    await withEbayRateLimitRetry(
      () =>
        axios.post(`${this.base()}/${encodeURIComponent(campaignId)}/${action}`, undefined, {
          headers: this.headers(ctx, true),
        }),
      this.options(EbayCallPriority.INTERACTIVE)
    );
  }

  /** A 207 / 4xx still carries `responses[]`; hand that body back instead of throwing. */
  private async bulk(ctx: AccountContext, campaignId: string, endpoint: string, body: unknown): Promise<unknown> {
    try {
      const response = await withEbayRateLimitRetry(
        () =>
          axios.post(`${this.base()}/${encodeURIComponent(campaignId)}/${endpoint}`, body, {
            headers: this.headers(ctx, true),
          }),
        this.options(EbayCallPriority.INTERACTIVE)
      );
      return response.data as unknown;
    } catch (error: unknown) {
      if (error instanceof EbayBudgetExhaustedError) {
        throw error;
      }
      const data: unknown = axios.isAxiosError(error) ? error.response?.data : undefined;
      if (data !== undefined && data !== null && data !== '') {
        return data;
      }
      throw error;
    }
  }
}
