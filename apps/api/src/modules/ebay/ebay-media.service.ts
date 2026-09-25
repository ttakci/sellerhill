import { Injectable, Logger } from '@nestjs/common';
import { EBAY_EPS_IMAGE_BASE_URL, extractEpsImageId, readEpsImageUrl } from '@repo/shared';

/**
 * Uploads one image to eBay Picture Services and hands back its `i.ebayimg.com`
 * URL, or null. Knows nothing about products, stores or listings — the cache
 * keyed on (product, eBay account) is `EbayImageResolver`'s job.
 *
 * It does not resolve the seller token either: the caller passes one in, so a
 * run of 24 uploads reads `ebay_accounts` ONCE instead of 24 times. That is not
 * only waste — `EbayImageResolver` runs its upload loop inside an open database
 * transaction, so every token read was a NESTED pool acquisition from inside a
 * held connection. The pool is `max: 20` with a 2s `connectionTimeoutMillis`
 * and is shared with every other worker in the process, so under enough
 * concurrency each nested acquisition times out, every upload returns null, and
 * the feature degrades silently to Amazon URLs.
 *
 * Deliberately never throws: an image failure must never fail a listing (D5 in
 * docs/superpowers/specs/2026-09-25-ebay-eps-images-design.md).
 */

/** 50 POSTs / 5s per user (documented). A short bounded wait genuinely clears it. */
const MAX_ATTEMPTS = 3;
const BASE_BACKOFF_MS = 500;

/**
 * Wall-clock ceiling on ONE `create_image_from_url` request.
 *
 * What is being bounded here is not a local upload: eBay receives the POST and
 * then goes and downloads the image from Amazon itself, synchronously, before
 * answering. Without a signal the only bound is undici's ~300s default — i.e.
 * no application bound — and because `EbayImageResolver` holds a pooled
 * database connection for the whole upload loop, one hung image is minutes of
 * a connection that order sync and auto-fulfill also need.
 *
 * 15s rather than the R2 mirror's 10s: that 10s bounded US fetching the same
 * image over the same public internet, and eBay's datacentre fetch is not the
 * slower half — the extra 5s is headroom for eBay's own ingest, not for the
 * download. A timeout rejects, which `uploadFromUrl` catches and reports as an
 * ordinary failure, so a stalled image costs that image and nothing else.
 */
export const CREATE_IMAGE_TIMEOUT_MS = 15_000;

/**
 * Wall-clock ceiling on ONE `GET /image/{id}`.
 *
 * Shorter than the create bound on purpose: this is a plain eBay read of an
 * image eBay has already ingested, with no third-party hop in it at all, so
 * nothing here can legitimately take as long as a create. 10s matches
 * `MAX_BACKOFF_MS`, the other bound this path already accepts as "long enough
 * that waiting further is not worth a listing".
 */
export const GET_IMAGE_TIMEOUT_MS = 10_000;

/**
 * Ceiling on any single backoff wait, `Retry-After` included. This call sits on
 * the SYNCHRONOUS listing-creation path (Task 5), so an unbounded sleep here
 * does not degrade a listing — it stops one. Two windows of the documented
 * 50-per-5s limit is generous; past that, a misconfigured/rewritten header is
 * not information worth honouring and giving up (returning `null`, per the
 * fail-soft contract) is the better outcome.
 */
export const MAX_BACKOFF_MS = 10_000;

interface EbayErrorBody {
  errors?: Array<{ errorId?: number; message?: string }>;
}

