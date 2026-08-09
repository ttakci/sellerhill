import * as fs from 'fs';
import * as path from 'path';

/** Source of a method body, by brace matching from its signature. */
function methodBody(source: string, name: string): string {
  const start = source.indexOf(`  async ${name}(`);
  expect(start).toBeGreaterThan(-1);

  let depth = 0;
  for (let index = source.indexOf('{', start); index < source.length; index += 1) {
    if (source[index] === '{') {
      depth += 1;
    } else if (source[index] === '}') {
      depth -= 1;
      if (depth === 0) {
        return source.slice(start, index + 1);
      }
    }
  }
  throw new Error(`Could not find the end of ${name}`);
}

describe('create-only AI invariant', () => {
  const root = path.join(__dirname);

  it('listing create processor passes applyContentAi: true', () => {
    const src = fs.readFileSync(path.join(root, 'listing-processor.service.ts'), 'utf8');
    expect(src).toMatch(/applyContentAi:\s*true/);
  });

  it('product-sync reprices through the AI-free path, never the create path', () => {
    const src = fs.readFileSync(path.join(root, 'product-sync.service.ts'), 'utf8');
    expect(src).not.toMatch(/applyContentAi:\s*true/);
    // Stronger than "passes applyContentAi: false": the refresh fan-out resolves
    // price/quantity through computePricing, which never enters the branch that
    // can call the LLM. It must not reach for prepareListingData at all.
    expect(src).toMatch(/computePricing\s*\(/);
    expect(src).not.toMatch(/prepareListingData\s*\(/);
  });

  it('computePricing cannot reach content generation', () => {
    const src = fs.readFileSync(path.join(root, 'listing-strategy.service.ts'), 'utf8');
    expect(methodBody(src, 'computePricing')).not.toMatch(/contentGeneration/);
  });

  it('listing-strategy defaults applyContentAi off', () => {
    const src = fs.readFileSync(path.join(root, 'listing-strategy.service.ts'), 'utf8');
    expect(src).toMatch(/const applyAi = Boolean\(options\?\.applyContentAi\)/);
  });
});
