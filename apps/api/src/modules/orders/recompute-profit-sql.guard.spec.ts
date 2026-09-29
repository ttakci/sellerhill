// apps/api/src/modules/orders/recompute-profit-sql.guard.spec.ts
//
// `recomputeProfit` writes `purchase_price = COALESCE(NULLIF($4, 0), …)`. With
// a bare `$4` Postgres infers the parameter's type from the literal `0` — an
// INTEGER — and refuses every real price: the first live order (2026-09-29)
// died with `invalid input syntax for type integer: "13.91"`, leaving
// `net_profit` NULL and `cost_capture_status` at `pending`. The parameter must
// be cast to numeric so the comparison, not the literal, decides the type.
//
// The write is inside a try/catch that only logs, so nothing but this spec
// notices the regression.

import * as fs from 'fs';
import * as path from 'path';

function read(...segments: string[]): string {
  return fs.readFileSync(path.join(__dirname, '..', '..', ...segments), 'utf8').replace(/\r\n/g, '\n');
}

describe('recomputeProfit purchase_price write', () => {
  const src = read('modules', 'orders', 'order-sync.service.ts');
  const fn = src.slice(src.indexOf('async recomputeProfit('));
  const body = fn.slice(0, fn.indexOf('\n  }\n'));

  it('casts the purchase-price parameter to numeric inside NULLIF', () => {
    expect(body).toMatch(/NULLIF\(\$4::numeric, 0\)/);
  });

  it('never compares a bare parameter against the integer literal 0', () => {
    // `NULLIF($n, 0)` lets Postgres type $n as integer.
    expect(body).not.toMatch(/NULLIF\(\$\d+, 0\)/);
  });
});
