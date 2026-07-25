import * as fs from 'fs';
import * as path from 'path';

describe('create-only AI invariant', () => {
  const root = path.join(__dirname);

  it('listing create processor passes applyContentAi: true', () => {
    const src = fs.readFileSync(path.join(root, 'listing-processor.service.ts'), 'utf8');
    expect(src).toMatch(/applyContentAi:\s*true/);
  });

  it('product-sync does not pass applyContentAi: true', () => {
    const src = fs.readFileSync(path.join(root, 'product-sync.service.ts'), 'utf8');
    expect(src).not.toMatch(/applyContentAi:\s*true/);
    expect(src).toMatch(/prepareListingData\s*\(/);
  });

  it('listing-strategy defaults applyContentAi off', () => {
    const src = fs.readFileSync(path.join(root, 'listing-strategy.service.ts'), 'utf8');
    expect(src).toMatch(/const applyAi = Boolean\(options\?\.applyContentAi\)/);
  });
});
