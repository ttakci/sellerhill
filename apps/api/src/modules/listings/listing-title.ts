import { EBAY_TITLE_MAX_LENGTH } from '@repo/shared';

/**
 * Pure eBay title helpers.
 *
 * Amazon titles are long, punctuation-heavy and often contain newlines or
 * control characters. eBay caps titles at 80 characters, and the previous
 * `slice(0, 80)` cut mid-word ("… Variety Pack, Gluten Free, 16 Pouc"), which
 * reads as a broken listing and costs search relevance on the trailing term.
 */

/** Collapse whitespace and drop control characters (no regex control ranges). */
export function normalizeTitleWhitespace(title: string): string {
  let out = '';
  for (const char of title) {
    const code = char.codePointAt(0) ?? 0;
    // C0/C1 control characters and DEL become spaces.
    out += code < 32 || code === 127 ? ' ' : char;
  }
  return out.replace(/\s{2,}/g, ' ').trim();
}

/**
 * Truncate to `maxLength` without splitting a word, then drop a dangling
 * separator so the title never ends in "," / "-" / "(".
 */
export function truncateTitleAtWordBoundary(title: string, maxLength = EBAY_TITLE_MAX_LENGTH): string {
  const normalized = normalizeTitleWhitespace(title);
  if (normalized.length <= maxLength) {
    return normalized;
  }

  const slice = normalized.slice(0, maxLength);
  const lastSpace = slice.lastIndexOf(' ');
  // Only honour the word boundary when it keeps a reasonable amount of title;
  // a single 90-char word must still be truncated rather than emptied.
  const cut = lastSpace > maxLength * 0.6 ? slice.slice(0, lastSpace) : slice;

  return cut.replace(/[\s,;:|/\-–([{&+]+$/, '').trim();
}

/**
 * Case-insensitive brand strip (leading "Brand - " form, then whole-word
 * occurrences). Pure so both the deterministic title and the AI post-check use
 * exactly the same rule — otherwise a model that re-introduces the brand would
 * silently undo the seller's "remove brand" setting.
 */
export function stripBrandFromTitle(title: string, brand: string): string {
  const trimmed = brand.trim();
  if (!trimmed) {
    return title;
  }
  const escaped = trimmed.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  let next = title.replace(new RegExp(`^${escaped}\\s*[-–:|]?\\s*`, 'i'), '');
  next = next.replace(new RegExp(`\\b${escaped}\\b`, 'gi'), ' ');
  return next.replace(/\s{2,}/g, ' ').replace(/^[-–:|,\s]+|[-–:|,\s]+$/g, '').trim() || title;
}

/**
 * Does the rewritten title still earn its place next to the deterministic one?
 *
 * eBay ranks on the title, so its 80 characters are search surface: a model
 * that answers "BISSELL Portable Carpet Cleaner 48oz" (36 chars) for a 65-char
 * source has thrown away half the budget AND the model number buyers search by.
 * When that happens the deterministic title — which keeps every source keyword
 * up to the limit — is simply better, so the rewrite is rejected.
 */
export function isTitleRewriteAcceptable(
  rewritten: string,
  baseTitle: string,
  maxLength = EBAY_TITLE_MAX_LENGTH
): boolean {
  if (rewritten.length < 8) {
    return false;
  }

  // How much title we could have used for this product.
  const budget = Math.min(maxLength, baseTitle.length);
  if (rewritten.length < budget * 0.6) {
    return false;
  }

  // Identifier-ish tokens (model numbers, sizes: "1400B", "48oz", "16CT") are
  // high-intent search terms; dropping them is never an improvement.
  const identifiers = extractIdentifierTokens(baseTitle);
  const lower = rewritten.toLowerCase();
  const kept = identifiers.filter((token) => lower.includes(token.toLowerCase()));

  return identifiers.length === 0 || kept.length > 0;
}

/** Tokens that mix letters and digits, or are pure digits with a unit. */
export function extractIdentifierTokens(title: string): string[] {
  return title
    .split(/[\s,;|/()]+/)
    .map((token) => token.replace(/^[^A-Za-z0-9]+|[^A-Za-z0-9]+$/g, ''))
    .filter((token) => token.length >= 3 && /[0-9]/.test(token) && /[A-Za-z]/.test(token));
}

/** Words that carry no search value on their own. */
const TITLE_STOPWORDS = new Set([
  'and', 'for', 'with', 'the', 'of', 'a', 'an', 'to', 'in', 'on', 'by', 'from',
  'your', 'our', 'you', 'it', 'is', 'are', 'that', 'this', 'x', 'or', 'as',
  'gifts', 'gift', 'essentials', 'gerekli',
]);

/**
 * Pack unused title characters with search terms the model left behind.
 *
 * Small local models cannot count characters: asked for 65-80 they answer 40-50
 * and drop keywords the source had. Rather than fight that with prompt
 * engineering, the model does the part it is good at (deciding what matters
 * most, which goes first) and this function does the part code is good at
 * (filling the remaining budget deterministically, in source order, without
 * repeating a word).
 *
 * eBay titles are keyword strings rather than prose, so appending source terms
 * is idiomatic for the marketplace, not padding.
 */
export function expandTitleWithSourceKeywords(
  title: string,
  sourceTitle: string,
  maxLength = EBAY_TITLE_MAX_LENGTH,
  excludeTerm?: string
): string {
  let result = normalizeTitleWhitespace(title);
  if (result.length >= maxLength) {
    return result;
  }

  // Whole-title alphanumeric blob. Word-by-word comparison is not enough: the
  // model writes "1.19oz (34g)" while the source says "1.19oz(34g)", which are
  // different words but the same information — appending both produced
  // "... 1.19oz (34g) 1.19oz(34g) ...".
  let haystack = titleTokenKey(result);
  const excluded = excludeTerm ? titleTokenKey(excludeTerm) : '';

  const fits = (addition: string): boolean => result.length + 1 + addition.length <= maxLength;
  const isNew = (text: string): boolean => {
    const key = titleTokenKey(text);
    return key.length > 0 && key !== excluded && !haystack.includes(key);
  };
  const append = (text: string): void => {
    result = `${result} ${text}`;
    haystack += titleTokenKey(text);
  };

  const source = normalizeTitleWhitespace(sourceTitle);

  // 1. Identifiers ("48mm", "50g", "G5") are what buyers type into search, so
  //    they get the budget before any descriptive phrase does.
  for (const token of source.split(/[\s,;|()]+/).map(trimTokenEdges)) {
    if (isIdentifierToken(token) && isNew(token) && fits(token)) {
      append(token);
    }
  }

  // 2. Then whole phrases, in source order. Appending single words instead
  //    produced word salad ("... 40-Count Lead Resists Bulk"); a phrase like
  //    "Pastel Barrels" reads like a title a seller would actually write.
  for (const rawPhrase of source.split(/\s*[,;|]\s*/)) {
    // A phrase may carry the brand the seller removed
    // ("HiBREW G5 Electric Burr Coffee Grinder") — strip it rather than skip the
    // whole phrase, which would lose "G5".
    const phrase = trimPhraseEdges(
      excludeTerm ? stripBrandFromTitle(trimPhraseEdges(rawPhrase), excludeTerm) : rawPhrase
    );

    if (phrase.length < 3 || !fits(phrase) || isPhraseNoise(phrase, excluded)) {
      continue;
    }
    // `isNew` only catches a phrase we hold verbatim. A phrase that merely
    // restates what the model already wrote plus one new word
    // ("Bio Collagen Real Deep Mask Hydrating") must also be skipped, or the
    // title reads twice.
    if (!isNew(phrase) || overlapsExisting(phrase, haystack)) {
      continue;
    }
    append(phrase);
  }

  // 3. Whatever budget is left goes to individual content words. A phrase that
  //    does not fit ("Little Green Multi-Purpose Portable Carpet Cleaner") must
  //    not mean the words it contains are lost.
  for (const token of source.split(/[\s,;|()]+/).map(trimTokenEdges)) {
    if (token.length < 3 || !/[A-Za-z]/.test(token) || TITLE_STOPWORDS.has(token.toLowerCase())) {
      continue;
    }
    if (isNew(token) && fits(token)) {
      append(token);
    }
  }

  return result;
}

function trimTokenEdges(token: string): string {
  return token.replace(/^[^A-Za-z0-9]+|[^A-Za-z0-9)]+$/g, '');
}

function trimPhraseEdges(phrase: string): string {
  return phrase.replace(/^[^A-Za-z0-9]+|[^A-Za-z0-9)]+$/g, '').trim();
}

/** A token that mixes letters and digits, e.g. a model number or a size. */
function isIdentifierToken(token: string): boolean {
  return token.length >= 2 && /[0-9]/.test(token) && /[A-Za-z]/.test(token);
}

/**
 * True when most of a phrase's words are already in the title. Appending it
 * would restate what the model wrote instead of adding information.
 */
function overlapsExisting(phrase: string, haystack: string): boolean {
  const words = phrase
    .split(/\s+/)
    .map(titleTokenKey)
    .filter((word) => word.length >= 3);

  if (words.length === 0) {
    return false;
  }
  const known = words.filter((word) => haystack.includes(word)).length;
  return known / words.length >= 0.5;
}

/** Phrases that add no search value: stopword-only, or just the brand. */
function isPhraseNoise(phrase: string, excludedKey: string): boolean {
  const words = phrase.toLowerCase().split(/\s+/);
  if (words.every((word) => TITLE_STOPWORDS.has(word) || !/[a-z]/.test(word))) {
    return true;
  }
  return excludedKey.length > 0 && titleTokenKey(phrase) === excludedKey;
}

/**
 * Comparison key for "is this word already in the title".
 *
 * Punctuation is dropped entirely so "Bio-Collagen" and "Bio Collagen" are the
 * same token — otherwise the packer happily appended a phrase the model had
 * already written, producing "… Real Deep Mask 1.19oz x 4ea Bio-Collagen …".
 */
function titleTokenKey(word: string): string {
  return word.toLowerCase().replace(/[^a-z0-9]/g, '');
}

/**
 * Put the brand back at the FRONT when the model dropped it.
 *
 * Buyers scan eBay results left to right and the brand is the strongest
 * recognition cue, so a title that ends "... Pastel Barrels BIC" — which is
 * where the keyword packer would otherwise place it — reads like a mistake.
 * No-op when the seller asked for the brand to be removed.
 */
export function ensureBrandPrefix(
  title: string,
  brand: string | undefined | null,
  maxLength = EBAY_TITLE_MAX_LENGTH
): string {
  const trimmed = (brand ?? '').trim();
  if (!trimmed) {
    return title;
  }

  const key = titleTokenKey(trimmed);
  if (!key || titleTokenKey(title).includes(key)) {
    return title;
  }
  if (title.length + 1 + trimmed.length > maxLength) {
    return title;
  }

  return `${trimmed} ${title}`;
}
