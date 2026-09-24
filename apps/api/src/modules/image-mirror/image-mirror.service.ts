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

  async ensureMirrored(
    productId: string,
    imageUrl: string | undefined,
    alreadyMirrored: boolean
  ): Promise<string | null> {
    if (!this.isConfigured() || !imageUrl) {
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
    if (alreadyMirrored) {
      return publicUrl;
    }

    try {
      const body = await this.download(name);
      if (!body) {
        return null;
      }
      await this.putObject(name, body.bytes, body.contentType, body.cacheControl);
      await this.database.query(`UPDATE products SET image_mirrored_at = NOW() WHERE id = $1`, [productId]);
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
