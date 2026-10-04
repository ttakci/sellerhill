// apps/api/src/modules/ebay-finances/finances.client.ts

import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { EbayApiResource, EbayCallPriority } from '@repo/shared';
import axios from 'axios';

import { EbayCallBudgetService } from '../../common/ebay-budget/ebay-call-budget.service';
import { withEbayRateLimitRetry } from '../ebay/ebay-http-retry';

import { BILLING_PAGE_LIMIT } from './ebay-finances.constants';
import type { BillingActivitiesParams } from './ebay-finances.types';

const REQUEST_TIMEOUT_MS = 30_000;
const DEFAULT_REST_BASE = 'https://api.ebay.com';

/**
 * eBay Finances API, read-only (`sell.finances` scope).
 *
 * The Finances API is served from `apiz.ebay.com` (the local OpenAPI's first
 * server, and the same host rule as the Identity API), so the usual REST base
 * is rewritten `api.` → `apiz.`. Every attempt is charged to the shared
 * `payoutapi.sell.finances` pool (15,000/day for the whole application) at
 * BACKGROUND priority. The body is returned as eBay sent it — nothing here
 * interprets a billing line, and nothing is ever logged from it.
 */
@Injectable()
export class FinancesClient {
  private readonly logger = new Logger(FinancesClient.name);

  constructor(
    private readonly config: ConfigService,
    private readonly budget: EbayCallBudgetService
  ) {}

  /** `GET /sell/finances/v1/billing_activity` — one page, raw JSON body. */
  async getBillingActivities(accessToken: string, params: BillingActivitiesParams): Promise<unknown> {
    const response = await withEbayRateLimitRetry(
      () =>
        axios.get<unknown>(`${this.baseUrl()}/sell/finances/v1/billing_activity`, {
          headers: { Authorization: `Bearer ${accessToken}`, Accept: 'application/json' },
          params: { filter: params.filter, limit: BILLING_PAGE_LIMIT, offset: params.offset },
          timeout: REQUEST_TIMEOUT_MS,
        }),
      {
        logger: this.logger,
        acquireBudget: async () => {
          await this.budget.acquire(EbayApiResource.FINANCES, EbayCallPriority.BACKGROUND);
        },
      }
    );
    return response.data;
  }

  private baseUrl(): string {
    const rest = this.config.get<string>('EBAY_REST_API_URL') || DEFAULT_REST_BASE;
    return rest.replace(/^(https?:\/\/)api\./, '$1apiz.');
  }
}