/**
 * Parses `Retry-After` as delta-seconds (eBay's REST error responses use that
 * form). Unlike the same-named helper in `ebay-http-retry.ts` — which this
 * module deliberately does not import, see the class doc — the value here is
 * NEVER used verbatim: `fetchWithRetry` clamps whatever comes back against
 * `MAX_BACKOFF_MS` before sleeping, because the header is eBay's word, not a
 * bound we control.
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

  async uploadFromUrl(accessToken: string, sourceUrl: string): Promise<string | null> {
    try {
      // eBay rejects plain http outright — refusing here spends no request to learn that.
      if (!sourceUrl.startsWith('https://')) {
        this.logger.warn(`EPS upload refused: source URL is not https (${sourceUrl})`);
        return null;
      }

      return await this.createImageFromUrl(accessToken, sourceUrl);
    } catch (error) {
      // A timeout lands here too: an aborted fetch rejects, so it is reported
      // as the ordinary failure it is — null, never a thrown listing failure.
      this.logger.warn(
        `EPS upload failed for ${sourceUrl}: ${error instanceof Error ? error.message : String(error)}`
      );
      return null;
    }
  }

  private async createImageFromUrl(token: string, sourceUrl: string): Promise<string | null> {
    const response = await this.fetchWithRetry(
      `${EBAY_EPS_IMAGE_BASE_URL}/image/create_image_from_url`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ imageUrl: sourceUrl }),
      },
      CREATE_IMAGE_TIMEOUT_MS
    );

    if (response.status !== 201) {
      await this.logHttpFailure('EPS upload', response, sourceUrl);
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
    const response = await this.fetchWithRetry(
      `${EBAY_EPS_IMAGE_BASE_URL}/image/${imageId}`,
      { headers: { Authorization: `Bearer ${token}` } },
      GET_IMAGE_TIMEOUT_MS
    );

    if (response.status !== 200) {
      await this.logHttpFailure('EPS getImage', response, sourceUrl);
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

  /** The one failure line both HTTP paths log — they differed only by label. */
  private async logHttpFailure(label: string, response: Response, sourceUrl: string): Promise<void> {
    const body = await response.text();
    const errorId = extractErrorId(body);
    this.logger.warn(
      `${label} failed (HTTP ${response.status}${errorId !== null ? `, errorId ${errorId}` : ''}) for ${sourceUrl}`
    );
  }

  /**
   * Retries a 429 with backoff, honouring `Retry-After` when eBay sends one —
   * but never sleeping longer than `MAX_BACKOFF_MS`, whatever the header says.
   *
   * `timeoutMs` bounds each ATTEMPT, with a fresh signal per attempt (an
   * aborted signal stays aborted, so reusing one would fail every retry
   * instantly). The attempts cannot stack into a multiplied stall: the only
   * retried status is 429, which by definition means eBay already answered.
   * A request that actually hangs aborts, rejects, and is never retried — it
   * becomes `uploadFromUrl`'s null.
   */
  private async fetchWithRetry(url: string, init: RequestInit, timeoutMs: number): Promise<Response> {
    for (let attempt = 1; ; attempt += 1) {
      const response = await fetch(url, { ...init, signal: AbortSignal.timeout(timeoutMs) });
      if (response.status !== 429 || attempt >= MAX_ATTEMPTS) {
        return response;
      }
      const retryAfterMs = parseRetryAfterMs(response.headers.get('retry-after'));
      const uncappedMs = retryAfterMs ?? BASE_BACKOFF_MS * 2 ** (attempt - 1);
      const backoffMs = Math.min(uncappedMs, MAX_BACKOFF_MS);
      this.logger.warn(`EPS ${url} answered 429 (attempt ${attempt}/${MAX_ATTEMPTS}) — retrying in ${backoffMs}ms`);
      // Release the 429's body before sleeping. In undici an unconsumed body
      // keeps its connection checked out, so without this the socket is held
      // for the whole backoff and for every attempt after it.
      await this.discardBody(response);
      await this.sleep(backoffMs);
    }
  }

  /**
   * Releases a response we will not read. Never throws — a body already
   * consumed, absent, or errored needs no release, and failing to tidy up
   * must not turn into a listing failure.
   */
  private async discardBody(response: Response): Promise<void> {
    try {
      await response.body?.cancel();
    } catch {
      /* nothing to release */
    }
  }

  /**
   * Its own instance method — not a module-level function — so a test can
   * override it on the instance to assert the clamped duration without ever
   * sleeping for it.
   */
  private sleep(ms: number): Promise<void> {
    return new Promise((resolve) => {
      setTimeout(resolve, ms);
    });
  }
}
