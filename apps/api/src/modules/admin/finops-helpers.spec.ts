import { SharedCostAllocationMethod, type ProviderPricingRow } from '@repo/shared';

import {
  allocateSharedCost,
  computeUsageCostMicros,
  resolveEffectivePricing,
} from './finops-helpers';

describe('resolveEffectivePricing', () => {
  const baseRow = (overrides: Partial<ProviderPricingRow> = {}): ProviderPricingRow => ({
    provider: 'openai',
    model: 'gpt-4o-mini',
    inputCostPerMillionMicros: 150,
    outputCostPerMillionMicros: 600,
    embeddingCostPerMillionMicros: 0,
    effectiveFrom: '2026-01-01T00:00:00.000Z',
    effectiveTo: null,
    currency: 'USD',
    ...overrides,
  });

  it('returns unpriced when no rows', () => {
    const r = resolveEffectivePricing([], '2026-06-01T00:00:00.000Z');
    expect(r.isPriced).toBe(false);
    expect(r.row).toBeNull();
  });

  it('returns unpriced when no row covers the instant', () => {
    const rows = [baseRow({ effectiveFrom: '2026-07-01T00:00:00.000Z' })];
    const r = resolveEffectivePricing(rows, '2026-06-01T00:00:00.000Z');
    expect(r.isPriced).toBe(false);
  });

  it('resolves the open-ended row when instant >= effective_from', () => {
    const rows = [baseRow({ effectiveFrom: '2026-01-01T00:00:00.000Z', effectiveTo: null })];
    const r = resolveEffectivePricing(rows, '2026-06-01T00:00:00.000Z');
    expect(r.isPriced).toBe(true);
    expect(r.row?.inputCostPerMillionMicros).toBe(150);
  });

  it('resolves a closed window when instant is inside it', () => {
    const rows = [
      baseRow({
        effectiveFrom: '2026-01-01T00:00:00.000Z',
        effectiveTo: '2026-04-01T00:00:00.000Z',
      }),
    ];
    expect(resolveEffectivePricing(rows, '2026-03-15T00:00:00.000Z').isPriced).toBe(true);
  });

  it('excludes a closed window when instant is at effective_to (exclusive end)', () => {
    const rows = [
      baseRow({
        effectiveFrom: '2026-01-01T00:00:00.000Z',
        effectiveTo: '2026-04-01T00:00:00.000Z',
      }),
    ];
    expect(resolveEffectivePricing(rows, '2026-04-01T00:00:00.000Z').isPriced).toBe(false);
  });

  it('picks the latest effective_from when multiple rows cover the instant', () => {
    const rows = [
      baseRow({ effectiveFrom: '2026-01-01T00:00:00.000Z', inputCostPerMillionMicros: 100 }),
      baseRow({ effectiveFrom: '2026-03-01T00:00:00.000Z', inputCostPerMillionMicros: 200 }),
    ];
    const r = resolveEffectivePricing(rows, '2026-06-01T00:00:00.000Z');
    expect(r.row?.inputCostPerMillionMicros).toBe(200);
  });

  it('treats null atIso as "now" and resolves open-ended rows', () => {
    const rows = [baseRow({ effectiveFrom: '2020-01-01T00:00:00.000Z', effectiveTo: null })];
    const r = resolveEffectivePricing(rows, null);
    expect(r.isPriced).toBe(true);
  });

  it('returns unpriced for an unparseable timestamp', () => {
    const rows = [baseRow()];
    const r = resolveEffectivePricing(rows, 'not-a-date');
    expect(r.isPriced).toBe(false);
    expect(r.row).toBeNull();
  });
});

describe('computeUsageCostMicros', () => {
  const row: ProviderPricingRow = {
    provider: 'openai',
    model: 'gpt-4o-mini',
    inputCostPerMillionMicros: 150, // $0.15 / 1M input tokens → 150 micro-USD per 1M
    outputCostPerMillionMicros: 600,
    embeddingCostPerMillionMicros: 0,
    effectiveFrom: '2026-01-01T00:00:00.000Z',
    effectiveTo: null,
    currency: 'USD',
  };

  it('returns null when row is null (unpriced)', () => {
    expect(computeUsageCostMicros(null, 1000, 'input')).toBeNull();
  });

  it('computes input cost = quantity * perMillion / 1_000_000', () => {
    // 1_000_000 tokens * 150 micro-USD / 1M = 150 micro-USD
    expect(computeUsageCostMicros(row, 1_000_000, 'input')).toBe(150);
    // 1_000 tokens * 150 / 1M = 0.15 → rounded to 0 micro-USD
    expect(computeUsageCostMicros(row, 1_000, 'input')).toBe(0);
    // 2_000_000 tokens * 600 / 1M (output) = 1200 micro-USD
    expect(computeUsageCostMicros(row, 2_000_000, 'output')).toBe(1200);
  });

  it('rounds to nearest micro', () => {
    // 3_333_333 tokens * 150 / 1M = 499.99995 → rounds to 500
    expect(computeUsageCostMicros(row, 3_333_333, 'input')).toBe(500);
  });

  it('returns 0 when quantity is 0', () => {
    expect(computeUsageCostMicros(row, 0, 'input')).toBe(0);
  });

  it('returns null for negative quantity', () => {
    expect(computeUsageCostMicros(row, -10, 'input')).toBeNull();
  });
});

