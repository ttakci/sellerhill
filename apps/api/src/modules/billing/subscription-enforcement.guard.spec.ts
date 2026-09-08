import * as fs from 'fs';
import * as path from 'path';

const read = (rel: string): string =>
  fs.readFileSync(path.resolve(__dirname, rel), 'utf8');

describe('order sync suspension guard', () => {
  const source = read('../orders/order-sync.service.ts');

  it('checks suspension inside syncOrdersForAccount', () => {
    expect(source).toContain('quotaEnforcement.isSuspended');
  });

  it('returns BEFORE the watermark is advanced', () => {
    // last_ebay_sync_at is written unconditionally at the end of a run and the
    // next run's start date is read from it. A suspended path that still
    // advanced it would PERMANENTLY lose every order that arrived during the
    // suspension — nothing ever looks at that date range again. This assertion
    // is the whole reason the guard file exists.
    const suspendedReturn = source.indexOf('quotaEnforcement.isSuspended');
    const watermarkWrite = source.indexOf('SET last_ebay_sync_at');
    expect(suspendedReturn).toBeGreaterThan(-1);
    expect(watermarkWrite).toBeGreaterThan(-1);
    expect(suspendedReturn).toBeLessThan(watermarkWrite);
  });
});
