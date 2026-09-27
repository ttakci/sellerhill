import { readFileSync } from 'fs';
import { join } from 'path';

// Every surface that shows Amazon stock must go through formatSourceStock,
// or an AT_LEAST value renders as a bare "20" and reads as an exact count.
describe('Amazon stock display', () => {
  const web = (p: string) => readFileSync(join(__dirname, '../../../../web/src/features/listings', p), 'utf8');
  // Comments stripped and a CALL required: an unused import (or a comment)
  // naming the helper must not satisfy the guard.
  const code = (text: string) => text.replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|[^:'"`])\/\/.*$/gm, '$1');
  it('listing detail, table column and CSV use formatSourceStock', () => {
    expect(code(web('detail/ListingDetailPage.container.tsx'))).toMatch(/formatSourceStock\(/);
    expect(code(web('all/hooks/useListingsColumns.tsx'))).toMatch(/formatSourceStock\(/);
    expect(readFileSync(join(__dirname, 'listings.service.ts'), 'utf8')).toMatch(/formatSourceStock\(item\.sourceStock/);
  });
  it('the API exposes the status next to the number', () => {
    expect(readFileSync(join(__dirname, 'listings.service.ts'), 'utf8')).toMatch(/sourceStockStatus:/);
  });
});