describe('allocateSharedCost', () => {
  it('even split: each tenant gets floor(total/n), residue returned', () => {
    const r = allocateSharedCost({
      totalCostMicros: 100,
      method: SharedCostAllocationMethod.EVEN_SPLIT,
      tenants: [
        { userId: 'u1', usageWeight: 0 },
        { userId: 'u2', usageWeight: 0 },
        { userId: 'u3', usageWeight: 0 },
        { userId: 'u4', usageWeight: 0 },
      ],
    });
    expect(r.shares).toEqual([
      { userId: 'u1', shareMicros: 25 },
      { userId: 'u2', shareMicros: 25 },
      { userId: 'u3', shareMicros: 25 },
      { userId: 'u4', shareMicros: 25 },
    ]);
    expect(r.allocatedTotalMicros).toBe(100);
    expect(r.residueMicros).toBe(0);
  });

  it('even split: residue is returned when total is not divisible', () => {
    const r = allocateSharedCost({
      totalCostMicros: 10,
      method: SharedCostAllocationMethod.EVEN_SPLIT,
      tenants: [
        { userId: 'u1', usageWeight: 0 },
        { userId: 'u2', usageWeight: 0 },
        { userId: 'u3', usageWeight: 0 },
      ],
    });
    expect(r.shares.map((s) => s.shareMicros)).toEqual([3, 3, 3]);
    expect(r.allocatedTotalMicros).toBe(9);
    expect(r.residueMicros).toBe(1);
  });

  it('even split: zero tenants returns full total as residue', () => {
    const r = allocateSharedCost({
      totalCostMicros: 100,
      method: SharedCostAllocationMethod.EVEN_SPLIT,
      tenants: [],
    });
    expect(r.shares).toEqual([]);
    expect(r.allocatedTotalMicros).toBe(0);
    expect(r.residueMicros).toBe(100);
  });

  it('usage weighted: proportional split', () => {
    const r = allocateSharedCost({
      totalCostMicros: 1000,
      method: SharedCostAllocationMethod.USAGE_WEIGHTED,
      tenants: [
        { userId: 'u1', usageWeight: 3 },
        { userId: 'u2', usageWeight: 1 },
      ],
    });
    // u1 = floor(1000 * 3 / 4) = 750; u2 = floor(1000 * 1 / 4) = 250
    expect(r.shares).toEqual([
      { userId: 'u1', shareMicros: 750 },
      { userId: 'u2', shareMicros: 250 },
    ]);
    expect(r.allocatedTotalMicros).toBe(1000);
    expect(r.residueMicros).toBe(0);
  });

  it('usage weighted: residue from floor rounding', () => {
    const r = allocateSharedCost({
      totalCostMicros: 10,
      method: SharedCostAllocationMethod.USAGE_WEIGHTED,
      tenants: [
        { userId: 'u1', usageWeight: 1 },
        { userId: 'u2', usageWeight: 1 },
        { userId: 'u3', usageWeight: 1 },
      ],
    });
    // each = floor(10/3) = 3; allocated = 9; residue = 1
    expect(r.shares.map((s) => s.shareMicros)).toEqual([3, 3, 3]);
    expect(r.residueMicros).toBe(1);
  });

  it('usage weighted: zero-weight tenants receive 0', () => {
    const r = allocateSharedCost({
      totalCostMicros: 100,
      method: SharedCostAllocationMethod.USAGE_WEIGHTED,
      tenants: [
        { userId: 'u1', usageWeight: 0 },
        { userId: 'u2', usageWeight: 1 },
      ],
    });
    expect(r.shares).toEqual([
      { userId: 'u1', shareMicros: 0 },
      { userId: 'u2', shareMicros: 100 },
    ]);
    expect(r.residueMicros).toBe(0);
  });

  it('usage weighted: all-zero weights falls back to even split', () => {
    const r = allocateSharedCost({
      totalCostMicros: 100,
      method: SharedCostAllocationMethod.USAGE_WEIGHTED,
      tenants: [
        { userId: 'u1', usageWeight: 0 },
        { userId: 'u2', usageWeight: 0 },
      ],
    });
    expect(r.shares.map((s) => s.shareMicros)).toEqual([50, 50]);
    expect(r.allocatedTotalMicros).toBe(100);
  });

  it('manual: returns no shares and full total as residue', () => {
    const r = allocateSharedCost({
      totalCostMicros: 500,
      method: SharedCostAllocationMethod.MANUAL,
      tenants: [
        { userId: 'u1', usageWeight: 10 },
        { userId: 'u2', usageWeight: 20 },
      ],
    });
    expect(r.shares).toEqual([]);
    expect(r.allocatedTotalMicros).toBe(0);
    expect(r.residueMicros).toBe(500);
  });

  it('throws on negative total', () => {
    expect(() =>
      allocateSharedCost({
        totalCostMicros: -1,
        method: SharedCostAllocationMethod.EVEN_SPLIT,
        tenants: [{ userId: 'u1', usageWeight: 1 }],
      }),
    ).toThrow();
  });

  it('residue is always strictly less than tenant count (micros)', () => {
    for (let total = 0; total < 50; total++) {
      const r = allocateSharedCost({
        totalCostMicros: total,
        method: SharedCostAllocationMethod.EVEN_SPLIT,
        tenants: [
          { userId: 'u1', usageWeight: 0 },
          { userId: 'u2', usageWeight: 0 },
          { userId: 'u3', usageWeight: 0 },
        ],
      });
      expect(r.residueMicros).toBeLessThan(3);
      expect(r.allocatedTotalMicros + r.residueMicros).toBe(total);
    }
  });
});
