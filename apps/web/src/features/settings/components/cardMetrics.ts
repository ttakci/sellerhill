/**
 * One height for every card that can appear in a settings carousel
 * (eBay store, Amazon account, buyer message template, listing settings group).
 *
 * It is a `min-height`, not a `height`: the value is sized to the richest card
 * (the template card's three-line body preview), so the others pad out to match
 * instead of being clipped — an Amazon card showing a verification error still
 * grows rather than hiding the reason the account is broken.
 */
export const CAROUSEL_CARD_MIN_HEIGHT = '13rem';
