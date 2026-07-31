import {
  EBAY_ASPECT_MAX_VALUES,
  EBAY_ASPECT_NAME_MAX_LENGTH,
  EBAY_ASPECT_VALUE_MAX_LENGTH,
  EBAY_MAX_ITEM_SPECIFICS,
  EBAY_NOT_APPLICABLE,
  EBAY_UNBRANDED,
  type ProductIdentifiers,
} from '@repo/shared';

import { isValidGtin } from '../../common/utils/gtin';

import { pickPriorValue, pickTerminalValue } from './aspect-priors';

/**
 * Pure eBay item-specifics (aspect) builder.
 *
 * Item specifics are the single biggest driver of eBay search placement and
 * buyer trust, and the previous implementation produced almost none: it seeded
 * `Brand`, scraped a few "Key: Value" bullets, and then filled every REQUIRED
 * aspect eBay declared with the literal string "Unknown" — which is what buyers
 * saw on the live listing ("Product: Unknown").
 *
 * This module instead:
 * 1. matches our product attributes to the category's real aspect names
 *    (case/format-insensitive, with a synonym table for the naming differences
 *    between Amazon and eBay),
 * 2. constrains values to what the category actually accepts (SELECTION_ONLY
 *    value lists, max length, cardinality),
 * 3. derives a value from the title when nothing else is known, and
 * 4. only then falls back — to eBay's sanctioned "Does not apply" for identifier
 *    aspects and "Unbranded" for Brand, never to invented text.
 */

/** Aspect metadata as returned by the Taxonomy API (subset we consume). */
export interface CategoryAspect {
  name: string;
  required: boolean;
  /** true when eBay only accepts values from `values`. */
  selectionOnly: boolean;
  /** true when the aspect accepts more than one value. */
  multiValue: boolean;
  values: string[];
  maxLength?: number;
}

export interface AspectBuilderInput {
  title: string;
  brand?: string;
  specs?: Record<string, string>;
  features?: string[];
  identifiers?: ProductIdentifiers;
  categoryAspects: CategoryAspect[];
  /** Aspect names eBay explicitly complained about (self-healing retry loop). */
  forcedAspectNames?: string[];
  /**
   * Values resolved by the async layers (curated defaults, learned values, LLM),
   * keyed by normalized aspect name. Precomputed by the caller so this module
   * stays pure and synchronous.
   */
  overrides?: Record<string, ResolvedAspectOverride>;
  /** Default true. False reproduces the old "leave required aspects empty" behavior. */
  allowTerminalFallback?: boolean;
  /** Default true. Emits product attributes the category did not declare. */
  includeCustomSpecifics?: boolean;
}

export interface ResolvedAspectOverride {
  value: string;
  layer: AspectResolutionLayer;
}

/** Which layer produced an aspect's value — recorded for diagnostics. */
export enum AspectResolutionLayer {
  /** Real product data from Keepa (or a "Key: Value" feature bullet). */
  PRODUCT_DATA = 'product_data',
  /** Operator-curated default for this category. */
  CURATED = 'curated',
  /** Value that previously published successfully in this category. */
  LEARNED = 'learned',
  /** Built-in knowledge / product-text inference. */
  PRIOR = 'prior',
  /** Model picked from eBay's allowed-value list. */
  LLM = 'llm',
  /** Broad-but-true value so a required aspect is never empty. */
  TERMINAL_FALLBACK = 'terminal_fallback',
}

export interface AspectDecision {
  aspectName: string;
  value: string | null;
  layer: AspectResolutionLayer;
  required: boolean;
  selectionOnly: boolean;
}

export interface AspectResolution {
  aspects: Record<string, string[]>;
  decisions: AspectDecision[];
  /** Empty whenever the terminal fallback is enabled — that is the guarantee. */
  unresolvedRequired: string[];
}

/**
 * Aspect names that describe an identifier. When we genuinely have no value,
 * eBay's own documented answer is "Does not apply" — inventing "Unknown" both
 * misinforms buyers and is treated as a low-quality listing signal.
 */
const IDENTIFIER_ASPECTS = new Set([
  'mpn',
  'manufacturerpartnumber',
  'upc',
  'ean',
  'gtin',
  'isbn',
  'modelnumber',
  'partnumber',
  'californiaprop65warning',
  'unitquantity',
  'unittype',
]);

/** Aspects that must carry a manufacturer part number, never a barcode. */
const PART_NUMBER_ASPECTS = new Set(['mpn', 'manufacturerpartnumber', 'partnumber', 'model', 'modelnumber']);

/**
 * Amazon/Keepa attribute name → eBay aspect name synonyms. Keys and values are
 * compared in normalized form, so only genuinely different wordings belong here.
 */
