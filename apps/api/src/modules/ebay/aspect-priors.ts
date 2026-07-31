import { EBAY_NOT_APPLICABLE, EBAY_UNBRANDED } from '@repo/shared';

import type { CategoryAspect } from './aspect-builder';

/**
 * Built-in knowledge for the item specifics eBay makes required across whole
 * category trees but which Amazon data never states — Department, Type, Size
 * Type and friends. Pure and dependency-free so it stays unit-testable.
 *
 * Why this module exists: a required `SELECTION_ONLY` aspect used to be dropped
 * when nothing matched, eBay refused the publish with error 25002, the retry
 * loop forced the same aspect once, it was dropped again, and the listing died
 * with "no value could be derived" — advice the UI gave the seller no way to
 * act on. One unlisted product per unlucky category, forever.
 *
 * The contract here is the opposite: `pickTerminalValue` ALWAYS returns a
 * value, so a required aspect can never be the reason a listing fails.
 */

/** Values that honestly say "this attribute does not apply to this product". */
const NON_VALUE_PATTERN = /^(does\s?not\s?apply|not\s?applicable|n\/?a|unspecified|unbranded|none)$/i;

/**
 * Values that are broad rather than wrong. Picking "Unisex Adult" for a jar of
 * spice is defensible; picking "Boys" is a lie that reaches buyers.
 */
const CATCH_ALL_PATTERN =
  /^(other|unisex|unisex adult|universal|assorted|multi-?colou?r|multicolou?red|one size|adult|all|any|standard|mixed)$/i;

/** Aspects whose "unknown" answer is eBay's sanctioned identifier non-value. */
const IDENTIFIER_ASPECT_PATTERN = /^(mpn|manufacturerpartnumber|partnumber|upc|ean|gtin|isbn|modelnumber)$/;

/** Aspect-specific hints, keyed by normalized aspect name. */
const PRIOR_HINTS: Record<string, RegExp[]> = {
  department: [/\bunisex adult\b/i, /\badult\b/i, /\bunisex\b/i],
  agegroup: [/\badult\b/i],
  sizetype: [/\bregular\b/i, /\bstandard\b/i],
  countryregionofmanufacture: [/\bunknown\b/i, /\bunspecified\b/i],
  material: [/\bnot specified\b/i],
};

function normalizeName(name: string): string {
  return name.toLowerCase().replace(/[^a-z0-9]/g, '');
}

function normalizeValue(value: string): string {
  return value.toLowerCase().replace(/\s+/g, ' ').trim();
}

/** First allowed value the product text actually mentions (longest match wins). */
export function pickValueFromText(aspect: CategoryAspect, text: string): string | null {
  if (aspect.values.length === 0) {
    return null;
  }
  const haystack = normalizeValue(text);
  if (haystack.length === 0) {
    return null;
  }

  const mentioned = aspect.values
    .filter((value) => {
      const needle = normalizeValue(value);
      // 3+ chars: "S" or "XL" would match almost any title by accident.
      return needle.length >= 3 && haystack.includes(needle);
    })
    // Longest match is the most specific ("Unisex Adult" beats "Adult").
    .sort((a, b) => b.length - a.length);

  return mentioned[0] ?? null;
}

/**
 * A broadly-true value for a well-known aspect, derived from the product text
 * and the aspect's own hint table. Returns null when nothing is defensible —
 * the terminal fallback then takes over.
 */
export function pickPriorValue(aspect: CategoryAspect, text: string): string | null {
  const fromText = pickValueFromText(aspect, text);
  if (fromText) {
    return fromText;
  }

  const hints = PRIOR_HINTS[normalizeName(aspect.name)];
  if (!hints || aspect.values.length === 0) {
    return null;
  }

  for (const hint of hints) {
    const match = aspect.values.find((value) => hint.test(value));
    if (match) {
      return match;
    }
  }

  return null;
}

/**
 * The guarantee: a value that eBay will accept for this aspect, always.
 *
 * Order is deliberate — an explicit non-value beats a catch-all, and a
 * catch-all beats an arbitrary specific one. The final deterministic pick only
 * runs for SELECTION_ONLY aspects, where every candidate is a value eBay itself
 * published as valid, and it prefers plain options (no digits, no ranges) so a
 * listing never claims a concrete size or measurement it does not have.
 */
export function pickTerminalValue(aspect: CategoryAspect): string {
  if (!aspect.selectionOnly || aspect.values.length === 0) {
    if (normalizeName(aspect.name) === 'brand') {
      return EBAY_UNBRANDED;
    }
    return EBAY_NOT_APPLICABLE;
  }

  const nonValue = aspect.values.find((value) => NON_VALUE_PATTERN.test(value.trim()));
  if (nonValue) {
    return nonValue;
  }

  const catchAll = aspect.values.find((value) => CATCH_ALL_PATTERN.test(value.trim()));
  if (catchAll) {
    return catchAll;
  }

  // Deterministic, and biased away from values that assert a measurement.
  const plain = aspect.values.filter((value) => !/[0-9/×x-]/.test(value)).sort((a, b) => a.localeCompare(b));

  return plain[0] ?? [...aspect.values].sort((a, b) => a.localeCompare(b))[0];
}

/** True when the aspect is an identifier whose unknown answer is "Does not apply". */
export function isIdentifierAspect(aspectName: string): boolean {
  return IDENTIFIER_ASPECT_PATTERN.test(normalizeName(aspectName));
}
