import { readdirSync, readFileSync, statSync } from 'fs';
import { join } from 'path';

/**
 * The per-user "the active account" helpers (`getActiveAccount`,
 * `getActiveAccountId`, `getActiveAccountAccessToken`) were an unordered
 * `LIMIT 1` over a seller's stores: a seller with two stores got an arbitrary
 * one, and work went out through the wrong store's token. They are deleted;
 * every caller names the store it is for. This keeps them gone.
 */
const SRC = join(__dirname, '..', '..');

function sourceFiles(dir: string): string[] {
  const out: string[] = [];
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) {
      out.push(...sourceFiles(full));
    } else if (entry.endsWith('.ts') && !entry.endsWith('.spec.ts') && !entry.endsWith('.d.ts')) {
      out.push(full);
    }
  }
  return out;
}

/** Comments may still tell the history; only code counts. */
function stripComments(source: string): string {
  return source.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '');
}

describe('no per-user "active account" helper', () => {
  const files = sourceFiles(SRC);

  it('scans the api sources', () => {
    expect(files.length).toBeGreaterThan(100);
    expect(files.some((file) => file.endsWith(join('ebay', 'ebay.service.ts')))).toBe(true);
  });

  it('no source file defines or calls getActiveAccount*', () => {
    const offenders = files.filter((file) => /getActiveAccount/.test(stripComments(readFileSync(file, 'utf8'))));
    expect(offenders).toEqual([]);
  });
});
