import { Injectable } from '@nestjs/common';
import {
  PlatformSettingKey,
  ProductDataProviderKind,
  ScraperFetchMode,
  ScraperLane,
  SourceFetchOutcome,
  SourceStockStatus,
  partitionProxyList,
  type AmazonMarketplace,
  type ProductData,
  type ScraperProductResult,
} from '@repo/shared';

import { PlatformSettingsService } from '../../common/settings/platform-settings.service';

import { chunkAsins, dedupeAsins } from './keepa-normalizer';
import { ScraperClient } from './scraper.client';
import { mapScraperProduct } from './source-content-mapper';
import { normalizeScraperCommerce, redirectedAsin } from './source-product-normalizer';

export type CreateFetchResult =
  | { kind: 'product'; product: ProductData }
  | { kind: 'not_found' }
  | { kind: 'no_buy_box' }
  | { kind: 'asin_redirected'; resolvedAsin: string }
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

  /**
   * How old a cached `products` row may be before a CREATE re-fetches it.
   *
   * The refresh interval, so a product on the refresh schedule (one with an
   * ACTIVE listing) is always a cache hit, while a row nothing refreshes — a
   * product whose listing attempts failed or whose listings ended — pays one
   * page fetch before it can be listed again. That row is the one that can
   * describe a product Amazon has since removed.
   */
  async createCacheMaxAgeMs(): Promise<number> {
    const minutes = await this.platformSettings.getNumber(PlatformSettingKey.KEEPA_REFRESH_INTERVAL_MINUTES);
    return minutes * 60_000;
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
      // Amazon opened another product for this ASIN (a merged ASIN redirected,
      // or a variation parent showing a child). Its title, price and stock are
      // the OTHER product's, and the automatic purchase would buy that one, so
      // nothing is saved under the requested ASIN. Create only: the refresh
      // keeps its own handling for listings already live.
      const resolvedAsin = r.outcome === SourceFetchOutcome.FOUND ? redirectedAsin(asin, r.signals?.pageAsin) : null;
      if (resolvedAsin) {
        out.set(asin, { kind: 'asin_redirected', resolvedAsin });
        continue;
      }
      // Checked before the normalizer, which reads a page with neither price
      // nor stock as a data failure ("product data unavailable", retried) —
      // wrong for a page that was read fine and simply has nothing to buy.
      if (r.outcome === SourceFetchOutcome.FOUND && r.signals?.noFeaturedOffer === true) {
        out.set(asin, { kind: 'no_buy_box' });
        continue;
      }
      const observation = normalizeScraperCommerce(r, floor);
      if (r.outcome !== SourceFetchOutcome.FOUND || !r.content || observation.kind !== 'observed') {
        out.set(asin, { kind: 'unavailable', outcome: r.outcome === SourceFetchOutcome.FOUND ? SourceFetchOutcome.PARSE_FAILED : r.outcome });
        continue;
      }
      // A page that is NOT out of stock but whose price block could not be
      // read ("see price in cart", a coupon layout, a price-only DOM change)
      // must never become a product row: the mapper would store price 0, the
      // listing would publish at the price floor, and the cached row would
      // serve every later seller of that ASIN. Retryable, like any other
      // unreadable page.
      //
      // An OUT-OF-STOCK page with no price is different: Amazon shows no price
      // because there is nothing to buy, a permanent condition a retry cannot
      // change. It is saved (price 0, stock 0) so a live create is refused as
      // ZERO_STOCK and a draft can be kept; the price <= 0 refusal in
      // `prepareListingData({ live: true })` then stops that draft from being
      // published until a refresh reads a real price.
      if (observation.commerce.price === null && observation.commerce.stockStatus !== SourceStockStatus.OUT_OF_STOCK) {
        out.set(asin, { kind: 'unavailable', outcome: SourceFetchOutcome.PARSE_FAILED });
        continue;
      }
      out.set(asin, { kind: 'product', product: mapScraperProduct(asin, r.content, observation.commerce, marketplace, r.signals) });
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
