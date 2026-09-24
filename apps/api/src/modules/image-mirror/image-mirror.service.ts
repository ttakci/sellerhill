import { PutObjectCommand, S3Client } from '@aws-sdk/client-s3';
import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { buildAmazonSourceImageUrl, buildMirroredImageUrl, extractKeepaImageName } from '@repo/shared';

import { DatabaseService } from '../../common/database/database.service';

/** Amazon's own header on these objects; copied so our copy ages the same way. */
const DEFAULT_CACHE_CONTROL = 'public, max-age=630720000, immutable';
const FETCH_TIMEOUT_MS = 10_000;
const MAX_IMAGE_BYTES = 5 * 1024 * 1024;
/**
 * The AWS SDK's own default is 0 (no timeout) — `NodeHttpHandlerOptions.requestTimeout`
 * is opt-in, and even set it only WARNS on breach unless `throwOnRequestTimeout` is
 * also set. This runs inline on the listing-creation path on a box where RAM/CPU are
 * shared with the Playwright pool, so a stalled R2 PUT must not hang indefinitely.
 */
const S3_REQUEST_TIMEOUT_MS = 15_000;

/**
 * Copies a product's first image into our own bucket so the eBay description
 * can render it without naming the supplier.
 *
 * Everything here is best-effort. A failure returns null, the product stays
 * unmirrored, and the description renders with no image — a listing must never
 * fail because of a picture. NULL is also the retry signal, so the next listing
 * for the same ASIN tries again.
 */
@Injectable()
export class ImageMirrorService {
  private readonly logger = new Logger(ImageMirrorService.name);
  private client: S3Client | null = null;

  constructor(
    private readonly config: ConfigService,
    private readonly database: DatabaseService
  ) {}

  isConfigured(): boolean {
    return Boolean(
      this.config.get<string>('R2_ACCOUNT_ID') &&
        this.config.get<string>('R2_ACCESS_KEY_ID') &&
        this.config.get<string>('R2_SECRET_ACCESS_KEY') &&
        this.config.get<string>('R2_BUCKET') &&
        this.config.get<string>('IMAGE_CDN_BASE_URL')
    );
  }

  /**
   * `mirroredImageName` is the name ACTUALLY uploaded for this product
   * (`products.mirrored_image_name`), or `null` when nothing has been
   * mirrored yet — never a boolean flag. This is load-bearing: `imageUrl` is
   * always the CURRENT, mutable `product.imageUrls[0]`, which a Keepa refresh
   * can rotate at any time, while the eBay description that already embeds
   * this product's image was rendered once and is never revised. A prior
   * version of this method derived the returned URL from `imageUrl` even on
   * reuse (gated only by a boolean "was this mirrored at some point"), so a
   * rotated image silently pointed every future listing's description at an
   * object nobody uploaded. See the image-mirror invariants guard.
   */
  async ensureMirrored(
    productId: string,
    imageUrl: string | undefined,
    mirroredImageName: string | null
  ): Promise<string | null> {
    if (!this.isConfigured()) {
      return null;
    }

    if (mirroredImageName) {
      // Write-once reuse: return the URL of what was ACTUALLY uploaded, never
      // re-derive a name from the caller's current (possibly rotated) source
      // and never re-upload — the stored object already exists and other
      // already-published descriptions reference it by this exact name.
      return buildMirroredImageUrl(mirroredImageName, this.config.get<string>('IMAGE_CDN_BASE_URL') as string);
    }

    if (!imageUrl) {
      return null;
    }
    const name = extractKeepaImageName(imageUrl);
    if (!name) {
      this.logger.warn(`Unusable image name for product ${productId}; not mirroring`);
      return null;
    }
    const publicUrl = buildMirroredImageUrl(name, this.config.get<string>('IMAGE_CDN_BASE_URL') as string);
    if (!publicUrl) {
      return null;
    }

    try {
      const body = await this.download(name);
      if (!body) {
        return null;
      }
      await this.putObject(name, body.bytes, body.contentType, body.cacheControl);
      // One statement: the watermark and the mirrored name must never be able
      // to disagree (see migration 117 — the GC's live set reads this column).
      await this.database.query(
        `UPDATE products SET image_mirrored_at = NOW(), mirrored_image_name = $2 WHERE id = $1`,
        [productId, name]
      );
      return publicUrl;
    } catch (error) {
      this.logger.warn(
        `Mirror failed for product ${productId} (${name}): ${error instanceof Error ? error.message : String(error)}`
      );
      return null;
    }
  }

