import { QuotaPressureBand } from '@repo/shared';

import {
  ALL_QUOTA_BANDS,
  aggregateQuotaBands,
  buildAccessTierDistribution,
  buildAccountStatusDistribution,
  buildQuotaPressureSummary,
  classifyQuotaBand,
  resolveCostTotal,
} from './billing-metrics.helpers';

describe('classifyQuotaBand', () => {
  const warn = 25;
  const critical = 100;

  it('classifies zero usage as NONE', () => {
    expect(classifyQuotaBand(0, warn, critical)).toBe(QuotaPressureBand.NONE);
  });

  it('classifies usage below warn as UNDER_LIMIT', () => {
    expect(classifyQuotaBand(1, warn, critical)).toBe(QuotaPressureBand.UNDER_LIMIT);
    expect(classifyQuotaBand(24, warn, critical)).toBe(QuotaPressureBand.UNDER_LIMIT);
  });

  it('classifies usage at warn as NEAR_LIMIT', () => {
    expect(classifyQuotaBand(25, warn, critical)).toBe(QuotaPressureBand.NEAR_LIMIT);
    expect(classifyQuotaBand(99, warn, critical)).toBe(QuotaPressureBand.NEAR_LIMIT);
  });

  it('classifies usage at critical as AT_LIMIT', () => {
    expect(classifyQuotaBand(100, warn, critical)).toBe(QuotaPressureBand.AT_LIMIT);
  });

  it('classifies usage above critical as OVER_LIMIT', () => {
    expect(classifyQuotaBand(101, warn, critical)).toBe(QuotaPressureBand.OVER_LIMIT);
    expect(classifyQuotaBand(500, warn, critical)).toBe(QuotaPressureBand.OVER_LIMIT);
  });

  it('is monotonic — every non-negative value maps to exactly one band', () => {
    for (let usage = 0; usage <= 200; usage++) {
      const band = classifyQuotaBand(usage, warn, critical);
      expect(ALL_QUOTA_BANDS).toContain(band);
    }
  });

  it('treats negative usage as NONE (defensive)', () => {
    expect(classifyQuotaBand(-5, warn, critical)).toBe(QuotaPressureBand.NONE);
  });

  it('treats NaN usage as NONE (defensive)', () => {
    expect(classifyQuotaBand(Number.NaN, warn, critical)).toBe(QuotaPressureBand.NONE);
  });

  it('falls back to UNDER_LIMIT for positive usage when thresholds are invalid', () => {
    expect(classifyQuotaBand(50, 0, 0)).toBe(QuotaPressureBand.UNDER_LIMIT);
    expect(classifyQuotaBand(50, -1, 100)).toBe(QuotaPressureBand.UNDER_LIMIT);
    expect(classifyQuotaBand(50, 100, 25)).toBe(QuotaPressureBand.UNDER_LIMIT); // warn > critical
    expect(classifyQuotaBand(50, Number.NaN, 100)).toBe(QuotaPressureBand.UNDER_LIMIT);
  });

  it('zero usage is NONE even when thresholds are invalid', () => {
    expect(classifyQuotaBand(0, 0, 0)).toBe(QuotaPressureBand.NONE);
  });
});

describe('aggregateQuotaBands', () => {
  const warn = 25;
  const critical = 100;

  it('returns empty bands with null maxUsage for empty input', () => {
    const r = aggregateQuotaBands([], warn, critical);
    expect(r.maxUsage).toBeNull();
    expect(r.usersWithUsage).toBe(0);
    expect(r.bands).toHaveLength(ALL_QUOTA_BANDS.length);
    for (const band of r.bands) {
      expect(band.userCount).toBe(0);
    }
  });

  it('aggregates a mixed usage set into the correct bands', () => {
    const usages = [
      0, // NONE
      0, // NONE
      5, // UNDER_LIMIT
      24, // UNDER_LIMIT
      25, // NEAR_LIMIT
      50, // NEAR_LIMIT
      100, // AT_LIMIT
      150, // OVER_LIMIT
    ];
    const r = aggregateQuotaBands(usages, warn, critical);
    expect(r.maxUsage).toBe(150);
    expect(r.usersWithUsage).toBe(6); // 6 users with usage > 0
    const byBand = new Map(r.bands.map((b) => [b.band, b.userCount]));
    expect(byBand.get(QuotaPressureBand.NONE)).toBe(2);
    expect(byBand.get(QuotaPressureBand.UNDER_LIMIT)).toBe(2);
    expect(byBand.get(QuotaPressureBand.NEAR_LIMIT)).toBe(2);
    expect(byBand.get(QuotaPressureBand.AT_LIMIT)).toBe(1);
    expect(byBand.get(QuotaPressureBand.OVER_LIMIT)).toBe(1);
  });

  it('sum of band counts equals input length', () => {
    const usages = [0, 1, 25, 100, 200, 50, 75, 0, 10];
    const r = aggregateQuotaBands(usages, warn, critical);
    const sum = r.bands.reduce((total, b) => total + b.userCount, 0);
    expect(sum).toBe(usages.length);
  });

  it('emits a count for every band even when some are zero', () => {
    const r = aggregateQuotaBands([5], warn, critical);
    expect(r.bands).toHaveLength(ALL_QUOTA_BANDS.length);
    const nonZero = r.bands.filter((b) => b.userCount > 0);
    expect(nonZero).toHaveLength(1);
    expect(nonZero[0]?.band).toBe(QuotaPressureBand.UNDER_LIMIT);
  });

  it('maxUsage is 0 (not null) when every user has zero usage', () => {
    const r = aggregateQuotaBands([0, 0, 0], warn, critical);
    expect(r.maxUsage).toBe(0);
    expect(r.usersWithUsage).toBe(0);
  });
});

