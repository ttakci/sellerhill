/**
 * Clean-up of source copy before it becomes an eBay listing.
 *
 * Three independent, pure steps, applied to the PRODUCT's own text (title,
 * description, feature bullets, spec values) before the template renders:
 *
 *  - keyword REMOVAL — a blacklist entry whose action is `remove` strips the
 *    word and lists the product anyway;
 *  - contact details — e-mail addresses, web addresses and phone numbers are
 *    always taken out: eBay removes listings that carry them, and an Amazon
 *    seller's support line means nothing to an eBay buyer;
 *  - brand hiding — the seller's "send no brand" rule.
 *
 * HTML is handled by touching only the text BETWEEN tags, so a keyword or a
 * URL inside an attribute (an image `src`) is never rewritten.
 */
import {
  BlacklistAction,
  BlacklistType,
  type BlacklistKeyword,
  type ProductData,
} from '@repo/shared';

import { buildKeywordPattern } from './listing-blacklist';

const EMAIL = /[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi;
/** `https://…` or `www.…`, up to the next space or closing bracket. */
const WEB_ADDRESS = /(?:https?:\/\/|www\.)[^\s<>"')\]]+/gi;
/**
 * A bare host (`acme.com`, `shop.acme.com/help`). Deliberately narrow: only
 * four TLDs, and only written in LOWERCASE. Amazon copy routinely drops the
 * space after a full stop ("leak-proof.Store upright", "durable.Net weight"),
 * and a wider or case-insensitive pattern would eat the start of the next
 * sentence.
 */
const BARE_HOST = /\b(?:[A-Za-z0-9][A-Za-z0-9-]{0,62}\.)+(?:com|net|org|io)\b(?:\/[^\s<>"')\]]*)?/g;
/**
 * North-American phone numbers written WITH separators: `(800) 555-0199`,
 * `800-555-0199`, `1.800.555.0199`, `+1 800 555 0199`. A bare ten-digit run is
 * deliberately not matched — that is what a UPC or a model number looks like.
 */
const PHONE = /(?<![\w.-])(?:\+?1[\s.-]?)?(?:\(\d{3}\)\s?|\d{3}[\s.-])\d{3}[\s.-]\d{4}(?![\w-])/g;
/**
 * Link shorteners written without a scheme (`bit.ly/3xYz`, `amzn.to/abc`,
 * `a.co/d/xyz`). eBay refuses a listing that carries one anywhere in the
 * description, and none ends in the four TLDs `BARE_HOST` knows. Named hosts
 * only, any case, and only with a path — `a.co` alone is not a link.
 */
const SHORT_LINK =
  /(?<![\w.-])(?:bit\.ly|bitly\.com|tinyurl\.com|t\.co|goo\.gl|ow\.ly|is\.gd|buff\.ly|rebrand\.ly|cutt\.ly|shorturl\.at|rb\.gy|tiny\.cc|amzn\.to|amzn\.eu|a\.co)\/[^\s<>"')\]]+/gi;

const HTML_TAG_SPLIT = /(<[^>]+>)/;

/** Apply `transform` to the text between tags only. Plain text is one segment. */
function mapTextSegments(input: string, transform: (text: string) => string): string {
  if (!input.includes('<')) {
    return transform(input);
  }
  return input
    .split(HTML_TAG_SPLIT)
    .map((segment) => (segment.startsWith('<') && segment.endsWith('>') ? segment : transform(segment)))
    .join('');
}

/** Repair what a removal leaves behind: doubled spaces, a space before punctuation, empty brackets. */
function tidy(text: string): string {
  return text
    .replace(/\(\s*\)|\[\s*\]/g, '')
    .replace(/[ \t]{2,}/g, ' ')
    .replace(/[ \t]+([,.;:!?])/g, '$1')
    .replace(/([,;:])(?:\s*[,;:])+/g, '$1');
}

/** Remove e-mail addresses, web addresses and phone numbers from buyer-visible text. */
export function stripContactDetails(input: string): string {
  if (!input) {
    return input;
  }
  return mapTextSegments(input, (text) => {
    const cleaned = text
      .replace(EMAIL, '')
      .replace(WEB_ADDRESS, '')
      .replace(SHORT_LINK, '')
      .replace(BARE_HOST, '')
      .replace(PHONE, '');
    return cleaned === text ? text : tidy(cleaned);
  });
}

/** Remove every whole-word occurrence of each keyword from buyer-visible text. */
export function removeKeywords(input: string, keywords: readonly string[]): string {
  if (!input || keywords.length === 0) {
    return input;
  }
  const patterns = keywords
    .map((keyword) => buildKeywordPattern(keyword, 'giu'))
    .filter((pattern): pattern is RegExp => pattern !== null);
  if (patterns.length === 0) {
    return input;
  }
  return mapTextSegments(input, (text) => {
    let cleaned = text;
    for (const pattern of patterns) {
      cleaned = cleaned.replace(pattern, '');
    }
    return cleaned === text ? text : tidy(cleaned);
  });
}

/** The `remove` keywords scoped to one field. */
export function removalKeywordsFor(
  blacklist: readonly BlacklistKeyword[] | undefined,
  type: BlacklistType
): string[] {
  return (blacklist ?? [])
    .filter((item) => item.action === BlacklistAction.REMOVE && item.types.includes(type))
    .map((item) => item.keyword.trim())
    .filter(Boolean);
}

const BRAND_SPEC_NAMES = new Set(['brand', 'brand name', 'manufacturer']);

export interface ContentRuleOptions {
  blacklist?: readonly BlacklistKeyword[];
  /** The blacklist master switch; off means no keyword is removed either. */
  checkBlacklist: boolean;
  hideBrand: boolean;
}

/**
 * The product as it may be listed: a copy with the seller's content rules
 * applied. The input is never mutated — the cached product row is shared.
 */
export function applyContentRules(product: ProductData, options: ContentRuleOptions): ProductData {
  const blacklist = options.checkBlacklist ? options.blacklist : undefined;
  const titleWords = removalKeywordsFor(blacklist, BlacklistType.TITLE);
  const descriptionWords = removalKeywordsFor(blacklist, BlacklistType.DESCRIPTION);
  const featureWords = removalKeywordsFor(blacklist, BlacklistType.FEATURE_SPECIFICATION);

  const title = removeKeywords(product.title ?? '', titleWords).trim();
  const description = stripContactDetails(removeKeywords(product.description ?? '', descriptionWords));
  const features = (product.features ?? [])
    .map((feature) => stripContactDetails(removeKeywords(feature, featureWords)).trim())
    .filter((feature) => feature.length > 0);

  const specs: Record<string, string> = {};
  for (const [name, value] of Object.entries(product.specs ?? {})) {
    if (options.hideBrand && BRAND_SPEC_NAMES.has(name.trim().toLowerCase())) {
      continue;
    }
    const cleaned = removeKeywords(String(value ?? ''), featureWords).trim();
    if (cleaned) {
      specs[name] = cleaned;
    }
  }

  return {
    ...product,
    // A title that was nothing but removed words keeps its original text: an
    // empty title would fail the listing over a rule meant to keep it alive.
    title: title || product.title,
    description,
    features,
    specs,
    ...(options.hideBrand ? { brand: '', manufacturer: undefined, identifiers: {} } : {}),
  };
}
