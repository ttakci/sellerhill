/**
 * Buyer-address matching for Amazon checkout.
 *
 * In dropshipping the item must ship to the eBay BUYER, never to the Amazon
 * buyer-account holder. Amazon pre-selects the account's own default address, so
 * picking the wrong saved address (or falling back to the default) means paying
 * for an order that is delivered to the wrong person while the eBay sale stays
 * unfulfilled. That makes the match rule money-critical and worth isolating.
 */

/** Address fields used for matching. Mirrors the checkout service's Address. */
export interface MatchableAddress {
  fullName?: string;
  street?: string;
  street2?: string;
  city?: string;
  state?: string;
  zipCode?: string;
}

/** Case/spacing/punctuation-insensitive comparison form. */
function normalize(value: string): string {
  return value
    .toLowerCase()
    .replace(/[.,#]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

/** Leading house/building number of a street line, when present. */
function streetNumber(street: string): string | null {
  return /^\s*(\d+)/.exec(street)?.[1] ?? null;
}

/**
 * Whether a saved Amazon address block's rendered text identifies the eBay
 * buyer's address.
 *
 * Requires BOTH the postcode and the street to line up. A postcode alone is not
 * enough: one household can hold several addresses under the same zip (observed
 * live — two entries differing only by unit, `24233` vs `STE567`), and matching
 * on zip alone would silently pick whichever came first. The street check also
 * demands the house number, so `30 N GOULD ST STE567` cannot satisfy a buyer at
 * `30 N GOULD ST 24233` unless the unit text matches too.
 *
 * Name is corroborating evidence only: eBay and Amazon frequently render the
 * recipient differently (middle names, casing, company lines), so a name
 * mismatch is not decisive — but when the buyer's address carries a unit/suite,
 * that unit MUST appear.
 */
export function addressBlockMatchesBuyer(
  blockText: string,
  buyer: MatchableAddress,
): boolean {
  const zip = buyer.zipCode?.trim();
  const street = buyer.street?.trim();
  if (!zip || !street) {
    // Without both signals there is no safe way to tell two saved addresses
    // apart; the caller must not guess.
    return false;
  }

  const haystack = normalize(blockText);

  // Postcode: compare the 5-digit base so ZIP+4 on either side still matches.
  const zipBase = normalize(zip).split('-')[0];
  if (!zipBase || !haystack.includes(zipBase)) {
    return false;
  }

  // Street: require the house number AND the remaining street text.
  const streetNorm = normalize(street);
  if (!haystack.includes(streetNorm)) {
    return false;
  }
  const number = streetNumber(streetNorm);
  if (number && !new RegExp(`(^|\\s)${number}(\\s|$)`).test(haystack)) {
    return false;
  }

  // Unit/suite line: if the buyer has one it must be present, otherwise a
  // same-street neighbouring unit would be accepted.
  const unit = buyer.street2?.trim();
  if (unit && !haystack.includes(normalize(unit))) {
    return false;
  }

  return true;
}
