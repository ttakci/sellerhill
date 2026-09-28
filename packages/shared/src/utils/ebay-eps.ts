/**
 * Reading eBay Picture Services responses, and deciding which URL each surface
 * gets.
 *
 * The two surfaces deliberately behave differently, and NOT because one is
 * correctable later — neither is. Nothing in this codebase ever re-sends
 * `imageUrls` to eBay after create: `buildInventoryItemPayload` is the only
 * function that emits them and `EbayBulkService.createListings` is its only
 * caller, while `updatePriceQuantity` carries quantity and price alone. So a
 * failed upload is permanent on BOTH surfaces, for the life of the listing.
 *
 * The GALLERY still falls back per image to the source URL, because the
 * alternative is `EBAY_PLACEHOLDER_IMAGE` on a listing with no photos at all,
 * and a listing with one Amazon-hosted photo outsells a listing with none.
 * The DESCRIPTION never falls back, because there the choice is between an
 * Amazon URL and no image — and the gallery is already showing every photo,
 * so no image costs the listing nothing.
 *
 * That asymmetry is a trade, not a safety net. Upload reliability is what
 * actually keeps the supplier's domain off a listing.
 */

/**
 * Image operations only — not the host this app's other REST calls use.
 * eBay's own docs name `apim.ebay.com` in one place and `apiz.ebay.com` in
 * another for the Media API; `apps/api/src/scripts/ebay-media-probe.ts`
 * tried all three candidate hosts against production and confirmed this is
 * the one that actually serves images. Do not assume it also serves
 * anything else this app calls.
 */
import { EBAY_MIN_IMAGE_LONGEST_SIDE } from '../domain/listings/listings.constants';

export const EBAY_EPS_IMAGE_BASE_URL = 'https://apim.ebay.com/commerce/media/v1_beta';

const EPS_HOST = 'https://i.ebayimg.com/';

/** An EPS URL, as opposed to a source URL we merely handed to eBay. */
export function isEpsImageUrl(url: string): boolean {
  return typeof url === 'string' && url.startsWith(EPS_HOST);
}

/**
 * The image id from a 201's `Location` header, which eBay documents as
 * `https://apim.ebay.com/commerce/media/v1_beta/image/{image_id}`.
 */
export function extractEpsImageId(location: string | null): string | null {
  if (typeof location !== 'string' || location.length === 0) {
    return null;
  }
  const id = location.split('/').filter(Boolean).pop();
  return id && !id.includes(':') && id !== 'image' ? id : null;
}

/**
 * The EPS URL from a create-or-get response body.
 *
 * eBay's OpenAPI declares `ImageResponse` on the 201, which would make
 * `getImage` unnecessary — but the live probe did not print the body, so this
 * returns null rather than assuming. A caller that gets null falls back to
 * `getImage`. A body carrying something that is not an EPS URL is treated as
 * absent: storing a non-EPS value would defeat the whole feature.
 */
export function readEpsImageUrl(body: string): string | null {
  if (typeof body !== 'string' || body.length === 0) {
    return null;
  }
  try {
    const parsed = JSON.parse(body) as { imageUrl?: unknown };
    return typeof parsed.imageUrl === 'string' && isEpsImageUrl(parsed.imageUrl)
      ? parsed.imageUrl
      : null;
  } catch {
    return null;
  }
}

/**
 * Gallery URLs: EPS where we have it, the source URL where we do not.
 *
 * The fallback is NOT correctable on a later sync (see this file's header) —
 * it is accepted because a listing with no photos is worse than a listing with
 * one Amazon-hosted photo.
 */
export function resolveGalleryUrls(sourceUrls: string[], epsBySource: Map<string, string>): string[] {
  const gallery = (sourceUrls ?? []).map((source) => epsBySource.get(source) ?? source);
  // eBay refuses the WHOLE listing when any picture is under its Picture
  // Policy minimum — seen live on one 269x331 image Amazon had no hi-res for.
  // Only EPS URLs are judged: eBay encodes their real size, a source URL's is
  // unknown and is kept. If every image is too small the list is returned
  // unfiltered: an empty gallery publishes with eBay's placeholder (a live
  // listing with no photo), and eBay's own refusal is the better outcome.
  const large = gallery.filter((url) => !isBelowPicturePolicy(url));
  return large.length > 0 ? large : gallery;
}

function isBelowPicturePolicy(url: string): boolean {
  const size = readEpsImageDimensions(url);
  return size !== null && Math.max(size.width, size.height) < EBAY_MIN_IMAGE_LONGEST_SIDE;
}

/**
 * The pixel size eBay encodes in an EPS URL: `https://i.ebayimg.com/00/s/<b64>/…`
 * where `<b64>` is base64 of `"<width>X<height>"` (e.g. `MjY5WDMzMQ==` →
 * `269X331`). Null for any URL not in that shape — the caller must then treat
 * the size as unknown, never as small.
 */
export function readEpsImageDimensions(url: string): { width: number; height: number } | null {
  if (!isEpsImageUrl(url)) {
    return null;
  }
  // One path segment, so never a `/` — the unpadded form (`MTM2OFgxMjMy`) would
  // otherwise run on into the next segment.
  const encoded = /\/00\/s\/([A-Za-z0-9+]+={0,2})\//.exec(url)?.[1];
  if (!encoded) {
    return null;
  }
  const decoded = decodeBase64Ascii(encoded);
  const match = decoded ? /^(\d{1,5})X(\d{1,5})$/.exec(decoded) : null;
  return match ? { width: Number(match[1]), height: Number(match[2]) } : null;
}

const BASE64_ALPHABET = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/';

/**
 * Minimal base64 → ASCII, platform-free on purpose: this module runs in the
 * browser (no `Buffer`) and in Node (where `atob` is not guaranteed on every
 * supported version), and it only ever decodes a short `WxH` string.
 */
function decodeBase64Ascii(input: string): string | null {
  const clean = input.replace(/=+$/, '');
  let bits = 0;
  let value = 0;
  let out = '';
  for (const char of clean) {
    const index = BASE64_ALPHABET.indexOf(char);
    if (index === -1) {
      return null;
    }
    value = (value << 6) | index;
    bits += 6;
    if (bits >= 8) {
      bits -= 8;
      out += String.fromCharCode((value >> bits) & 0xff);
    }
  }
  return out;
}

/**
 * The description URL: the FIRST image's EPS URL, or nothing.
 *
 * Deliberately not "the first image that happens to have one" — the
 * description shows the product's primary image, and quietly promoting image
 * two would change what the listing shows without anyone asking.
 */
export function resolveDescriptionUrl(sourceUrls: string[], epsBySource: Map<string, string>): string {
  const first = (sourceUrls ?? [])[0];
  if (!first) {
    return '';
  }
  return epsBySource.get(first) ?? '';
}
