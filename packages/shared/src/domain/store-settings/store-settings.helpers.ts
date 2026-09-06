// packages/shared/src/domain/store-settings/store-settings.helpers.ts
//
// Pure derivations over a seller's store address. Shared because the SAME
// address feeds two providers with different required-field sets, and a second
// hand-rolled derivation at one of the two call sites is how they drift.

/** The four fields the Store Settings drawer actually collects. */
export interface StoreAddressParts {
  country?: string | null;
  state?: string | null;
  city?: string | null;
  zipCode?: string | null;
}

/**
 * A street line for providers that REQUIRE one, derived from city + region.
 *
 * SellerHill deliberately does not collect a street. A dropshipper has no
 * warehouse — the parcel ships from Amazon — so a street would be a field with
 * no true value that the seller has to invent anyway. But both consumers demand
 * one: eBay refuses a `STORE` inventory location without `addressLine1`, and
 * the tracking provider's profile requires `address_line1`. So one is derived
 * rather than left blank or, worse, filled with a literal placeholder — which
 * is exactly what shipped before this (`'Use Store Address'` reached eBay as a
 * real street on every seller's inventory location).
 *
 * `"Sheridan, WY"` is honest in a way `"Use Store Address"` is not: it repeats
 * information the buyer already sees as the item location and asserts no
 * premises that do not exist. eBay publishes only city/region/country to
 * buyers, so this line is never rendered on a listing.
 *
 * Returns `''` when neither part is present — the caller decides whether an
 * empty street is acceptable for its provider.
 */
export function buildStoreStreetLine(address: StoreAddressParts): string {
  const parts = [address.city, address.state]
    .map((part) => part?.trim() ?? '')
    .filter((part) => part.length > 0);
  return parts.join(', ');
}

/**
 * Whether the address satisfies BOTH consumers' required-field sets — the
 * union, since a seller configures one address and it has to serve both.
 *
 * eBay (`STORE` location): addressLine1 + city + stateOrProvince + postalCode
 * + country. Tracking provider profile: address_line1 + city + country.
 * `addressLine1` is derived by `buildStoreStreetLine`, so it is satisfied
 * exactly when city or state is present — already implied by requiring both.
 */
export function isStoreAddressComplete(address: StoreAddressParts): boolean {
  return Boolean(
    address.country?.trim() &&
      address.state?.trim() &&
      address.city?.trim() &&
      address.zipCode?.trim(),
  );
}
