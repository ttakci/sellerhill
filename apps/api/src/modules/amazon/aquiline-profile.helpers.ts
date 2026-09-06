// apps/api/src/modules/amazon/aquiline-profile.helpers.ts
import { createHash } from 'crypto';

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
 * It used to cover `storeAddress` too. We no longer send one: a live probe on
 * 2026-09-02 created a profile from `{"accountOrigin":"amazon"}` alone and the
 * provider stored `storeAddress: null`, so the field is optional and our
 * sellers — dropshippers with no premises — have no real address to put in it.
 * Sending a synthesized one was inventing data for a field nobody requires.
 *
 * `amazonAccountEmail` is deliberately excluded: it is documented as an
 * optional hint, it is immutable after creation (PATCH accepts only label,
 * marketplaceHost and storeAddress), and including it would make a seller's
 * second Amazon account churn the profile for no gain.
 *
 * `label` is therefore the only input left, and it is derived from the
 * deterministic profile id — so in practice the fingerprint never changes and
 * no PATCH is ever issued. The mechanism is kept rather than deleted because
 * it costs one hash per conversion and is what a future PATCH-able field would
 * hang off.
 */
export function fingerprintProfile(label: string): string {
  return createHash('sha256').update(JSON.stringify([label])).digest('hex').slice(0, 64);
}
