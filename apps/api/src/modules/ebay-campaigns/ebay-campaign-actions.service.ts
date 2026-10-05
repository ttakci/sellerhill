import { Injectable, Logger } from '@nestjs/common';
import {
  CampaignAction,
  CampaignAddOutcome,
  campaignReadOnlyReason,
  EbayCallPriority,
  isValidBidPercentage,
  ListingStatus,
  resolveAppliedAdRate,
  type CampaignListingsRequest,
  type CampaignRateRequest,
  type CampaignWriteResultDto,
  type CreateCampaignRequest,
  type EbayCampaignDto,
} from '@repo/shared';
import { isUUID } from 'class-validator';
import type { PoolClient } from 'pg';

import { DatabaseService } from '../../common/database/database.service';
import { QuotaEnforcementService } from '../billing/quota-enforcement.service';
import { EbayPromotedListingsService } from '../ebay/ebay-promoted-listings.service';
import {
  EBAY_BULK_ADS_MAX_PER_CALL,
  EBAY_ERROR_AD_ALREADY_EXISTS,
  formatBidPercentage,
} from '../ebay/ebay-promoted.helpers';
import { EbayService } from '../ebay/ebay.service';

import { CampaignAccountLockService } from './campaign-account-lock.service';
import { CampaignAdStateRepository } from './campaign-ad-state.repository';
import { readBulkListingResponse, readCampaignsPage, type ParsedCampaign } from './campaign-readers';
import { EbayCampaignSyncService } from './ebay-campaign-sync.service';
import { EbayMarketingClient } from './ebay-marketing.client';

export class CampaignActionError extends Error {
  constructor(
    public readonly key: string,
    public readonly status: number,
    public readonly reason?: string
  ) {
    super(key);
  }
}

interface Account {
  id: string;
  user_id: string;
  status: string;
}
interface CampaignRow {
  campaign_id: string;
  name: string;
  status: string;
  funding_model: string | null;
  ad_rate_strategy: string | null;
  bid_percentage: string | number | null;
  rule_based: boolean;
}
interface ListingRow {
  id: string;
  ebay_item_id: string;
  product_id: string;
  promoted_campaign_id: string | null;
  promoted_ad_rate: string | number | null;
  ad_rate_applied: string | number;
}

function validListingIds(value: unknown): value is string[] {
  return (
    Array.isArray(value) &&
    value.length > 0 &&
    value.every((id) => typeof id === 'string' && isUUID(id)) &&
    new Set(value).size === value.length
  );
}

@Injectable()
export class EbayCampaignActionsService {
  private readonly logger = new Logger(EbayCampaignActionsService.name);
  constructor(
    private readonly database: DatabaseService,
    private readonly client: EbayMarketingClient,
    private readonly eligibility: EbayPromotedListingsService,
    private readonly quota: QuotaEnforcementService,
    private readonly ebay: EbayService,
    private readonly repository: CampaignAdStateRepository,
    private readonly sync: EbayCampaignSyncService,
    private readonly accountLock: CampaignAccountLockService
  ) {}

  private async assertWritable(
    userId: string,
    accountId: string,
    campaignId?: string,
    sendsStoredRate = false
  ): Promise<{ account: Account; campaign?: CampaignRow }> {
    const accounts = await this.database.query<Account>(
      'SELECT id, user_id, status FROM ebay_accounts WHERE id = $1 AND user_id = $2',
      [accountId, userId]
    );
    const account = accounts[0];
    if (!account || account.status !== 'active') {
      throw new CampaignActionError('campaigns.errors.storeUnavailable', 404);
    }
    if (await this.quota.isSuspended(userId)) {
      throw new CampaignActionError('campaigns.errors.suspended', 403);
    }
    let campaign: CampaignRow | undefined;
    if (campaignId) {
      const campaigns = await this.database.query<CampaignRow>(
        'SELECT * FROM ebay_campaigns WHERE ebay_account_id = $1 AND campaign_id = $2',
        [accountId, campaignId]
      );
      campaign = campaigns[0];
      if (!campaign) {
        throw new CampaignActionError('campaigns.errors.notFound', 404);
      }
      if (sendsStoredRate) {
        this.validateRate(Number(campaign.bid_percentage));
      }
    }
    if ((await this.eligibility.getEligibility(accountId, EbayCallPriority.INTERACTIVE)).status === 'INELIGIBLE') {
      throw new CampaignActionError('campaigns.errors.ineligible', 409);
    }
    if (!campaignId) {
      return { account };
    }
    const reason = campaignReadOnlyReason({
      status: campaign!.status,
      fundingModel: campaign!.funding_model,
      adRateStrategy: campaign!.ad_rate_strategy,
      ruleBased: campaign!.rule_based,
    });
    if (reason) {
      throw new CampaignActionError('campaigns.errors.readOnly', 409, reason);
    }
    return { account, campaign };
  }

