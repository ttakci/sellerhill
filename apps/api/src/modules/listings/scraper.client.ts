import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  partitionProxyList,
  type ProxyVerifyResult,
  type ScraperBestSellersRequest,
  type ScraperBestSellersResponse,
  type ScraperProductResult,
  type ScraperProductsRequest,
  type ScraperStats,
} from '@repo/shared';
import axios from 'axios';

/** The scraper service could not be reached or answered with an error. Retryable. */
export class ScraperUnavailableError extends Error {
  override name = 'ScraperUnavailableError';
}

/**
 * Valid, de-duplicated proxy URLs from a newline/comma-separated value. A
 * malformed entry is dropped here rather than sent — the service would skip
 * it anyway, and before it did, one bad line 400'd every call.
 */
export function parseProxyList(value: string | null): string[] {
  return partitionProxyList(value).valid;
}

const REQUEST_TIMEOUT_MS = 200_000; // service resolves each ASIN by its own 150 s deadline
const BEST_SELLERS_TIMEOUT_MS = 180_000; // one list page, behind the service's own 150 s deadline

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

  /**
   * One Amazon Best Sellers list page (`POST /v1/best-sellers`). The request
   * carries the proxy list like `fetchProducts`, so the same discipline holds:
   * the body is never logged, only the list coordinates and the status.
   */
  async fetchBestSellers(req: ScraperBestSellersRequest): Promise<ScraperBestSellersResponse> {
    const { url, secret } = this.base();
    try {
      const res = await axios.post<ScraperBestSellersResponse>(`${url}/v1/best-sellers`, req, {
        headers: { 'X-Scraper-Secret': secret },
        timeout: BEST_SELLERS_TIMEOUT_MS,
      });
      return res.data;
    } catch (error: unknown) {
      // Never log the request body: it carries proxy credentials.
      const status = axios.isAxiosError(error) ? error.response?.status : undefined;
      this.logger.error(
        `Scraper best-sellers request failed (${req.listType} ${req.category || 'root'} p${req.page}, status ${status ?? 'network'})`,
      );
      throw new ScraperUnavailableError(`scraper best-sellers request failed: ${status ?? 'network'}`);
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

  /**
   * One lightweight, non-Amazon connectivity check per proxy — never logs or
   * returns the proxy value itself, only what the service already redacts to
   * `host:port`. `proxies` is capped by the service at 50; this never sees a
   * saved secret's plaintext caller-side, only whatever the admin action
   * passed in (a draft, or the value `PlatformSettingsService` decrypted).
   */
  async verifyProxies(proxies: string[]): Promise<ProxyVerifyResult[]> {
    const { url, secret } = this.base();
    try {
      const res = await axios.post<{ results: ProxyVerifyResult[] }>(
        `${url}/v1/proxies/verify`,
        { proxies },
        { headers: { 'X-Scraper-Secret': secret }, timeout: 20_000 },
      );
      return res.data?.results ?? [];
    } catch (error: unknown) {
      // Never log the request body: it carries proxy credentials.
      const status = axios.isAxiosError(error) ? error.response?.status : undefined;
      this.logger.error(`Scraper proxy verify failed (${proxies.length} entries, status ${status ?? 'network'})`);
      throw new ScraperUnavailableError(`scraper proxy verify failed: ${status ?? 'network'}`);
    }
  }
}
