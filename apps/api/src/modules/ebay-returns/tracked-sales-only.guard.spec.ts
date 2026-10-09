// apps/api/src/modules/ebay-returns/tracked-sales-only.guard.spec.ts
//
// Operator decision, 2026-10-09: the Returns and Cancellations pages show only
// OUR sales — a return / cancel request linked to an order that matched one of
// the seller's SellerHill listings (`buildTrackedOrderSql`). A sale made through
// another tool, or from before the store was connected, is shown nowhere: not
// on the pages, not in their counts, not in the detail or the answers, not in
// the Action Center and not in the daily e-mail. A read site that forgets the
// predicate fails silently (a mocked test keeps passing), so every statement
// over the two tables in a seller-facing file is checked here.

import { readFileSync } from 'fs';
import { join } from 'path';

import { buildTrackedOrderSql } from './return-store-scope';

const MODULES_DIR = join(__dirname, '..');

/** Block and line comments removed, so prose can never satisfy or break a check. */
function stripComments(text: string): string {
  return text.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '');
}

const read = (file: string): string =>
  stripComments(readFileSync(join(MODULES_DIR, file), 'utf8').replace(/\r\n/g, '\n'));

/**
 * Each statement over `ebay_returns r` / `ebay_cancellations c`: the text from
 * its `FROM` to the end of that statement (the next backtick or the next such
 * `FROM`, whichever comes first).
 */
function statements(code: string): string[] {
  const matches = [...code.matchAll(/\bFROM (ebay_returns r|ebay_cancellations c)\b/g)];
  return matches.map((match, index) => {
    const start = match.index ?? 0;
    const nextFrom = matches[index + 1]?.index ?? code.length;
    const nextTick = code.indexOf('`', start);
    return code.slice(start, Math.min(nextFrom, nextTick === -1 ? code.length : nextTick));
  });
}

/** What carries the predicate into a statement: the helper itself, or a seed checked below. */
const MARKERS = [/buildTrackedOrderSql\('[rc]'\)/, /\$\{TRACKED\}/, /\$\{filters\}/, /\$\{where\.join\(' AND '\)\}/];

const SELLER_FACING = [
  'ebay-returns/ebay-returns.service.ts',
  'ebay-returns/ebay-returns-actions.service.ts',
  'ebay-returns/ebay-cancellations-actions.service.ts',
  'action-center/action-center.service.ts',
  'seller-digest/seller-digest.service.ts',
  'orders/orders.service.ts',
];

describe('Returns and Cancellations show only our sales', () => {
  it('builds the predicate over the order the row is linked to', () => {
    expect(buildTrackedOrderSql('r')).toBe(
      'EXISTS (SELECT 1 FROM orders tracked_o WHERE tracked_o.id = r.order_id AND tracked_o.listing_id IS NOT NULL)'
    );
    expect(() => buildTrackedOrderSql('r; DROP TABLE orders')).toThrow();
  });

  it.each(SELLER_FACING)('every statement in %s carries the predicate', (file) => {
    const found = statements(read(file));
    expect(found.length).toBeGreaterThan(0);
    for (const statement of found) {
      expect(MARKERS.some((marker) => marker.test(statement))).toBe(true);
    }
  });

  it('seeds the returns page filters with the predicate', () => {
    const code = read('ebay-returns/ebay-returns.service.ts');
    expect(code).toContain("const TRACKED = buildTrackedOrderSql('r');");
    const seeds = code.match(/let filters = [^;]*;/g) ?? [];
    expect(seeds.length).toBeGreaterThanOrEqual(2);
    for (const seed of seeds) {
      expect(seed).toBe('let filters = ` AND ${TRACKED}`;');
    }
  });

  it('seeds the cancellations page conditions with the predicate', () => {
    const code = read('ebay-returns/ebay-cancellations-actions.service.ts');
    const seeds = code.match(/const where = \[[^\]]*\];/g) ?? [];
    expect(seeds.length).toBeGreaterThanOrEqual(2);
    for (const seed of seeds) {
      expect(seed).toContain("buildTrackedOrderSql('c')");
    }
  });
});
