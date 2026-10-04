import { readFileSync } from 'fs';
import { join } from 'path';

describe('the fan-out prices each listing with its OWN applied ad rate', () => {
  const src = readFileSync(join(__dirname, 'product-sync.service.ts'), 'utf8');
  it('selects ad_rate_applied per listing row', () => {
    const select = src.slice(src.indexOf('async computePendingUpdates('), src.indexOf('if (listings.length === 0)'));
    expect(select).toMatch(/ad_rate_applied/);
  });
  it('passes the row rate into computePricing', () => {
    const body = src.slice(src.indexOf('private async buildPendingUpdate('));
    expect(body).toMatch(/computePricing\([\s\S]*?Number\(listing\.ad_rate_applied\)/);
  });
});
