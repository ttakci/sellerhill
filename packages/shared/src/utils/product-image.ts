/**
 * Deriving the mirrored image URL from the Keepa filename.
 *
 * `keepa-normalizer` builds every Amazon image URL as
 * `https://images-na.ssl-images-amazon.com/images/I/${name}`, so the name IS
 * the image's whole identity. That is what lets the mirror work with no ID
 * table and no lookup, and it is why the same physical image shared by many
 * ASINs and many sellers is one stored object.
 *
 * The name already carries its extension (`71nx65qZq6L.jpg`), so the two
 * derivations differ: our key is the name verbatim, while Amazon's source URL
 * needs the size variant inserted before the final dot.
 */

const AMAZON_IMAGE_BASE = 'https://images-na.ssl-images-amazon.com/images/I';

/**
 * The size Amazon renders for us. Verified 2026-09-24: the same image is
 * 185,303 bytes unmodified and 45,132 bytes at `_SL800_`, so Amazon performs
 * the resize and the mirror is a byte copy with no transform component.
 */
export const AMAZON_IMAGE_SIZE_VARIANT = '_SL800_';

const MAX_IMAGE_NAME_LENGTH = 64;

/**
 * A name is usable only if it is a bare filename with an extension.
 *
 * This is the only guard between provider-supplied text and both an object key
 * and an outbound URL, so it is a strict allowlist rather than a denylist: no
 * slash, no backslash, no traversal, no query string, no fragment. A name
 * without a dot is rejected because the size variant has nowhere to go — it
 * would otherwise produce a URL Amazon answers with an error page that
 * Cloudflare would then cache.
 */
export function isValidKeepaImageName(name: string): boolean {
  if (typeof name !== 'string' || name.length === 0 || name.length > MAX_IMAGE_NAME_LENGTH) {
    return false;
  }
  return /^[A-Za-z0-9+_-]+\.[A-Za-z0-9]{2,5}$/.test(name);
}

/** The final path segment of an Amazon image URL, when it is a usable name. */
export function extractKeepaImageName(url: string): string | null {
  if (typeof url !== 'string' || url.length === 0) {
    return null;
  }
  const name = url.split('/').pop() ?? '';
  return isValidKeepaImageName(name) ? name : null;
}

/** Amazon's own URL for the resized variant, or null when the name is unusable. */
export function buildAmazonSourceImageUrl(name: string): string | null {
  if (!isValidKeepaImageName(name)) {
    return null;
  }
  const dot = name.lastIndexOf('.');
  const stem = name.slice(0, dot);
  const extension = name.slice(dot);
  return `${AMAZON_IMAGE_BASE}/${stem}.${AMAZON_IMAGE_SIZE_VARIANT}${extension}`;
}

/** Our own URL for a mirrored image, or null when it cannot be built safely. */
export function buildMirroredImageUrl(name: string, baseUrl: string): string | null {
  if (!isValidKeepaImageName(name) || typeof baseUrl !== 'string' || baseUrl.length === 0) {
    return null;
  }
  return `${baseUrl.replace(/\/+$/, '')}/${name}`;
}
