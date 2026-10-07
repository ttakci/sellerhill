// apps/api/src/modules/orders/orders-filter-forwarding.guard.spec.ts
//
// Every field of `OrderFiltersDto` must be forwarded by the web app's
// `getOrders` request mapper.
//
// The mapper copies filters into query params one `if` at a time, so adding a
// filter to the DTO, the hook and the SQL still ships a dropdown that does
// nothing if that last hand-written line is forgotten — the request goes out
// unfiltered and the list simply looks unaffected. That is exactly how
// `fulfillmentState` and `isTracked` ("tracked by SellerHill") stopped working.

import * as fs from 'fs';
import * as path from 'path';

function readFromRepoRoot(...segments: string[]): string {
  return fs
    .readFileSync(path.join(__dirname, '..', '..', '..', '..', '..', ...segments), 'utf8')
    .replace(/\r\n/g, '\n');
}

describe('orders list: every OrderFiltersDto field reaches the request', () => {
  const types = readFromRepoRoot('packages', 'shared', 'src', 'domain', 'orders', 'orders.types.ts');
  const dtoStart = types.indexOf('export interface OrderFiltersDto');
  const dtoBody = types.slice(dtoStart, types.indexOf('\n}\n', dtoStart));
  const fields = [...dtoBody.matchAll(/^ {2}(\w+)\??:/gm)].map((m) => m[1]);

  const mapper = readFromRepoRoot('apps', 'web', 'src', 'features', 'orders', 'api', 'orders.api.ts');

  it('finds the DTO fields it is meant to check', () => {
    expect(fields).toEqual(expect.arrayContaining(['fulfillmentState', 'isTracked', 'status']));
  });

  it.each(fields)('forwards %s', (field) => {
    expect(mapper).toContain(`filters.${field}`);
  });

  it('sends isTracked under the name the controller reads, and keeps `false`', () => {
    const controller = fs.readFileSync(path.join(__dirname, 'orders.controller.ts'), 'utf8');
    expect(controller).toMatch(/@Query\('tracked'\)/);
    expect(mapper).toMatch(/params\.tracked = String\(filters\.isTracked\)/);
    // `false` is a real filter (untracked orders) — a truthiness check drops it.
    expect(mapper).toMatch(/filters\.isTracked !== undefined/);
  });

  it('sends cancelRequested under the name the controller reads (the Action Center link)', () => {
    const controller = fs.readFileSync(path.join(__dirname, 'orders.controller.ts'), 'utf8');
    expect(controller).toMatch(/@Query\('cancelRequested'\)/);
    expect(mapper).toMatch(/params\.cancelRequested = 'true'/);
  });
});
