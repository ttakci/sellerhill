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

  it('the scraper is called from ONE place, so every caller passes the proxy check', () => {
    // `getPage` and `getCategories` both go through `resolveList`; a second
    // call site would be a path that skips the NO_PROXY refusal below.
    expect(src.split('this.client.fetchBestSellers(').length - 1).toBe(1);
  });

  it('BestSellersService returns NO_PROXY on an empty proxy list before calling the scraper', () => {
    const start = src.indexOf('private async resolveList(');
    const end = src.indexOf('private fetchDeduped(');
    expect(start).toBeGreaterThan(-1);
    expect(end).toBeGreaterThan(start);
    const body = src.slice(start, end);

    const guard = /if \(proxies\.length === 0\) \{[\s\S]*?outcome: SourceFetchOutcome\.NO_PROXY[\s\S]*?return \{[\s\S]*?\};\s*\}/.exec(body);
    expect(guard).not.toBeNull();
    const clientCall = body.indexOf('this.client.fetchBestSellers(');
    expect(clientCall).toBeGreaterThan(guard?.index ?? Infinity);
  });

  it('never logs or returns a proxy value', () => {
    // Only the count/list may be passed to the client; no proxy string reaches a log line.
    expect(src).not.toMatch(/logger\.\w+\([^)]*proxies\[/);
    expect(src).not.toMatch(/logger\.\w+\([^)]*\$\{proxies\}/);
  });
});
