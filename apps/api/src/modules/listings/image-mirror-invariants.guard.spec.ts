import { readFileSync } from 'fs';
import { join } from 'path';

/**
 * Source-text guards for the listing image mirror (see
 * docs/superpowers/specs/2026-09-24-listing-image-mirror-design.md).
 *
 * Every invariant here has the same dangerous property: it does not fail
 * loudly when it reverts. A fallback to the Amazon URL still renders a
 * picture. A rewritten gallery still publishes. A garbage collector reading
 * the wrong column still deletes files and every behavioural test stays
 * green. Source-greps, in the style of
 * `tracking-webhook-coverage.guard.spec.ts` and
 * `listing-invariants.guard.spec.ts`, are what keep them.
 */
const repoRoot = join(__dirname, '../../../../..');
const read = (relative: string) => readFileSync(join(repoRoot, relative), 'utf8').replace(/\r\n/g, '\n');

/** Body of one class method, bounded by the next method declaration. Same helper as listing-invariants.guard.spec.ts. */
function methodBody(source: string, declaration: string): string {
  const start = source.indexOf(declaration);
  if (start === -1) {
    throw new Error(`Method not found: ${declaration}`);
  }
  const rest = source.slice(start + declaration.length);
  const next = rest.indexOf('\n  private ');
  return next > -1 ? rest.slice(0, next) : rest;
}

describe('image mirror invariants', () => {
  it('main_image is fed only by the caller-supplied URL, never by imageUrls', () => {
    // D2: the description is written once at publish and never revised, so a
    // fallback to imageUrls[0] would put the raw Amazon URL back into a live
    // description forever — the exact outcome this feature exists to prevent.
    // This must be structural (the renderer cannot do it), not a call-site habit.
    const source = read('packages/shared/src/utils/listing-template.ts');
    expect(source).toContain("main_image: input.mainImageUrl ?? ''");
    expect(source).not.toMatch(/main_image:\s*images\[0\]/);
  });

  it('the publish path passes the mirrored URL, not the source one', () => {
    // D2: the description-template context must resolve main_image from the
    // mirrored URL. `imageUrls: product.imageUrls` also appears elsewhere in
    // this file (the eBay gallery payload built by prepareListingData — see
    // the next guard, which asserts that occurrence is expected), so the
    // negative check is scoped to the description-context builder only —
    // an unscoped grep would fail on a legitimate, unrelated line.
    const source = read('apps/api/src/modules/listings/listing-strategy.service.ts');
    expect(source).toContain('mainImageUrl: product.mainImageMirroredUrl');
    const contextBuild = methodBody(source, 'private async processDescriptionTemplate(');
    expect(contextBuild).not.toMatch(/imageUrls:\s*product\.imageUrls/);
  });

  it('the eBay gallery payload still carries the source URLs', () => {
    // Out of scope for the mirror: the gallery is separate from the
    // description and must keep showing every real product photo — only the
    // one image embedded in the description is ever hidden behind the mirror.
    const source = read('apps/api/src/modules/ebay/ebay-listing-payload.ts');
    expect(source).toContain('data.imageUrls');
    expect(source).not.toContain('mainImageMirroredUrl');
    expect(source).not.toContain('IMAGE_CDN_BASE_URL');
  });

  it('images and has_images are gone from the template vocabulary', () => {
    // D1: a custom, seller-authored template must not be able to render the
    // full image array either (only the seeded catalog was reviewed for
    // this), and has_images exists only to wrap that array's list — leaving
    // it behind would let a custom template render an empty, styled wrapper.
    const source = read('packages/shared/src/utils/listing-template.ts');
    expect(source).not.toMatch(/^\s*'images',$/m);
    expect(source).not.toContain('has_images');
  });

  it('the image CDN destination is env-only, never a platform setting', () => {
    // Configuration: an editable destination in platform_settings would let a
    // compromised admin session repoint mirrored images at a host it
    // controls — the same reasoning that keeps LLM_BASE_URL env-only.
    const registry = read('apps/api/src/common/settings/platform-settings.registry.ts');
    expect(registry).not.toContain('IMAGE_CDN_BASE_URL');
    expect(registry).not.toContain('R2_');
  });

  it("ensureMirrored's reuse path builds its URL from the STORED name, never the caller's imageUrl", () => {
    // This is the read-side twin of the write-side bug above: that one let the
    // GC delete an object a live listing still needs by deriving the "live"
    // name from the current (mutable) image_urls instead of the name actually
    // uploaded. This one is worse, because it fires on the CREATE path for
    // every new listing of an already-cached ASIN, not just in a GC sweep.
    //
    // `imageUrl` passed into `ensureMirrored` is always the CURRENT
    // `product.imageUrls[0]`, which a Keepa refresh tick can rotate at any
    // time (default every 12h). The eBay description that already embeds
    // this product's mirrored image was rendered once at publish and is
    // NEVER revised. So once a product has a stored `mirrored_image_name`,
    // the only name that is safe to hand back is that stored one — deriving
    // a name from `imageUrl` on the reuse path re-points every FUTURE
    // listing's description at an object that was never uploaded under that
    // name, silently. The listing publishes; the image is a permanent 404;
    // nothing logs an error, because nothing failed from the code's point of
    // view — it faithfully built and returned a URL, just not one anything
    // ever wrote to R2.
    //
    // A behavioral test alone did not catch this the first time: the
    // original "already mirrored" test reused the SAME url for both the
    // stored name and the current imageUrl, so the two values could never
    // disagree and the assertion could not tell "built from the stored name"
    // apart from "built from imageUrl". The behavioral regression test in
    // image-mirror.service.spec.ts now uses two DIFFERENT names for exactly
    // this reason; this structural guard is the second, independent check.
    const source = read('apps/api/src/modules/image-mirror/image-mirror.service.ts');
    const body = methodBody(source, 'async ensureMirrored(');

    const reuseBranchStart = body.indexOf('if (mirroredImageName)');
    expect(reuseBranchStart).toBeGreaterThan(-1);
    const reuseReturnEnd = body.indexOf(';', body.indexOf('return', reuseBranchStart));
    const reuseBranch = body.slice(reuseBranchStart, reuseReturnEnd);

    // The reuse branch must build the URL from the stored name...
    expect(reuseBranch).toContain('buildMirroredImageUrl(mirroredImageName');
    // ...and must never re-derive a name from the caller-supplied URL. If
    // this branch ever needs extractKeepaImageName again, it has regressed
    // to computing a name from the current image instead of trusting the
    // one actually uploaded.
    expect(reuseBranch).not.toContain('extractKeepaImageName');
  });

  it("the garbage collector's live set comes from mirrored_image_name, never image_urls", () => {
    // Migration 117/118: `image_urls` is overwritten on every Keepa refresh
    // tick. When Amazon rotates an ASIN's primary image, a live set derived
    // from image_urls silently stops containing the name the already-
    // published description embeds — and the GC deletes an object a live
    // listing still needs. Every test still stays green when this reverts,
    // because nothing behavioural exercises an image rotation.
    const source = read('apps/api/src/modules/image-mirror/image-mirror-gc.service.ts');
    const loadLiveNames = methodBody(source, 'private async loadLiveNames(');
    expect(loadLiveNames).toContain('mirrored_image_name');
    expect(loadLiveNames).not.toMatch(/image_urls/);
  });
});
