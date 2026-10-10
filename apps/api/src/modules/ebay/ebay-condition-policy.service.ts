import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { EbayApiResource } from '@repo/shared';
import axios from 'axios';

import { DatabaseService } from '../../common/database/database.service';
import { EbayApplicationTokenService } from '../../common/ebay-budget/ebay-application-token.service';
import { EbayCallBudgetService } from '../../common/ebay-budget/ebay-call-budget.service';

import { withEbayRateLimitRetry } from './ebay-http-retry';
import { EbayConditionEnum, resolveConditionForCategory, resolveEbayCondition } from './listing-condition';

/** In-process TTL in front of the DB (a bulk add hits the same category constantly). */
const MEMORY_TTL_MS = 15 * 60 * 1000;
/** Same freshness knob as the aspect snapshot: category rules change rarely. */
const DEFAULT_TTL_HOURS = 168;

/** The conditions a leaf category accepts, as eBay numeric ids (strings). */
export interface CategoryConditions {
  conditionRequired: boolean;
  conditionIds: string[];
}

interface ConditionRow {
  condition_required: boolean;
  condition_ids: string[] | string;
  fetched_at: Date;
}

interface ConditionPoliciesResponse {
  itemConditionPolicies?: Array<{
    categoryId?: string;
    itemConditionRequired?: boolean;
    itemConditions?: Array<{ conditionId?: string | number }>;
  }>;
}

/**
 * Which item conditions an eBay leaf category accepts (Sell Metadata API
 * `getItemConditionPolicies`), cached per (marketplace, category) like the
 * aspect metadata: memory, then a fresh DB row, then eBay, then a stale DB row.
 *
 * FAIL SOFT, always: an eBay error, an exhausted quota or a database outage
 * yields `null` ("policy unknown") and the caller keeps the title-derived
 * condition, exactly the pre-policy behaviour. Nothing here ever throws into
 * the create path.
 */
@Injectable()
export class EbayConditionPolicyService {
  private readonly logger = new Logger(EbayConditionPolicyService.name);
  private readonly memo = new Map<string, { value: CategoryConditions | null; expiresAt: number }>();
  private readonly inflight = new Map<string, Promise<CategoryConditions | null>>();

  constructor(
    private readonly databaseService: DatabaseService,
    private readonly configService: ConfigService,
    private readonly budget: EbayCallBudgetService,
    private readonly appToken: EbayApplicationTokenService
  ) {}

  /** The listing condition, settled against its category policy. Never throws. */
  async resolveCondition(title: string, marketplaceId: string, categoryId: string): Promise<EbayConditionEnum> {
    const preferred = resolveEbayCondition(title);
    try {
      const policy = await this.getCategoryConditions(marketplaceId, categoryId);
      if (!policy) {
        return preferred;
      }
      const settled = resolveConditionForCategory(preferred, policy.conditionIds, policy.conditionRequired);
      if (settled !== preferred) {
        this.logger.log(`Condition for category ${categoryId}: ${preferred} → ${settled} (eBay policy)`);
      }
      return settled;
    } catch (error: unknown) {
      this.logger.warn(
        `Condition policy lookup failed for category ${categoryId}; keeping ${preferred}: ${
          error instanceof Error ? error.message : String(error)
        }`
      );
      return preferred;
    }
  }

  /** `null` = policy unknown (could not be obtained, or eBay listed no conditions). */
  async getCategoryConditions(marketplaceId: string, categoryId: string): Promise<CategoryConditions | null> {
    const key = `${marketplaceId}:${categoryId}`;
    const memo = this.memo.get(key);
    if (memo && memo.expiresAt > Date.now()) {
      return memo.value;
    }
    const pending = this.inflight.get(key);
    if (pending) {
      return pending;
    }
    const run = this.load(marketplaceId, categoryId, key).finally(() => this.inflight.delete(key));
    this.inflight.set(key, run);
    return run;
  }

