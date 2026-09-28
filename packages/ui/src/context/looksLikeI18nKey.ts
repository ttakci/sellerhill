/**
 * True when `text` is shaped like a translation key rather than a sentence:
 * dot-separated identifier segments and no whitespace (`billing.errors.x`,
 * `auth.errors.emailNotVerified`, or a namespaced `ebay:ebay.errors.x`).
 *
 * i18next answers a missing key with the key itself, so a popup that renders
 * whatever `t()` returned prints `billing.errors.listingQuotaExhausted` at the
 * seller whenever a namespace is missing or a backend code has no translation.
 * A real message is a sentence, and a sentence always contains a space.
 */
const I18N_KEY_SHAPE = /^(?:[A-Za-z][\w-]*:)?[A-Za-z][\w-]*(?:\.[A-Za-z][\w-]*)+$/;

export const looksLikeI18nKey = (text: string): boolean => I18N_KEY_SHAPE.test(text.trim());
