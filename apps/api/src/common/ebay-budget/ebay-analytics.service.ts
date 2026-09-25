import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { EbayApiResource, EbayCallPriority } from '@repo/shared';

import { EbayCallBudgetService } from './ebay-call-budget.service';
import { EbayRateLimitStore, type EbayRateLimitSnapshot } from './ebay-rate-limit.store';
import { parseRateLimitsResponse } from './ebay-rate-limits';

/** The admin panel asks eBay at most this often; ~1,440 calls/day worst case against Analytics' 5,000. */
export const PANEL_CACHE_MS = 60_000;

/** Refresh the application token this long before eBay says it expires. */
const TOKEN_SAFETY_MS = 60_000;

/**
 * Asks eBay what THIS keyset's real call limits are.
 *
 * Uses an APPLICATION token (client credentials): limits belong to the keyset,
 * not to a seller, so no connected store is involved. Never throws — every
 * failure returns false and leaves the stored snapshot exactly as it was.
 */
@Injectable()
export class EbayAnalyticsService {
  private readonly logger = new Logger(EbayAnalyticsService.name);
  private token: { value: string; expiresAt: number } | null = null;
  private lastAttemptAt = 0;
  private lastLive = false;

  constructor(
    private readonly config: ConfigService,
    private readonly store: EbayRateLimitStore,
    private readonly budget: EbayCallBudgetService,
  ) {}

  async refresh(): Promise<boolean> {
    const clientId = this.config.get<string>('EBAY_CLIENT_ID')?.trim();
    const clientSecret = this.config.get<string>('EBAY_CLIENT_SECRET')?.trim();
    const tokenUrl = this.config.get<string>('EBAY_TOKEN_URL')?.trim();
    const restBase = this.config.get<string>('EBAY_REST_API_URL')?.trim();
    if (!clientId || !clientSecret || !tokenUrl || !restBase) {
      this.logger.warn('eBay credentials not configured; cannot read eBay rate limits.');
      return false;
    }

    try {
      const token = await this.applicationToken(tokenUrl, clientId, clientSecret);
      // Counted like any other call so our column is comparable with eBay's.
      await this.budget.acquire(EbayApiResource.ANALYTICS, EbayCallPriority.INTERACTIVE, 1);
      const response = await fetch(`${restBase.replace(/\/+$/, '')}/developer/analytics/v1_beta/rate_limit/`, {
        headers: { Authorization: `Bearer ${token}`, Accept: 'application/json' },
      });
      const text = await response.text();
      if (!response.ok) {
        this.logger.warn(`eBay rate_limit call failed (${response.status}): ${text.slice(0, 300)}`);
        return false;
      }
      let body: unknown;
      try {
        body = JSON.parse(text);
      } catch {
        this.logger.warn('eBay rate_limit returned a non-JSON body; keeping the stored limits.');
        return false;
      }
      const resources = parseRateLimitsResponse(body);
      if (resources.length === 0) {
        this.logger.warn('eBay rate_limit returned no resources; keeping the stored limits.');
        return false;
      }
      await this.store.save(resources, new Date());
      return true;
    } catch (error: unknown) {
      this.logger.warn(`Could not refresh eBay rate limits: ${error instanceof Error ? error.message : String(error)}`);
      return false;
    }
  }

  async forPanel(): Promise<{ snapshot: EbayRateLimitSnapshot | null; live: boolean }> {
    if (Date.now() - this.lastAttemptAt >= PANEL_CACHE_MS) {
      this.lastAttemptAt = Date.now();
      this.lastLive = await this.refresh();
    }
    return { snapshot: await this.store.current(), live: this.lastLive };
  }

  private async applicationToken(tokenUrl: string, clientId: string, clientSecret: string): Promise<string> {
    if (this.token && Date.now() < this.token.expiresAt - TOKEN_SAFETY_MS) {
      return this.token.value;
    }
    const response = await fetch(tokenUrl, {
      method: 'POST',
      headers: {
        Authorization: `Basic ${Buffer.from(`${clientId}:${clientSecret}`).toString('base64')}`,
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      // eBay wants the production scope string even against the sandbox host.
      body: 'grant_type=client_credentials&scope=https%3A%2F%2Fapi.ebay.com%2Foauth%2Fapi_scope',
    });
    const text = await response.text();
    if (!response.ok) {
      throw new Error(`application token request failed (${response.status})`);
    }
    const parsed = JSON.parse(text) as { access_token?: string; expires_in?: number };
    if (!parsed.access_token) {
      throw new Error('application token response carried no access_token');
    }
    this.token = { value: parsed.access_token, expiresAt: Date.now() + (parsed.expires_in ?? 7200) * 1000 };
    return parsed.access_token;
  }
}
