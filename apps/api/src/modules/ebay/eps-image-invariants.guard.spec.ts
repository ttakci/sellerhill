import * as fs from 'fs';
import * as path from 'path';

/**
 * Source-text guards for the eBay Picture Services (EPS) image feature. Same
 * pattern as listing-invariants.guard.spec.ts: every invariant here reverts
 * SILENTLY. A fallback to an Amazon URL still renders a picture — nothing
 * fails, a screenshot looks fine, the supplier is just named in the page
 * source forever. A re-introduced delete call against the Media API passes
 * every behavioural test right up until it runs against real eBay and 404s.
 * A lock deleted from `EbayImageResolver.resolve` — or moved after the
 * upload loop — leaves every existing unit test green, because none of them
 * run two jobs concurrently. Source-greps are the only thing that catches
 * these, which is also why two of the seven guards below exist: the
 * invariants they protect already reverted once during this branch's own
 * review loop, undetected by the full test suite at the time.
 */

const REPO_ROOT = path.join(__dirname, '..', '..', '..', '..', '..');
const EBAY_DIR = path.join(__dirname);
const LISTINGS_DIR = path.join(__dirname, '..', 'listings');
const SHARED_UTILS_DIR = path.join(REPO_ROOT, 'packages', 'shared', 'src', 'utils');
const MIGRATIONS_DIR = path.join(__dirname, '..', '..', '..', 'migrations');
const THIS_FILE = path.resolve(__filename);

function read(dir: string, file: string): string {
  // Normalized to LF: these assertions pin multi-line shapes with `\n`, and
  // the repo is checked out with CRLF on Windows. Without this every such
  // regex fails on a developer machine while passing in CI — a false alarm
  // that teaches the team to ignore this guard, which is exactly what it
  // must not be.
  return fs.readFileSync(path.join(dir, file), 'utf8').replace(/\r\n/g, '\n');
}

/**
 * Body of one class method, bounded by brace-matching to the method's OWN
 * closing brace — not, as `listing-invariants.guard.spec.ts`'s `methodBody`
 * does, by the next `\n  private ` in the file. That bound is wrong here: the
 * member immediately after `processDescriptionTemplate` is `calculateQuantity`,
 * a PUBLIC method with no `private` modifier, so the next-`private` search
 * would silently sweep it into whatever body guard 2 checks. It is harmless
 * today only because `calculateQuantity` has no `product` in scope — the next
 * method inserted into that gap would have nothing to signal it landed inside
 * the assertion's blast radius. Brace-matching has no such gap: it always
 * stops at the method's real end, whichever member (public or private) comes
 * next, or none at all.
 */
function methodBody(source: string, declaration: string): string {
  const start = source.indexOf(declaration);
  if (start === -1) {
    throw new Error(`Method not found: ${declaration}`);
  }
  const bodyStart = start + declaration.length;
  let depth = 0;
  for (let index = source.indexOf('{', start); index < source.length; index += 1) {
    if (source[index] === '{') {
      depth += 1;
    } else if (source[index] === '}') {
      depth -= 1;
      if (depth === 0) {
        return source.slice(bodyStart, index + 1);
      }
    }
  }
  throw new Error(`Could not find the end of ${declaration}`);
}

/**
 * Body of one top-level exported function, by brace matching from its
 * signature. `methodBody` above can't be reused for `ebay-eps.ts`'s
 * standalone functions — they have no `\n  private ` sibling to bound
 * against, since the file has no classes at all.
 */
function functionBody(source: string, signature: string): string {
  const start = source.indexOf(signature);
  if (start === -1) {
    throw new Error(`Function not found: ${signature}`);
  }
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
  throw new Error(`Could not find the end of ${signature}`);
}

/** Every `.ts`/`.tsx` file under `dir`, recursive, skipping build/dependency noise. */
function collectSourceFiles(dir: string, results: string[] = []): string[] {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    if (entry.name === 'node_modules' || entry.name === 'dist' || entry.name === '.git') {
      continue;
    }
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      collectSourceFiles(full, results);
    } else if (/\.(ts|tsx)$/.test(entry.name)) {
      results.push(full);
    }
  }
  return results;
}

