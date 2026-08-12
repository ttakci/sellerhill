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
  // Normalized to LF: these assertions pin multi-line shapes with `\n`, and the
  // repo is checked out with CRLF on Windows. Without this every such regex
  // fails on a developer machine while passing in CI — a false alarm that
  // teaches the team to ignore this guard, which is exactly what it must not be.
  return fs.readFileSync(path.join(dir, file), 'utf8').replace(/\r\n/g, '\n');
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
    // The original single-item loop ended with a bare `return { listingId }`
    // where listingId was still '', and the caller wrote an ACTIVE row for a
    // listing that does not exist on eBay. The batched path inherits the rule:
    // running out of attempts is a typed failure, never an empty success.
    const bulk = read(EBAY_DIR, 'ebay-bulk.service.ts');
    expect(bulk).toMatch(/new ListingPublishExhaustedError\(/);
    expect(bulk).not.toMatch(/listingId:\s*''/);
  });

  it('wraps create-path eBay calls in the rate-limit retry', () => {
    // Every write the create path makes goes through the shared retry helper,
    // which is also where the call budget is charged — one transient 500 used
    // to burn a whole BullMQ attempt for that ASIN.
    const bulk = read(EBAY_DIR, 'ebay-bulk.service.ts');
    for (const fn of ['private async postBulk(', 'private async refreshOffer(']) {
      expect(methodBody(bulk, fn)).toMatch(/withEbayRateLimitRetry\(/);
    }
  });

  it('keeps exactly one create implementation', () => {
    // `createListingWithRest` was a second one: it rebuilt the same eBay bodies,
    // ran its own aspect self-heal loop, spent three calls per listing where a
    // batch spends three per 25, and charged the call budget nothing — so draft
    // publishing was invisible to the quota governor. Publishing a draft now
    // goes through EbayBulkService like every other create.
    expect(ebayService).not.toMatch(/createListingWithRest/);
    expect(ebayService).not.toMatch(/private async (createOffer|publishOffer)\(/);
    expect(read(LISTINGS_DIR, 'listings.service.ts')).toMatch(
      /this\.ebayBulkService\.createListings\(/
    );
  });

  it('never sends a brand without an MPN (eBay validates the pair)', () => {
    // "Input data for tag <BrandMPN> is invalid or missing" — dropping a bad MPN
    // must not leave the brand unpaired. The rule lives in the shared payload
    // builder so the single and batched write paths cannot disagree about it.
    expect(read(EBAY_DIR, 'ebay-listing-payload.ts')).toMatch(/EBAY_NOT_APPLICABLE/);
  });

  it('builds every eBay body from the shared payload module', () => {
    // Every rule encoded there (GTIN check digits, BrandMPN, tag-safe
    // truncation, the image floor) has already broken live listings once, so
    // the bodies are never hand-rolled at a call site.
    const bulk = read(EBAY_DIR, 'ebay-bulk.service.ts');
    expect(bulk).toMatch(/buildInventoryItemPayload\(/);
    expect(bulk).toMatch(/buildOfferPayload\(/);
  });

  it('sends a locale on every bulk inventory item', () => {
    // The single-item PUT only needed the Content-Language header, but the bulk
    // endpoint validates a per-entry `locale` and rejects the WHOLE batch
    // without it ("Valid SKU and locale information are required for all the
    // InventoryItems in the request") — so every bulk-created listing failed.
    const bulk = read(EBAY_DIR, 'ebay-bulk.service.ts');
    expect(bulk).toMatch(/const locale = context\.contentLanguage\.replace\('-', '_'\)/);
    expect(bulk).toMatch(/sku: state\.draft\.sku, locale/);
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

  it('records the SKU and offer id at create, on both write sites', () => {
    // Migration 067 exists to stop paying an offer lookup on every price push,
    // and the SKU is NOT recoverable afterwards — sandbox mints a timestamped
    // one. Both columns were nevertheless left out of the INSERT, so every new
    // listing came back NULL and the fan-out fell back to guessing the SKU.
    const listings = read(LISTINGS_DIR, 'listings.service.ts');
    expect(listings).toMatch(/sku, ebay_offer_id\n\s*\)/);
    expect(listings).toMatch(/sku = \$16,\s*\n\s*ebay_offer_id = \$17/);
    expect(read(LISTINGS_DIR, 'listing-processor.service.ts')).toMatch(
      /sku: prepared\.sku,\s*\n\s*ebayOfferId: outcome\.offerId/
    );

    // …and a SKU we only guessed is never written back unless eBay confirmed it
    // by resolving an offer from it. A wrong SKU in this column is permanent.
    expect(read(LISTINGS_DIR, 'product-sync.service.ts')).toMatch(
      /sku = CASE WHEN v\.offer_id IS NOT NULL THEN COALESCE\(l\.sku, v\.sku\) ELSE l\.sku END/
    );
  });

  it('guards both listing write sites against an empty eBay item id', () => {
    // An ACTIVE row with no eBay item id does not exist on eBay, can never be
    // matched to an order (order sync keys on that column), and blocks
    // re-listing the ASIN. Both the queue worker and the publish path refuse it.
    for (const file of ['listing-processor.service.ts', 'listings.service.ts']) {
      expect(read(LISTINGS_DIR, file)).toMatch(/if \(!\w+\.ok \|\| !\w+\.listingId\)/);
    }
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
