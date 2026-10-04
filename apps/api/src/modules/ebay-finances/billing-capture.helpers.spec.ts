import { buildBillingDateFilter, readBillingPage, summarizeFeeTypes } from './billing-capture.helpers';

describe('billing capture helpers', () => {
  it('builds the documented transactionDate range filter in UTC', () => {
    expect(buildBillingDateFilter(new Date('2026-10-04T00:00:00Z'), 30)).toBe(
      'transactionDate:[2026-09-04T00:00:00.000Z..2026-10-04T00:00:00.000Z]'
    );
  });

  it('never reaches back further than eBay allows, and never asks for less than a day', () => {
    expect(buildBillingDateFilter(new Date('2026-10-04T00:00:00Z'), 500)).toBe(
      'transactionDate:[2026-06-06T00:00:00.000Z..2026-10-04T00:00:00.000Z]'
    );
    expect(buildBillingDateFilter(new Date('2026-10-04T00:00:00Z'), 0)).toBe(
      'transactionDate:[2026-10-03T00:00:00.000Z..2026-10-04T00:00:00.000Z]'
    );
  });

  it('reads nothing from a body that is not the documented object', () => {
    expect(readBillingPage(null)).toBeNull();
    expect(readBillingPage([])).toBeNull();
    expect(readBillingPage('x')).toBeNull();
  });

  it('reads the paging facts and the fee types of one page', () => {
    expect(readBillingPage({ billingActivities: [{ feeType: 'A' }, {}], total: 2, next: '' })).toEqual({
      count: 2,
      total: 2,
      hasNext: false,
      feeTypes: ['A'],
    });
    expect(readBillingPage({ billingActivities: [], next: 'https://next' })).toEqual({
      count: 0,
      total: null,
      hasNext: true,
      feeTypes: [],
    });
  });

  it('summarizes the fee types seen, for the log line', () => {
    expect(summarizeFeeTypes([])).toBe('none');
    expect(
      summarizeFeeTypes([
        { count: 2, total: 3, hasNext: true, feeTypes: ['B', 'A'] },
        { count: 1, total: 3, hasNext: false, feeTypes: ['A'] },
      ])
    ).toBe('A×2, B×1');
  });
});
