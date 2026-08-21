// apps/api/src/modules/listings/refresh-batch-size.spec.ts
//
// Pure tests for the batch-size policy. No DB, no NestJS — mirrors the
// refresh-backoff.spec.ts / profit-calculation.spec.ts style.

import {
  KEEPA_TOKENS_PER_REFRESH,
  maxProductsAtInterval,
  resolveRefreshBatchSize,
} from './refresh-batch-size';

const BASE = { reservePercent: 20, manualBatchSize: 50, autoEnabled: true, min: 1, max: 1000 };

describe('resolveRefreshBatchSize', () => {
  it('derives from the refill rate, holding back the reserve', () => {
    // 250 tpm * 0.8 = 200 usable / 8 tokens = 25
    const r = resolveRefreshBatchSize({ ...BASE, refillRate: 250 });
    expect(r).toEqual({ batchSize: 25, source: 'auto' });
  });

  it('scales with the plan: a bigger Keepa tier yields a bigger batch', () => {
    const small = resolveRefreshBatchSize({ ...BASE, refillRate: 20 });
    const large = resolveRefreshBatchSize({ ...BASE, refillRate: 2000 });
    expect(small.batchSize).toBe(2); // 20*0.8/8 = 2
    expect(large.batchSize).toBe(200); // 2000*0.8/8 = 200
    expect(large.batchSize).toBeGreaterThan(small.batchSize);
  });

  it('floors rather than rounds up — overshooting the refill rate costs 429s', () => {
    // 100 tpm * 0.8 = 80 / 8 = 10 exactly; 105 tpm gives 10.5 -> 10, not 11
    expect(resolveRefreshBatchSize({ ...BASE, refillRate: 105 }).batchSize).toBe(10);
  });

  it('honours a zero reserve', () => {
    const r = resolveRefreshBatchSize({ ...BASE, refillRate: 250, reservePercent: 0 });
    expect(r.batchSize).toBe(Math.floor(250 / KEEPA_TOKENS_PER_REFRESH));
  });

  it('clamps an out-of-range reserve instead of producing a negative batch', () => {
    const r = resolveRefreshBatchSize({ ...BASE, refillRate: 250, reservePercent: 500 });
    // reserve clamps to 90% -> 250*0.1/8 = 3
    expect(r.batchSize).toBe(3);
  });

  it('uses the manual value when auto is disabled', () => {
    const r = resolveRefreshBatchSize({ ...BASE, refillRate: 2000, autoEnabled: false });
    expect(r).toEqual({ batchSize: 50, source: 'manual' });
  });

  it('falls back to manual when no balance has been captured yet', () => {
    expect(resolveRefreshBatchSize({ ...BASE, refillRate: null }).source).toBe('manual_no_rate');
    expect(resolveRefreshBatchSize({ ...BASE, refillRate: null }).batchSize).toBe(50);
  });

  it('falls back to manual on a nonsensical refill rate', () => {
    expect(resolveRefreshBatchSize({ ...BASE, refillRate: 0 }).source).toBe('manual_no_rate');
    expect(resolveRefreshBatchSize({ ...BASE, refillRate: -5 }).source).toBe('manual_no_rate');
    expect(resolveRefreshBatchSize({ ...BASE, refillRate: NaN }).source).toBe('manual_no_rate');
  });

  it('never returns below the registry minimum, even on a tiny plan', () => {
    // 5 tpm * 0.8 / 8 = 0.5 -> floors to 0, must clamp up to min
    const r = resolveRefreshBatchSize({ ...BASE, refillRate: 5 });
    expect(r.batchSize).toBe(1);
  });

  it('never exceeds the registry maximum on a very large plan', () => {
    const r = resolveRefreshBatchSize({ ...BASE, refillRate: 100_000 });
    expect(r.batchSize).toBe(1000);
  });

  it('clamps a manual value that sits outside the registry bounds', () => {
    expect(
      resolveRefreshBatchSize({ ...BASE, refillRate: null, manualBatchSize: 99_999 }).batchSize,
    ).toBe(1000);
    expect(
      resolveRefreshBatchSize({ ...BASE, refillRate: null, manualBatchSize: 0 }).batchSize,
    ).toBe(1);
  });
});

describe('maxProductsAtInterval', () => {
  it('reports how many products a plan keeps fresh at a 12h interval', () => {
    // 250 tpm / 8 = 31.25 refresh/min * 720 min = 22,500
    expect(maxProductsAtInterval(250, 720)).toBe(22_500);
  });

  it('halves when the interval halves', () => {
    expect(maxProductsAtInterval(250, 360)).toBe(11_250);
  });

  it('accounts for the reserve', () => {
    expect(maxProductsAtInterval(250, 720, 20)).toBe(18_000);
  });

  it('returns 0 for a nonsensical plan or interval', () => {
    expect(maxProductsAtInterval(0, 720)).toBe(0);
    expect(maxProductsAtInterval(250, 0)).toBe(0);
  });
});
