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

describe('amazon tracking suspension guard', () => {
  const source = read('../amazon/amazon-tracking-processor.service.ts');

  it('skips the scrape when suspended', () => {
    expect(source).toContain('quotaEnforcement.isSuspended');
  });

  it('does not remove the scheduler on the suspended path', () => {
    // Keeping the scheduler is what makes resume automatic: the expensive part
    // is the Playwright scrape, and the scheduler costs one lookup per tick.
    // Tearing it down would need reconcileSchedulers(), which runs only at API
    // startup — an unacceptable recovery path for a paying customer.
    // The teardown call in this file is `trackingQueueService.removeOrderTracking`
    // (it removes the per-order job scheduler). The window starts AT the
    // suspension check, so the legitimate terminal/not-found calls above it are
    // out of range.
    const idx = source.indexOf('isSuspended');
    expect(idx).toBeGreaterThan(-1);
    const suspendedBlock = source.slice(idx, idx + 600);
    expect(suspendedBlock).not.toContain('removeOrderTracking');
  });
});

describe('quota window invariants', () => {
  const repo = read('./billing-repository.service.ts');
  const helpers = read('./quota-helpers.ts');

  it('no repository method resolves the calendar month directly', () => {
    // The defect class this whole change addresses is "one rule, implemented at
    // only some of its call sites". There are seven here.
    expect(repo).not.toContain('utcMonthBounds(');
  });

  it('the conversion count is bounded at both ends', () => {
    expect(repo).toContain('tracking_converted_at >=');
    expect(repo).toContain('tracking_converted_at <');
  });

  it('resolveQuotaWindow never advances periodStart', () => {
    // Guards against a future reintroduction of the rejected roll-forward: the
    // grace must extend the END only.
    expect(helpers).not.toMatch(/addUtcMonths|rollForward/);
  });
});
