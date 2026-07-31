/**
 * Pure helpers for the admin listing-quality surface.
 *
 * Kept out of the service so the validation rule that protects publishes — a
 * curated value must be one the category actually accepts — is unit-testable
 * without a database.
 */

/** Same normalization the aspect builder uses; it is the join key in the DB. */
export function normalizeAspectKey(aspectName: string): string {
  return (aspectName ?? '').toLowerCase().replace(/[^a-z0-9]/g, '');
}

export interface CategoryAspectShape {
  name: string;
  selectionOnly: boolean;
  values: string[];
}

/**
 * Why a curated value cannot be stored, or null when it is fine.
 *
 * An operator typing a free-text value into a SELECTION_ONLY aspect would make
 * every listing in that category fail at publish — the panel must refuse it,
 * not discover it later.
 */
export function validateCuratedAspectValue(
  aspects: CategoryAspectShape[],
  aspectName: string,
  value: string
): string | null {
  const trimmed = (value ?? '').trim();
  if (trimmed.length === 0) {
    return 'Value is required';
  }

  const key = normalizeAspectKey(aspectName);
  const aspect = aspects.find((candidate) => normalizeAspectKey(candidate.name) === key);
  if (!aspect) {
    // Unknown to the cached taxonomy — allowed; eBay's own error will teach us.
    return null;
  }

  if (!aspect.selectionOnly || aspect.values.length === 0) {
    return null;
  }

  const allowed = aspect.values.some((candidate) => candidate.toLowerCase() === trimmed.toLowerCase());
  return allowed
    ? null
    : `"${trimmed}" is not an accepted value for ${aspect.name}. Allowed: ${aspect.values.slice(0, 8).join(', ')}${
        aspect.values.length > 8 ? '…' : ''
      }`;
}

/** Share of listings that needed a broad fallback value, as a percentage. */
export function autofillRate(listingsAnalyzed: number, listingsWithAutofill: number): number {
  if (listingsAnalyzed <= 0) {
    return 0;
  }
  return Math.round((listingsWithAutofill / listingsAnalyzed) * 1000) / 10;
}
