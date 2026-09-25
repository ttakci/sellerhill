import { Injectable, Logger } from '@nestjs/common';
import { EBAY_MAX_IMAGES, isEpsImageUrl, resolveDescriptionUrl, resolveGalleryUrls } from '@repo/shared';
import type { PoolClient } from 'pg';

import { DatabaseService } from '../../common/database/database.service';

import { EbayMediaService } from './ebay-media.service';
import { EbayService } from './ebay.service';

/** `product_ebay_images.image_urls[N]` is the EPS URL for `sourceUrls[N]`, or `''` on a failed upload. */
interface ProductEbayImagesRow {
  image_urls: unknown;
}

export interface EbayImageResolution {
  galleryUrls: string[];
  descriptionUrl: string;
}

/**
 * Does this length-matched row still have slots with no EPS URL?
 *
 * A row like `['', 'https://i.ebayimg.com/b.jpg']` is a PARTIAL failure, and
 * before this check it was a permanent one: it satisfies `parseCacheHit`'s
 * length test for ever, so every future listing of that (product, store)
 * served the Amazon URL in gallery slot 0 and rendered no description image at
 * all — the exact leak this feature exists to close, caused by one transient
 * 429 at first-listing time.
 *
 * Re-attempting a permanently dead image on every listing is the accepted
 * cost. The uploads are sequential and fail-soft, and a permanent leak is
 * worse than a repeated cheap failure.
 */
function hasGaps(stored: string[]): boolean {
  return stored.some((entry) => !entry);
}

/**
 * Turns a product's source image URLs into what a listing actually needs:
 * a gallery (EPS where we have it, the source URL where we do not) and a
 * description image (an EPS URL, or none at all — see `resolveGalleryUrls` /
 * `resolveDescriptionUrl` in `@repo/shared` for why the two differ).
 *
 * Uploads once per (product, eBay account) and caches the result in
 * `product_ebay_images` — the same ASIN listed by two different stores needs
 * two uploads, because an EPS image belongs to the uploading seller's account,
 * but the same store listing it twice needs none.
 *
 * Never throws: a failure anywhere in here (DB down, no usable token, every
 * upload failing, whatever) falls back to `{ galleryUrls: sourceUrls,
 * descriptionUrl: '' }` — today's gallery behaviour and no description image,
 * never a broken listing.
 */
@Injectable()
export class EbayImageResolver {
  private readonly logger = new Logger(EbayImageResolver.name);

  constructor(
    private readonly databaseService: DatabaseService,
    private readonly ebayMediaService: EbayMediaService,
    private readonly ebayService: EbayService
  ) {}

  async resolve(productId: string, ebayAccountId: string, sourceUrls: string[]): Promise<EbayImageResolution> {
    if (!sourceUrls || sourceUrls.length === 0) {
      // No query, no upload — never spend a call resolving a placeholder.
      return { galleryUrls: [], descriptionUrl: '' };
    }

    // Best answer found so far, so a failure LATER in this method cannot throw
    // away EPS URLs we already hold. Without it, a gapped hit whose retry then
    // fails for an unrelated reason (no token, the transaction rolling back)
    // would fall all the way back to raw source URLs — losing the images that
    // had uploaded fine, which is strictly worse than the row it started from.
    let bestKnown: string[] | null = null;

    try {
      const cached = await this.readCached(productId, ebayAccountId, sourceUrls);
      bestKnown = cached;
      // A COMPLETE hit is the common case and the cheap one: no lock, no token
      // read, no upload. A hit with gaps is not complete — see `hasGaps` for
      // why it must never be served as-is.
      if (cached && !hasGaps(cached)) {
        return this.toResult(sourceUrls, cached);
      }

      // Resolved ONCE, and deliberately outside the transaction below.
      // `EbayMediaService` used to read the token itself on every image, which
      // meant up to 24 nested pool acquisitions from inside an already-held
      // connection — the shape that starves a `max: 20` pool with a 2s
      // acquisition timeout and then degrades silently to Amazon URLs. A throw
      // here (no such account, refresh refused) is caught below and falls back
      // exactly as any other failure does.
      const accessToken = await this.ebayService.getAccountAccessToken(ebayAccountId);

      return await this.databaseService.transaction(async (client) => {
        // Two concurrent listing jobs for the same (product, store) would
        // otherwise both upload every image — wasted calls against the
        // per-user rate limit, and a race on the cache row. Same shape as
        // resolveProductData's per-ASIN Keepa lock.
        await client.query(`SELECT pg_advisory_xact_lock(hashtext('ebay-image-resolve'), hashtext($1))`, [
          `${productId}:${ebayAccountId}`,
        ]);

        // Another job may have uploaded and stored while we waited on the lock.
        const cachedAfterLock = await this.readCachedWithClient(client, productId, ebayAccountId, sourceUrls);
        bestKnown = cachedAfterLock ?? bestKnown;
        if (cachedAfterLock && !hasGaps(cachedAfterLock)) {
          return this.toResult(sourceUrls, cachedAfterLock);
        }

        // Positional carry-over, and ONLY from a length-matched row: entry N
        // of a stored row describes source N, so a row of a different length
        // (`parseCacheHit` returns null for one) says nothing about today's
        // images and must not be read as if it did.
        const existing = cachedAfterLock ?? [];
        const toUpload = sourceUrls.slice(0, EBAY_MAX_IMAGES);
        const uploaded: string[] = [];
        let succeeded = 0;
        // Sequential, never Promise.all: the limit is 50 POSTs/5s per user and
        // the point is to stay under it, not to discover it.
        for (const [index, source] of toUpload.entries()) {
          const kept = existing[index];
          if (kept) {
            // Already uploaded on an earlier run. Never re-uploaded, and never
            // overwritten by a later failure — a good entry only ever survives.
            uploaded.push(kept);
            continue;
          }
          const epsUrl = await this.ebayMediaService.uploadFromUrl(accessToken, source);
          if (epsUrl) {
            succeeded += 1;
          }
          uploaded.push(epsUrl ?? '');
        }

        // Written only when this run actually produced something new.
        //
        // A TOTAL failure (every upload came back null — eBay down, a bad
        // token, the product's images momentarily unfetchable) must never be
        // written. A stored all-empty row still satisfies the length check in
        // parseCacheHit, so it would read as a HIT on every future listing of
        // this (product, store). A missing row is the retry signal instead, so
        // skipping the write here just lets the next listing try again from
        // scratch. It also protects a pre-existing GOOD row from being
        // overwritten by a transient outage on re-upload — ON CONFLICT DO
        // UPDATE would otherwise clobber it.
        //
        // The same test covers the gap-retry path: if every gap re-attempted
        // here failed again, `uploaded` is identical to what is already
        // stored, so there is nothing to write and nothing is written.
        if (succeeded > 0) {
          await client.query(
            `INSERT INTO product_ebay_images (product_id, ebay_account_id, image_urls, uploaded_at)
             VALUES ($1, $2, $3, NOW())
             ON CONFLICT (product_id, ebay_account_id) DO UPDATE SET
               image_urls = EXCLUDED.image_urls,
               uploaded_at = NOW()`,
            [productId, ebayAccountId, JSON.stringify(uploaded)]
          );
        }

        return this.toResult(sourceUrls, uploaded);
      });
    } catch (error) {
      this.logger.warn(
        `EPS resolve failed for product ${productId}, store ${ebayAccountId}: ${
          error instanceof Error ? error.message : String(error)
        }`
      );
      return bestKnown ? this.toResult(sourceUrls, bestKnown) : { galleryUrls: sourceUrls, descriptionUrl: '' };
    }
  }

