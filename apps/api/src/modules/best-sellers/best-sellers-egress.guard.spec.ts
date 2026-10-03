import { readFileSync } from 'fs';
import { join } from 'path';

// Same rule `scraper-egress.guard.spec.ts` holds for the product path: never
// scrape from the server's own IP. With an empty proxy list the service must
// answer NO_PROXY and return before any scraper call — a comment, or a
// condition like `proxies.length === 0 && false`, must not satisfy this.
describe('best-sellers egress guard', () => {
  const src = readFileSync(join(__dirname, 'best-sellers.service.ts'), 'utf8')
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .replace(/(^|[^:'"`])\/\/.*$/gm, '$1');

  it('the scraper is called from ONE place, and that place refuses an empty proxy list first', () => {
    // `getPage`, `getCategories` and the platform crawl (`crawlFetch`) all
    // reach Amazon through `scraperFetch`; a second call site would be a
    // path that skips its NO_PROXY refusal.
    expect(src.split('this.client.fetchBestSellers(').length - 1).toBe(1);
    const start = src.indexOf('private async scraperFetch(');
    const end = src.indexOf('private fetchDeduped(');
    expect(start).toBeGreaterThan(-1);
    expect(end).toBeGreaterThan(start);
    const body = src.slice(start, end);
    const guard = /if \(req\.proxies\.length === 0\) \{\s*return \{ outcome: SourceFetchOutcome\.NO_PROXY[^}]*\};\s*\}/.exec(body);
    expect(guard).not.toBeNull();
    expect(body.indexOf('this.client.fetchBestSellers(')).toBeGreaterThan(guard?.index ?? Infinity);
  });

  it('BestSellersService returns NO_PROXY on an empty proxy list before calling the scraper', () => {
    const start = src.indexOf('private async resolveList(');
    const end = src.indexOf('private async scraperFetch(');
    expect(start).toBeGreaterThan(-1);
    expect(end).toBeGreaterThan(start);
    const body = src.slice(start, end);

    const guard = /if \(proxies\.length === 0\) \{[\s\S]*?outcome: SourceFetchOutcome\.NO_PROXY[\s\S]*?return \{[\s\S]*?\};\s*\}/.exec(body);
    expect(guard).not.toBeNull();
    const scraperCall = body.indexOf('this.scraperFetch(');
    expect(scraperCall).toBeGreaterThan(guard?.index ?? Infinity);
  });

  it('never logs or returns a proxy value', () => {
    // Only the count/list may be passed to the client; no proxy string reaches a log line.
    expect(src).not.toMatch(/logger\.\w+\([^)]*proxies\[/);
    expect(src).not.toMatch(/logger\.\w+\([^)]*\$\{proxies\}/);
  });
});
