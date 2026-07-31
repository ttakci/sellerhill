/**
 * GTIN (UPC-A / EAN-8 / EAN-13 / GTIN-14) validation.
 *
 * eBay rejects a publish outright when `product.upc`/`product.ean` carries a
 * malformed identifier, and Amazon/Keepa data contains plenty of junk values
 * ("X0022ABCDE", zero-padded internal codes, empty strings). Validating the
 * GS1 check digit locally keeps a bad ASIN from failing an otherwise fine
 * listing — an unverifiable identifier is simply omitted.
 */

/** Digits only, length 8/12/13/14, and a correct GS1 mod-10 check digit. */
export function isValidGtin(value: string | undefined | null): boolean {
  if (!value) {
    return false;
  }
  const digits = value.trim();
  if (!/^\d+$/.test(digits) || ![8, 12, 13, 14].includes(digits.length)) {
    return false;
  }
  // All-zero (and other constant) codes are structurally valid but never real.
  if (/^0+$/.test(digits)) {
    return false;
  }

  const body = digits.slice(0, -1);
  const checkDigit = Number(digits.slice(-1));

  // GS1: weights alternate 3/1 from the RIGHTMOST body digit.
  let sum = 0;
  for (let i = body.length - 1, weight = 3; i >= 0; i -= 1, weight = weight === 3 ? 1 : 3) {
    sum += Number(body[i]) * weight;
  }
  const expected = (10 - (sum % 10)) % 10;

  return expected === checkDigit;
}

/** Normalize to digits, returning undefined when the value is not a usable GTIN. */
export function normalizeGtin(value: string | undefined | null): string | undefined {
  const trimmed = value?.trim();
  return isValidGtin(trimmed) ? trimmed : undefined;
}
