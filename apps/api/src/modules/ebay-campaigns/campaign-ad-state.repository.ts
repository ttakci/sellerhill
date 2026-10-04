import { Injectable } from '@nestjs/common';
import { resolveAppliedAdRate } from '@repo/shared';

import { DatabaseService } from '../../common/database/database.service';

import type { ParsedCampaign } from './campaign-readers';

@Injectable()
export class CampaignAdStateRepository {
  constructor(private readonly database: DatabaseService) {}

  async upsertCampaigns(
    accountId: string,
    campaigns: Array<ParsedCampaign & { adCount: number | null }>,
    removeMissing: boolean
  ): Promise<void> {
    if (campaigns.length > 0) {
      await this.database.query(
        `INSERT INTO ebay_campaigns (ebay_account_id, campaign_id, name, status, funding_model,
           ad_rate_strategy, bid_percentage, rule_based, start_date, end_date, ad_count, synced_at)
         SELECT $1, c."campaignId", c.name, c.status, c."fundingModel", c."adRateStrategy",
           c."bidPercentage", c."ruleBased", c."startDate", c."endDate", c."adCount", NOW()
         FROM jsonb_to_recordset($2::jsonb) AS c("campaignId" text, name text, status text,
           "fundingModel" text, "adRateStrategy" text, "bidPercentage" numeric, "ruleBased" boolean,
           "startDate" timestamptz, "endDate" timestamptz, "adCount" integer)
         ON CONFLICT (ebay_account_id, campaign_id) DO UPDATE SET
           name = EXCLUDED.name, status = EXCLUDED.status, funding_model = EXCLUDED.funding_model,
           ad_rate_strategy = EXCLUDED.ad_rate_strategy, bid_percentage = EXCLUDED.bid_percentage,
           rule_based = EXCLUDED.rule_based, start_date = EXCLUDED.start_date,
           end_date = EXCLUDED.end_date, ad_count = EXCLUDED.ad_count, synced_at = NOW()`,
        [accountId, JSON.stringify(campaigns)]
      );
    }
    if (removeMissing) {
      await this.database.query(
        'DELETE FROM ebay_campaigns WHERE ebay_account_id = $1 AND campaign_id <> ALL($2::text[])',
        [accountId, campaigns.map((c) => c.campaignId)]
      );
    }
  }

  async writeAdState(
    accountId: string,
    ads: Map<string, { campaignId: string; rate: number | null }>,
    clearOthers: boolean
  ): Promise<string[]> {
    const changed = new Set<string>();
    const ids = [...ads.keys()];
    if (ids.length > 0) {
      const campaigns = await this.database.query<{
        campaign_id: string;
        status: string;
        funding_model: string | null;
        ad_rate_strategy: string | null;
      }>(
        'SELECT campaign_id, status, funding_model, ad_rate_strategy FROM ebay_campaigns WHERE ebay_account_id = $1 AND campaign_id = ANY($2::text[])',
        [accountId, [...new Set([...ads.values()].map((ad) => ad.campaignId))]]
      );
      const byId = new Map(campaigns.map((c) => [c.campaign_id, c]));
      // Missing metadata cannot be interpreted as a known zero-rate campaign.
      if ([...ads.values()].some((ad) => !byId.has(ad.campaignId))) {
        throw new Error('Campaign metadata missing during ad-state write');
      }
      const values = [...ads.values()];
      const strategies = values.map((ad) => byId.get(ad.campaignId)!.ad_rate_strategy ?? 'FIXED');
      const applied = values.map((ad) => {
        const c = byId.get(ad.campaignId)!;
        return resolveAppliedAdRate({
          rate: ad.rate,
          strategy: c.ad_rate_strategy,
          fundingModel: c.funding_model,
          campaignStatus: c.status,
        });
      });
      const rows = await this.database.query<{ product_id: string; changed: boolean }>(
        `WITH old AS MATERIALIZED (
           SELECT id, ad_rate_applied FROM listings WHERE ebay_account_id = $1 AND ebay_item_id = ANY($2::text[])
         ), v AS (
           SELECT * FROM unnest($2::text[], $3::text[], $4::numeric[], $5::text[], $6::numeric[])
             AS v(item_id, campaign_id, rate, strategy, applied)
         )
         UPDATE listings l SET promoted_campaign_id = v.campaign_id, promoted_ad_rate = v.rate,
           promoted_ad_strategy = v.strategy, promoted_synced_at = NOW(), ad_rate_applied = v.applied
         FROM v, old WHERE l.id = old.id AND l.ebay_account_id = $1 AND l.ebay_item_id = v.item_id
         RETURNING l.product_id, (old.ad_rate_applied IS DISTINCT FROM v.applied) AS changed`,
        [accountId, ids, values.map((ad) => ad.campaignId), values.map((ad) => ad.rate), strategies, applied]
      );
      for (const row of rows) {
        if (row.changed) {
          changed.add(row.product_id);
        }
      }
    }
    if (clearOthers) {
      const rows = await this.database.query<{ product_id: string; changed: boolean }>(
        `WITH old AS MATERIALIZED (
           SELECT id, ad_rate_applied FROM listings WHERE ebay_account_id = $1
             AND promoted_campaign_id IS NOT NULL AND ebay_item_id <> ALL($2::text[])
         )
         UPDATE listings l SET promoted_campaign_id = NULL, promoted_ad_rate = NULL,
           promoted_ad_strategy = NULL, promoted_synced_at = NULL, ad_rate_applied = 0
         FROM old WHERE l.id = old.id AND l.ebay_account_id = $1
         RETURNING l.product_id, (old.ad_rate_applied > 0) AS changed`,
        [accountId, ids]
      );
      for (const row of rows) {
        if (row.changed) {
          changed.add(row.product_id);
        }
      }
    }
    return [...changed];
  }
}
