import { readFileSync } from 'fs';
import { join } from 'path';

// The Action Center count and the listings deep-link filter must agree on
// which listings are "unavailable on Amazon" — both must include the
// scraper's 404 flag, not only the failure-count threshold.
describe('source-unavailable predicate', () => {
  const read = (p: string) => readFileSync(join(__dirname, p), 'utf8');
  it('action center counts removed products', () => {
    expect(read('action-center.service.ts')).toMatch(/consecutive_failures >= \$3 OR p\.source_removed_at IS NOT NULL/);
  });
  it('listings filter includes removed products', () => {
    expect(read('../listings/listings.service.ts')).toMatch(/p\.consecutive_failures >= \$\$\{paramIndex\} OR p\.source_removed_at IS NOT NULL/);
  });
});
