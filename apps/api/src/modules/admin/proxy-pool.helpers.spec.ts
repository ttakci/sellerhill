import { ProxyExpiryState, ProxyStatus, type AdminProxyDto } from '@repo/shared';

import { buildProxyPoolSummary, classifyProxyExpiry } from './proxy-pool.helpers';

const NOW = new Date('2026-07-29T12:00:00Z');

const proxy = (overrides: Partial<AdminProxyDto>): AdminProxyDto => ({
  id: 'p1',
  host: '1.2.3.4',
  port: 8080,
  username: 'user',
  status: ProxyStatus.ACTIVE,
  label: null,
  assignedUserId: null,
  assignedUserEmail: null,
  assignedAt: null,
  expiresAt: null,
  expiryState: ProxyExpiryState.NO_EXPIRY,
  daysUntilExpiry: null,
  monthlyCostMicros: null,
  currency: null,
  createdAt: NOW.toISOString(),
  ...overrides,
});

describe('classifyProxyExpiry', () => {
  it('returns NO_EXPIRY with null days when no expiry is set', () => {
    expect(classifyProxyExpiry(null, NOW, 7)).toEqual({
      state: ProxyExpiryState.NO_EXPIRY,
      daysUntilExpiry: null,
    });
  });

  it('returns OK when expiry is beyond the warn window', () => {
    const result = classifyProxyExpiry(new Date('2026-08-30T12:00:00Z'), NOW, 7);
    expect(result.state).toBe(ProxyExpiryState.OK);
    expect(result.daysUntilExpiry).toBe(32);
  });

  it('returns EXPIRING_SOON at exactly the warn boundary', () => {
    const result = classifyProxyExpiry(new Date('2026-08-05T12:00:00Z'), NOW, 7);
    expect(result.state).toBe(ProxyExpiryState.EXPIRING_SOON);
    expect(result.daysUntilExpiry).toBe(7);
  });

  it('returns EXPIRING_SOON with 0 days when expiring later today', () => {
    const result = classifyProxyExpiry(new Date('2026-07-29T18:00:00Z'), NOW, 7);
    expect(result.state).toBe(ProxyExpiryState.EXPIRING_SOON);
    expect(result.daysUntilExpiry).toBe(0);
  });

  it('returns EXPIRED with negative days when past expiry', () => {
    const result = classifyProxyExpiry(new Date('2026-07-27T11:00:00Z'), NOW, 7);
    expect(result.state).toBe(ProxyExpiryState.EXPIRED);
    expect(result.daysUntilExpiry).toBe(-3);
  });
});

describe('buildProxyPoolSummary', () => {
  it('reports an empty pool with null cost (unknown, not 0)', () => {
    const summary = buildProxyPoolSummary([], 7);
    expect(summary.totalProxies).toBe(0);
    expect(summary.totalMonthlyCostMicros).toBeNull();
    expect(summary.currency).toBeNull();
    expect(summary.expiryWarnDays).toBe(7);
  });

  it('splits active/disabled and assigned/free counts', () => {
    const summary = buildProxyPoolSummary(
      [
        proxy({ id: 'a', assignedUserId: 'u1' }),
        proxy({ id: 'b' }),
        proxy({ id: 'c', status: ProxyStatus.DISABLED, assignedUserId: 'u2' }),
      ],
      7,
    );
    expect(summary.totalProxies).toBe(3);
    expect(summary.activeProxies).toBe(2);
    expect(summary.disabledProxies).toBe(1);
    expect(summary.assignedProxies).toBe(1); // disabled row's assignment does not count
    expect(summary.freeActiveProxies).toBe(1);
  });

  it('sums only known ACTIVE costs and keeps null when none are known', () => {
    const noCosts = buildProxyPoolSummary([proxy({ id: 'a' }), proxy({ id: 'b' })], 7);
    expect(noCosts.totalMonthlyCostMicros).toBeNull();

    const summary = buildProxyPoolSummary(
      [
        proxy({ id: 'a', monthlyCostMicros: 3_500_000, currency: 'USD' }),
        proxy({ id: 'b', monthlyCostMicros: null }),
        proxy({ id: 'c', status: ProxyStatus.DISABLED, monthlyCostMicros: 9_000_000, currency: 'USD' }),
        proxy({ id: 'd', monthlyCostMicros: 4_000_000, currency: 'USD' }),
      ],
      7,
    );
    // Disabled row excluded; unknown-cost row excluded (lower bound, not 0-filled).
    expect(summary.totalMonthlyCostMicros).toBe(7_500_000);
    expect(summary.currency).toBe('USD');
  });

  it('counts expiring/expired only among ACTIVE rows', () => {
    const summary = buildProxyPoolSummary(
      [
        proxy({ id: 'a', expiryState: ProxyExpiryState.EXPIRING_SOON }),
        proxy({ id: 'b', expiryState: ProxyExpiryState.EXPIRED }),
        proxy({ id: 'c', status: ProxyStatus.DISABLED, expiryState: ProxyExpiryState.EXPIRED }),
      ],
      7,
    );
    expect(summary.expiringSoon).toBe(1);
    expect(summary.expired).toBe(1);
  });
});
