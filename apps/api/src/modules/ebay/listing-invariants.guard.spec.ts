import * as fs from 'fs';
import * as path from 'path';

/**
 * Source-text guards for invariants that cannot be expressed as unit tests
 * because the failure mode is "a silent default came back". Same pattern as
 * create-only-ai.guard.spec.ts.
 *
 * Every assertion here corresponds to a bug that shipped: a listing that did
 * not exist on eBay recorded as ACTIVE, a root category id used as a leaf, an
 * empty aspect list treated as a valid answer.
 */
const EBAY_DIR = path.join(__dirname);
const LISTINGS_DIR = path.join(__dirname, '..', 'listings');

function read(dir: string, file: string): string {
  return fs.readFileSync(path.join(dir, file), 'utf8');
}

/** Body of one class method, bounded by the next method declaration. */
function methodBody(source: string, declaration: string): string {
  const start = source.indexOf(declaration);
  if (start === -1) {
    throw new Error(`Method not found: ${declaration}`);
  }
  const rest = source.slice(start + declaration.length);
  const next = rest.indexOf('\n  private ');
  return next > -1 ? rest.slice(0, next) : rest;
}

describe('eBay create-path invariants', () => {
  const ebayService = read(EBAY_DIR, 'ebay.service.ts');

  it('never falls back to category id 1 (eBay root, not a listable leaf)', () => {
    expect(ebayService).not.toMatch(/categoryId:\s*'1'/);
    expect(ebayService).toMatch(/throw new CategoryResolutionError\(/);
  });

  it('never treats an empty aspect list as a valid answer', () => {
    const body = methodBody(ebayService, 'private async getItemAspectsForCategory');
    expect(body).toMatch(/throw new CategoryAspectsUnavailableError\(/);
    expect(body).not.toMatch(/return \[\];/);
  });

  it('never returns a publish result without a listing id', () => {
    expect(ebayService).toMatch(/throw new ListingPublishExhaustedError\(/);
    // The old code ended createListingWithRest with a bare `return { listingId, categoryName }`
    // after the retry loop, where listingId was still ''.
    const loopEnd = ebayService.indexOf('throw new ListingPublishExhaustedError(');
    const afterLoop = ebayService.slice(loopEnd);
    expect(afterLoop.slice(0, afterLoop.indexOf('\n  }\n'))).not.toMatch(/return \{ listingId/);
  });

  it('wraps create-path eBay calls in the rate-limit retry', () => {
    for (const fn of ['createOrReplaceInventoryItem', 'createOffer', 'publishOffer']) {
      expect(methodBody(ebayService, `private async ${fn}(`)).toMatch(/this\.withRateLimitRetry\(/);
    }
  });

  it('never sends a brand without an MPN (eBay validates the pair)', () => {
    // "Input data for tag <BrandMPN> is invalid or missing" — dropping a bad MPN
    // must not leave the brand unpaired. The rule lives in the shared payload
    // builder so the single and batched write paths cannot disagree about it.
    expect(read(EBAY_DIR, 'ebay-listing-payload.ts')).toMatch(/EBAY_NOT_APPLICABLE/);
  });

  it('builds both write paths from the same payload module', () => {
    // A bulk-published listing must be byte-for-byte what the single path would
    // have published. Two payload builders would drift, and every rule encoded
    // there (GTIN check digits, BrandMPN, tag-safe truncation, the image floor)
    // is one that has already broken live listings once.
    for (const file of ['ebay.service.ts', 'ebay-bulk.service.ts']) {
      const source = read(EBAY_DIR, file);
      expect(source).toMatch(/buildInventoryItemPayload\(/);
      expect(source).toMatch(/buildOfferPayload\(/);
    }
  });

  it('never records a bulk-created listing eBay did not confirm', () => {
    // The batched path has the same failure mode the single path shipped: a
    // missing response entry must never be read as success.
    const helpers = read(EBAY_DIR, 'ebay-bulk.helpers.ts');
    expect(helpers).toMatch(/export function isBulkEntrySuccess/);
    // A null entry (eBay answered for fewer items than we sent) is a failure.
    expect(helpers).toMatch(/if \(!entry\) \{\s*return false;/);
  });

  it('bounds the batched aspect self-heal so a batch cannot loop forever', () => {
    const bulk = read(EBAY_DIR, 'ebay-bulk.service.ts');
    expect(bulk).toMatch(/MAX_CREATE_ATTEMPTS/);
    expect(bulk).toMatch(/state\.attempts \+= 1/);
    // An aspect is forced at most once; the second refusal is terminal.
    expect(bulk).toMatch(/!state\.forcedAspectNames\.includes\(missing\)/);
  });

  it('guards both listing write sites against an empty eBay item id', () => {
    expect(read(LISTINGS_DIR, 'listing-processor.service.ts')).toMatch(/if \(!ebayItemId\)/);
    expect(read(LISTINGS_DIR, 'listings.service.ts')).toMatch(/if \(!ebayItemId\)/);
  });
});

describe('aspect resolution purity', () => {
  it('keeps the aspect modules pure and framework-free', () => {
    for (const file of ['aspect-builder.ts', 'aspect-priors.ts']) {
      const source = read(EBAY_DIR, file);
      expect(source).not.toMatch(/\bawait\b/);
      expect(source).not.toMatch(/from '@nestjs\//);
      expect(source).not.toMatch(/from 'axios'/);
      expect(source).not.toMatch(/database/i);
    }
  });

  it('keeps the terminal fallback wired into the builder', () => {
    // Without this, a required SELECTION_ONLY aspect is dropped and the publish
    // dies with "no value could be derived" — the bug this work exists to kill.
    expect(read(EBAY_DIR, 'aspect-builder.ts')).toMatch(/pickTerminalValue\(aspect\)/);
  });
});
