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
  it('breaks the count down into removed (404) vs unreadable, exclusively, from the same row set', () => {
    const src = read('action-center.service.ts').replace(/\/\*[\s\S]*?\*\/|\/\/.*$/gm, '');
    expect(src).toMatch(/COUNT\(\*\) FILTER \(WHERE p\.source_removed_at IS NOT NULL\) AS removed/);
    expect(src).toMatch(/COUNT\(\*\) FILTER \(WHERE p\.source_removed_at IS NULL\) AS unreadable/);
    expect(src).toMatch(/\[SourceUnavailableReason\.REMOVED\]: toCount\(deadSource\[0\]\?\.removed\)/);
    expect(src).toMatch(/\[SourceUnavailableReason\.UNREADABLE\]: toCount\(deadSource\[0\]\?\.unreadable\)/);
  });
  it('seller copy claims neither "still buyable" nor that quarantine means Amazon removed it', () => {
    for (const locale of ['en', 'tr']) {
      const json = JSON.parse(
        readFileSync(join(__dirname, `../../../../../packages/shared/src/i18n/resources/${locale}/actionCenter.json`), 'utf8'),
      ) as { actionCenter: { items: Record<string, Record<string, string>>; reasons: Record<string, Record<string, string>> } };
      const item = json.actionCenter.items.listing_source_unavailable;
      const text = Object.values(item).join(' ');
      expect(text).not.toMatch(/still buyable|hâlâ satın alınabil|kaldırıldı|listeleme/i);
      expect(Object.keys(json.actionCenter.reasons.sourceUnavailable).sort()).toEqual(['removed', 'unreadable']);
    }
  });
  it('listings filter includes removed products', () => {
    expect(read('../listings/listings.service.ts')).toMatch(/p\.consecutive_failures >= \$\$\{paramIndex\} OR p\.source_removed_at IS NOT NULL/);
  });
});
