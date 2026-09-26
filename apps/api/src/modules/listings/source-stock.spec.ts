import { formatSourceStock, SourceStockStatus } from '@repo/shared';

describe('formatSourceStock', () => {
  it('renders AT_LEAST as N+', () => {
    expect(formatSourceStock(20, SourceStockStatus.AT_LEAST)).toBe('20+');
    expect(formatSourceStock(4, SourceStockStatus.AT_LEAST)).toBe('4+');
  });
  it('renders exact and out-of-stock as the number', () => {
    expect(formatSourceStock(20, SourceStockStatus.EXACT)).toBe('20');
    expect(formatSourceStock(0, SourceStockStatus.OUT_OF_STOCK)).toBe('0');
  });
  it('renders a missing value as an em dash and a missing status as the plain number', () => {
    expect(formatSourceStock(null, SourceStockStatus.EXACT)).toBe('—');
    expect(formatSourceStock(7, undefined)).toBe('7');
  });
});