  private async readCached(productId: string, ebayAccountId: string, sourceUrls: string[]): Promise<string[] | null> {
    const rows = await this.databaseService.query<ProductEbayImagesRow>(
      `SELECT image_urls FROM product_ebay_images WHERE product_id = $1 AND ebay_account_id = $2`,
      [productId, ebayAccountId]
    );
    return this.parseCacheHit(rows[0], sourceUrls);
  }

  private async readCachedWithClient(
    client: PoolClient,
    productId: string,
    ebayAccountId: string,
    sourceUrls: string[]
  ): Promise<string[] | null> {
    const result = await client.query<ProductEbayImagesRow>(
      `SELECT image_urls FROM product_ebay_images WHERE product_id = $1 AND ebay_account_id = $2`,
      [productId, ebayAccountId]
    );
    return this.parseCacheHit(result.rows[0], sourceUrls);
  }

  /**
   * A hit's stored array must be exactly as long as what we would upload
   * today — `Math.min(sourceUrls.length, EBAY_MAX_IMAGES)`, not the raw
   * `sourceUrls.length`. A product with more than EBAY_MAX_IMAGES source
   * images can never store more than EBAY_MAX_IMAGES entries (uploads are
   * capped), so comparing against the uncapped count would make its cache
   * row permanently unreadable and re-upload the same 24 images on every
   * listing created from it.
   */
  private parseCacheHit(row: ProductEbayImagesRow | undefined, sourceUrls: string[]): string[] | null {
    if (!row) {
      return null;
    }
    const stored = this.parseStoredImageUrls(row.image_urls);
    const expectedLength = Math.min(sourceUrls.length, EBAY_MAX_IMAGES);
    return stored.length === expectedLength ? stored : null;
  }

  /**
   * Normalizes a stored row. Anything that is not an EPS URL — a non-string, a
   * source URL, junk — becomes `''`, which is this row's own "no EPS image for
   * this slot" marker, so `resolve` re-attempts it like any other gap.
   *
   * MAPPED, never filtered: the array is POSITIONAL against `sourceUrls`, so
   * dropping an entry would silently re-point every later slot at the wrong
   * image. The only writer today is the EPS-validated INSERT above, so this is
   * unreachable — it is here because it is the last unguarded step of the
   * invariant this whole feature exists for, and it costs one `.map()`.
   */
  private parseStoredImageUrls(value: unknown): string[] {
    return this.parseRawArray(value).map((entry) =>
      typeof entry === 'string' && isEpsImageUrl(entry) ? entry : ''
    );
  }

  private parseRawArray(value: unknown): unknown[] {
    if (Array.isArray(value)) {
      return value;
    }
    if (typeof value === 'string') {
      try {
        const parsed = JSON.parse(value) as unknown;
        return Array.isArray(parsed) ? parsed : [];
      } catch {
        return [];
      }
    }
    return [];
  }

  /**
   * Builds the Map `resolveGalleryUrls`/`resolveDescriptionUrl` expect — and
   * never puts an empty string into it. `resolveGalleryUrls` does
   * `map.get(source) ?? source`, so an `''` entry would be a HIT that returns
   * an empty string where the source URL belongs; skipping it is what makes
   * the per-image fallback actually work.
   */
  private toResult(sourceUrls: string[], epsUrls: string[]): EbayImageResolution {
    const epsBySource = new Map<string, string>();
    sourceUrls.forEach((source, index) => {
      const eps = epsUrls[index];
      if (eps) {
        epsBySource.set(source, eps);
      }
    });
    return {
      galleryUrls: resolveGalleryUrls(sourceUrls, epsBySource),
      descriptionUrl: resolveDescriptionUrl(sourceUrls, epsBySource),
    };
  }
}
