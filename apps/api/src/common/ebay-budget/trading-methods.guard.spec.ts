// Every Trading call this codebase makes must have its own governed resource.
//
// eBay meters Trading per METHOD, so a Trading call with no matching
// `RESOURCE_SOURCE` row is invisible to the budget: it spends a real,
// separately-metered eBay quota that no counter records. This is a
// source-grep because the failure is a missing line — it breaks nothing at
// runtime, the call just goes ungoverned.

import { readdirSync, readFileSync, statSync } from 'fs';
import { join } from 'path';

import { RESOURCE_SOURCE } from './ebay-rate-limits';

const MODULES_DIR = join(__dirname, '..', '..', 'modules');

function sourceFiles(dir: string): string[] {
  return readdirSync(dir).flatMap((entry) => {
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) {
      return sourceFiles(full);
    }
    return full.endsWith('.ts') && !full.endsWith('.spec.ts') ? [full] : [];
  });
}

describe('Trading methods are governed', () => {
  const called = new Set<string>();
  for (const file of sourceFiles(MODULES_DIR)) {
    const source = readFileSync(file, 'utf8');
    for (const match of source.matchAll(/'X-EBAY-API-CALL-NAME':\s*'([A-Za-z]+)'/g)) {
      called.add(match[1]);
    }
  }
  const governed = Object.values(RESOURCE_SOURCE)
    .filter((s) => s.trading)
    .map((s) => s.name);

  it('finds the Trading calls it is guarding', () => {
    // If this drops to zero the regex no longer matches the call sites and
    // the guard below would pass vacuously.
    expect(called.size).toBeGreaterThan(0);
  });

  it.each([...called])('governs the Trading call %s', (method) => {
    expect(governed).toContain(method);
  });

  it('declares no Trading resource for a method nothing calls', () => {
    expect([...governed].sort()).toEqual([...called].sort());
  });
});