describe('buildQuotaPressureSummary', () => {
  it('builds a complete summary for listings', () => {
    const summary = buildQuotaPressureSummary('listings', [0, 10, 30, 150], 25, 100);
    expect(summary.resource).toBe('listings');
    expect(summary.warnThreshold).toBe(25);
    expect(summary.criticalThreshold).toBe(100);
    expect(summary.maxUsage).toBe(150);
    expect(summary.usersWithUsage).toBe(3);
    expect(summary.bands).toHaveLength(ALL_QUOTA_BANDS.length);
  });

  it('builds a complete summary for amazon_accounts', () => {
    const summary = buildQuotaPressureSummary('amazon_accounts', [], 25, 100);
    expect(summary.resource).toBe('amazon_accounts');
    expect(summary.maxUsage).toBeNull();
    expect(summary.usersWithUsage).toBe(0);
  });

  it('preserves configured thresholds in the output', () => {
    const summary = buildQuotaPressureSummary('listings', [5], 50, 200);
    expect(summary.warnThreshold).toBe(50);
    expect(summary.criticalThreshold).toBe(200);
  });
});

describe('buildAccountStatusDistribution', () => {
  it('maps status rows to DTOs', () => {
    const rows = [
      { status: 'active', count: 10 },
      { status: 'pending', count: 3 },
      { status: 'inactive', count: 2 },
    ];
    const dist = buildAccountStatusDistribution(rows);
    expect(dist).toEqual([
      { status: 'active', count: 10 },
      { status: 'pending', count: 3 },
      { status: 'inactive', count: 2 },
    ]);
  });

  it('drops rows with null status', () => {
    const rows = [
      { status: 'active', count: 5 },
      { status: null, count: 1 },
    ];
    const dist = buildAccountStatusDistribution(rows);
    expect(dist).toEqual([{ status: 'active', count: 5 }]);
  });

  it('drops rows with empty-string status', () => {
    const rows = [
      { status: '', count: 1 },
      { status: 'banned', count: 2 },
    ];
    const dist = buildAccountStatusDistribution(rows);
    expect(dist).toEqual([{ status: 'banned', count: 2 }]);
  });

  it('returns empty array for empty input', () => {
    expect(buildAccountStatusDistribution([])).toEqual([]);
  });
});

describe('buildAccessTierDistribution', () => {
  it('maps tier rows to DTOs', () => {
    const rows = [
      { tier: 'customer', count: 100 },
      { tier: 'support', count: 3 },
      { tier: 'admin', count: 2 },
    ];
    const dist = buildAccessTierDistribution(rows);
    expect(dist).toEqual([
      { tier: 'customer', count: 100 },
      { tier: 'support', count: 3 },
      { tier: 'admin', count: 2 },
    ]);
  });

  it('drops rows with null tier', () => {
    const rows = [
      { tier: 'customer', count: 5 },
      { tier: null, count: 1 },
    ];
    const dist = buildAccessTierDistribution(rows);
    expect(dist).toEqual([{ tier: 'customer', count: 5 }]);
  });

  it('drops rows with empty-string tier', () => {
    const rows = [
      { tier: '', count: 1 },
      { tier: 'admin', count: 2 },
    ];
    const dist = buildAccessTierDistribution(rows);
    expect(dist).toEqual([{ tier: 'admin', count: 2 }]);
  });
});

describe('resolveCostTotal', () => {
  it('returns null cost and currency when total is null (no cost rows)', () => {
    const r = resolveCostTotal({ totalCostMicros: null, currency: null });
    expect(r.totalCostMicros).toBeNull();
    expect(r.currency).toBeNull();
  });

  it('parses a valid cost total', () => {
    const r = resolveCostTotal({ totalCostMicros: '123456', currency: 'USD' });
    expect(r.totalCostMicros).toBe(123456);
    expect(r.currency).toBe('USD');
  });

  it('returns null when total is present but currency is missing', () => {
    const r = resolveCostTotal({ totalCostMicros: '123456', currency: null });
    expect(r.totalCostMicros).toBeNull();
    expect(r.currency).toBeNull();
  });

  it('returns null when total is present but currency is empty', () => {
    const r = resolveCostTotal({ totalCostMicros: '123456', currency: '' });
    expect(r.totalCostMicros).toBeNull();
    expect(r.currency).toBeNull();
  });

  it('returns null for unparseable total', () => {
    const r = resolveCostTotal({ totalCostMicros: 'not-a-number', currency: 'USD' });
    expect(r.totalCostMicros).toBeNull();
    expect(r.currency).toBeNull();
  });

  it('returns null for negative total (defensive)', () => {
    const r = resolveCostTotal({ totalCostMicros: '-5', currency: 'USD' });
    expect(r.totalCostMicros).toBeNull();
    expect(r.currency).toBeNull();
  });

  it('parses a zero cost total as a real zero (not null)', () => {
    // A genuine zero (rows exist, sum is 0) is NOT unknown — it is a real zero.
    const r = resolveCostTotal({ totalCostMicros: '0', currency: 'USD' });
    expect(r.totalCostMicros).toBe(0);
    expect(r.currency).toBe('USD');
  });
});
