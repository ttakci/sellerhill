import { Injectable } from '@nestjs/common';
import {
  PlatformSettingKey,
  ProductDataProviderKind,
  ScraperFetchMode,
  ScraperLane,
  SourceFetchOutcome,
  partitionProxyList,
  type AmazonMarketplace,
  type ProductData,
  type ScraperProductResult,
} from '@repo/shared';

import { PlatformSettingsService } from '../../common/settings/platform-settings.service';

import { chunkAsins, dedupeAsins } from './keepa-normalizer';
import { ScraperClient } from './scraper.client';
import { mapScraperProduct } from './source-content-mapper';
import { normalizeScraperCommerce } from './source-product-normalizer';

export type CreateFetchResult =
  | { kind: 'product'; product: ProductData }
  | { kind: 'not_found' }
  | { kind: 'unavailable'; outcome: SourceFetchOutcome };

const MAX_ASINS_PER_REQUEST = 100;

/** Provider switch and the scraper-side fetches. Keepa code is untouched and
 * called by its existing call sites when the active provider is `keepa`. */
@Injectable()
export class ProductSourceService {
  constructor(
    private readonly platformSettings: PlatformSettingsService,
    private readonly client: ScraperClient,
  ) {}

  async activeProvider(): Promise<ProductDataProviderKind> {
    const value = await this.platformSettings.getString(PlatformSettingKey.PRODUCT_DATA_PROVIDER);
    return value === ProductDataProviderKind.KEEPA ? ProductDataProviderKind.KEEPA : ProductDataProviderKind.SCRAPER;
  }

  /** Valid proxies only — a malformed entry is never sent to the service. */
  async proxies(): Promise<string[]> {
    return (await this.proxyConfig()).proxies;
  }

  /**
   * The configured proxy list split into what is used and how many entries
   * were dropped as malformed (`SCRAPER_PROXY_INVALID` reports the count; no
   * value is ever surfaced — entries carry credentials).
   */
  async proxyConfig(): Promise<{ proxies: string[]; dropped: number }> {
    const { valid, invalidEntries } = partitionProxyList(await this.platformSettings.getString(PlatformSettingKey.SCRAPER_PROXIES));
    return { proxies: valid, dropped: invalidEntries.length };
  }

  async fetchForCreate(asins: string[], marketplace: AmazonMarketplace): Promise<Map<string, CreateFetchResult>> {
    const results = await this.fetch(asins, marketplace, ScraperFetchMode.FULL, ScraperLane.INTERACTIVE);
    const floor = await this.platformSettings.getNumber(PlatformSettingKey.SCRAPER_IN_STOCK_FLOOR);
    const byAsin = new Map(results.map((r) => [r.asin, r]));
    const out = new Map<string, CreateFetchResult>();
    for (const asin of dedupeAsins(asins)) {
      const r = byAsin.get(asin);
      if (!r) {
        out.set(asin, { kind: 'unavailable', outcome: SourceFetchOutcome.BLOCKED });
        continue;
      }
      if (r.outcome === SourceFetchOutcome.NOT_FOUND) {
        out.set(asin, { kind: 'not_found' });
        continue;
      }
      const observation = normalizeScraperCommerce(r, floor);
      if (r.outcome !== SourceFetchOutcome.FOUND || !r.content || observation.kind !== 'observed') {
        out.set(asin, { kind: 'unavailable', outcome: r.outcome === SourceFetchOutcome.FOUND ? SourceFetchOutcome.PARSE_FAILED : r.outcome });
        continue;
      }
      // An in-stock page whose price block could not be read ("see price in
      // cart", a coupon layout, a price-only DOM change) must never become a
      // product row: the mapper would store price 0, the listing would publish
      // at the price floor, and the cached row would serve every later seller
      // of that ASIN. Retryable, like any other unreadable page.
      if (observation.commerce.price === null) {
        out.set(asin, { kind: 'unavailable', outcome: SourceFetchOutcome.PARSE_FAILED });
        continue;
      }
      out.set(asin, { kind: 'product', product: mapScraperProduct(asin, r.content, observation.commerce, marketplace) });
    }
    return out;
  }

  fetchCommerce(asins: string[], marketplace: AmazonMarketplace): Promise<ScraperProductResult[]> {
    return this.fetch(asins, marketplace, ScraperFetchMode.COMMERCE, ScraperLane.BACKGROUND);
  }

  private async fetch(asins: string[], marketplace: AmazonMarketplace, mode: ScraperFetchMode, lane: ScraperLane): Promise<ScraperProductResult[]> {
    const unique = dedupeAsins(asins);
    const proxies = await this.proxies();
    if (proxies.length === 0) {
      // No proxy → no request. The server's own IP is never used.
      return unique.map((asin) => ({ asin, outcome: SourceFetchOutcome.NO_PROXY, fetchedAt: null, signals: null, content: null }));
    }
    const rate = await this.platformSettings.getNumber(PlatformSettingKey.SCRAPER_PER_IP_RPS);
    const out: ScraperProductResult[] = [];
    for (const chunk of chunkAsins(unique, MAX_ASINS_PER_REQUEST)) {
      out.push(...(await this.client.fetchProducts({
        marketplace: marketplaceCountry(marketplace), asins: chunk, mode, lane, proxies, perIpRequestsPerSecond: rate,
      })));
    }
    return out;
  }
}

function marketplaceCountry(marketplace: AmazonMarketplace): string {
  // AmazonMarketplace has one member today (AMAZON_US); the service keys marketplaces by country code.
  return marketplace.replace(/^AMAZON_/, '');
}
