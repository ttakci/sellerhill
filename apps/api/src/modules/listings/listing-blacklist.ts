/**
 * Whole-word matching for the Store Settings blacklist.
 *
 * `ListingStrategyService.validateListing` used to test each keyword with
 * `value.toLowerCase().includes(keyword.toLowerCase())` — a plain SUBSTRING
 * match with no notion of a word boundary. Every short keyword therefore fired
 * on words no seller would ever connect to the rule, and the failure reason
 * named a word they could not find by eye because it was buried inside a longer
 * one (observed live 2026-09-08, one bulk job, six ASINs, six false positives):
 *
 *   "gin"    -> pack(agin)g, ch(argin)g, ori(gin)al, plu(gin), en(gin)e
 *   "rum"    -> se(rum), d(rum), fo(rum), spect(rum)
 *   "cross"  -> a(cross)
 *   "amazon" -> images-na.ssl-images-(amazon).com
 *
 * That last one is the reason `extractVisibleText` exists, and it shows the
 * shape of the whole class: the keyword was never buyer-visible as a word.
 */

/**
 * Characters that count as "inside a word".
 *
 * Unicode letters and numbers are the obvious members — `\p{L}\p{N}` rather
 * than `\w`, because `\w` is ASCII-only and would treat every accented or
 * Turkish letter as a boundary, re-opening the same false-positive hole for
 * non-English copy.
 *
 * `-`, `/` and `_` are members by an explicit operator decision (2026-09-08):
 * a seller who blacklists `cross` means the standalone word, not `cross-body`
 * or `cross/over`. Counting them as word characters is precisely what makes
 * those compounds NOT match. A seller who does want the compound blocked types
 * it in full, and `cross-body` still matches then.
 *
 * Deliberately NOT members: `.`, `'`, `,`, brackets and the rest of
 * punctuation. A seller blacklisting `amazon` absolutely means to catch
 * `amazon.com` and `Amazon's Choice`, and those read as the word to a buyer.
 */
const WORD_CHARACTER_CLASS = '[\\p{L}\\p{N}_/-]';

/** Escape every character that would otherwise be regex syntax. */
function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/**
 * True when `keyword` occurs as a standalone word in any of `values`.
 *
 * Case-insensitivity comes from the `i` flag rather than lowercasing both
 * sides: paired with `u` it applies real Unicode case folding, and it avoids
 * allocating a lowercased copy of a full product description once per keyword.
 *
 * An empty or whitespace-only keyword matches nothing — a blank row in the
 * blacklist drawer must never block every listing the seller owns.
 */
export function containsBlacklistedKeyword(
  values: readonly string[],
  keyword: string
): boolean {
  const trimmed = keyword.trim();
  if (!trimmed) {
    return false;
  }

  const pattern = new RegExp(
    `(?<!${WORD_CHARACTER_CLASS})${escapeRegExp(trimmed)}(?!${WORD_CHARACTER_CLASS})`,
    'iu'
  );

  return values.some((value) => pattern.test(value));
}
