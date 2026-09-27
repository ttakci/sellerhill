import { ListingStrategyService } from './listing-strategy.service';

const svc = Object.create(ListingStrategyService.prototype) as ListingStrategyService;
const group = (defaultQuantity: number, stockBuffer: number) => ({ stock: { defaultQuantity, stockBuffer } }) as never;

describe('calculateQuantity', () => {
  it('unchanged without an order limit', () => {
    expect(svc.calculateQuantity(20, group(3, 5))).toBe(3);
    expect(svc.calculateQuantity(6, group(3, 5))).toBe(1);
    expect(svc.calculateQuantity(5, group(3, 5))).toBe(0);
  });
  it('the order limit caps the listed quantity', () => {
    expect(svc.calculateQuantity(20, group(10, 0), 4)).toBe(4);
  });
  it('a limit above defaultQuantity changes nothing', () => {
    expect(svc.calculateQuantity(20, group(3, 0), 30)).toBe(3);
  });
  it('spec example: limited In Stock (4), buffer 5 → 0', () => {
    expect(svc.calculateQuantity(4, group(1, 5), 4)).toBe(0);
  });
  it('null / non-positive limit is ignored', () => {
    expect(svc.calculateQuantity(20, group(3, 0), null)).toBe(3);
    expect(svc.calculateQuantity(20, group(3, 0), 0)).toBe(3);
  });
});
