// apps/api/src/modules/amazon/raw-tracking-never-pushed.guard.spec.ts
//
// THE rule this whole feature exists for: when a conversion was expected and
// did not produce a number, the raw Amazon tracking number is NEVER pushed to
// eBay. A seller pays to keep their supplier hidden; handing the buyer the
// supplier's own tracking number defeats the entire product, and eBay's
// Fulfillment API has no update endpoint, so it can never be taken back.
//
// This is a guard spec because the rule was once the OPPOSITE. The processor
// used to push the raw number after a 12h window on the reasoning that
// "late-but-honest tracking beats no tracking at all" — a defensible-sounding
// sentence that traded the product's purpose for shipping-status timeliness
// nobody asked us to prioritise. A future reader optimising for eBay defect
// metrics could reintroduce it in one line; this spec is what stops them.

import { readFileSync } from 'fs';
import { join } from 'path';

import { ConversionOutcome, mayPushToEbay } from '@repo/shared';

const PROCESSOR = readFileSync(
  join(__dirname, 'amazon-tracking-processor.service.ts'),
  'utf8',
);

const read = (...segments: string[]): string =>
  readFileSync(join(__dirname, '..', '..', ...segments), 'utf8');

describe('mayPushToEbay', () => {
  it('allows a real conversion', () => {
    expect(mayPushToEbay(ConversionOutcome.CONVERTED)).toBe(true);
  });

  it('allows a pass-through the SELLER chose', () => {
    // Provider left on `local`, carrier outside their configured scope, or
    // conversion switched off for hand-linked orders. The raw number is the
    // intended, honest result — holding these would strand every order of
    // every seller who never enabled conversion.
    expect(mayPushToEbay(ConversionOutcome.PASSTHROUGH_NOT_REQUIRED)).toBe(true);
  });

  it('allows an unclassified result, which is the pure local converter', () => {
    expect(mayPushToEbay(undefined)).toBe(true);
  });

  it('REFUSES a conversion that was expected and failed', () => {
    // Suspended subscription, exhausted quota, missing API key, incomplete
    // ship-from address, no usable profile, provider plan exhausted.
    expect(mayPushToEbay(ConversionOutcome.PASSTHROUGH_FAILED)).toBe(false);
  });

  it('REFUSES a retryable failure', () => {
    expect(mayPushToEbay(ConversionOutcome.PASSTHROUGH_RETRYABLE)).toBe(false);
  });

  it('covers every outcome the enum defines', () => {
    // A new outcome added without deciding its push rule would silently take
    // the `undefined` branch and become pushable — exactly the direction that
    // exposes a supplier. Force the author to come here and choose.
    for (const outcome of Object.values(ConversionOutcome)) {
      expect(typeof mayPushToEbay(outcome)).toBe('boolean');
    }
    expect(Object.values(ConversionOutcome).sort()).toEqual(
      ['converted', 'passthrough_failed', 'passthrough_not_required', 'passthrough_retryable'].sort(),
    );
  });
});

describe('the shipped-transition processor', () => {
  it('gates its eBay push on mayPushToEbay', () => {
    expect(PROCESSOR).toMatch(/mayPushToEbay\s*\(/);
  });

  it('does not push on an expired deferral window', () => {
    // The removed behaviour, in the words it was written in. If either of
    // these reappears, the raw number is reaching buyers again.
    expect(PROCESSOR).not.toMatch(/late-but-honest/i);
    expect(PROCESSOR).not.toMatch(/past the\s*\n?\s*\/\/\s*window the push goes through/i);
  });
});

describe('conversion is ON by default (migration 112)', () => {
  // The rule above only protects an order where a conversion was EXPECTED.
  // `PASSTHROUGH_NOT_REQUIRED` is publishable, and it is what a seller on the
  // `local` provider produces — so while `local` was the DEFAULT, a seller who
  // never opened Store Settings shipped every order with the raw Amazon number
  // and the guard above never applied. The default is the other half of the
  // rule, and nothing tested it.

  it('defaults a store with no settings row to converting', () => {
    const service = read('modules', 'store-settings', 'store-settings.service.ts');
    expect(service).toMatch(
      /trackingConversionProvider: TrackingConversionProvider\.AQUILINE/,
    );
    expect(service).not.toMatch(
      /trackingConversionProvider: TrackingConversionProvider\.LOCAL/,
    );
  });

  it('reads an absent or unrecognised stored provider as converting', () => {
    // The two failure directions are not symmetric: a value we cannot read
    // must never put the supplier in front of a buyer. An explicit `local` is
    // a seller who opted out and still means off.
    const service = read('modules', 'amazon', 'tracking-conversion.service.ts');
    const fn = service.slice(service.indexOf('export function normalizeProvider('));
    const body = fn.slice(0, 1200);
    const localArm = body.slice(body.indexOf('case TrackingConversionProvider.LOCAL:'));
    expect(localArm.slice(0, 120)).toContain('return TrackingConversionProvider.LOCAL;');
    const defaultArm = body.slice(body.indexOf('default:'));
    expect(defaultArm.slice(0, 120)).toContain('return TrackingConversionProvider.AQUILINE;');
  });

  it('keeps the provider key a panel setting, so a plan change needs no redeploy', () => {
    // With conversion expected, a missing key classifies as PASSTHROUGH_FAILED
    // and the push is held. The key therefore has to be settable while the
    // system runs: it is an encrypted, write-only platform setting read at call
    // time, and NOT requiresRestart. Wiring it through compose would make every
    // rotation or Aquiline plan upgrade a redeploy.
    const registry = read('common', 'settings', 'platform-settings.registry.ts');
    for (const key of ['AQUILINE_API_KEY', 'AQUILINE_WEBHOOK_SECRET']) {
      const at = registry.indexOf("envVar: '" + key + "'");
      const entry = registry.slice(registry.lastIndexOf('def({', at), registry.indexOf('}),', at));
      expect(entry).toContain('isSecret: true');
      expect(entry).not.toContain('requiresRestart');
    }
  });
});
