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

/**
 * USPS standard abbreviations Amazon applies when it saves an address. The eBay
 * side keeps whatever the buyer typed ("115 Cambron Lane"), the Amazon side
 * shows the standardised form ("115 CAMBRON LN"). Applied to BOTH sides token by
 * token, so the table can only make equal addresses compare equal — an entry
 * cannot make two different words collide unless they are the same USPS word.
 */
const USPS_TOKENS: Readonly<Record<string, string>> = {
  street: 'st',
  avenue: 'ave',
  av: 'ave',
  road: 'rd',
  drive: 'dr',
  lane: 'ln',
  boulevard: 'blvd',
  court: 'ct',
  circle: 'cir',
  place: 'pl',
  terrace: 'ter',
  highway: 'hwy',
  parkway: 'pkwy',
  trail: 'trl',
  square: 'sq',
  crossing: 'xing',
  expressway: 'expy',
  freeway: 'fwy',
  heights: 'hts',
  point: 'pt',
  mount: 'mt',
  north: 'n',
  south: 's',
  east: 'e',
  west: 'w',
  northeast: 'ne',
  northwest: 'nw',
  southeast: 'se',
  southwest: 'sw',
  apartment: 'apt',
  suite: 'ste',
  building: 'bldg',
  floor: 'fl',
  room: 'rm',
  department: 'dept',
};

/** Case/spacing/punctuation-insensitive comparison form, USPS-abbreviated. */
function normalize(value: string): string {
  return (
    value
      .toLowerCase()
      .replace(/[.,#]/g, ' ')
      // "121Daniel" -> "121 daniel": Amazon inserts the space when it saves.
      .replace(/(\d)([a-z])/g, '$1 $2')
      .replace(/([a-z])(\d)/g, '$1 $2')
      .split(/\s+/)
      .filter(Boolean)
      .map((token) => USPS_TOKENS[token] ?? token)
      .join(' ')
  );
}

/** Whole-token containment, so "15 cambron ln" is not found inside "115 cambron ln". */
function containsTokens(haystack: string, needle: string): boolean {
  return ` ${haystack} `.includes(` ${needle} `);
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
  if (!containsTokens(haystack, streetNorm)) {
    return false;
  }
  const number = streetNumber(streetNorm);
  if (number && !new RegExp(`(^|\\s)${number}(\\s|$)`).test(haystack)) {
    return false;
  }

  // Unit/suite line: if the buyer has one it must be present, otherwise a
  // same-street neighbouring unit would be accepted.
  const unit = buyer.street2?.trim();
  if (unit && !containsTokens(haystack, normalize(unit))) {
    return false;
  }

  return true;
}