  private validateRate(rate: unknown): asserts rate is number {
    if (!isValidBidPercentage(rate)) {
      throw new CampaignActionError('campaigns.errors.invalidRate', 400);
    }
  }

  private validateListings(ids: unknown): asserts ids is string[] {
    if (!validListingIds(ids)) {
      throw new CampaignActionError('campaigns.errors.notFound', 400);
    }
  }

  private async audit(
    userId: string,
    accountId: string,
    campaignId: string,
    kind: string,
    requested: number,
    ok: number,
    failed: number
  ): Promise<void> {
    try {
      await this.database.query(
        "INSERT INTO audit_logs (user_id, action, resource_type, resource_id, details) VALUES ($1, 'EBAY_CAMPAIGN_ACTION', 'ebay_campaign', $2, $3)",
        [
          userId,
          campaignId,
          JSON.stringify({
            ebayAccountId: accountId,
            campaignId,
            kind,
            requested,
            ok,
            failed,
            at: new Date().toISOString(),
          }),
        ]
      );
    } catch (error: unknown) {
      this.logger.warn(`Campaign audit failed: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  private async ebayCall<T>(call: () => Promise<T>): Promise<T> {
    try {
      return await call();
    } catch (error: unknown) {
      if (error instanceof CampaignActionError) {
        throw error;
      }
      this.logger.warn(`Campaign Marketing call rejected: ${error instanceof Error ? error.message : String(error)}`);
      throw new CampaignActionError('campaigns.errors.ebayRejected', 409);
    }
  }

  private async findListings(
    userId: string,
    accountId: string,
    ids: string[],
    campaignId: string | null,
    requireActive = false
  ): Promise<ListingRow[]> {
    const activeFilter = requireActive ? 'AND status = $3' : '';
    const itemFilter = requireActive
      ? 'AND ebay_item_id IS NOT NULL AND id = ANY($4::uuid[])'
      : 'AND ebay_item_id IS NOT NULL AND id = ANY($3::uuid[])';
    const membershipFilter =
      campaignId === null ? 'promoted_campaign_id IS NULL' : `promoted_campaign_id = $${requireActive ? 5 : 4}`;
    return this.database.query<ListingRow>(
      `SELECT id, ebay_item_id, product_id, promoted_campaign_id, promoted_ad_rate, ad_rate_applied
       FROM listings WHERE user_id = $1 AND ebay_account_id = $2 ${activeFilter}
         ${itemFilter} AND ${membershipFilter}`,
      requireActive
        ? campaignId === null
          ? [userId, accountId, ListingStatus.ACTIVE, ids]
          : [userId, accountId, ListingStatus.ACTIVE, ids, campaignId]
        : campaignId === null
          ? [userId, accountId, ids]
          : [userId, accountId, ids, campaignId]
    );
  }

  private async persistChanged(accountId: string, sql: string, params: unknown[]): Promise<void> {
    await this.database.transaction(async (client: PoolClient) => {
      await client.query('SELECT id FROM ebay_accounts WHERE id = $1 FOR UPDATE', [accountId]);
      const result = await client.query<{ product_id: string; changed: boolean }>(sql, params);
      await this.repository.recordPendingReprices(
        client,
        accountId,
        result.rows.filter((r) => r.changed).map((r) => r.product_id)
      );
    });
    await this.sync.flushPendingRepricing(accountId);
  }

  async create(userId: string, body: CreateCampaignRequest): Promise<EbayCampaignDto> {
    return this.accountLock.run(body.ebayAccountId, () => this.createLocked(userId, body));
  }

  private async createLocked(userId: string, body: CreateCampaignRequest): Promise<EbayCampaignDto> {
    const name = typeof body?.name === 'string' ? body.name.trim() : '';
    if (name.length < 1 || name.length > 80) {
      throw new CampaignActionError('campaigns.errors.invalidName', 400);
    }
    this.validateRate(body?.bidPercentage);
    const { account } = await this.assertWritable(userId, body.ebayAccountId);
    const ctx = await this.ebay.getAccountApiContext(account.id);
    let id = '';
    try {
      const created = await this.ebayCall(() =>
        this.client.createCampaign(ctx, name, formatBidPercentage(body.bidPercentage))
      );
      if (created.nameTaken) {
        throw new CampaignActionError('campaigns.errors.nameTaken', 409);
      }
      if (!created.campaignId) {
        throw new CampaignActionError('campaigns.errors.ebayRejected', 409);
      }
      id = created.campaignId;
      const parsed = this.parseCampaign(
        await this.ebayCall(() => this.client.getCampaign(ctx, id, EbayCallPriority.INTERACTIVE)),
        id
      );
      await this.repository.upsertCampaigns(account.id, [{ ...parsed, adCount: null }], false);
      await this.database.query(
        'UPDATE ebay_campaigns SET created_by_sellerhill = TRUE WHERE ebay_account_id = $1 AND campaign_id = $2',
        [account.id, id]
      );
      return await this.campaignDto(account.id, parsed, true);
    } finally {
      await this.audit(userId, account.id, id, 'create', 1, id ? 1 : 0, id ? 0 : 1);
    }
  }

  async add(userId: string, campaignId: string, body: CampaignListingsRequest): Promise<CampaignWriteResultDto> {
    return this.accountLock.run(body.ebayAccountId, () => this.addLocked(userId, campaignId, body));
  }

  private async addLocked(
    userId: string,
    campaignId: string,
    body: CampaignListingsRequest
  ): Promise<CampaignWriteResultDto> {
    this.validateListings(body?.listingIds);
    const { account, campaign } = await this.assertWritable(userId, body.ebayAccountId, campaignId, true);
    const rate = Number(campaign!.bid_percentage);
    this.validateRate(rate);
    const rows = await this.findListings(userId, account.id, body.listingIds, null, true);
    const byId = new Map(rows.map((row) => [row.id, row]));
    const eligible = body.listingIds.flatMap((id) => (byId.has(id) ? [byId.get(id)!] : []));
    const outcome = new Map<string, CampaignAddOutcome>(body.listingIds.map((id) => [id, CampaignAddOutcome.FAILED]));
    let ok = 0;
    try {
      if (eligible.length > 0) {
        const ctx = await this.ebay.getAccountApiContext(account.id);
        for (let i = 0; i < eligible.length; i += EBAY_BULK_ADS_MAX_PER_CALL) {
          const chunk = eligible.slice(i, i + EBAY_BULK_ADS_MAX_PER_CALL);
          const answer = readBulkListingResponse(
            await this.ebayCall(() =>
              this.client.bulkCreateAds(
                ctx,
                campaignId,
                chunk.map((r) => r.ebay_item_id),
                formatBidPercentage(rate)
              )
            ),
            chunk.map((r) => r.ebay_item_id)
          );
          const written = new Map<string, { campaignId: string; rate: number | null }>();
          for (const row of chunk) {
            const item = answer.find((a) => a.listingId === row.ebay_item_id)!;
            if (item.ok) {
              outcome.set(row.id, CampaignAddOutcome.ADDED);
              written.set(row.ebay_item_id, { campaignId, rate });
              ok++;
            } else if (item.errorIds.includes(EBAY_ERROR_AD_ALREADY_EXISTS)) {
              outcome.set(row.id, CampaignAddOutcome.ALREADY_IN_CAMPAIGN);
            }
          }
          if (written.size) {
            await this.repository.writeAdState(account.id, written, false);
          }
        }
        await this.sync.flushPendingRepricing(account.id);
      }
      return {
        campaignId,
        results: body.listingIds.map((listingId) => ({ listingId, outcome: outcome.get(listingId)! })),
      };
    } finally {
      await this.audit(userId, account.id, campaignId, 'add', body.listingIds.length, ok, body.listingIds.length - ok);
    }
  }

  async remove(userId: string, campaignId: string, body: CampaignListingsRequest): Promise<CampaignWriteResultDto> {
    return this.accountLock.run(body.ebayAccountId, () => this.removeLocked(userId, campaignId, body));
  }

  private async removeLocked(
    userId: string,
    campaignId: string,
    body: CampaignListingsRequest
  ): Promise<CampaignWriteResultDto> {
    this.validateListings(body?.listingIds);
    const { account } = await this.assertWritable(userId, body.ebayAccountId, campaignId);
    const rows = await this.findListings(userId, account.id, body.listingIds, campaignId);
    const byId = new Map(rows.map((row) => [row.id, row]));
    const outcome = new Map<string, CampaignAddOutcome>(body.listingIds.map((id) => [id, CampaignAddOutcome.FAILED]));
    let ok = 0;
    try {
      const ctx = await this.ebay.getAccountApiContext(account.id);
      for (let i = 0; i < rows.length; i += EBAY_BULK_ADS_MAX_PER_CALL) {
        const chunk = rows.slice(i, i + EBAY_BULK_ADS_MAX_PER_CALL);
        const answer = readBulkListingResponse(
          await this.ebayCall(() =>
            this.client.bulkDeleteAds(
              ctx,
              campaignId,
              chunk.map((r) => r.ebay_item_id)
            )
          ),
          chunk.map((r) => r.ebay_item_id)
        );
        const succeeded = chunk.filter((r) => answer.some((a) => a.listingId === r.ebay_item_id && a.ok));
        if (succeeded.length) {
          await this.persistChanged(
            account.id,
            `WITH old AS MATERIALIZED (SELECT id, product_id, ad_rate_applied FROM listings WHERE user_id = $1 AND ebay_account_id = $2 AND promoted_campaign_id = $3 AND id = ANY($4::uuid[]))
             UPDATE listings l SET promoted_campaign_id = NULL, promoted_ad_rate = NULL, promoted_ad_strategy = NULL, promoted_synced_at = NULL, ad_rate_applied = 0
             FROM old WHERE l.id = old.id RETURNING l.product_id, (old.ad_rate_applied > 0) AS changed`,
            [userId, account.id, campaignId, succeeded.map((r) => r.id)]
          );
          for (const row of succeeded) {
            outcome.set(row.id, CampaignAddOutcome.ADDED);
            ok++;
          }
        }
      }
      return {
        campaignId,
        results: body.listingIds.map((listingId) => ({
          listingId,
          outcome: byId.has(listingId) ? outcome.get(listingId)! : CampaignAddOutcome.FAILED,
        })),
      };
    } finally {
      await this.audit(
        userId,
        account.id,
        campaignId,
        'remove',
        body.listingIds.length,
        ok,
        body.listingIds.length - ok
      );
    }
  }

  async rate(userId: string, campaignId: string, body: CampaignRateRequest): Promise<CampaignWriteResultDto> {
    return this.accountLock.run(body.ebayAccountId, () => this.rateLocked(userId, campaignId, body));
  }

  private async rateLocked(
    userId: string,
    campaignId: string,
    body: CampaignRateRequest
  ): Promise<CampaignWriteResultDto> {
    this.validateRate(body?.bidPercentage);
    if (body.listingIds !== undefined) {
      this.validateListings(body.listingIds);
    }
    const { account, campaign } = await this.assertWritable(userId, body.ebayAccountId, campaignId);
    const ids = body.listingIds;
    const rows = ids
      ? await this.findListings(userId, account.id, ids, campaignId)
      : await this.database.query<ListingRow>(
          'SELECT id, ebay_item_id, product_id, promoted_campaign_id, promoted_ad_rate, ad_rate_applied FROM listings WHERE user_id = $1 AND ebay_account_id = $2 AND promoted_campaign_id = $3',
          [userId, account.id, campaignId]
        );
    const outcome = new Map<string, CampaignAddOutcome>(
      (ids ?? rows.map((r) => r.id)).map((id) => [id, CampaignAddOutcome.FAILED])
    );
    let ok = 0;
    try {
      const ctx = await this.ebay.getAccountApiContext(account.id);
      if (!ids) {
        await this.ebayCall(() =>
          this.client.updateDefaultRate(ctx, campaignId, formatBidPercentage(body.bidPercentage))
        );
        await this.database.query(
          'UPDATE ebay_campaigns SET bid_percentage = $3 WHERE ebay_account_id = $1 AND campaign_id = $2',
          [account.id, campaignId, body.bidPercentage]
        );
      }
      for (let i = 0; i < rows.length; i += EBAY_BULK_ADS_MAX_PER_CALL) {
        const chunk = rows.slice(i, i + EBAY_BULK_ADS_MAX_PER_CALL);
        const answer = readBulkListingResponse(
          await this.ebayCall(() =>
            this.client.bulkUpdateBids(
              ctx,
              campaignId,
              chunk.map((r) => r.ebay_item_id),
              formatBidPercentage(body.bidPercentage)
            )
          ),
          chunk.map((r) => r.ebay_item_id)
        );
        const succeeded = chunk.filter((r) => answer.some((a) => a.listingId === r.ebay_item_id && a.ok));
        if (succeeded.length) {
          const applied = resolveAppliedAdRate({
            rate: body.bidPercentage,
            strategy: campaign!.ad_rate_strategy,
            fundingModel: campaign!.funding_model,
            campaignStatus: campaign!.status,
          });
          await this.persistChanged(
            account.id,
            `WITH old AS MATERIALIZED (SELECT id, product_id, ad_rate_applied FROM listings WHERE user_id = $1 AND ebay_account_id = $2 AND promoted_campaign_id = $3 AND id = ANY($4::uuid[]))
             UPDATE listings l SET promoted_ad_rate = $5, ad_rate_applied = $6, promoted_synced_at = NOW()
             FROM old WHERE l.id = old.id RETURNING l.product_id, (old.ad_rate_applied IS DISTINCT FROM $6::numeric) AS changed`,
            [userId, account.id, campaignId, succeeded.map((r) => r.id), body.bidPercentage, applied]
          );
          for (const row of succeeded) {
            outcome.set(row.id, CampaignAddOutcome.ADDED);
            ok++;
          }
        }
      }
      return { campaignId, results: [...outcome].map(([listingId, result]) => ({ listingId, outcome: result })) };
    } finally {
      await this.audit(
        userId,
        account.id,
        campaignId,
        'rate',
        ids?.length ?? rows.length,
        ok,
        (ids?.length ?? rows.length) - ok
      );
    }
  }

  async action(
    userId: string,
    campaignId: string,
    accountId: string,
    action: CampaignAction
  ): Promise<EbayCampaignDto> {
    return this.accountLock.run(accountId, () => this.actionLocked(userId, campaignId, accountId, action));
  }

  private async actionLocked(
    userId: string,
    campaignId: string,
    accountId: string,
    action: CampaignAction
  ): Promise<EbayCampaignDto> {
    if (!Object.values(CampaignAction).includes(action)) {
      throw new CampaignActionError('campaigns.errors.ebayRejected', 400);
    }
    const { account } = await this.assertWritable(userId, accountId, campaignId);
    const ctx = await this.ebay.getAccountApiContext(account.id);
    let ok = 0;
    try {
      await this.ebayCall(() => this.client.campaignAction(ctx, campaignId, action));
      const parsed = this.parseCampaign(
        await this.ebayCall(() => this.client.getCampaign(ctx, campaignId, EbayCallPriority.INTERACTIVE)),
        campaignId
      );
      await this.repository.upsertCampaigns(account.id, [{ ...parsed, adCount: null }], false);
      await this.database.transaction(async (client: PoolClient) => {
        await client.query('SELECT id FROM ebay_accounts WHERE id = $1 FOR UPDATE', [account.id]);
        const members = await client.query<Pick<ListingRow, 'id' | 'product_id' | 'promoted_ad_rate'>>(
          'SELECT id, product_id, promoted_ad_rate FROM listings WHERE user_id = $1 AND ebay_account_id = $2 AND promoted_campaign_id = $3',
          [userId, account.id, campaignId]
        );
        const ids = members.rows.map((listing) => listing.id);
        const appliedRates = members.rows.map((listing) =>
          resolveAppliedAdRate({
            rate: listing.promoted_ad_rate ?? parsed.bidPercentage,
            strategy: parsed.adRateStrategy,
            fundingModel: parsed.fundingModel,
            campaignStatus: parsed.status,
          })
        );
        const result = await client.query<{ product_id: string; changed: boolean }>(
          `WITH old AS MATERIALIZED (
             SELECT id, product_id, ad_rate_applied FROM listings
             WHERE user_id = $1 AND ebay_account_id = $2 AND promoted_campaign_id = $3
           ), requested AS (
             SELECT * FROM unnest($4::uuid[], $5::numeric[]) AS rates(id, applied)
           )
           UPDATE listings l SET ad_rate_applied = requested.applied
           FROM old JOIN requested ON requested.id = old.id
           WHERE l.id = old.id
           RETURNING l.product_id, (old.ad_rate_applied IS DISTINCT FROM requested.applied) AS changed`,
          [userId, account.id, campaignId, ids, appliedRates]
        );
        await this.repository.recordPendingReprices(
          client,
          account.id,
          result.rows.filter((row) => row.changed).map((row) => row.product_id)
        );
      });
      await this.sync.flushPendingRepricing(account.id);
      ok = 1;
      return await this.campaignDto(account.id, parsed, false);
    } finally {
      await this.audit(userId, account.id, campaignId, action, 1, ok, 1 - ok);
    }
  }

  private parseCampaign(body: unknown, id: string): ParsedCampaign {
    const parsed = readCampaignsPage({ campaigns: [body], total: 1 });
    if (!parsed || parsed.campaigns[0]?.campaignId !== id) {
      throw new CampaignActionError('campaigns.errors.ebayRejected', 409);
    }
    return parsed.campaigns[0];
  }

  private async campaignDto(accountId: string, c: ParsedCampaign, created: boolean): Promise<EbayCampaignDto> {
    const [saved] = await this.database.query<{
      id: string;
      created_by_sellerhill: boolean;
      ad_count: number | null;
      listing_count: string;
      synced_at: Date;
      metrics: Record<string, number> | null;
      metrics_from: Date | null;
      metrics_to: Date | null;
    }>(
      `SELECT c.id, c.created_by_sellerhill, c.ad_count, c.synced_at, c.metrics, c.metrics_from, c.metrics_to,
         (SELECT COUNT(*)::text FROM listings l WHERE l.ebay_account_id = c.ebay_account_id AND l.promoted_campaign_id = c.campaign_id) AS listing_count
       FROM ebay_campaigns c WHERE c.ebay_account_id = $1 AND c.campaign_id = $2`,
      [accountId, c.campaignId]
    );
    if (!saved) {
      throw new CampaignActionError('campaigns.errors.notFound', 404);
    }
    return {
      id: saved.id,
      ebayAccountId: accountId,
      campaignId: c.campaignId,
      name: c.name,
      status: c.status,
      fundingModel: c.fundingModel,
      adRateStrategy: c.adRateStrategy,
      bidPercentage: c.bidPercentage,
      ruleBased: c.ruleBased,
      createdBySellerHill: created || saved.created_by_sellerhill,
      startDate: c.startDate,
      endDate: c.endDate,
      adCount: saved.ad_count,
      sellerHillListingCount: Number(saved.listing_count),
      readOnlyReason: campaignReadOnlyReason(c),
      syncedAt: saved.synced_at instanceof Date ? saved.synced_at.toISOString() : String(saved.synced_at),
      metrics: saved.metrics,
      metricsFrom: saved.metrics_from?.toISOString().slice(0, 10) ?? null,
      metricsTo: saved.metrics_to?.toISOString().slice(0, 10) ?? null,
    };
  }
}
