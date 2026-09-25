import { Injectable, Logger } from '@nestjs/common';
import { EBAY_MAX_IMAGES, resolveDescriptionUrl, resolveGalleryUrls } from '@repo/shared';
import type { PoolClient } from 'pg';

import { DatabaseService } from '../../common/database/database.service';

import { EbayMediaService } from './ebay-media.service';

/** `product_ebay_images.image_urls[N]` is the EPS URL for `sourceUrls[N]`, or `''` on a failed upload. */
interface ProductEbayImagesRow {
  image_urls: unknown;
}

export interface EbayImageResolution {
  galleryUrls: string[];
  descriptionUrl: string;
}

/**
 * Turns a product's source image URLs into what a listing actually needs:
 * a gallery (EPS where we have it, the source URL where we do not) and a
 * description image (an EPS URL, or none at all — see Task 1's
 * `resolveGalleryUrls`/`resolveDescriptionUrl` for why the two differ).
 *
 * Uploads once per (product, eBay account) and caches the result in
 * `product_ebay_images` — the same ASIN listed by two different stores needs
 * two uploads, because an EPS image belongs to the uploading seller's account,
 * but the same store listing it twice needs none.
 *
 * Never throws: a failure anywhere in here (DB down, every upload failing,
 * whatever) falls back to `{ galleryUrls: sourceUrls, descriptionUrl: '' }` —
 * today's gallery behaviour and no description image, never a broken listing.
 */
@Injectable()
export class EbayImageResolver {
  private readonly logger = new Logger(EbayImageResolver.name);

  constructor(
    private readonly databaseService: DatabaseService,
    private readonly ebayMediaService: EbayMediaService
  ) {}

  async resolve(productId: string, ebayAccountId: string, sourceUrls: string[]): Promise<EbayImageResolution> {
    if (!sourceUrls || sourceUrls.length === 0) {
      // No query, no upload — never spend a call resolving a placeholder.
      return { galleryUrls: [], descriptionUrl: '' };
    }

    try {
      const cached = await this.readCached(productId, ebayAccountId, sourceUrls);
      if (cached) {
        return this.toResult(sourceUrls, cached);
      }

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
        if (cachedAfterLock) {
          return this.toResult(sourceUrls, cachedAfterLock);
        }

        const toUpload = sourceUrls.slice(0, EBAY_MAX_IMAGES);
        const uploaded: string[] = [];
        // Sequential, never Promise.all: the limit is 50 POSTs/5s per user and
        // the point is to stay under it, not to discover it.
        for (const source of toUpload) {
          const epsUrl = await this.ebayMediaService.uploadFromUrl(ebayAccountId, source);
          uploaded.push(epsUrl ?? '');
        }

        // A TOTAL failure (every upload came back null — eBay down, a bad
        // token, the product's images momentarily unfetchable) must never be
        // written. A stored all-empty row still satisfies the length check in
        // parseCacheHit, so it would read as a permanent HIT on every future
        // listing of this (product, store) — the exact Amazon-URL leak this
        // feature exists to close, with nothing left to retry it. A missing
        // row is already this design's retry signal (same convention as
        // ImageMirrorService.ensureMirrored's NULL watermark), so skipping the
        // write here just lets the next listing try again from scratch. It
        // also protects a pre-existing GOOD row from being overwritten by a
        // transient outage on re-upload — ON CONFLICT DO UPDATE would
        // otherwise clobber it. A partial failure (at least one success) is
        // still stored, per the brief.
        const allFailed = uploaded.every((entry) => entry === '');
        if (!allFailed) {
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
      return { galleryUrls: sourceUrls, descriptionUrl: '' };
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

  private parseStoredImageUrls(value: unknown): string[] {
    if (Array.isArray(value)) {
      return value as string[];
    }
    if (typeof value === 'string') {
      try {
        const parsed = JSON.parse(value) as unknown;
        return Array.isArray(parsed) ? (parsed as string[]) : [];
      } catch {
        return [];
      }
    }
    return [];
  }

  /**
   * Builds the Map Task 1's helpers expect — and never puts an empty string
   * into it. `resolveGalleryUrls` does `map.get(source) ?? source`, so an `''`
   * entry would be a HIT that returns an empty string where the source URL
   * belongs; skipping it is what makes the per-image fallback actually work.
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
