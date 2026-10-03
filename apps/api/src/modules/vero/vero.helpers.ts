import { VERO_KEYWORD_MAX_LENGTH } from '@repo/shared';

import { buildKeywordPattern } from '../listings/listing-blacklist';

/**
 * Split operator input into clean, unique brand names.
 *
 * Commas and new lines separate entries — never spaces, because a brand is
 * often two words ("Stomp Rocket"). Uniqueness ignores case; the first
 * spelling entered is the one kept.
 */
export function parseVeroKeywords(input: readonly string[]): string[] {
  const seen = new Map<string, string>();
  for (const chunk of input) {
    for (const part of String(chunk ?? '').split(/[\n,]/)) {
      const keyword = part.replace(/\s+/g, ' ').trim();
      if (!keyword || keyword.length > VERO_KEYWORD_MAX_LENGTH) {
        continue;
      }
      const key = keyword.toLowerCase();
      if (!seen.has(key)) {
        seen.set(key, keyword);
      }
    }
  }
  return [...seen.values()];
}

/** A VeRO entry prepared for matching: a cheap substring test before the regex. */
export interface CompiledVeroKeyword {
  keyword: string;
  needle: string;
  pattern: RegExp;
}

export function compileVeroKeywords(keywords: readonly string[]): CompiledVeroKeyword[] {
  const compiled: CompiledVeroKeyword[] = [];
  for (const keyword of keywords) {
    const pattern = buildKeywordPattern(keyword, 'iu');
    if (pattern) {
      compiled.push({ keyword: keyword.trim(), needle: keyword.trim().toLowerCase(), pattern });
    }
  }
  return compiled;
}

/**
 * The first VeRO entry that names this product's brand or manufacturer, or
 * null. Whole words only — the blacklist's own rule — so "Roku" never matches
 * "Rokua" and a two-word brand matches only as that phrase.
 *
 * Brand and manufacturer are the ONLY fields read. A brand name is also an
 * ordinary word in thousands of titles ("Apple" cider vinegar, "Dove" grey),
 * and a list no seller can see must not refuse products for a reason no
 * seller could guess.
 */
export function findVeroMatch(
  compiled: readonly CompiledVeroKeyword[],
  brandValues: ReadonlyArray<string | null | undefined>
): string | null {
  const values = brandValues.map((value) => (value ?? '').trim()).filter(Boolean);
  if (values.length === 0 || compiled.length === 0) {
    return null;
  }
  const lowered = values.map((value) => value.toLowerCase());
  for (const entry of compiled) {
    if (!lowered.some((value) => value.includes(entry.needle))) {
      continue;
    }
    if (values.some((value) => entry.pattern.test(value))) {
      return entry.keyword;
    }
  }
  return null;
}
