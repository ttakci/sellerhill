import { Injectable, Logger } from '@nestjs/common';
import { EBAY_EPS_IMAGE_BASE_URL, extractEpsImageId, readEpsImageUrl } from '@repo/shared';

import { EbayService } from './ebay.service';

/**
 * Uploads one image to eBay Picture Services and hands back its `i.ebayimg.com`
 * URL, or null. Knows nothing about products, stores or listings — the cache
 * keyed on (product, eBay account) is Task 4's job, and wiring it into listing
 * creation is Task 5's.
 *
 * Deliberately never throws: an image failure must never fail a listing (D5 in
 * docs/superpowers/specs/2026-09-25-ebay-eps-images-design.md).
 */

/** 50 POSTs / 5s per user (documented). A short bounded wait genuinely clears it. */
const MAX_ATTEMPTS = 3;
const BASE_BACKOFF_MS = 500;

interface EbayErrorBody {
  errors?: Array<{ errorId?: number; message?: string }>;
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => {
    setTimeout(resolve, ms);
  });
}

/**
 * Delta-seconds `Retry-After` only, matching `parseRetryAfterMs` in
 * `ebay-http-retry.ts` — mirrored rather than imported, since that module's
 * retry loop is axios-specific (see the task's "do not use it" ruling) and
 * charges the eBay call budget, which this resource is deliberately kept out of.
 */
function parseRetryAfterMs(value: string | null): number | null {
  if (!value) {
    return null;
  }
  const seconds = Number(value);
  return Number.isFinite(seconds) ? Math.max(0, seconds) * 1000 : null;
}

/** eBay's `errorId` when the body carries one — for the warn line only, never for control flow. */
function extractErrorId(body: string): number | null {
  try {
    const parsed = JSON.parse(body) as EbayErrorBody;
    const errorId = parsed.errors?.[0]?.errorId;
    return typeof errorId === 'number' ? errorId : null;
  } catch {
    return null;
  }
}

@Injectable()
export class EbayMediaService {
  private readonly logger = new Logger(EbayMediaService.name);

  constructor(private readonly ebayService: EbayService) {}

  async uploadFromUrl(accountId: string, sourceUrl: string): Promise<string | null> {
    try {
      // eBay rejects plain http outright — refusing here spends no request to learn that.
      if (!sourceUrl.startsWith('https://')) {
        this.logger.warn(`EPS upload refused: source URL is not https (${sourceUrl})`);
        return null;
      }

      const token = await this.ebayService.getAccountAccessToken(accountId);
      return await this.createImageFromUrl(token, sourceUrl);
    } catch (error) {
      this.logger.warn(
        `EPS upload failed for ${sourceUrl}: ${error instanceof Error ? error.message : String(error)}`
      );
      return null;
    }
  }

  private async createImageFromUrl(token: string, sourceUrl: string): Promise<string | null> {
    const response = await this.fetchWithRetry(`${EBAY_EPS_IMAGE_BASE_URL}/image/create_image_from_url`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({ imageUrl: sourceUrl }),
    });

    if (response.status !== 201) {
      const body = await response.text();
      const errorId = extractErrorId(body);
      this.logger.warn(
        `EPS upload failed (HTTP ${response.status}${errorId !== null ? `, errorId ${errorId}` : ''}) for ${sourceUrl}`
      );
      return null;
    }

    const body = await response.text();
    const fromBody = readEpsImageUrl(body);
    if (fromBody) {
      this.logger.log(`EPS upload for ${sourceUrl}: read imageUrl from the create_image_from_url 201 body`);
      return fromBody;
    }

    const imageId = extractEpsImageId(response.headers.get('location'));
    if (!imageId) {
      this.logger.warn(`EPS upload for ${sourceUrl}: 201 carried no usable imageUrl and no Location header`);
      return null;
    }

    return this.getImage(token, imageId, sourceUrl);
  }

  private async getImage(token: string, imageId: string, sourceUrl: string): Promise<string | null> {
    const response = await this.fetchWithRetry(`${EBAY_EPS_IMAGE_BASE_URL}/image/${imageId}`, {
      headers: { Authorization: `Bearer ${token}` },
    });

    if (response.status !== 200) {
      const body = await response.text();
      const errorId = extractErrorId(body);
      this.logger.warn(
        `EPS getImage failed (HTTP ${response.status}${errorId !== null ? `, errorId ${errorId}` : ''}) for ${sourceUrl}`
      );
      return null;
    }

    const body = await response.text();
    const url = readEpsImageUrl(body);
    if (url) {
      this.logger.log(`EPS upload for ${sourceUrl}: 201 body had no usable imageUrl, fell back to getImage`);
    } else {
      this.logger.warn(`EPS getImage for ${sourceUrl}: response carried no usable imageUrl`);
    }
    return url;
  }

  /** Retries a 429 with backoff, honouring `Retry-After` when eBay sends one. */
  private async fetchWithRetry(url: string, init: RequestInit): Promise<Response> {
    for (let attempt = 1; ; attempt += 1) {
      const response = await fetch(url, init);
      if (response.status !== 429 || attempt >= MAX_ATTEMPTS) {
        return response;
      }
      const retryAfterMs = parseRetryAfterMs(response.headers.get('retry-after'));
      const backoffMs = retryAfterMs ?? BASE_BACKOFF_MS * 2 ** (attempt - 1);
      this.logger.warn(`EPS ${url} answered 429 (attempt ${attempt}/${MAX_ATTEMPTS}) — retrying in ${backoffMs}ms`);
      await sleep(backoffMs);
    }
  }
}