const ASPECT_SYNONYMS: Record<string, string[]> = {
  mpn: ['partnumber', 'manufacturerpartnumber', 'model', 'modelnumber'],
  brand: ['manufacturer', 'make'],
  manufacturer: ['brand'],
  type: ['producttype', 'itemtype', 'style'],
  color: ['colour', 'primarycolor'],
  size: ['sizetype', 'itemsize'],
  material: ['materials', 'fabrictype'],
  itemweight: ['weight', 'netweight', 'packageweight'],
  itemlength: ['length'],
  itemwidth: ['width'],
  itemheight: ['height'],
  numberofitems: ['numberinpack', 'itemsincluded', 'packquantity', 'packagequantity', 'unitquantity'],
  flavor: ['flavour'],
  department: ['gender', 'agegroup'],
  modelnumber: ['model'],
  features: ['featurelist'],
};

/** Lower-case, strip everything but a–z0–9 — "Item Weight" ≡ "item_weight". */
function normalizeName(name: string): string {
  return name.toLowerCase().replace(/[^a-z0-9]/g, '');
}

function normalizeValue(value: string): string {
  return value.toLowerCase().replace(/\s+/g, ' ').trim();
}

/** All normalized names an aspect may be known by (itself + synonyms, both ways). */
function candidateNames(aspectName: string): string[] {
  const normalized = normalizeName(aspectName);
  const direct = ASPECT_SYNONYMS[normalized] ?? [];
  const reverse = Object.entries(ASPECT_SYNONYMS)
    .filter(([, synonyms]) => synonyms.includes(normalized))
    .map(([key]) => key);
  return [normalized, ...direct.map(normalizeName), ...reverse];
}

/**
 * Constrain a value to what the aspect accepts.
 * SELECTION_ONLY aspects return the matching allowed value (exact → case
 * insensitive → containment) or null; free-text aspects return the trimmed
 * value. Returning null is deliberate: an unaccepted value fails the publish.
 */
export function matchAspectValue(aspect: CategoryAspect, rawValue: string, brand?: string): string | null {
  const value = rawValue.replace(/\s+/g, ' ').trim();
  if (value.length === 0) {
    return null;
  }

  // eBay rejects the publish when MPN carries a barcode ("MPN has an invalid
  // value of 021500000529"). Amazon routinely puts the UPC in `partNumber`, and
  // "Part Number: <upc>" also shows up in feature bullets, so the guard lives
  // here rather than only at extraction. Identifier aspects (UPC/EAN) are
  // unaffected — a GTIN is exactly what they want.
  if (PART_NUMBER_ASPECTS.has(normalizeName(aspect.name))) {
    // A barcode is not a part number, and neither is the brand name — eBay
    // refuses both ("MPN has an invalid value of \"BolaButty\"").
    if (isValidGtin(value) || (brand && value.toLowerCase() === brand.trim().toLowerCase())) {
      return null;
    }
  }

  if (aspect.selectionOnly && aspect.values.length > 0) {
    const normalized = normalizeValue(value);

    const exact = aspect.values.find((allowed) => normalizeValue(allowed) === normalized);
    if (exact) {
      return exact;
    }
    // "Blue" vs "Blue/Navy", "16 oz" vs "16 oz."
    const contained = aspect.values.find((allowed) => {
      const allowedNorm = normalizeValue(allowed);
      return allowedNorm.includes(normalized) || normalized.includes(allowedNorm);
    });
    if (contained) {
      return contained;
    }
    return null;
  }

  const limit = Math.min(aspect.maxLength ?? EBAY_ASPECT_VALUE_MAX_LENGTH, EBAY_ASPECT_VALUE_MAX_LENGTH);
  return value.length > limit ? value.slice(0, limit).trim() : value;
}

/**
 * Last-resort value for a REQUIRED aspect we could not fill.
 *
 * Order matters: a SELECTION_ONLY aspect must receive one of its own values
 * (matched against the title when possible) — sending free text there is an
 * outright publish failure, which is what the old "Unknown" fill triggered
 * before the retry loop papered over it.
 */
export function fallbackValueFor(aspect: CategoryAspect, title: string): string | null {
  const normalized = normalizeName(aspect.name);

  if (aspect.selectionOnly && aspect.values.length > 0) {
    const titleNorm = normalizeValue(title);
    // Prefer an allowed value the title actually mentions.
    const fromTitle = aspect.values.find((allowed) => {
      const allowedNorm = normalizeValue(allowed);
      return allowedNorm.length > 2 && titleNorm.includes(allowedNorm);
    });
    if (fromTitle) {
      return fromTitle;
    }
    const notApplicable = aspect.values.find((allowed) =>
      /^(does not apply|not applicable|n\/a|unbranded|unspecified|other)$/i.test(allowed.trim())
    );
    return notApplicable ?? null;
  }

  if (normalized === 'brand') {
    return EBAY_UNBRANDED;
  }
  if (IDENTIFIER_ASPECTS.has(normalized)) {
    return EBAY_NOT_APPLICABLE;
  }
  return null;
}

