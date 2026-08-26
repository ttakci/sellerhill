// apps/api/src/modules/billing/payment-method-helpers.ts
//
// Pure helper for the /billing/details endpoint. The Stripe call surface
// around it is deliberately not unit-tested (see billing-provider.ts's own
// note) — this is the one genuinely pure piece.

/** Warn this many days ahead by default. Long enough for a seller to act
 *  before a renewal fails, short enough not to nag for a year. */
export const CARD_EXPIRY_WARNING_DAYS = 60;

/**
 * Is this card at or near its expiry?
 *
 * A card is valid through the LAST day of its expiry month, so the deadline is
 * the first instant of the following month. An already-expired card returns
 * true: it is strictly more urgent, and reporting it as fine would hide the
 * one case that is certain to fail.
 */
export function isCardExpiringSoon(
  expMonth: number,
  expYear: number,
  now: Date,
  withinDays: number = CARD_EXPIRY_WARNING_DAYS,
): boolean {
  const expiresAt = Date.UTC(expYear, expMonth, 1);
  const threshold = now.getTime() + withinDays * 24 * 60 * 60 * 1000;
  return expiresAt <= threshold;
}
