import {
  AmazonMarketplace,
  PlatformSettingKey,
  ProductDataProviderKind,
  SourceFetchOutcome,
  type ScraperProductResult,
} from '@repo/shared';

import { ProductSourceService } from './product-source.service';
import { parseProxyList, type ScraperClient } from './scraper.client';

function service(settings: Partial<Record<PlatformSettingKey, string | number | null>>, results: ScraperProductResult[] = []) {
  const calls: unknown[] = [];
  // Not `async`: the body returns a plain value, not a promise, and
  // `@typescript-eslint/require-await` flags an `async` arrow with nothing to
  // await. `await`ing a non-promise mock return still resolves fine, so this
  // is a no-op for every call site under test.
  const client = { fetchProducts: jest.fn((req) => { calls.push(req); return results; }) } as unknown as ScraperClient;
  const platformSettings = {
    getString: jest.fn((k: PlatformSettingKey) => (settings[k] ?? null) as string | null),
    getNumber: jest.fn((k: PlatformSettingKey) => Number(settings[k] ?? 0)),
  };
  return { svc: new ProductSourceService(platformSettings as never, client), calls };
}

const content = { title: 'T', brand: 'B', manufacturer: null, bullets: [], description: 'd', aplusRaw: null,
  images: ['https://m.media-amazon.com/images/I/x.jpg'], categories: ['A', 'B'], specs: {}, identifiers: {} };
const signals = { price: 10, currency: 'USD', availabilityText: 'In Stock', isInStock: true, onlyLeft: null,
  quantityMax: 30, buyboxSellerId: null, buyboxSellerName: null, soldByAmazon: null };

describe('parseProxyList', () => {
  it('splits on newlines and commas, trims, drops blanks and duplicates', () => {
    expect(parseProxyList('http://a:1\n http://b:2 ,http://a:1\n\n')).toEqual(['http://a:1', 'http://b:2']);
    expect(parseProxyList(null)).toEqual([]);
  });
  it('drops malformed entries instead of sending them', () => {
    expect(parseProxyList('h:1:u:p, http://u:p@h:1 ,ftp://h:2,http://h:70000,socks5h://h:1080')).toEqual([
      'http://u:p@h:1',
      'socks5h://h:1080',
    ]);
  });
});

