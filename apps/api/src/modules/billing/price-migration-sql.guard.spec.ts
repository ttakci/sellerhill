// apps/api/src/modules/billing/price-migration-sql.guard.spec.ts
//
// `billing_plan_prices.interval` and `billing_subscriptions.interval` are two
// DIFFERENT Postgres enum types that happen to share their labels. Comparing
// them bare is a type error (42883), and the unit tests cannot see it: they
// run against fakes, so the statement is never parsed by a real database. The
// price-migration query shipped that way and failed on every hourly run in
// production until 2026-09-30, which silently disabled the automatic move of
// subscribers onto a plan's new price.

import * as fs from 'fs';
import * as path from 'path';

describe('billing interval comparisons', () => {
  const files = fs
    .readdirSync(__dirname)
    .filter((name) => name.endsWith('.ts') && !name.endsWith('.spec.ts'))
    .map((name) => ({
      name,
      source: fs
        .readFileSync(path.join(__dirname, name), 'utf8')
        .replace(/\r\n/g, '\n')
        .replace(/^\s*--.*$/gm, ''),
    }));

  it('never compares the interval columns of two tables without a cast', () => {
    const offenders: string[] = [];
    for (const { name, source } of files) {
      for (const match of source.matchAll(/\b\w+\.interval\s*=\s*\w+\.interval\b/g)) {
        offenders.push(`${name}: ${match[0]}`);
      }
    }
    expect(offenders).toEqual([]);
  });

  it('joins a subscription to its plan price on the interval as text', () => {
    const repository = files.find((file) => file.name === 'billing-repository.service.ts');
    expect(repository?.source).toContain('pp.interval::text = s.interval::text');
  });
});
