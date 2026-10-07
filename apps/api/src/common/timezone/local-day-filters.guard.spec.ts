import * as fs from 'fs';
import * as path from 'path';

const read = (...p: string[]) =>
  fs.readFileSync(path.join(__dirname, '..', '..', ...p), 'utf8').replace(/\r\n/g, '\n');

describe('order-date filters are bounded by the seller’s local midnight', () => {
  const orders = read('modules', 'orders', 'orders.service.ts');
  const listings = read('modules', 'listings', 'listings.service.ts');

  it('orders dateFrom/dateTo use the local-day helpers', () => {
    expect(orders).toMatch(/localDayStartSql\(/);
    expect(orders).toMatch(/localDayEndExclusiveSql\(/);
    expect(orders).not.toMatch(/o\.order_date >= \$\$\{paramIndex\}::date/);
  });

  it('listings soldFrom/soldTo use the local-day helpers', () => {
    expect(listings).toMatch(/o_sold\.order_date >= \$\{localDayStartSql\(/);
    expect(listings).toMatch(/o_sold\.order_date < \$\{localDayEndExclusiveSql\(/);
    expect(listings).not.toMatch(/o_sold\.order_date >= \$\$\{paramIndex\}::date/);
  });
});
