// apps/api/src/modules/buyer-messaging/buyer-message.provider.guard.spec.ts
//
// Source-grep guard: the provider must never revert to the invented
// `apix.ebay.com` endpoint or a hand-rolled `fetch` retry loop — it must send
// through the real, budget-governed `EbayMessageClient`.
import { readFileSync } from 'fs';
import { join } from 'path';

describe('buyer-message.provider source guard', () => {
  const src = readFileSync(join(__dirname, 'buyer-message.provider.ts'), 'utf8');

  it('never targets the invented endpoint or bypasses the client', () => {
    expect(src).not.toContain('apix.ebay.com');
    expect(src).not.toMatch(/\bfetch\(/);
    expect(src).toContain('EbayMessageClient');
  });
});
