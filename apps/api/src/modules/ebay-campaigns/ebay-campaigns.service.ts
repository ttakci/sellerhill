import { Injectable } from '@nestjs/common';
import {
  campaignReadOnlyReason,
  EbayCallPriority,
  ListingStatus,
  type CampaignCandidatesQuery,
  type CampaignListingDto,
  type EbayCampaignDetailDto,
  type EbayCampaignDto,
  type EbayCampaignListDto,
  type CampaignCandidatesDto,
} from '@repo/shared';

import { DatabaseService } from '../../common/database/database.service';
import { EbayPromotedListingsService } from '../ebay/ebay-promoted-listings.service';

import { CampaignActionError } from './ebay-campaign-actions.service';
import { EbayCampaignSyncService } from './ebay-campaign-sync.service';

interface CampaignRow {
  id: string;
  ebay_account_id: string;
  campaign_id: string;
  name: string;
  status: string;
  funding_model: string | null;
  ad_rate_strategy: string | null;
  bid_percentage: string | null;
  rule_based: boolean;
  created_by_sellerhill: boolean;
  start_date: Date | null;
  end_date: Date | null;
  ad_count: number | null;
  seller_hill_listing_count: string;
  synced_at: Date;
  metrics: Record<string, number> | null;
  metrics_from: Date | null;
  metrics_to: Date | null;
}
interface ListingRow {
  id: string;
  ebay_item_id: string;
  title: string;
  image_url: string | null;
  price: string | null;
  promoted_ad_rate: string | null;
  ad_rate_applied: string;
  lock_price: boolean;
  margin_percent_override: string | null;
  margin_fixed_override: string | null;
}

@Injectable()
export class EbayCampaignsService {
  private readonly refreshes = new Map<string, { completedAt: number | null; promise: Promise<unknown> }>();
  constructor(
    private readonly database: DatabaseService,
    private readonly eligibility: EbayPromotedListingsService,
    private readonly sync: EbayCampaignSyncService
  ) {}

  private async account(userId: string, accountId: string): Promise<{ id: string; user_id: string }> {
    const rows = await this.database.query<{ id: string; user_id: string }>(
      'SELECT id, user_id FROM ebay_accounts WHERE id = $1 AND user_id = $2 AND status = $3',
      [accountId, userId, 'active']
    );
    if (!rows[0]) {
      throw new CampaignActionError('campaigns.errors.storeUnavailable', 404);
    }
    return rows[0];
  }

  private campaign(row: CampaignRow): EbayCampaignDto {
    return {
      id: row.id,
      ebayAccountId: row.ebay_account_id,
      campaignId: row.campaign_id,
      name: row.name,
      status: row.status,
      fundingModel: row.funding_model,
      adRateStrategy: row.ad_rate_strategy,
      bidPercentage: row.bid_percentage === null ? null : Number(row.bid_percentage),
      ruleBased: row.rule_based,
      createdBySellerHill: row.created_by_sellerhill,
      startDate: row.start_date?.toISOString() ?? null,
      endDate: row.end_date?.toISOString() ?? null,
      adCount: row.ad_count,
      sellerHillListingCount: Number(row.seller_hill_listing_count),
      readOnlyReason: campaignReadOnlyReason({
        status: row.status,
        fundingModel: row.funding_model,
        adRateStrategy: row.ad_rate_strategy,
        ruleBased: row.rule_based,
      }),
      syncedAt: row.synced_at.toISOString(),
      metrics: row.metrics,
      metricsFrom: row.metrics_from?.toISOString().slice(0, 10) ?? null,
      metricsTo: row.metrics_to?.toISOString().slice(0, 10) ?? null,
    };
  }

  private async campaignRows(accountId: string, campaignId?: string): Promise<CampaignRow[]> {
    return this.database.query<CampaignRow>(
      `SELECT c.*, COUNT(l.id) FILTER (WHERE l.promoted_campaign_id = c.campaign_id)::text AS seller_hill_listing_count
       FROM ebay_campaigns c LEFT JOIN listings l ON l.ebay_account_id = c.ebay_account_id AND l.promoted_campaign_id = c.campaign_id
       WHERE c.ebay_account_id = $1 ${campaignId ? 'AND c.campaign_id = $2' : ''}
       GROUP BY c.id ORDER BY c.created_at DESC`,
      campaignId ? [accountId, campaignId] : [accountId]
    );
  }

  private listing(row: ListingRow): CampaignListingDto {
    return {
      listingId: row.id,
      ebayItemId: row.ebay_item_id,
      title: row.title,
      imageUrl: row.image_url,
      price: row.price === null ? null : Number(row.price),
      adRate: row.promoted_ad_rate === null ? null : Number(row.promoted_ad_rate),
      appliedAdRate: Number(row.ad_rate_applied),
      priceLocked: row.lock_price,
      hasMarginOverride: row.margin_percent_override !== null || row.margin_fixed_override !== null,
    };
  }

