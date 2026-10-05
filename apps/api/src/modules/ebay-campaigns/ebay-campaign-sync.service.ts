import { Injectable, Logger } from '@nestjs/common';
import { EbayCallPriority, ListingStatus, PlatformSettingKey } from '@repo/shared';

import { DatabaseService } from '../../common/database/database.service';
import { EbayBudgetExhaustedError } from '../../common/ebay-budget/ebay-budget.errors';
import { PlatformSettingsService } from '../../common/settings/platform-settings.service';
import { QuotaEnforcementService } from '../billing/quota-enforcement.service';
import { EbayService } from '../ebay/ebay.service';
import { StockSyncQueueService } from '../orders/stock-sync-queue.service';

import { CampaignAccountLockService } from './campaign-account-lock.service';
import { CampaignAdStateRepository } from './campaign-ad-state.repository';
import { type ParsedCampaign, readAdsPage, readCampaignsPage } from './campaign-readers';
import { ADS_LISTING_IDS_MAX, CAMPAIGN_MAX_PAGES, CAMPAIGN_PAGE_LIMIT } from './ebay-campaigns.constants';
import { EbayMarketingClient } from './ebay-marketing.client';

export interface SyncOutcome {
  campaigns: number;
  complete: boolean;
  repricedProducts: number;
}

@Injectable()
export class EbayCampaignSyncService {
  private readonly logger = new Logger(EbayCampaignSyncService.name);

  constructor(
    private readonly database: DatabaseService,
    private readonly settings: PlatformSettingsService,
    private readonly quota: QuotaEnforcementService,
    private readonly ebay: EbayService,
    private readonly marketing: EbayMarketingClient,
    private readonly repository: CampaignAdStateRepository,
    private readonly stock: StockSyncQueueService,
    private readonly accountLock: CampaignAccountLockService
  ) {}

  async runSweep(): Promise<void> {
    if (!(await this.settings.getBoolean(PlatformSettingKey.EBAY_CAMPAIGN_SYNC_ENABLED))) {
      return;
    }
    const interval = await this.settings.getNumber(PlatformSettingKey.EBAY_CAMPAIGN_SYNC_INTERVAL_HOURS);
    const max = await this.settings.getNumber(PlatformSettingKey.EBAY_CAMPAIGN_SYNC_MAX_ACCOUNTS_PER_RUN);
    const accounts = await this.database.query<{ id: string; user_id: string; sync_due: boolean }>(
      `WITH due AS (
         SELECT id, (last_campaign_sync_at IS NULL OR last_campaign_sync_at < NOW() - ($1 || ' hours')::INTERVAL) AS sync_due
         FROM ebay_accounts WHERE status = 'active'
           AND (last_campaign_sync_at IS NULL OR last_campaign_sync_at < NOW() - ($1 || ' hours')::INTERVAL
             OR EXISTS (SELECT 1 FROM ebay_campaign_reprice_outbox pending WHERE pending.ebay_account_id = ebay_accounts.id))
         ORDER BY last_campaign_sync_at ASC NULLS FIRST, id ASC LIMIT $2 FOR UPDATE SKIP LOCKED
       ) UPDATE ebay_accounts a
         SET last_campaign_sync_at = CASE WHEN due.sync_due THEN NOW() ELSE a.last_campaign_sync_at END
         FROM due WHERE a.id = due.id RETURNING a.id, a.user_id, due.sync_due`,
      [String(interval), max]
    );
    for (const account of accounts) {
      try {
        if (await this.quota.isSuspended(account.user_id)) {
          continue;
        }
        if (account.sync_due === false) {
          await this.flushPendingRepricing(account.id);
          continue;
        }
        await this.syncAccount(account, EbayCallPriority.BACKGROUND);
      } catch (error: unknown) {
        this.logger.warn(
          `Campaign sync failed for ${account.id}: ${error instanceof Error ? error.message : String(error)}`
        );
        if (error instanceof EbayBudgetExhaustedError) {
          return;
        }
      }
    }
  }

  async syncAccount(account: { id: string; user_id: string }, priority: EbayCallPriority): Promise<SyncOutcome> {
    return this.accountLock.run(account.id, () => this.syncAccountLocked(account, priority));
  }