/**
 * Extract "Key: Value" pairs from Amazon feature bullets.
 *
 * Amazon bullets mix real attributes ("Item Form: Rolled") with marketing
 * headlines ("LARGE 48OZ. CLEAN WATER TANK: Clean more, uninterrupted, with…").
 * Only the former belong in an item-specifics table, so a key must look like an
 * attribute NAME — short, wordy rather than numeric — and its value must not be
 * a sentence.
 */
export function extractSpecsFromFeatures(features: string[]): Record<string, string> {
  const specs: Record<string, string> = {};

  for (const feature of features) {
    const match = feature.match(/^\s*([A-Za-z][A-Za-z0-9\-/ .]{1,29}?)\s*[:]\s*(.+)$/);
    if (!match) {
      continue;
    }
    const key = match[1].trim();
    const value = match[2].trim();

    if (key.length <= 2 || /\d/.test(key) || key.split(/\s+/).length > 3) {
      continue;
    }
    // A sentence is copy, not an attribute value.
    if (value.length === 0 || value.length > EBAY_ASPECT_VALUE_MAX_LENGTH || /\.\s|\.$/.test(value)) {
      continue;
    }
    const name = toAttributeCase(key);
    if (!specs[name]) {
      specs[name] = value;
    }
  }

  return specs;
}

/** "MATERIAL" → "Material"; mixed-case names are left as the source wrote them. */
function toAttributeCase(key: string): string {
  if (key !== key.toUpperCase()) {
    return key;
  }
  return key
    .toLowerCase()
    .split(' ')
    .map((word) => (word.length > 0 ? word[0].toUpperCase() + word.slice(1) : word))
    .join(' ');
}

/**
 * Build the aspects map for an eBay inventory item.
 *
 * Two kinds of item specific are emitted:
 * 1. the aspects the category DECLARES — value-constrained, required ones
 *    always resolved (see `pickTerminalValue`), and
 * 2. every remaining product attribute as a CUSTOM free-text specific.
 *
 * (2) is what the strongest listings on eBay do: they carry the source
 * catalogue's whole attribute table ("Included Components", "Unit Count",
 * "Recommended Uses For Product", …) even when the category never declared
 * those names. This builder previously discarded them, which is why our
 * listings showed three specifics next to a competitor's thirty.
 */
export function buildAspects(input: AspectBuilderInput): Record<string, string[]> {
  return buildAspectResolution(input).aspects;
}