  /**
   * A 200 carrying `text/html` is Amazon's error page for a dead image id.
   * Storing it would publish a broken image under a 20-year cache header, so
   * the content type is checked before anything is written.
   */
  private async download(
    name: string
  ): Promise<{ bytes: Uint8Array; contentType: string; cacheControl: string } | null> {
    const sourceUrl = buildAmazonSourceImageUrl(name);
    if (!sourceUrl) {
      return null;
    }
    // Verified 2026-09-24 (Node 22 / undici): an AbortSignal passed to fetch() also
    // aborts an in-progress body read, not just the connect+headers phase — a response
    // that stalls mid-body during response.arrayBuffer() below still aborts at
    // FETCH_TIMEOUT_MS. Do not add a second timeout around the body read for this.
    const response = await fetch(sourceUrl, { signal: AbortSignal.timeout(FETCH_TIMEOUT_MS) });
    if (!response.ok) {
      this.logger.warn(`Amazon answered ${response.status} for ${name}; not mirroring`);
      return null;
    }
    const contentType = response.headers.get('content-type') ?? '';
    if (!contentType.startsWith('image/')) {
      this.logger.warn(`Amazon answered ${contentType || 'no content-type'} for ${name}; not mirroring`);
      return null;
    }
    // Refuse an oversized body BEFORE buffering it: content-length is Amazon's own
    // claim, so it can be absent or wrong, but when present it lets us reject a huge
    // response without ever reading its bytes into memory. The post-read byte-length
    // check below still stands as the real bound when content-length is missing/lying.
    const contentLengthHeader = response.headers.get('content-length');
    if (contentLengthHeader !== null) {
      const declaredLength = Number(contentLengthHeader);
      if (Number.isFinite(declaredLength) && declaredLength > MAX_IMAGE_BYTES) {
        this.logger.warn(`Amazon declared ${declaredLength} bytes for ${name}; refusing before download`);
        return null;
      }
    }
    const bytes = new Uint8Array(await response.arrayBuffer());
    if (bytes.byteLength === 0 || bytes.byteLength > MAX_IMAGE_BYTES) {
      this.logger.warn(`Refusing ${bytes.byteLength} bytes for ${name}`);
      return null;
    }
    return {
      bytes,
      contentType,
      cacheControl: response.headers.get('cache-control') ?? DEFAULT_CACHE_CONTROL,
    };
  }

  private getClient(): S3Client {
    if (!this.client) {
      this.client = new S3Client({
        region: 'auto',
        endpoint: `https://${this.config.get<string>('R2_ACCOUNT_ID')}.r2.cloudflarestorage.com`,
        credentials: {
          accessKeyId: this.config.get<string>('R2_ACCESS_KEY_ID') as string,
          secretAccessKey: this.config.get<string>('R2_SECRET_ACCESS_KEY') as string,
        },
        // Explicit — the SDK's own default is no timeout at all, and `requestTimeout`
        // alone only logs a warning on breach; `throwOnRequestTimeout` is required to
        // actually bound the call with an error `putObject`'s caller can catch.
        requestHandler: {
          requestTimeout: S3_REQUEST_TIMEOUT_MS,
          throwOnRequestTimeout: true,
        },
      });
    }
    return this.client;
  }

  private async putObject(
    key: string,
    bytes: Uint8Array,
    contentType: string,
    cacheControl: string
  ): Promise<void> {
    await this.getClient().send(
      new PutObjectCommand({
        Bucket: this.config.get<string>('R2_BUCKET') as string,
        Key: key,
        Body: bytes,
        ContentType: contentType,
        CacheControl: cacheControl,
      })
    );
  }
}
