import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { EbayApiResource, EbayCallPriority, type EbayAdvertisingEligibilityDto } from '@repo/shared';
import axios from 'axios';

import { DatabaseService } from '../../common/database/database.service';
import { EbayBudgetExhaustedError } from '../../common/ebay-budget/ebay-budget.errors';
import { EbayCallBudgetService } from '../../common/ebay-budget/ebay-call-budget.service';

import { withEbayRateLimitRetry } from './ebay-http-retry';
import {
  EBAY_BULK_ADS_MAX_PER_CALL,
  EBAY_ELIGIBILITY_INELIGIBLE,
  EBAY_ERROR_CAMPAIGN_ENDED,
  EBAY_ERROR_CAMPAIGN_NAME_EXISTS,
  EBAY_ERROR_CAMPAIGN_NOT_FOUND,
  EBAY_FUNDING_MODEL_COST_PER_SALE,
  EBAY_PROGRAM_PROMOTED_LISTINGS_STANDARD,
  EBAY_SELLER_NOT_ELIGIBLE_ERROR_IDS,
  PROMOTED_CAMPAIGN_NAME,
  formatBidPercentage,
  formatCampaignDate,
  parseCampaignIdFromLocation,
  readBulkAdResponse,
  readEbayErrorIds,
  readStandardEligibility,
  type AdvertisingEligibility,
} from './ebay-promoted.helpers';
import { EbayService } from './ebay.service';

/** How long one store's eligibility answer is reused. eBay changes it with seller standing, not by the hour. */
const ELIGIBILITY_TTL_MS = 6 * 60 * 60 * 1000;
/** The campaign's start must not be in the past; a small lead absorbs clock skew. */
const CAMPAIGN_START_LEAD_MS = 2 * 60 * 1000;

export interface PromoteResult {
  promoted: number;
  failed: number;
  /** Set when nothing was sent because eBay does not let this seller advertise. */
  skippedReason?: string;
}

/**
 * Promoted Listings, general strategy (cost per sale): put new listings into
 * one SellerHill campaign of the store at the seller's ad rate.
 *
 * Whether an ad actually runs is eBay's decision, not ours: a seller without
 * enough recent sales is INELIGIBLE (the production store's own answer on
 * 2026-10-02 was `NOT_ENOUGH_ACTIVITY`), and then nothing is sent at all.
 *
 * Everything here is fail-soft. A listing is already live when this runs, and
 * an advertising problem must never turn a successful publish into a failure.
 */
@Injectable()
export class EbayPromotedListingsService {
  private readonly logger = new Logger(EbayPromotedListingsService.name);
  private readonly eligibilityCache = new Map<string, { at: number; value: AdvertisingEligibility }>();

