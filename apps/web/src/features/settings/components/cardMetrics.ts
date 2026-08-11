/**
 * One height for every card that can appear in a settings carousel
 * (eBay store, Amazon account, buyer message template, listing settings group).
 *
 * It is a `min-height`, not a `height`: the value is sized to the richest card
 * (the template card's three-line body preview), so the others pad out to match
 * instead of being clipped — an Amazon card showing a verification error still
 * grows rather than hiding the reason the account is broken.
 *
 * Width is NOT set here — every card is `width: 100%`, so it already matches the
 * "add new" QuickActionCard beside it in the same full-width drawer body.
 */
export const CAROUSEL_CARD_MIN_HEIGHT = '13rem';

/**
 * How far a card's trailing "Detay →" arrow is held off the content edge, so its
 * tip lines up with the "add new" `QuickActionCard`'s arrow below it. That card
 * centres an 18px glyph inside a 2.5rem circle sitting on the padding edge, so
 * its glyph is (40 − 18) / 2 = 11px in from that edge; `spacing.sm-md` is
 * exactly 11px. The cards use the same horizontal padding (`spacing.xl`) as the
 * QuickActionCard, so equal padding + equal inset = one vertical line of arrows.
 *
 * It is a margin rather than a fixed-width slot on purpose: a 2.5rem slot would
 * centre the glyph in it and push the "Detay" label an extra 11px away from the
 * arrow it belongs to.
 */
export const CARD_ACTION_ARROW_INSET = 'spacing.sm-md';

/** Icon size for that arrow — same as `QuickActionCard`'s, so the tips match exactly. */
export const CARD_ACTION_ICON_SIZE = 18;
