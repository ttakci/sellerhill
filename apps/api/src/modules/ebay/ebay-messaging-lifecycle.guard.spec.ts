import { readFileSync } from 'fs';
import { join } from 'path';

/**
 * Source-grep guards for the eBay messaging lifecycle. Each of these fails
 * silently at runtime (a store that never subscribes, a subscription left
 * dangling on disconnect, a UI flag stuck at false), so no unit test would
 * notice a regression.
 */
const src = readFileSync(join(__dirname, 'ebay.service.ts'), 'utf8');

describe('eBay messaging lifecycle invariants', () => {
  it('records granted_scopes on both the INSERT and the reconnect UPDATE', () => {
    expect(src.match(/granted_scopes/g)?.length ?? 0).toBeGreaterThanOrEqual(3); // entity + INSERT + UPDATE
  });

  it('writes granted_scopes from the OAuth service, never a hardcoded list', () => {
    expect(src.match(/this\.oauthService\.getScopes\(\)/g)?.length ?? 0).toBeGreaterThanOrEqual(2);
  });

  it('subscribes the store to NEW_MESSAGE after the row is written, on both branches', () => {
    expect(src.match(/subscribeToMessages\(/g)?.length ?? 0).toBeGreaterThanOrEqual(3); // definition + 2 call sites
    expect(src.match(/subscribeAccount\(/g)?.length ?? 0).toBeGreaterThanOrEqual(1);
    const updateIdx = src.indexOf('granted_scopes = $8');
    const insertIdx = src.indexOf('INSERT INTO ebay_accounts');
    const calls = [...src.matchAll(/await this\.subscribeToMessages\(/g)].map((m) => m.index ?? -1);
    expect(calls.length).toBeGreaterThanOrEqual(2);
    expect(calls.some((i) => i > updateIdx && i < insertIdx)).toBe(true);
    expect(calls.some((i) => i > insertIdx)).toBe(true);
  });

  it('unsubscribes BEFORE the tokens are nulled on disconnect', () => {
    const unsub = src.indexOf('unsubscribeAccount(');
    const nulling = src.indexOf('access_token = NULL');
    expect(unsub).toBeGreaterThan(-1);
    expect(unsub).toBeLessThan(nulling);
  });

  it('exposes messagingEnabled from granted_scopes', () => {
    expect(src).toMatch(/messagingEnabled:\s*hasMessagingScopes\(entity\.granted_scopes\)/);
  });
});
