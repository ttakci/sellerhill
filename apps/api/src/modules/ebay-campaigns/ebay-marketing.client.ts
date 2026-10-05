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

import { CAMPAIGN_PAGE_LIMIT } from './ebay-campaigns.constants';

export type AccountContext = { accessToken: string; marketplaceId: string };

export interface CampaignReportRequest {
  reportType: string;
  reportFormat: string;
  marketplaceId: string;
  dateFrom: string;
  dateTo: string;
  fundingModels: string[];
  campaignIds: string[];
  dimensions: Array<{ dimensionKey: string; annotationKeys: string[] }>;
  metricKeys: string[];
}

export interface CampaignReportTask {
  reportTaskStatus?: string;
  reportTaskStatusMessage?: string;
  reportHref?: string;
  reportId?: string;
}

const REPORT_TASK_PATH = '/sell/marketing/v1/ad_report_task';
const REPORT_PATH = '/sell/marketing/v1/ad_report';

const CAMPAIGN_START_LEAD_MS = 2 * 60 * 1000;
const PATH = '/sell/marketing/v1/ad_campaign';

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function matchesCreateRequest(
  value: unknown,
  request: { campaignName: string; startDate: string; marketplaceId: string; fundingStrategy: { fundingModel: string; adRateStrategy: string; bidPercentage: string } }
): value is Record<string, unknown> & { campaignId: string } {
  if (!isRecord(value) || !isRecord(value.fundingStrategy)) {
    return false;
  }
  const funding = value.fundingStrategy;
  return (
    typeof value.campaignId === 'string' && value.campaignId !== '' &&
    value.campaignName === request.campaignName &&
    value.startDate === request.startDate &&
    value.marketplaceId === request.marketplaceId &&
    funding.fundingModel === request.fundingStrategy.fundingModel &&
    funding.adRateStrategy === request.fundingStrategy.adRateStrategy &&
    funding.bidPercentage === request.fundingStrategy.bidPercentage
  );
}

function isAmbiguousCreateFailure(error: unknown): boolean {
  return axios.isAxiosError(error) && (
    !error.response || error.response.status === 429 || error.response.status >= 500
  );
}

/**
 * Thin eBay Marketing API client (Promoted Listings, general strategy). No
 * service logic: every method is one documented call, budget-charged to the
 * `sell.marketing.ads.campaign` pool before each attempt.
 *
 * Campaign creation is sent once because an ambiguous 5xx or transport failure
 * can mean eBay accepted the POST. Other calls use the shared retry policy.
 */
@Injectable()
export class EbayMarketingClient {
  private readonly logger = new Logger(EbayMarketingClient.name);

  async createReportTask(ctx: AccountContext, request: CampaignReportRequest): Promise<string> {
    const endpoint = this.reportUrl(REPORT_TASK_PATH);
    const response = await withEbayRateLimitRetry(
      () => axios.post(endpoint, request, { headers: this.headers(ctx, true), maxRedirects: 0 }),
      { logger: this.logger }
    );
    const location = (response.headers as Record<string, unknown> | undefined)?.location;
    return this.reportIdFromLocation(location, REPORT_TASK_PATH);
  }

  async getReportTask(ctx: AccountContext, taskId: string): Promise<CampaignReportTask> {
    const response = await withEbayRateLimitRetry(
      () => axios.get(`${this.reportUrl(REPORT_TASK_PATH)}/${encodeURIComponent(taskId)}`, {
        headers: this.headers(ctx), maxRedirects: 0,
      }),
      { logger: this.logger }
    );
    return response.data as CampaignReportTask;
  }

  async downloadReport(ctx: AccountContext, reportId: string): Promise<Buffer> {
    const response = await withEbayRateLimitRetry(
      () => axios.get(`${this.reportUrl(REPORT_PATH)}/${encodeURIComponent(reportId)}`, {
        headers: this.headers(ctx), responseType: 'arraybuffer', maxRedirects: 0, decompress: false,
      }),
      { logger: this.logger }
    );
    return Buffer.from(response.data as ArrayBuffer);
  }

  private reportUrl(endpoint: string): string {
    return `${String(this.config.get('EBAY_REST_API_URL') ?? '').replace(/\/$/, '')}${endpoint}`;
  }

  private reportIdFromLocation(location: unknown, endpoint: string): string {
    if (typeof location !== 'string' || !location) {
      throw new Error('eBay report task response has no Location');
    }
    const configured = new URL(this.reportUrl(endpoint));
    const received = new URL(location, configured);
    const prefix = `${endpoint}/`;
    if (
      received.protocol !== configured.protocol || received.origin !== configured.origin ||
      !received.pathname.startsWith(prefix) || received.search || received.hash
    ) {
      throw new Error('eBay report task Location is untrusted');
    }
    const encoded = received.pathname.slice(prefix.length);
    if (!encoded || encoded.includes('/')) {
      throw new Error('eBay report task Location has no valid task id');
    }
    const id = decodeURIComponent(encoded);
    if (!id) {
      throw new Error('eBay report task Location has no valid task id');
    }
    return id;
  }

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
      () => axios.get(this.base(), { params: { limit: CAMPAIGN_PAGE_LIMIT, offset }, headers: this.headers(ctx) }),
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
    const request = {
      campaignName: name,
      startDate: formatCampaignDate(new Date(Date.now() + CAMPAIGN_START_LEAD_MS)),
      marketplaceId: ctx.marketplaceId,
      fundingStrategy: {
        fundingModel: EBAY_FUNDING_MODEL_COST_PER_SALE,
        adRateStrategy: 'FIXED',
        bidPercentage: bid,
      },
    };
    let postError: unknown;
    try {
      const response = await withEbayRateLimitRetry(
        () => axios.post(this.base(), request, { headers: this.headers(ctx, true) }),
        { ...this.options(EbayCallPriority.INTERACTIVE), maxAttempts: 1 }
      );
      const fromHeader = parseCampaignIdFromLocation((response.headers as Record<string, unknown> | undefined)?.location);
      if (fromHeader) {
        return { campaignId: fromHeader, nameTaken: false };
      }
    } catch (error: unknown) {
      if (
        axios.isAxiosError(error) &&
        readEbayErrorIds(error.response?.data).includes(EBAY_ERROR_CAMPAIGN_NAME_EXISTS)
      ) {
        return { campaignId: null, nameTaken: true };
      }
      if (!isAmbiguousCreateFailure(error)) {
        throw error;
      }
      postError = error;
    }
    try {
      const byName = await withEbayRateLimitRetry(
        () => axios.get(`${this.base()}/get_campaign_by_name`, {
          params: { campaign_name: name },
          headers: this.headers(ctx),
        }),
        this.options(EbayCallPriority.INTERACTIVE)
      );
      const campaign: unknown = byName.data;
      if (matchesCreateRequest(campaign, request)) {
        return { campaignId: campaign.campaignId, nameTaken: false };
      }
    } catch (error: unknown) {
      if (error instanceof EbayBudgetExhaustedError) {
        throw error;
      }
      if (!postError) {
        throw error;
      }
    }
    if (postError) {
      throw postError;
    }
    throw new Error('eBay campaign create response could not be verified by name');
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

  /** Only documented per-item bulk responses can be handled by the caller. */
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
      const status = axios.isAxiosError(error) ? error.response?.status : undefined;
      if ((status === 400 || status === 207) && isRecord(data) && Array.isArray(data.responses) && !Array.isArray(data.errors)) {
        return data;
      }
      throw error;
    }
  }
}