  private async listings(accountId: string, campaignId: string): Promise<CampaignListingDto[]> {
    const rows = await this.database.query<ListingRow>(
      `SELECT l.id, l.ebay_item_id, l.title, p.image_urls->>0 AS image_url, l.price,
         l.promoted_ad_rate, l.ad_rate_applied, l.margin_percent_override, l.margin_fixed_override,
         (l.lock_price OR l.disable_repricing OR l.price_override IS NOT NULL) AS lock_price
       FROM listings l LEFT JOIN products p ON p.id = l.product_id
       WHERE l.ebay_account_id = $1 AND l.promoted_campaign_id = $2 ORDER BY l.created_at DESC`,
      [accountId, campaignId]
    );
    return rows.map((row) => this.listing(row));
  }

  async list(
    userId: string,
    accountId: string
  ): Promise<EbayCampaignListDto> {
    await this.account(userId, accountId);
    const [rows, eligibility] = await Promise.all([
      this.campaignRows(accountId),
      this.eligibility.getEligibility(accountId, EbayCallPriority.INTERACTIVE),
    ]);
    return { campaigns: rows.map((row) => this.campaign(row)), eligibility };
  }

  async candidates(
    userId: string,
    query: CampaignCandidatesQuery
  ): Promise<CampaignCandidatesDto> {
    await this.account(userId, query.ebayAccountId);
    const page = query.page ?? 1;
    const limit = query.limit ?? 25;
    const group = query.listingSettingsGroupId ?? null;
    const search = query.search?.trim() || null;
    const params = [userId, query.ebayAccountId, ListingStatus.ACTIVE, group, search];
    const filter = `l.user_id = $1 AND l.ebay_account_id = $2 AND l.status = $3 AND l.ebay_item_id IS NOT NULL
       AND ($4::uuid IS NULL OR l.listing_settings_group_id = $4::uuid)
       AND ($5::text IS NULL OR l.title ILIKE '%' || $5 || '%' OR l.ebay_item_id ILIKE '%' || $5 || '%')`;
    const [counts] = await this.database.query<{ total: string; skipped: string }>(
      `SELECT COUNT(*) FILTER (WHERE l.promoted_campaign_id IS NULL)::text AS total,
         COUNT(*) FILTER (WHERE l.promoted_campaign_id IS NOT NULL)::text AS skipped
       FROM listings l WHERE ${filter}`,
      params
    );
    const rows = await this.database.query<ListingRow>(
      `SELECT l.id, l.ebay_item_id, l.title, p.image_urls->>0 AS image_url, l.price,
         l.promoted_ad_rate, l.ad_rate_applied, l.margin_percent_override, l.margin_fixed_override,
         (l.lock_price OR l.disable_repricing OR l.price_override IS NOT NULL) AS lock_price
       FROM listings l LEFT JOIN products p ON p.id = l.product_id
       WHERE ${filter} AND l.promoted_campaign_id IS NULL
       ORDER BY l.created_at DESC LIMIT $6 OFFSET $7`,
      [...params, limit, (page - 1) * limit]
    );
    return {
      items: rows.map((row) => this.listing(row)),
      total: Number(counts?.total ?? 0),
      page,
      limit,
      skippedInCampaign: Number(counts?.skipped ?? 0),
    };
  }

  async detail(userId: string, accountId: string, campaignId: string): Promise<EbayCampaignDetailDto> {
    const account = await this.account(userId, accountId);
    const now = Date.now();
    const cached = this.refreshes.get(accountId);
    if (cached && (cached.completedAt === null || now - cached.completedAt < 60_000)) {
      await cached.promise;
    } else {
      const entry: { completedAt: number | null; promise: Promise<unknown> } = {
        completedAt: null,
        promise: Promise.resolve(),
      };
      entry.promise = this.sync.syncAccount(account, EbayCallPriority.INTERACTIVE).then(
        (result) => {
          if (this.refreshes.get(accountId) === entry) {
            entry.completedAt = Date.now();
          }
          return result;
        },
        (error: unknown) => {
          if (this.refreshes.get(accountId) === entry) {
            this.refreshes.delete(accountId);
          }
          throw error;
        }
      );
      this.refreshes.set(accountId, entry);
      await entry.promise;
    }
    const [row] = await this.campaignRows(accountId, campaignId);
    if (!row) {
      throw new CampaignActionError('campaigns.errors.notFound', 404);
    }
    const [listings, eligibility] = await Promise.all([
      this.listings(accountId, campaignId),
      this.eligibility.getEligibility(accountId, EbayCallPriority.INTERACTIVE),
    ]);
    return { campaign: this.campaign(row), listings, eligibility };
  }
}
