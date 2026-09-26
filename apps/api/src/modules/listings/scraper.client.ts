import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { ScraperProductResult, ScraperProductsRequest, ScraperStats } from '@repo/shared';
import axios from 'axios';

/** The scraper service could not be reached or answered with an error. Retryable. */
export class ScraperUnavailableError extends Error {
  override name = 'ScraperUnavailableError';
}

/** Newline/comma-separated proxy URLs from the `scraper.proxies` setting. */
export function parseProxyList(value: string | null): string[] {
  return [...new Set((value ?? '').split(/[\n,]/).map((p) => p.trim()).filter(Boolean))];
}

const REQUEST_TIMEOUT_MS = 200_000; // service resolves each ASIN by its own 150 s deadline

@Injectable()
export class ScraperClient {
  private readonly logger = new Logger(ScraperClient.name);

  constructor(private readonly config: ConfigService) {}

  private base(): { url: string; secret: string } {
    const url = this.config.get<string>('SCRAPER_SERVICE_URL') ?? '';
    const secret = this.config.get<string>('SCRAPER_SERVICE_SECRET') ?? '';
    if (!url || !secret) {
      throw new ScraperUnavailableError('SCRAPER_SERVICE_URL / SCRAPER_SERVICE_SECRET not configured');
    }
    return { url: url.replace(/\/$/, ''), secret };
  }

  async fetchProducts(req: ScraperProductsRequest): Promise<ScraperProductResult[]> {
    const { url, secret } = this.base();
    try {
      const res = await axios.post<{ results: ScraperProductResult[] }>(`${url}/v1/products`, req, {
        headers: { 'X-Scraper-Secret': secret },
        timeout: REQUEST_TIMEOUT_MS,
      });
      return res.data?.results ?? [];
    } catch (error: unknown) {
      // Never log the request body: it carries proxy credentials.
      const status = axios.isAxiosError(error) ? error.response?.status : undefined;
      this.logger.error(`Scraper request failed (${req.asins.length} ASINs, status ${status ?? 'network'})`);
      throw new ScraperUnavailableError(`scraper request failed: ${status ?? 'network'}`);
    }
  }

  async getStats(): Promise<ScraperStats> {
    const { url, secret } = this.base();
    try {
      const res = await axios.get<ScraperStats>(`${url}/v1/stats`, { headers: { 'X-Scraper-Secret': secret }, timeout: 5000 });
      return res.data;
    } catch {
      throw new ScraperUnavailableError('scraper stats unavailable');
    }
  }
}