describe('EPS description never falls back to a source URL', () => {
  // Guard 1 (brief). The description is rendered ONCE at publish and never
  // revised afterwards (see listing-template.ts / listing-strategy.service.ts).
  // If this reverts to `epsBySource.get(first) ?? first`, one failed EPS
  // upload — a transient 429, a bad token, anything — bakes the Amazon URL
  // into that listing's description permanently, with nothing left to retry
  // it: the exact leak this whole feature exists to close.
  it('resolveDescriptionUrl has no `?? first`-style fallback to a source URL', () => {
    const source = read(SHARED_UTILS_DIR, 'ebay-eps.ts');
    const body = functionBody(
      source,
      'export function resolveDescriptionUrl(sourceUrls: string[], epsBySource: Map<string, string>): string {'
    );

    // The one and only permitted fallback is to the empty string.
    expect(body).toMatch(/epsBySource\.get\(first\)\s*\?\?\s*'';/);
    // Any fallback naming `first` (or the raw source URL) instead of ''
    // would silently reintroduce the leak — this is the literal shape of
    // that regression (`?? first`).
    expect(body).not.toMatch(/\?\?\s*first\b/);
  });

  // Guard 2 (brief). `processDescriptionTemplate` builds the CONTEXT the
  // template renderer fills `{{main_image}}` from. Passing `product.imageUrls`
  // there (the raw Amazon gallery array) would let a template iterate the
  // unresolved source list straight into the description HTML, bypassing
  // `resolveDescriptionUrl` entirely — the fallback rule above only protects
  // the field it actually gates. `product.imageUrls` legitimately appears
  // elsewhere in this same file (the GALLERY assignment, which correctly
  // falls back per image) — that is why this check is scoped to the method
  // body via brace-matched `methodBody`, not a whole-file grep.
  it('processDescriptionTemplate builds its context from mainImageUrl only, never the raw gallery array', () => {
    const source = read(LISTINGS_DIR, 'listing-strategy.service.ts');
    const body = methodBody(source, 'private async processDescriptionTemplate(');

    expect(body).toMatch(/mainImageUrl:\s*product\.mainImageUrl,/);
    expect(body).not.toMatch(/product\.imageUrls/);
    // Proves the scoping itself: `calculateQuantity` is the very next class
    // member after this method, and it carries no `private` modifier — a
    // boundary search for the next `\n  private ` would silently include it
    // in the checked region. It stays out of scope here on the strength of
    // `methodBody`'s brace-matching, not by coincidence.
    expect(body).not.toMatch(/calculateQuantity/);
  });
});

describe('no delete call against the eBay Media API', () => {
  // Guard 3 (brief). eBay documents no delete endpoint for Picture Services
  // images (see migration 119's header: "The Media API has no delete method
  // for images and eBay expires unused ones itself after 30 days"). Code
  // that tries one would fail at runtime with a 404/405 and read as a
  // provider outage — a defect a unit test with a mocked HTTP client would
  // never catch, since the mock would happily return whatever the test told
  // it to.
  it('never calls an R2-style DeleteObject anywhere in the API', () => {
    const offenders = collectSourceFiles(path.join(REPO_ROOT, 'apps', 'api', 'src'))
      .filter((file) => path.resolve(file) !== THIS_FILE)
      .filter((file) => /DeleteObject/.test(fs.readFileSync(file, 'utf8')));
    expect(offenders).toEqual([]);
  });

  it('never issues a DELETE request against the EPS image base URL', () => {
    // Scoped to every file that references the base URL, not just
    // ebay-media.service.ts — a delete call added in a NEW file that imports
    // EBAY_EPS_IMAGE_BASE_URL would otherwise slip past a single-file check.
    const offenders = collectSourceFiles(path.join(REPO_ROOT, 'apps', 'api', 'src'))
      .map((file) => ({ file, content: fs.readFileSync(file, 'utf8') }))
      .filter(({ content }) => content.includes('EBAY_EPS_IMAGE_BASE_URL'))
      .filter(({ content }) => /method:\s*'DELETE'/.test(content))
      .map(({ file }) => path.relative(REPO_ROOT, file));

    expect(offenders).toEqual([]);
    // And the constant is genuinely still in use — a guard that passes
    // because the base URL was deleted, not because no DELETE call exists,
    // would be silently checking nothing.
    expect(read(EBAY_DIR, 'ebay-media.service.ts')).toMatch(/EBAY_EPS_IMAGE_BASE_URL/);
  });
});

describe('EbayMediaService.uploadFromUrl cannot throw', () => {
  // Guard 4 (brief). This call sits on the SYNCHRONOUS listing-creation path
  // (see the class doc: "an image failure must never fail a listing"). An
  // uncaught throw here — a network error, a malformed response, anything —
  // would fail the entire listing create over one image, which is strictly
  // worse than publishing with no description image at all.
  it('wraps the whole body in try/catch and returns null on failure', () => {
    const source = read(EBAY_DIR, 'ebay-media.service.ts');
    const body = methodBody(
      source,
      'async uploadFromUrl(accountId: string, sourceUrl: string): Promise<string | null> {'
    );

    expect(body).toMatch(/^\s*try \{/);
    expect(body).toMatch(/\} catch \(error\) \{[\s\S]*?return null;/);
    // The two checks above prove a try/catch exists SOMEWHERE in the body —
    // they do not prove it IS the body. Code inserted after the catch's own
    // closing brace, still inside the method, would satisfy both regexes
    // above while reopening a path that can throw uncaught. This anchors to
    // the end of the (brace-matched, so genuinely whole) method body: after
    // the catch's `return null;`, only whitespace and the catch's closing
    // brace, then only whitespace and the method's own closing brace, then
    // nothing else.
    expect(body).toMatch(/return null;\s*\}\s*\}$/);
  });
});