  private async load(marketplaceId: string, categoryId: string, key: string): Promise<CategoryConditions | null> {
    const snapshot = await this.readSnapshot(marketplaceId, categoryId);
    if (snapshot && Date.now() - snapshot.fetchedAt.getTime() < this.ttlMs()) {
      return this.remember(key, snapshot.value);
    }

    try {
      const fetched = await this.fetchFromEbay(marketplaceId, categoryId);
      await this.writeSnapshot(marketplaceId, categoryId, fetched);
      return this.remember(key, fetched.conditionIds.length > 0 ? fetched : null);
    } catch (error: unknown) {
      const reason = error instanceof Error ? error.message : String(error);
      if (snapshot) {
        this.logger.warn(
          `Condition policy unavailable for category ${categoryId}; serving snapshot from ` +
            `${snapshot.fetchedAt.toISOString()}: ${reason}`
        );
        return this.remember(key, snapshot.value);
      }
      this.logger.warn(
        `Condition policy unavailable for category ${categoryId}; publishing with the title-derived condition: ${reason}`
      );
      // Not memoised: the next listing in this category tries again.
      return null;
    }
  }

  private remember(key: string, value: CategoryConditions | null): CategoryConditions | null {
    this.memo.set(key, { value, expiresAt: Date.now() + MEMORY_TTL_MS });
    return value;
  }

  private ttlMs(): number {
    const hours = Number(this.configService.get('EBAY_CATEGORY_ASPECT_TTL_HOURS')) || DEFAULT_TTL_HOURS;
    return hours * 60 * 60 * 1000;
  }

  private async readSnapshot(
    marketplaceId: string,
    categoryId: string
  ): Promise<{ value: CategoryConditions | null; fetchedAt: Date } | null> {
    try {
      const rows = await this.databaseService.query<ConditionRow>(
        `SELECT condition_required, condition_ids, fetched_at FROM ebay_category_conditions
         WHERE marketplace_id = $1 AND category_id = $2`,
        [marketplaceId, categoryId]
      );
      const row = rows[0];
      if (!row) {
        return null;
      }
      const raw = typeof row.condition_ids === 'string' ? (JSON.parse(row.condition_ids) as unknown) : row.condition_ids;
      const ids = Array.isArray(raw) ? raw.map((id) => String(id)) : [];
      return {
        value: ids.length > 0 ? { conditionRequired: row.condition_required, conditionIds: ids } : null,
        fetchedAt: new Date(row.fetched_at),
      };
    } catch (error: unknown) {
      this.logger.warn(
        `Condition policy cache read failed: ${error instanceof Error ? error.message : String(error)}`
      );
      return null;
    }
  }

  private async writeSnapshot(marketplaceId: string, categoryId: string, value: CategoryConditions): Promise<void> {
    try {
      await this.databaseService.query(
        `INSERT INTO ebay_category_conditions (marketplace_id, category_id, condition_required, condition_ids, fetched_at)
         VALUES ($1, $2, $3, $4::jsonb, NOW())
         ON CONFLICT (marketplace_id, category_id)
         DO UPDATE SET
           condition_required = EXCLUDED.condition_required,
           condition_ids = EXCLUDED.condition_ids,
           fetched_at = NOW()`,
        [marketplaceId, categoryId, value.conditionRequired, JSON.stringify(value.conditionIds)]
      );
    } catch (error: unknown) {
      this.logger.warn(
        `Condition policy cache write failed: ${error instanceof Error ? error.message : String(error)}`
      );
    }
  }

  private async fetchFromEbay(marketplaceId: string, categoryId: string): Promise<CategoryConditions> {
    // Application (client-credentials) token: the policy is public marketplace
    // metadata, not tied to a seller.
    const token = await this.appToken.get();
    const filter = encodeURIComponent(`categoryIds:{${categoryId}}`);
    const url =
      `${this.configService.get('EBAY_REST_API_URL')}/sell/metadata/v1/marketplace/` +
      `${marketplaceId}/get_item_condition_policies?filter=${filter}`;

    const response = await withEbayRateLimitRetry(
      () =>
        axios.get<ConditionPoliciesResponse>(url, {
          headers: { Authorization: `Bearer ${token}`, 'Accept-Language': 'en-US' },
        }),
      { logger: this.logger, acquireBudget: () => this.budget.acquire(EbayApiResource.METADATA) }
    );

    const policies = response.data?.itemConditionPolicies ?? [];
    const policy = policies.find((p) => p.categoryId === categoryId) ?? policies[0];
    const ids = (policy?.itemConditions ?? [])
      .map((c) => (c.conditionId === undefined || c.conditionId === null ? '' : String(c.conditionId)))
      .filter((id) => id.length > 0);

    return { conditionRequired: policy?.itemConditionRequired === true, conditionIds: [...new Set(ids)] };
  }
}
