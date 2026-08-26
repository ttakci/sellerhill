// apps/api/src/modules/amazon/aquiline-profile.helpers.ts
import { createHash } from 'crypto';

import type { AquilineStoreAddress } from '@repo/shared';

/**
 * Deterministic profile id.
 *
 * The provider lets the client choose the id, and choosing it is what makes a
 * crashed creation recoverable: profiles cannot be deleted, so if Aquiline
 * created one but our row write failed, a server-generated id would leave a
 * permanently consumed slot with nothing pointing at it. With a derived id the
 * next attempt asks for the same one and adopts it.
 */
export function buildAquilineProfileId(
  prefix: string,
  userId: string,
  marketplace: string,
): string {
  return `${prefix}-${userId}-${marketplace}`;
}

/**
 * Hash of everything a PATCH would change. Comparing this is what stops every
 * conversion re-PATCHing the profile.
 *
 * `amazonAccountEmail` is deliberately excluded: it is documented as an
 * optional hint, it is immutable after creation (PATCH accepts only label,
 * marketplaceHost and storeAddress), and including it would make a seller's
 * second Amazon account churn the profile for no gain.
 */
export function fingerprintProfile(label: string, address: AquilineStoreAddress): string {
  const canonical = JSON.stringify([
    label,
    address.first_name ?? '',
    address.last_name ?? '',
    address.address_line1,
    address.address_line2 ?? '',
    address.city,
    address.state ?? '',
    address.zip_code ?? '',
    address.country,
    address.phone_number ?? '',
  ]);
  return createHash('sha256').update(canonical).digest('hex').slice(0, 64);
}