  private async syncAccountLocked(
    account: { id: string; user_id: string },
    priority: EbayCallPriority
  ): Promise<SyncOutcome> {
    const delivered = await this.flushPendingRepricing(account.id);
    const ctx = await this.ebay.getAccountApiContext(account.id);
    const campaigns: Array<ParsedCampaign & { adCount: number | null }> = [];
    let complete = false;
    let expectedTotal: number | null = null;
    const seen = new Set<string>();
    try {
      for (let pageIndex = 0; pageIndex < CAMPAIGN_MAX_PAGES; pageIndex += 1) {
        const page = readCampaignsPage(
          await this.marketing.getCampaigns(ctx, pageIndex * CAMPAIGN_PAGE_LIMIT, priority)
        );
        if (
          !page ||
          page.total === null ||
          page.campaigns.length > CAMPAIGN_PAGE_LIMIT ||
          (expectedTotal !== null && page.total !== expectedTotal)
        ) {
          break;
        }
        expectedTotal = page.total;
        if (
          page.campaigns.some((c) => seen.has(c.campaignId)) ||
          new Set(page.campaigns.map((c) => c.campaignId)).size !== page.campaigns.length
        ) {
          break;
        }
        for (const c of page.campaigns) {
          seen.add(c.campaignId);
          campaigns.push({ ...c, adCount: null });
        }
        if (campaigns.length > expectedTotal) {
          break;
        }
        if (campaigns.length === expectedTotal) {
          complete = true;
          break;
        }
        // A short page contradicting total is truncated, not exhaustion.
        if (page.campaigns.length < CAMPAIGN_PAGE_LIMIT) {
          break;
        }
      }
    } catch (error: unknown) {
      if (error instanceof EbayBudgetExhaustedError) {
        throw error;
      }
      this.logger.warn(`Campaign pages incomplete for ${account.id}`);
    }
    if (!complete) {
      await this.repository.upsertCampaigns(account.id, campaigns, false);
      return { campaigns: campaigns.length, complete: false, repricedProducts: delivered.length };
    }
    const listings = await this.database.query<{ id: string; ebay_item_id: string }>(
      'SELECT id, ebay_item_id FROM listings WHERE ebay_account_id = $1 AND status = $2 AND ebay_item_id IS NOT NULL',
      [account.id, ListingStatus.ACTIVE]
    );
    const ids = [...new Set(listings.map((l) => l.ebay_item_id))];
    const activeListingIds = listings.map((listing) => listing.id);
    const map = new Map<string, { campaignId: string; rate: number | null }>();
    for (const campaign of campaigns) {
      // getAds for ENDED campaigns rejects with documented error 35035.
      if (campaign.fundingModel !== 'COST_PER_SALE' || campaign.status === 'ENDED') {
        continue;
      }
      try {
        const count = readAdsPage(await this.marketing.getAds(ctx, campaign.campaignId, { limit: 1 }, priority));
        if (!count || count.total === null || count.ads.length !== Math.min(1, count.total)) {
          complete = false;
        } else {
          campaign.adCount = count.total;
        }
      } catch (error: unknown) {
        if (error instanceof EbayBudgetExhaustedError) {
          throw error;
        }
        complete = false;
      }
      if (campaign.ruleBased) {
        continue;
      }
      let coveredAds = 0;
      for (let start = 0; start < ids.length; start += ADS_LISTING_IDS_MAX) {
        const chunk = ids.slice(start, start + ADS_LISTING_IDS_MAX);
        try {
          const page = readAdsPage(
            await this.marketing.getAds(
              ctx,
              campaign.campaignId,
              { limit: CAMPAIGN_PAGE_LIMIT, listingIds: chunk },
              priority
            ),
            campaign.status === 'RUNNING' &&
              (campaign.adRateStrategy ?? 'FIXED') === 'FIXED' &&
              !campaign.ruleBased
          );
          if (
            !page ||
            page.total !== page.ads.length ||
            page.ads.length > chunk.length ||
            page.ads.some((ad) => !chunk.includes(ad.listingId)) ||
            new Set(page.ads.map((ad) => ad.listingId)).size !== page.ads.length
          ) {
            complete = false;
            continue;
          }
          coveredAds += page.ads.length;
          if (campaign.adCount !== null && coveredAds > campaign.adCount) {
            complete = false;
          }
          for (const ad of page.ads) {
            const prior = map.get(ad.listingId);
            if (prior && prior.campaignId !== campaign.campaignId) {
              complete = false;
              continue;
            }
            map.set(ad.listingId, {
              campaignId: campaign.campaignId,
              rate: ad.bidPercentage ?? campaign.bidPercentage,
            });
          }
        } catch (error: unknown) {
          if (error instanceof EbayBudgetExhaustedError) {
            throw error;
          }
          complete = false;
        }
      }
    }
    await this.repository.upsertCampaigns(account.id, campaigns, complete);
    if (!complete) {
      return { campaigns: campaigns.length, complete: false, repricedProducts: delivered.length };
    }
    await this.repository.writeAdState(account.id, map, true, activeListingIds);
    const products = new Set([...delivered, ...(await this.flushPendingRepricing(account.id))]);
    return { campaigns: campaigns.length, complete, repricedProducts: products.size };
  }

  /** Public for Task 7: call only after committing listing writes + pending requests. */
  async flushPendingRepricing(accountId: string): Promise<string[]> {
    const delivered: string[] = [];
    for (const pending of await this.repository.listPendingReprices(accountId)) {
      // Stable for retries, unique for newer revisions even inside the 5s sale bucket.
      await this.stock.enqueueProductStockSync(pending.productId, `campaign-${accountId}-${pending.revision}`);
      await this.repository.acknowledgeReprice(accountId, pending.productId, pending.revision);
      delivered.push(pending.productId);
    }
    return delivered;
  }
}