  constructor(
    private readonly configService: ConfigService,
    private readonly ebayService: EbayService,
    private readonly databaseService: DatabaseService,
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

  /**
   * Add live listings to the store's SellerHill campaign at `adRate` percent.
   * Never throws. `listingIds` are eBay item ids.
   */
  async promoteListings(accountId: string, listingIds: readonly string[], adRate: number): Promise<PromoteResult> {
    const ids = [...new Set(listingIds.filter(Boolean))];
    if (ids.length === 0) {
      return { promoted: 0, failed: 0 };
    }
    try {
      const eligibility = await this.getEligibility(accountId);
      if (eligibility.status === EBAY_ELIGIBILITY_INELIGIBLE) {
        return { promoted: 0, failed: 0, skippedReason: eligibility.reason ?? EBAY_ELIGIBILITY_INELIGIBLE };
      }

      const context = await this.ebayService.getAccountApiContext(accountId);
      const bid = formatBidPercentage(adRate);
      let campaignId = await this.ensureCampaign(accountId, context, bid);
      if (!campaignId) {
        return { promoted: 0, failed: ids.length };
      }

      let promoted = 0;
      let failed = 0;
      for (let start = 0; start < ids.length; start += EBAY_BULK_ADS_MAX_PER_CALL) {
        const chunk = ids.slice(start, start + EBAY_BULK_ADS_MAX_PER_CALL);
        let outcome = await this.bulkCreateAds(context.accessToken, campaignId, chunk, bid);
        // The stored campaign was ended or deleted on eBay: forget it, make a
        // new one and send this chunk again — once.
        if (outcome.campaignGone) {
          await this.storeCampaignId(accountId, null);
          campaignId = await this.ensureCampaign(accountId, context, bid);
          if (!campaignId) {
            failed += ids.length - start;
            break;
          }
          outcome = await this.bulkCreateAds(context.accessToken, campaignId, chunk, bid);
        }
        if (outcome.sellerNotEligible) {
          // eBay refused the SELLER; the eligibility answer we held is stale.
          this.eligibilityCache.delete(accountId);
          return { promoted, failed: ids.length - promoted, skippedReason: 'seller_not_eligible' };
        }
        promoted += outcome.promoted.length;
        failed += outcome.failed.length;
        if (outcome.promoted.length > 0) {
          await this.databaseService.query(
            `UPDATE listings SET promoted_ad_rate = $3::numeric
              WHERE ebay_account_id = $1 AND ebay_item_id = ANY($2::text[])`,
            [accountId, outcome.promoted, bid]
          );
        }
        if (outcome.failed.length > 0) {
          this.logger.warn(
            `Promoted Listings: ${outcome.failed.length} listing(s) of store ${accountId} got no ad ` +
              `(eBay error ids: ${[...new Set(outcome.failed.flatMap((item) => item.errorIds))].join(', ') || 'none'})`
          );
        }
      }
      return { promoted, failed };
    } catch (error: unknown) {
      if (!(error instanceof EbayBudgetExhaustedError)) {
        this.logger.warn(
          `Promoted Listings failed for store ${accountId}: ${error instanceof Error ? error.message : 'unknown'}`
        );
      }
      return { promoted: 0, failed: ids.length };
    }
  }

  private charge(): () => Promise<void> {
    return () => this.budget.acquire(EbayApiResource.MARKETING, EbayCallPriority.BACKGROUND);
  }

  /** The store's campaign id: the stored one, else one found by name, else a new campaign. */
  private async ensureCampaign(
    accountId: string,
    context: { accessToken: string; marketplaceId: string },
    bid: string
  ): Promise<string | null> {
    const stored = await this.databaseService.query<{ promoted_campaign_id: string | null }>(
      `SELECT promoted_campaign_id FROM ebay_accounts WHERE id = $1`,
      [accountId]
    );
    if (stored[0]?.promoted_campaign_id) {
      return stored[0].promoted_campaign_id;
    }

    const created =
      (await this.createCampaign(context, PROMOTED_CAMPAIGN_NAME, bid)) ??
      // The plain name is taken — by a campaign the seller ended, or one made
      // by hand. A dated name is unique without touching either.
      (await this.createCampaign(
        context,
        `${PROMOTED_CAMPAIGN_NAME} ${formatCampaignDate(new Date()).slice(0, 10)}`,
        bid
      ));
    if (created) {
      await this.storeCampaignId(accountId, created);
    }
    return created;
  }

  /** createCampaign; null when the name is already in use. Other refusals throw. */
  private async createCampaign(
    context: { accessToken: string; marketplaceId: string },
    campaignName: string,
    bid: string
  ): Promise<string | null> {
    try {
      const response = await withEbayRateLimitRetry(
        () =>
          axios.post(
            `${this.base()}/sell/marketing/v1/ad_campaign`,
            {
              campaignName,
              startDate: formatCampaignDate(new Date(Date.now() + CAMPAIGN_START_LEAD_MS)),
              marketplaceId: context.marketplaceId,
              fundingStrategy: { fundingModel: EBAY_FUNDING_MODEL_COST_PER_SALE, bidPercentage: bid },
            },
            { headers: { Authorization: `Bearer ${context.accessToken}`, 'Content-Type': 'application/json' } }
          ),
        { logger: this.logger, acquireBudget: this.charge() }
      );
      const id = parseCampaignIdFromLocation((response.headers as Record<string, unknown>)?.location);
      if (id) {
        return id;
      }
      // Created, but the Location header was unreadable: find it by its name.
      return await this.findCampaignIdByName(context.accessToken, campaignName);
    } catch (error: unknown) {
      const errorIds = axios.isAxiosError(error) ? readEbayErrorIds(error.response?.data) : [];
      if (errorIds.includes(EBAY_ERROR_CAMPAIGN_NAME_EXISTS)) {
        return null;
      }
      throw error;
    }
  }

  private async findCampaignIdByName(accessToken: string, campaignName: string): Promise<string | null> {
    const response = await withEbayRateLimitRetry(
      () =>
        axios.get(`${this.base()}/sell/marketing/v1/ad_campaign/get_campaign_by_name`, {
          params: { campaign_name: campaignName },
          headers: { Authorization: `Bearer ${accessToken}` },
        }),
      { logger: this.logger, acquireBudget: this.charge() }
    );
    const id = (response.data as { campaignId?: unknown } | undefined)?.campaignId;
    return typeof id === 'string' && id ? id : null;
  }

  private async bulkCreateAds(
    accessToken: string,
    campaignId: string,
    listingIds: string[],
    bid: string
  ): Promise<{
    promoted: string[];
    failed: Array<{ listingId: string; errorIds: number[] }>;
    campaignGone: boolean;
    sellerNotEligible: boolean;
  }> {
    try {
      const response = await withEbayRateLimitRetry(
        () =>
          axios.post(
            `${this.base()}/sell/marketing/v1/ad_campaign/${encodeURIComponent(campaignId)}/bulk_create_ads_by_listing_id`,
            { requests: listingIds.map((listingId) => ({ listingId, bidPercentage: bid })) },
            { headers: { Authorization: `Bearer ${accessToken}`, 'Content-Type': 'application/json' } }
          ),
        { logger: this.logger, acquireBudget: this.charge() }
      );
      return { ...readBulkAdResponse(response.data, listingIds), campaignGone: false, sellerNotEligible: false };
    } catch (error: unknown) {
      if (error instanceof EbayBudgetExhaustedError) {
        throw error;
      }
      const data: unknown = axios.isAxiosError(error) ? error.response?.data : undefined;
      // A whole-call refusal still carries per-listing answers when eBay got
      // that far (the 207 / 4xx bodies share the `responses` shape).
      const partial = readBulkAdResponse(data, listingIds);
      const errorIds = [...readEbayErrorIds(data), ...partial.failed.flatMap((item) => item.errorIds)];
      return {
        ...partial,
        campaignGone:
          errorIds.includes(EBAY_ERROR_CAMPAIGN_ENDED) || errorIds.includes(EBAY_ERROR_CAMPAIGN_NOT_FOUND),
        sellerNotEligible: errorIds.some((id) => EBAY_SELLER_NOT_ELIGIBLE_ERROR_IDS.has(id)),
      };
    }
  }

  private async storeCampaignId(accountId: string, campaignId: string | null): Promise<void> {
    await this.databaseService.query(`UPDATE ebay_accounts SET promoted_campaign_id = $2 WHERE id = $1`, [
      accountId,
      campaignId,
    ]);
  }
}
