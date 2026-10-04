import { readdirSync, readFileSync } from 'fs';
import { join } from 'path';

// Capture-only (spec Part C3): until a parser is written against a real
// captured response, nothing in this module writes anything but the claim
// stamp, and it only ever READS eBay.

const stripComments = (src: string): string => src.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/.*$/gm, '');
const sources = readdirSync(__dirname)
  .filter((file) => file.endsWith('.ts') && !file.endsWith('.spec.ts'))
  .map((file) => stripComments(readFileSync(join(__dirname, file), 'utf8')));
const all = sources.join('\n');

describe('eBay Finances module is capture-only', () => {
  it('writes nothing to the database but the claim stamp', () => {
    expect(all).not.toMatch(/INSERT\s+INTO/i);
    expect(all).not.toMatch(/DELETE\s+FROM/i);
    expect(all).not.toMatch(/UPDATE\s+orders/i);
    expect(all.match(/UPDATE\s+ebay_accounts/gi)?.length).toBe(1);
  });

  it('only ever reads eBay, and only billing activity', () => {
    const client = stripComments(readFileSync(join(__dirname, 'finances.client.ts'), 'utf8'));
    expect(client).toMatch(/axios\.get/);
    expect(client).not.toMatch(/axios\.(post|put|patch|delete)/);
    expect(client.match(/\/sell\/finances\/v1\/[a-z_]+/g)).toEqual(['/sell/finances/v1/billing_activity']);
  });
});