/** `buildAspects` plus the per-aspect provenance used for logging/diagnostics. */
export function buildAspectResolution(input: AspectBuilderInput): AspectResolution {
  const sources: Record<string, string> = {
    ...extractSpecsFromFeatures(input.features ?? []),
    ...(input.specs ?? {}),
  };

  if (input.brand) {
    sources.Brand = input.brand;
  }
  if (input.identifiers?.mpn) {
    sources.MPN = input.identifiers.mpn;
  }
  if (input.identifiers?.model) {
    sources.Model = input.identifiers.model;
  }
  if (input.identifiers?.upc) {
    sources.UPC = input.identifiers.upc;
  }
  if (input.identifiers?.ean) {
    sources.EAN = input.identifiers.ean;
  }

  // Normalized lookup of everything we know about the product.
  const known = new Map<string, string>();
  for (const [name, value] of Object.entries(sources)) {
    if (typeof value === 'string' && value.trim().length > 0) {
      const key = normalizeName(name);
      if (!known.has(key)) {
        known.set(key, value.trim());
      }
    }
  }

  const forced = new Set((input.forcedAspectNames ?? []).map(normalizeName));
  const aspects: Record<string, string[]> = {};
  const decisions: AspectDecision[] = [];
  const consumed = new Set<string>();

  const declared = [...input.categoryAspects];
  // eBay complained about an aspect the taxonomy did not declare (it happens on
  // some categories) — treat it as a required free-text aspect.
  for (const name of input.forcedAspectNames ?? []) {
    if (!declared.some((aspect) => normalizeName(aspect.name) === normalizeName(name))) {
      declared.push({ name, required: true, selectionOnly: false, multiValue: false, values: [] });
    }
  }

  // Product text the prior layer reasons over (title carries most of the signal).
  const productText = [input.title, ...(input.features ?? [])].join(' ');
  const allowTerminal = input.allowTerminalFallback !== false;

  for (const aspect of declared) {
    const isRequired = aspect.required || forced.has(normalizeName(aspect.name));

    let matched: string | null = null;
    let layer: AspectResolutionLayer = AspectResolutionLayer.PRODUCT_DATA;

    for (const candidate of candidateNames(aspect.name)) {
      const value = known.get(candidate);
      if (value) {
        matched = matchAspectValue(aspect, value, input.brand);
        if (matched) {
          consumed.add(candidate);
          break;
        }
      }
    }

    // Values supplied by the async orchestrator (curated / learned / LLM).
    if (!matched && input.overrides) {
      const override = input.overrides[normalizeName(aspect.name)];
      const constrained = override ? matchAspectValue(aspect, override.value, input.brand) : null;
      if (constrained) {
        matched = constrained;
        layer = override.layer;
      }
    }

    if (!matched && isRequired) {
      matched = fallbackValueFor(aspect, input.title);
      if (matched) {
        layer = AspectResolutionLayer.PRIOR;
      }
    }

    if (!matched && isRequired) {
      const prior = pickPriorValue(aspect, productText);
      if (prior) {
        matched = prior;
        layer = AspectResolutionLayer.PRIOR;
      }
    }

    // The guarantee. A required aspect is never left empty: an empty one makes
    // eBay refuse the publish, and no retry can conjure the value, so the
    // listing died. A broad-but-true value keeps it live and is flagged
    // low-confidence for the seller to review.
    if (!matched && isRequired && allowTerminal) {
      matched = pickTerminalValue(aspect);
      layer = AspectResolutionLayer.TERMINAL_FALLBACK;
    }

    decisions.push({
      aspectName: aspect.name,
      value: matched,
      layer,
      required: isRequired,
      selectionOnly: aspect.selectionOnly,
    });

    if (matched) {
      // Multi-value aspects still get a single value: eBay accepts that, and
      // splitting a scraped string on commas invents specifics we never read.
      aspects[aspect.name] = [matched].slice(0, EBAY_ASPECT_MAX_VALUES);
      // Every name this aspect answers to is now spoken for, so the custom pass
      // cannot publish "Colour" next to the category's own "Color".
      for (const candidate of candidateNames(aspect.name)) {
        consumed.add(candidate);
      }
    }
  }

  // Brand is universally understood and improves listings even when the
  // category does not declare it.
  if (!Object.keys(aspects).some((name) => normalizeName(name) === 'brand')) {
    const brand = known.get('brand');
    aspects.Brand = [(brand ?? EBAY_UNBRANDED).slice(0, EBAY_ASPECT_VALUE_MAX_LENGTH)];
    consumed.add('brand');
  }

  // Custom specifics: everything the product data knows that the category did
  // not declare. eBay accepts up to EBAY_MAX_ITEM_SPECIFICS name/value pairs
  // and does not restrict names to the declared list.
  if (input.includeCustomSpecifics !== false) {
    for (const [name, rawValue] of Object.entries(sources)) {
      if (Object.keys(aspects).length >= EBAY_MAX_ITEM_SPECIFICS) {
        break;
      }
      const key = normalizeName(name);
      if (consumed.has(key) || IGNORED_CUSTOM_ASPECTS.has(key)) {
        continue;
      }
      // Already emitted under the category's own spelling of this attribute.
      if (Object.keys(aspects).some((emitted) => normalizeName(emitted) === key)) {
        continue;
      }

      const value = sanitizeCustomValue(rawValue);
      const aspectName = sanitizeCustomName(name);
      if (!value || !aspectName) {
        continue;
      }

      aspects[aspectName] = [value];
      consumed.add(key);
      decisions.push({
        aspectName,
        value,
        layer: AspectResolutionLayer.PRODUCT_DATA,
        required: false,
        selectionOnly: false,
      });
    }
  }

  return {
    aspects,
    decisions,
    unresolvedRequired: decisions.filter((d) => d.required && !d.value).map((d) => d.aspectName),
  };
}

/** Attribute names that are noise as buyer-facing item specifics. */
const IGNORED_CUSTOM_ASPECTS = new Set(['asin', 'parentasin', 'description', 'shortdescription', 'title']);

function sanitizeCustomName(name: string): string | null {
  const clean = name.replace(/[^A-Za-z0-9 &/.'()-]/g, ' ').replace(/\s{2,}/g, ' ').trim();
  if (clean.length < 2 || clean.length > EBAY_ASPECT_NAME_MAX_LENGTH) {
    return null;
  }
  return clean;
}

function sanitizeCustomValue(value: string): string | null {
  const clean = value.replace(/\s+/g, ' ').trim();
  if (clean.length === 0) {
    return null;
  }
  return clean.slice(0, EBAY_ASPECT_VALUE_MAX_LENGTH);
}
