import { ActionCenterItemKey, ActionCenterSeverity, i18nResources, type PeriodMetricsDto } from '@repo/shared';

import { renderDigest, resolveDigestLocale, type DigestInput } from './digest-render';

function metrics(over: Partial<PeriodMetricsDto> = {}): PeriodMetricsDto {
  return {
    sales: 0,
    orders: 0,
    units: 0,
    refunds: 0,
    grossProfit: 0,
    netProfit: 0,
    estimatedPayout: 0,
    margin: 0,
    avgOrderValue: 0,
    trend: null,
    profitTrend: null,
    profitConfirmed: 0,
    profitProvisional: 0,
    revenueUncosted: 0,
    ordersPendingCapture: 0,
    ordersCaptureFailed: 0,
    ordersUntracked: 0,
    costOfGoods: 0,
    transactionFees: 0,
    adFees: 0,
    amazonShipping: 0,
    amazonTax: 0,
    roi: 0,
    refundRate: 0,
    ...over,
  } as PeriodMetricsDto;
}

function input(over: Partial<DigestInput> = {}): DigestInput {
  return {
    locale: 'en',
    firstName: 'Ada',
    reportDay: '2026-10-07',
    currency: 'USD',
    total: metrics({ orders: 3, sales: 1234.5, profitConfirmed: 100, profitProvisional: 12.3, refunds: 1 }),
    stores: [],
    connectedStoreCount: 1,
    cancelRequests: 0,
    newReturns: 0,
    pending: [],
    ...over,
  };
}

describe('renderDigest', () => {
  it('formats figures and the day in the template language', () => {
    const { variables, empty } = renderDigest(input());
    expect(empty).toBe(false);
    expect(variables.dayLabel).toBe('October 7, 2026');
    expect(variables.orders).toBe('3');
    expect(variables.sales).toBe('$1,234.50');
    expect(variables.netProfit).toBe('$100.00');
    expect(variables.estimatedProfit).toBe('$12.30');
    expect(variables.cancelledOrders).toBe('1');
  });

  it('writes Turkish dates and numbers for a Turkish seller', () => {
    const { variables } = renderDigest(input({ locale: 'tr' }));
    expect(variables.dayLabel).toBe('7 Ekim 2026');
    expect(variables.sales).toContain('1.234,50');
  });

  it('hides the per-store table for a single-store account', () => {
    const { variables } = renderDigest(
      input({ stores: [{ label: 'Only', metrics: metrics({ orders: 3 }) }], connectedStoreCount: 1 }),
    );
    expect(variables.storesDisplay).toContain('display:none');
    expect(variables.storesHtml).toBe('');
  });

  it('lists stores by sales and escapes their names', () => {
    const { variables } = renderDigest(
      input({
        connectedStoreCount: 2,
        stores: [
          { label: 'Small $& <b>shop</b>', metrics: metrics({ orders: 1, sales: 10 }) },
          { label: 'Big', metrics: metrics({ orders: 2, sales: 90 }) },
        ],
      }),
    );
    expect(variables.storesDisplay).toBe('');
    expect(variables.storesHtml.indexOf('Big')).toBeLessThan(variables.storesHtml.indexOf('Small'));
    expect(variables.storesHtml).toContain('Small $&amp; &lt;b&gt;shop&lt;/b&gt;');
    expect(variables.storesHtml).not.toContain('<b>');
  });

  it('names waiting items with the Action Center wording and links them', () => {
    const { variables } = renderDigest(
      input({
        pending: [
          {
            key: ActionCenterItemKey.ORDER_PURCHASE_UNKNOWN,
            severity: ActionCenterSeverity.CRITICAL,
            count: 2,
            url: 'https://app.example.com/en/orders?stage=purchase_unknown',
          },
        ],
      }),
    );
    const title = (i18nResources.en.actionCenter as { actionCenter: { items: Record<string, { title: string }> } })
      .actionCenter.items[ActionCenterItemKey.ORDER_PURCHASE_UNKNOWN].title;
    expect(variables.pendingHtml).toContain('href="https://app.example.com/en/orders?stage=purchase_unknown"');
    expect(variables.pendingHtml).toContain('>2</span>');
    expect(variables.pendingHtml).toContain(title.replace(/'/g, '&#x27;'));
  });

  it('says nothing is waiting when nothing is', () => {
    const { variables } = renderDigest(input());
    expect(variables.pendingHtml).toContain('Nothing needs you right now');
  });

  it('is empty only when the day had nothing and nothing is waiting', () => {
    const quiet = input({ total: metrics() });
    expect(renderDigest(quiet).empty).toBe(true);
    expect(renderDigest({ ...quiet, newReturns: 1 }).empty).toBe(false);
    expect(renderDigest({ ...quiet, cancelRequests: 1 }).empty).toBe(false);
    expect(renderDigest({ ...quiet, total: metrics({ refunds: 1 }) }).empty).toBe(false);
    expect(
      renderDigest({
        ...quiet,
        pending: [{ key: ActionCenterItemKey.ORDER_FULFILLMENT_BLOCKED, severity: ActionCenterSeverity.WARNING, count: 1, url: null }],
      }).empty,
    ).toBe(false);
  });

  it('escapes the first name', () => {
    expect(renderDigest(input({ firstName: '<i>Ada</i>' })).variables.firstName).toBe('&lt;i&gt;Ada&lt;/i&gt;');
  });
});

describe('resolveDigestLocale', () => {
  it('uses Turkish only for Turkish sellers; every other language reads English like the template', () => {
    expect(resolveDigestLocale('tr')).toBe('tr');
    expect(resolveDigestLocale('ru')).toBe('en');
    expect(resolveDigestLocale(null)).toBe('en');
  });
});