describe('image mirror is fully retired', () => {
  // Guard 5 (brief, widened by the controller ruling to include migration
  // 120). The Cloudflare R2 mirror this branch replaced covered only the
  // description image; EPS covers both surfaces and needs no watermark, GC,
  // or bucket credentials at all — see migration 120's header. Any of these
  // identifiers resurfacing in application source is the R2 code (or a
  // fragment of it) coming back, which would run alongside EPS rather than
  // instead of it and leave the bucket-credential env vars load-bearing
  // again with nothing to configure them.
  const MIRROR_IDENTIFIER_PATTERN =
    /image_mirrored_at|mirrored_image_name|image-mirror|ImageMirror|ensureMirrored|R2_ACCOUNT_ID|R2_ACCESS_KEY_ID|R2_SECRET_ACCESS_KEY|R2_BUCKET|IMAGE_CDN_BASE_URL/;

  it('leaves no R2 or image-mirror identifier in application source', () => {
    const roots = [
      path.join(REPO_ROOT, 'apps', 'api', 'src'),
      path.join(REPO_ROOT, 'apps', 'web', 'src'),
      path.join(REPO_ROOT, 'packages', 'shared', 'src'),
      path.join(REPO_ROOT, 'packages', 'ui', 'src'),
    ];

    const offenders: string[] = [];
    for (const root of roots) {
      for (const file of collectSourceFiles(root)) {
        if (path.resolve(file) === THIS_FILE) {
          // This file names the identifiers it is checking for — excluding
          // itself is the only way to grep for their absence everywhere else.
          continue;
        }
        if (MIRROR_IDENTIFIER_PATTERN.test(fs.readFileSync(file, 'utf8'))) {
          offenders.push(path.relative(REPO_ROOT, file));
        }
      }
    }
    expect(offenders).toEqual([]);
  });

  it('confines every match to migrations 116, 117, 118 and 120', () => {
    // The three original watermark migrations, plus the migration that drops
    // them. An applied migration is never edited, so these four keep the
    // identifiers in their bodies forever — that is expected and correct,
    // not a leak.
    const allowedFiles = new Set([
      '116_products_image_mirrored_at.sql',
      '117_products_mirrored_image_name.sql',
      '118_backfill_mirrored_image_name.sql',
      '120_drop_image_mirror_columns.sql',
    ]);

    const offenders = fs
      .readdirSync(MIGRATIONS_DIR)
      .filter((file) => file.endsWith('.sql'))
      .filter((file) => !allowedFiles.has(file))
      .filter((file) => MIRROR_IDENTIFIER_PATTERN.test(fs.readFileSync(path.join(MIGRATIONS_DIR, file), 'utf8')));

    expect(offenders).toEqual([]);
  });
});

describe('the (product, store) upload lock is taken before any upload', () => {
  // Guard 6 (controller ruling — this invariant already reverted once during
  // Task 4's own review, and every one of that task's tests stayed green
  // with the lock deleted, or moved after the upload loop). Two concurrent
  // listing jobs for the same product and eBay store would otherwise each
  // upload all EBAY_MAX_IMAGES (24) images against a documented limit of 50
  // POSTs per 5 seconds per user, and race writing `product_ebay_images`.
  it('takes pg_advisory_xact_lock before calling uploadFromUrl', () => {
    const source = read(EBAY_DIR, 'ebay-image-resolver.service.ts');
    const body = methodBody(
      source,
      'async resolve(productId: string, ebayAccountId: string, sourceUrls: string[]): Promise<EbayImageResolution> {'
    );

    const lockIndex = body.indexOf('pg_advisory_xact_lock');
    const uploadIndex = body.indexOf('uploadFromUrl(');

    expect(lockIndex).toBeGreaterThan(-1);
    expect(uploadIndex).toBeGreaterThan(-1);
    // Not just "both present" — the lock must be textually BEFORE the first
    // upload call, or two racing jobs can both pass the (deleted-in-effect)
    // gate and upload concurrently.
    expect(lockIndex).toBeLessThan(uploadIndex);
  });
});

describe('attachEpsImages is not reached on the draft-creation path', () => {
  // Guard 7 (controller ruling — this invariant shipped ungated in this
  // branch's own Task 5). `persistDraft` stores none of the fields
  // `attachEpsImages` resolves, so calling it unconditionally in
  // `processListingBatch` spent up to 24 discarded Media API uploads per
  // draft — silently breaking CLAUDE.md's stated invariant that a draft
  // costs zero eBay calls and an abandoned draft costs nothing.
  it('processListingBatch gates attachEpsImages behind `if (!asDraft)`', () => {
    const source = read(LISTINGS_DIR, 'listing-processor.service.ts');
    const body = methodBody(source, 'private async processListingBatch(');

    expect(body).toMatch(/if \(!asDraft\) \{\s*\n\s*await attachEpsImages\(/);
  });

  // The PUBLISH path is the opposite invariant: a draft's images are resolved
  // exactly once, at publish, and must NOT be gated the same way — a guard
  // that forbade this call here would be wrong, not protective.
  it('prepareDraftForPublish calls attachEpsImages unconditionally', () => {
    const source = read(LISTINGS_DIR, 'listings.service.ts');
    const body = methodBody(source, 'private async prepareDraftForPublish(userId: string, listingId: string):');

    expect(body).toMatch(/await attachEpsImages\(/);
    expect(body).not.toMatch(/if \(!asDraft\)/);
  });
});