describe('ProductSourceService', () => {
  it('defaults to scraper when the setting is empty', async () => {
    const { svc } = service({});
    expect(await svc.activeProvider()).toBe(ProductDataProviderKind.SCRAPER);
  });

  it('reports how many configured entries were dropped, never sending them', async () => {
    const { svc, calls } = service({ [PlatformSettingKey.SCRAPER_PROXIES]: 'h:1:u:p,http://u:p@h:1' });
    expect(await svc.proxyConfig()).toEqual({ proxies: ['http://u:p@h:1'], dropped: 1 });
    await svc.fetchCommerce(['B000000001'], AmazonMarketplace.AMAZON_US);
    expect(calls[0]).toMatchObject({ proxies: ['http://u:p@h:1'] });
  });

  it('a list of only malformed entries is treated as no proxy — no request', async () => {
    const { svc, calls } = service({ [PlatformSettingKey.SCRAPER_PROXIES]: 'h:1:u:p' });
    const out = await svc.fetchCommerce(['B000000001'], AmazonMarketplace.AMAZON_US);
    expect(out[0].outcome).toBe(SourceFetchOutcome.NO_PROXY);
    expect(calls).toHaveLength(0);
  });

  it('never calls the service without proxies', async () => {
    const { svc, calls } = service({ [PlatformSettingKey.SCRAPER_PROXIES]: '' });
    const out = await svc.fetchForCreate(['B000000001'], AmazonMarketplace.AMAZON_US);
    expect(calls).toHaveLength(0);
    expect(out.get('B000000001')).toEqual({ kind: 'unavailable', outcome: SourceFetchOutcome.NO_PROXY });
    const commerce = await svc.fetchCommerce(['B000000001'], AmazonMarketplace.AMAZON_US);
    expect(commerce[0].outcome).toBe(SourceFetchOutcome.NO_PROXY);
    expect(calls).toHaveLength(0);
  });

  it('maps a found full result to a product and a 404 to not_found', async () => {
    const { svc, calls } = service(
      { [PlatformSettingKey.SCRAPER_PROXIES]: 'http://u:p@h:1', [PlatformSettingKey.SCRAPER_PER_IP_RPS]: 1, [PlatformSettingKey.SCRAPER_IN_STOCK_FLOOR]: 20 },
      [
        { asin: 'B000000001', outcome: SourceFetchOutcome.FOUND, fetchedAt: 't', signals, content },
        { asin: 'B000000002', outcome: SourceFetchOutcome.NOT_FOUND, fetchedAt: 't', signals: null, content: null },
      ],
    );
    const out = await svc.fetchForCreate(['B000000001', 'B000000002'], AmazonMarketplace.AMAZON_US);
    expect(out.get('B000000001')).toMatchObject({ kind: 'product', product: { title: 'T', stock: 20 } });
    expect(out.get('B000000002')).toEqual({ kind: 'not_found' });
    expect(calls[0]).toMatchObject({ mode: 'full', lane: 'interactive', proxies: ['http://u:p@h:1'] });
  });

  it('blocked, parse_failed and missing results are unavailable, never not_found', async () => {
    const { svc } = service({ [PlatformSettingKey.SCRAPER_PROXIES]: 'http://h:1' }, [
      { asin: 'B000000001', outcome: SourceFetchOutcome.BLOCKED, fetchedAt: null, signals: null, content: null },
      { asin: 'B000000002', outcome: SourceFetchOutcome.PARSE_FAILED, fetchedAt: null, signals: null, content: null },
    ]);
    const out = await svc.fetchForCreate(['B000000001', 'B000000002', 'B000000003'], AmazonMarketplace.AMAZON_US);
    expect(out.get('B000000001')).toEqual({ kind: 'unavailable', outcome: SourceFetchOutcome.BLOCKED });
    expect(out.get('B000000002')).toEqual({ kind: 'unavailable', outcome: SourceFetchOutcome.PARSE_FAILED });
    expect(out.get('B000000003')).toEqual({ kind: 'unavailable', outcome: SourceFetchOutcome.BLOCKED });
  });

  it('an in-stock page with an unreadable price is unavailable, never a product priced at 0', async () => {
    const { svc } = service(
      { [PlatformSettingKey.SCRAPER_PROXIES]: 'http://h:1', [PlatformSettingKey.SCRAPER_IN_STOCK_FLOOR]: 20 },
      [
        { asin: 'B000000001', outcome: SourceFetchOutcome.FOUND, fetchedAt: 't', signals: { ...signals, price: null }, content },
        { asin: 'B000000002', outcome: SourceFetchOutcome.FOUND, fetchedAt: 't', signals: { ...signals, price: 0, onlyLeft: 3 }, content },
      ],
    );
    const out = await svc.fetchForCreate(['B000000001', 'B000000002'], AmazonMarketplace.AMAZON_US);
    expect(out.get('B000000001')).toEqual({ kind: 'unavailable', outcome: SourceFetchOutcome.PARSE_FAILED });
    expect(out.get('B000000002')).toEqual({ kind: 'unavailable', outcome: SourceFetchOutcome.PARSE_FAILED });
  });

  it('chunks commerce requests at 100 ASINs and uses the background lane', async () => {
    const { svc, calls } = service({ [PlatformSettingKey.SCRAPER_PROXIES]: 'http://h:1' });
    const asins = Array.from({ length: 150 }, (_, i) => `B${String(i).padStart(9, '0')}`);
    await svc.fetchCommerce(asins, AmazonMarketplace.AMAZON_US);
    expect(calls).toHaveLength(2);
    expect(calls[0]).toMatchObject({ mode: 'commerce', lane: 'background' });
  });
});
