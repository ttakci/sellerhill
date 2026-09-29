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
    const calls = [...src.matchAll(/(?:await|void) this\.subscribeToMessages\(/g)].map((m) => m.index ?? -1);
    expect(calls.length).toBeGreaterThanOrEqual(2);
    expect(calls.some((i) => i > updateIdx && i < insertIdx)).toBe(true);
    expect(calls.some((i) => i > insertIdx)).toBe(true);
  });

  it('never makes the OAuth callback wait on the subscription', () => {
    expect(src).not.toMatch(/await this\.subscribeToMessages\(/);
    expect(src.match(/void this\.subscribeToMessages\(/g)?.length ?? 0).toBe(2);
  });

  it('treats a same-owner callback as a re-consent, never accountAlreadyConnected', () => {
    const start = src.indexOf('async handleCallback(');
    const end = src.indexOf('INSERT INTO ebay_accounts', start);
    const body = src.slice(start, end);
    // The only accountAlreadyConnected throw sits inside the different-owner branch.
    const ownerBranch = body.indexOf('existing.user_id !== userId');
    const conflict = body.indexOf("'ebay.errors.accountAlreadyConnected'");
    const storeOwned = body.indexOf("'ebay.errors.storeOwnedByAnotherAccount'");
    expect(ownerBranch).toBeGreaterThan(-1);
    expect(conflict).toBeGreaterThan(ownerBranch);
    expect(storeOwned).toBeGreaterThan(conflict);
    expect(body.match(/accountAlreadyConnected/g)?.length).toBe(1);
    // No status-only refusal that would also catch the owner's own active row.
    expect(body).not.toMatch(/if \(existing && existing\.status !== EBAY_ACCOUNT_STATUS\.DISCONNECTED\)/);
    // The reactivate UPDATE runs for any existing row that survived the owner check.
    expect(body).toMatch(/if \(existing\) \{\s*const reactivated/);
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
